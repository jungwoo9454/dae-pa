"use client";

import { create } from "zustand";
import { CAT_EMOJI, joinable, relativeWhen, settleStartable } from "./deal";
import { createClient } from "./supabase/client";
import { subscribePg } from "./supabase/realtime";
import { sysText } from "./sys-messages";
import type { GroupBuyRow } from "./db-types";
import type { AuthMode, Deal, DealForm, HistoryItem, Me, Msg, Noti, PageKey, Room } from "./types";

/** 마감 몇 분 전에 알림을 넣을지 (#13) */
const DEADLINE_MS = 30 * 60_000;

/** 같은 공구로 마감 알림을 두 번 넣지 않으려는 표시 — 목록을 불러올 때 지난 것도 채운다 */
const firedDeadlines = new Set<number>();

/** notifications 행 — 문구·이동할 공구는 payload 에 담는다 */
interface NotiRow {
  id: number;
  type: Noti["type"];
  payload: { text?: string; dealId?: number } | null;
  is_read: boolean;
  created_at: string;
}

/** 방에 들어갈 때 불러오는 최근 메시지 수 (#7) */
export const RECENT_LIMIT = 100;

/** chat_rooms 행 */
interface RoomRow {
  id: number;
  type: "lounge" | "group_buy";
  group_buy_id: number | null;
  name: string;
}

/** 방 → msgs 키. 화면·시드가 쓰던 "lounge" / "d{공구id}" 를 그대로 유지한다 */
const roomKey = (r: Room) => (r.type === "lounge" ? "lounge" : "d" + r.dealId);

/**
 * user_id → 닉네임. Realtime INSERT 페이로드에는 조인 결과가 없어서
 * 처음 보는 사람만 한 번 조회하고 여기에 담아 둔다.
 */
const nickCache = new Map<string, string>();

/**
 * messages 행 — 카드 말풍선은 payload.group_buy_id 로 어떤 공구인지 담는다 (#7).
 * 사진 말풍선은 kind 를 그대로 'text' 로 두고 payload.image_url 에 R2 URL 을 담는다 (#15) —
 * 새 kind 를 만들면 messages_own_insert 정책의 kind in ('text','card') 도 같이 고쳐야 한다.
 */
interface MsgRow {
  id: number;
  room_id: number;
  user_id: string | null;
  kind: "text" | "sys" | "card";
  content: string | null;
  payload: { group_buy_id?: number; image_url?: string } | null;
  profiles?: { nickname: string | null } | null;
}

/** messages 행 → 화면용 Msg. 내 메시지면 mine, 남이면 other, user_id 가 null 이면 시스템 */
const toMsg = (r: MsgRow, myId: string | null): Msg => {
  if (r.kind === "sys") return { kind: "sys", text: r.content ?? "", id: r.id };
  if (r.user_id && r.profiles?.nickname) nickCache.set(r.user_id, r.profiles.nickname);
  const who = r.profiles?.nickname ?? "이웃";
  if (r.kind === "card") {
    return { kind: "card", cardOf: Number(r.payload?.group_buy_id ?? 0), who, id: r.id };
  }
  const imageUrl = r.payload?.image_url;
  if (r.user_id && r.user_id === myId) return { kind: "mine", text: r.content ?? "", id: r.id, imageUrl };
  return { kind: "other", who, text: r.content ?? "", id: r.id, imageUrl };
};

/**
 * 내 말풍선을 messages 에 넣고, 돌아온 id 로 화면에 바로 붙인다 (#7).
 * 같은 행이 Realtime 으로 한 번 더 오지만 id 가 같아 중복되지 않는다.
 */
async function insertOwnMsg(
  roomId: number,
  key: string,
  userId: string,
  row: { kind: "text" | "card"; content?: string; payload?: { group_buy_id?: number; image_url?: string } },
  render: (id: number) => Msg,
) {
  const { data, error } = await createClient()
    .from("messages")
    .insert({ room_id: roomId, user_id: userId, ...row })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[messages insert]", error);
    return;
  }
  useStore.setState((st) => {
    const list = st.msgs[key] ?? [];
    if (list.some((m) => m.id === data.id)) return {};
    return { msgs: { ...st.msgs, [key]: [...list, render(data.id)] } };
  });
}

/**
 * profiles 본인 행 갱신 (#20) — RLS·컬럼 GRANT 가 본인 행의 허용 컬럼만 열어준다.
 *
 * ⚠️ 반드시 await 한다. supabase-js 쿼리 빌더는 thenable 이라 .then() 이 불릴 때 비로소
 * fetch 한다 — 예전처럼 `void createClient()...update()` 로 두면 HTTP 요청이 아예 안 나가고
 * 낙관적 로컬 상태만 바뀌어서, 새로고침 전까지 저장된 것처럼 보인다.
 */
async function patchProfile(uid: string, patch: Record<string, unknown>) {
  const { error } = await createClient().from("profiles").update(patch).eq("id", uid);
  if (error) alert(error.message);
}

/** Me 필드 → profiles 컬럼 */
const PROFILE_COL: Record<string, string> = {
  nickname: "nickname",
  avatarUrl: "avatar_url",
  dong: "dong",
  bankAccount: "bank_account",
  transferApp: "transfer_app",
};

const toNoti = (r: NotiRow): Noti => ({
  id: r.id,
  type: r.type,
  text: r.payload?.text ?? "",
  dealId: r.payload?.dealId ?? null,
  isRead: r.is_read,
  createdAt: Date.parse(r.created_at),
});

/**
 * 채팅은 DB(messages)에서 읽어온다 (#7). 아래 시드는 Supabase 가 아직 붙지 않은
 * 로컬 개발용 폴백이며, 로그인하면 initChat 이 실제 방/메시지로 덮어쓴다.
 */
const seedMsgs: Record<string, Msg[]> = {
  lounge: [
    { kind: "sys", text: "🏘 역삼동 이웃들이 함께하고 있어요" },
    { kind: "other", who: "민지", text: "치킨 같이 시키실 분? 배달비 아까워요 😂" },
  ],
  d1: [
    { kind: "sys", text: "공구방이 열렸어요 · 목표 5명" },
    { kind: "other", who: "파밍맘", text: "대파 좋아하는 분들 환영해요 🌿 한 단씩 나눠 가져요" },
  ],
  d2: [
    { kind: "sys", text: "목표 달성! 정산이 시작돼요 🎉" },
    { kind: "other", who: "준호", text: "영수증 올렸어요~ 각자 메뉴 금액 확인 부탁!" },
    { kind: "sys", text: "🧾 영수증 인증 완료 · 총 54,500원 · 금액 잠금" },
  ],
  d3: [
    { kind: "other", who: "수현", text: "작년에 여기 감귤 진짜 달았어요" },
    { kind: "mine", text: "3명만 더 오면 마감!" },
  ],
  d4: [{ kind: "other", who: "커피덕후", text: "마감 40분 전이에요! 원두 필요하신 분 서두르세요" }],
  d5: [{ kind: "sys", text: "공구방이 열렸어요 · 목표 2명" }],
};

const EMPTY_FORM: DealForm = {
  cat: "식료품",
  title: "",
  description: "",
  total: "",
  goal: "",
  mins: "",
  place: "",
  store_link: "",
  imageUrl: "",
  minOrderAmount: "",
  deliveryFee: "",
};

interface AuthForm {
  nick: string;
  email: string;
  pw: string;
}

interface StoreState {
  page: PageKey;
  sel: number | null;
  authMode: AuthMode;
  auth: AuthForm;
  me: Me | null;
  /** 최초 세션 복원이 끝났는지 — 끝나기 전엔 로그인 화면이 깜빡이지 않게 아무것도 안 그린다 */
  authReady: boolean;
  authBusy: boolean;
  authError: string;
  dongOk: boolean;
  /** 사용자가 적은 동네 이름 — 확정 시 profiles.dong 으로 간다 (#83) */
  dongValue: string;
  room: string;
  chatInput: string;
  search: string;
  mySearch: string;
  filter: string;
  statusFilter: string;
  myDealsOnly: boolean;
  profileOpen: boolean;
  notiOpen: boolean;
  notis: Noti[];
  /** 로그인 후 채팅이 DB에 붙었는지 — 붙기 전엔 시드가 보인다 */
  chatReady: boolean;
  topupOpen: boolean;
  topupAmt: number;
  /** 토스 결제창에서 돌아온 결과 — 대파페이 화면 상단 띠로만 쓴다 (#14) */
  topupResult: "ok" | "fail" | null;
  settleTotalInput: string;
  /** 첨부한 영수증 사진의 R2 공개 URL. null 이면 과반 동의 흐름으로 간다 (#15) */
  settleReceiptUrl: string | null;
  withdrawOpen: boolean;
  withdrawAmt: number;
  balance: number;
  autoPay: boolean;
  n1: boolean;
  n2: boolean;
  form: DealForm;
  deals: Deal[];
  msgs: Record<string, Msg[]>;
  history: HistoryItem[];

  setAuth: (patch: Partial<AuthForm>) => void;
  switchAuthMode: () => void;
  /** bfcache 복원 등으로 남은 authBusy 를 푼다 — 안 풀면 로그인 버튼이 죽는다 (#82) */
  resetAuthBusy: () => void;
  setDongValue: (v: string) => void;
  /** 동네 확정 — 가입 전이면 dongOk 만 켜고, 로그인 상태면 profiles.dong 까지 저장한다 (#83) */
  confirmDong: () => void;
  /** 세션 구독 시작. 정리 함수를 돌려준다 */
  initAuth: () => () => void;
  signIn: () => Promise<void>;
  signUp: () => Promise<void>;
  signInWithOAuth: (provider: "google" | "github") => Promise<void>;
  logout: () => Promise<void>;
  go: (page: PageKey) => void;
  openDeal: (id: number) => void;
  openSettle: (id: number) => void;
  goRoom: (roomId: string) => void;
  toggleProfile: () => void;
  /** 알림 목록 로드 + Realtime 구독 시작. 정리 함수를 돌려준다 */
  /** 내가 볼 수 있는 채팅방 (라운지 + 참여 중인 공구방) — DB에서 로드 (#7) */
  rooms: Room[];
  /** 방 목록 로드 + messages Realtime 구독 시작. 정리 함수를 돌려준다 */
  initChat: (uid: string) => () => void;
  initNotis: (uid: string) => () => void;
  /** 열 때 미읽음을 전부 읽음 처리한다 */
  toggleNoti: () => Promise<void>;
  /** 참여한 공구의 마감 30분 전 알림을 넣는다 — 주기 호출 */
  notifyDeadlines: () => Promise<void>;
  setChatInput: (v: string) => void;
  setSearch: (v: string) => void;
  setMySearch: (v: string) => void;
  setFilter: (v: string) => void;
  setStatusFilter: (v: string) => void;
  setMyDealsOnly: (v: boolean) => void;
  setForm: (patch: Partial<DealForm>) => void;
  /** 공구 참여 (#5) — join_group_buy RPC 호출. 서버가 정원/마감/중복을 원자적으로 거부한다 */
  join: (id: number) => Promise<void>;
  /** 참여 취소·공구 나가기 (#94) — leave_group_buy RPC. 모집중일 때만 서버가 허용 */
  leave: (id: number) => Promise<string | null>;
  shareDeal: (dealId: number, roomId: string) => void;
  /** 주최자 개별 금액 조정 (#16) — adjust_participation_amount RPC. 본인 몫은 나머지로 자동 계산 */
  adjustParticipationAmount: (participationId: number, newAmount: number) => Promise<void>;
  /** 총 금액 변경 (#12) — change_total_amount RPC 호출. 주최자+모집중일 때만 서버가 허용 */
  changeTotalAmount: (dealId: number, newTotal: number) => Promise<void>;
  sendMsg: () => void;
  /** 사진 말풍선 — kind 는 'text' 그대로, payload.image_url 에 R2 URL 을 담는다 (#15) */
  sendImageMsg: (imageUrl: string) => void;
  /** 대파페이 결제 (#18) — pay_with_wallet RPC. 잔액 검증→차감→입금 처리를 원자적으로 */
  payNow: (participationId: number) => Promise<void>;
  /** 계좌·토스 셀프 체크 (#17) — confirm_self_paid RPC */
  confirmSelfPaid: (participationId: number, method: "account" | "toss") => Promise<void>;
  /** 미입금자 리마인드 (#17) — remind_unpaid RPC, 주최자만 호출 가능 */
  remindUnpaid: (dealId: number) => Promise<void>;
  /**
   * 정원 미달 마감 → 정산 시작 (#131) — start_settlement RPC. 주최자 + 마감 + 모집중일 때만
   * 서버가 허용한다. 성공하면 정산 화면까지 열고, 실패하면 사유 문구를 돌려준다.
   */
  startSettlement: (dealId: number) => Promise<string | null>;
  /** 주최자 취소 (#29) — 모집중·정산중이면 canceled 로 보낸다. 실패하면 사유 문구를 돌려준다 */
  cancelDeal: (dealId: number) => Promise<string | null>;
  /** 주최자 삭제 — 모집중이면 DB에서 삭제한다. 실패하면 사유 문구를 돌려준다 */
  deleteDeal: (dealId: number) => Promise<string | null>;
  toggleTopup: () => void;
  setTopupAmt: (v: number) => void;
  doTopup: () => Promise<void>;
  setTopupResult: (v: "ok" | "fail" | null) => void;
  setSettleTotalInput: (v: string) => void;
  setSettleReceiptUrl: (v: string | null) => void;
  /** 정산 시작/총액 확정 (#15) — confirm_settlement RPC. 영수증 있으면 즉시 확정, 없으면 과반 동의 대기 */
  /**
   * overrides: 확정 전 미리보기에서 주최자가 손수 조정한 참여자별 금액 (participation id → 금액).
   * 영수증 첨부로 즉시 확정될 때만 반영된다 — 과반 동의 대기로 빠지면 그 시점엔 아직
   * apply_settlement_split 이 안 돌아서 amount_due 가 비어있어 조정할 기준값이 없다.
   */
  confirmSettlement: (dealId: number, overrides?: Record<number, number>) => Promise<void>;
  /** 영수증 없을 때 동의 투표 (#15) — 본인 투표 insert 후 finalize_settlement_vote RPC 로 과반 판정 */
  voteSettlement: (dealId: number, agree: boolean) => Promise<void>;
  toggleWithdraw: () => void;
  setWithdrawAmt: (v: number) => void;
  doWithdraw: () => Promise<void>;
  toggleAutoPay: () => void;
  toggleN1: () => void;
  toggleN2: () => void;
  /** 닉네임·아바타·계좌·송금 앱 저장 (#20, #15) — 화면은 즉시 바꾸고 profiles 에 반영한다 */
  saveProfile: (
    patch: Partial<Pick<Me, "nickname" | "avatarUrl" | "bankAccount" | "transferApp" | "dong">>,
  ) => void;
  submitNew: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  page: "login",
  sel: null,
  authMode: "login",
  auth: { nick: "", email: "", pw: "" },
  me: null,
  authReady: false,
  authBusy: false,
  authError: "",
  dongOk: false,
  dongValue: "",
  room: "lounge",
  chatInput: "",
  search: "",
  mySearch: "",
  filter: "전체",
  statusFilter: "전체",
  myDealsOnly: false,
  profileOpen: false,
  notiOpen: false,
  notis: [],
  chatReady: false,
  rooms: [],
  topupOpen: false,
  topupAmt: 10000,
  topupResult: null,
  settleTotalInput: "",
  settleReceiptUrl: null,
  withdrawOpen: false,
  withdrawAmt: 10000,
  balance: 0, // 로그인 시 initAuth 가 실제 wallets.balance 로 채운다
  autoPay: true,
  n1: true,
  n2: true,
  form: EMPTY_FORM,
  // 초기값은 빈 배열 — home.tsx 마운트 시 fetchDeals()로 Supabase에서 채운다 (Task 3, #4)
  deals: [],
  msgs: seedMsgs,
  history: [], // 로그인 시 initAuth 가 실제 wallet_transactions 로 채운다

  setAuth: (patch) => set((st) => ({ auth: { ...st.auth, ...patch }, authError: "" })),
  switchAuthMode: () =>
    set((st) => ({ authMode: st.authMode === "signup" ? "login" : "signup", authError: "" })),
  resetAuthBusy: () => set({ authBusy: false }),
  setDongValue: (v) => set({ dongValue: v }),

  confirmDong: () => {
    const dong = get().dongValue.trim();
    if (!dong) return;
    set({ dongOk: true, dongValue: dong });
    // 이미 로그인한 사용자(소셜 가입 등)는 바로 profiles 에 저장한다. 가입 폼에서는
    // 아직 계정이 없으니 signUp 이 raw_user_meta_data 로 넘긴다
    if (get().me) get().saveProfile({ dong });
  },

  initAuth: () => {
    const sb = createClient();
    let unsubWallet: (() => void) | null = null;
    // onAuthStateChange 콜백은 setTimeout 으로 이어진다. 그 사이 로그아웃/재로그인/정리가 일어나면
    // 뒤늦게 도착한 예전 세션의 응답으로 남의 잔액을 쓰거나 채널을 열면 안 된다 (#107)
    let gen = 0;
    // 인증 콜백이 실패하면 /?auth_error=email|oauth 로 돌아온다
    const authErrorKind = new URLSearchParams(window.location.search).get("auth_error");
    if (authErrorKind) {
      set({
        authError:
          authErrorKind === "email"
            ? "이메일 인증 링크가 만료됐거나 이미 사용됐어요. 가입한 브라우저에서 다시 열어주세요"
            : "소셜 로그인에 실패했어요. 다시 시도해주세요",
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      const myGen = ++gen;
      const uid = session?.user.id;
      // 가입 수단 표시용 (#81) — profiles 에는 없고 auth user 메타에만 있다
      const provider = session?.user.app_metadata?.provider ?? null;
      if (!uid) {
        // 다음 사람이 남의 알림·대화·설정을 보지 않게 목록·중복 표시·토글을 비운다
        firedDeadlines.clear();
        nickCache.clear();
        unsubWallet?.();
        unsubWallet = null;
        set((st) => ({
          me: null,
          notis: [],
          rooms: [],
          chatReady: false,
          msgs: seedMsgs,
          n1: true,
          n2: true,
          page: "login",
          authMode: "login",
          profileOpen: false,
          notiOpen: false,
          authReady: true,
          balance: 0,
          history: [],
          auth: { ...st.auth, pw: "" },
        }));
        return;
      }
      set((st) => ({
        page: st.page === "login" ? "home" : st.page,
        authReady: true,
        authBusy: false,
        authError: "",
        auth: { ...st.auth, pw: "" },
      }));
      // 이 콜백 안에서 supabase 를 다시 호출하면 교착에 빠진다 (supabase-js 알려진 제약) — 다음 틱으로 미룬다
      setTimeout(async () => {
        const { data: p, error } = await sb
          .from("profiles")
          .select(
            "nickname, avatar_url, dong, bank_account, transfer_app, notify_deadline, notify_payment, auto_pay",
          )
          .eq("id", uid)
          .single();
        // 행이 없다(PGRST116) = 삭제된 사용자의 죽은 세션 — 로그인 화면으로 내린다 (#35).
        // 네트워크·서버 오류는 일시적일 수 있어 폴백으로 넘어간다
        if (error?.code === "PGRST116") {
          await sb.auth.signOut();
          return;
        }
        if (myGen !== gen) return;
        set({
          me: {
            id: uid,
            nickname: p?.nickname ?? "파티원",
            avatarUrl: p?.avatar_url ?? null,
            dong: p?.dong ?? null,
            provider,
            bankAccount: p?.bank_account ?? null,
            transferApp: p?.transfer_app ?? null,
          },
          n1: p?.notify_deadline ?? true,
          n2: p?.notify_payment ?? true,
          autoPay: p?.auto_pay ?? true,
        });

        // 대파페이 잔액·이용 내역 (#14) — 최초 조회 후 Realtime 구독으로 계속 최신 유지
        const { data: w } = await sb.from("wallets").select("balance").eq("user_id", uid).single();
        const { data: txs } = await sb
          .from("wallet_transactions")
          .select("kind, amount, title, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(30);
        if (myGen !== gen) return;
        set({
          balance: w?.balance ?? 0,
          history: (txs ?? []).map((t) => ({
            kind: t.kind,
            title: t.title,
            when: relativeWhen(t.created_at),
            amt: t.amount,
          })),
        });

        unsubWallet?.();
        unsubWallet = subscribePg("wallet:" + uid, [
          {
            event: "UPDATE",
            table: "wallets",
            filter: `user_id=eq.${uid}`,
            handler: (payload) => set({ balance: (payload.new as { balance: number }).balance }),
          },
          {
            event: "INSERT",
            table: "wallet_transactions",
            filter: `user_id=eq.${uid}`,
            handler: (payload) => {
              const t = payload.new as { kind: string; amount: number; title: string; created_at: string };
              set((st) => ({
                history: [
                  { kind: t.kind, title: t.title, when: relativeWhen(t.created_at), amt: t.amount },
                  ...st.history,
                ],
              }));
            },
          },
        ]);
      }, 0);
    });
    return () => {
      gen++;
      data.subscription.unsubscribe(); // Auth 리스너 — 채널이 아니라 정상
      unsubWallet?.();
    };
  },

  signIn: async () => {
    const { email, pw } = get().auth;
    if (!email || !pw || get().authBusy) return;
    set({ authBusy: true, authError: "" });
    const { error } = await createClient().auth.signInWithPassword({ email, password: pw });
    // 성공하면 onAuthStateChange 가 화면을 넘긴다
    if (error) {
      set({
        authBusy: false,
        authError: error.message.includes("Invalid login")
          ? "이메일 또는 비밀번호를 확인해주세요"
          : error.message,
      });
    }
  },

  signUp: async () => {
    const { nick, email, pw } = get().auth;
    if (!nick || !email || !pw || get().authBusy) return;
    set({ authBusy: true, authError: "" });
    const { data, error } = await createClient().auth.signUp({
      email,
      password: pw,
      options: {
        // 닉네임·동네는 raw_user_meta_data 로 들어가 handle_new_user 트리거가 profiles 에 넣는다
        data: { nickname: nick, dong: get().dongOk ? get().dongValue : null },
        // 없으면 확인 링크가 항상 Site URL(프로덕션)로 가서 로컬 테스트가 막힌다
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) {
      set({ authBusy: false, authError: error.message });
      return;
    }
    // 대시보드에서 Confirm email 이 켜져 있으면 세션 없이 끝난다
    if (!data.session) {
      // 이미 가입된 이메일이어도 Supabase 는 사용자 열거 방지로 에러를 안 준다.
      // 중복이면 가짜 user 의 identities 가 빈 배열로 온다 (#119)
      const dup = data.user?.identities?.length === 0;
      set({
        authBusy: false,
        authError: dup
          ? "이미 가입된 이메일이에요. 로그인해주세요"
          : "메일로 보낸 인증 링크를 확인한 뒤 로그인해주세요 — 링크는 가입한 이 브라우저에서 열어야 해요",
      });
    }
  },

  signInWithOAuth: async (provider) => {
    if (get().authBusy) return;
    set({ authBusy: true, authError: "" });
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) set({ authBusy: false, authError: error.message });
  },

  logout: async () => {
    await createClient().auth.signOut();
    // 화면 정리는 onAuthStateChange 가 한다
  },

  go: (page) => set({ page, profileOpen: false, notiOpen: false }),
  openDeal: (id) => set({ page: "detail", sel: id, profileOpen: false, notiOpen: false }),
  // 총액 입력과 영수증 첨부는 "이 공구" 의 것이다 — 초기화하지 않으면 A 공구에서 올린
  // 영수증이 B 공구 확정에 그대로 붙고, receipt_url 이 있으면 서버가 투표 없이 즉시
  // 확정하므로 과반 동의 절차까지 건너뛴다.
  openSettle: (id) =>
    set({
      page: "settle",
      sel: id,
      profileOpen: false,
      notiOpen: false,
      settleTotalInput: "",
      settleReceiptUrl: null,
    }),
  goRoom: (roomId) => set({ page: "chat", room: roomId, profileOpen: false, notiOpen: false }),
  toggleProfile: () => set((st) => ({ profileOpen: !st.profileOpen, notiOpen: false })),

  initChat: (uid) => {
    const sb = createClient();
    // 정리된 뒤 늦게 도착한 응답이 화면을 되돌리지 않게 막는다
    let alive = true;
    // messages INSERT 구독은 방 필터가 없어서(전체 방 대상) 내 방이 아닌 메시지도 다 들어온다.
    // 한 번 "내 방 아님"이 확인된 room_id는 캐시해서 매번 재조회하지 않는다 (onMsg 참고).
    const notMineRooms = new Set<number>();

    /** 내가 속한 방(라운지 + 참여 중인 공구방)과 각 방의 최근 메시지를 다시 읽는다 */
    const loadRooms = async () => {
      const [{ data: parts }, { data: roomRows }] = await Promise.all([
        sb.from("participations").select("group_buy_id").eq("user_id", uid),
        sb.from("chat_rooms").select("id, type, group_buy_id, name").order("id"),
      ]);
      const joined = new Set((parts ?? []).map((p) => Number(p.group_buy_id)));
      const rooms: Room[] = ((roomRows ?? []) as RoomRow[])
        .filter((r) => r.type === "lounge" || (r.group_buy_id !== null && joined.has(r.group_buy_id)))
        .map((r) => ({ id: r.id, type: r.type, name: r.name, dealId: r.group_buy_id }));
      if (!alive || !rooms.length) return;

      // 방마다 최근 RECENT_LIMIT 개씩 — 한 번에 몰아 받으면 대화가 많은 방이 나머지를 굶긴다
      const lists = await Promise.all(
        rooms.map(async (r) => {
          const { data } = await sb
            .from("messages")
            .select("id, room_id, user_id, kind, content, payload, profiles(nickname)")
            .eq("room_id", r.id)
            .order("id", { ascending: false })
            .limit(RECENT_LIMIT);
          return ((data ?? []) as unknown as MsgRow[]).reverse();
        }),
      );
      if (!alive) return;

      const loaded: Record<string, Msg[]> = {};
      rooms.forEach((r, i) => {
        loaded[roomKey(r)] = lists[i].map((m) => toMsg(m, uid));
      });
      set((st) => {
        // 불러오는 동안 Realtime 으로 먼저 들어온 메시지는 살린다 (시드는 id 가 없어 여기서 사라진다)
        const msgs: Record<string, Msg[]> = { ...loaded };
        for (const [key, list] of Object.entries(msgs)) {
          const seen = new Set(list.map((m) => m.id));
          const late = (st.msgs[key] ?? []).filter((m) => m.id != null && !seen.has(m.id));
          if (late.length) msgs[key] = [...list, ...late];
        }
        return { rooms, chatReady: true, msgs };
      });
    };

    /** Realtime 으로 들어온 메시지 한 건을 해당 방에 붙인다 */
    const onMsg = async (row: MsgRow) => {
      if (!get().rooms.some((r) => r.id === row.room_id)) {
        // messages INSERT는 room_id만 주고 type/group_buy_id를 안 줘서, 이 방이 내 방인지
        // 여기서 바로 판단할 방법이 없다. 방금 참여해서 rooms 갱신이 아직 안 끝났을 수 있으니
        // loadRooms()로 한 번 더 확인한다 — 이미 커밋된 메시지라 room이 진짜 내 것이면
        // loadRooms()가 최근 메시지를 DB에서 다시 읽어올 때 이 메시지도 같이 따라온다.
        if (notMineRooms.has(row.room_id)) return;
        await loadRooms();
        if (!get().rooms.some((r) => r.id === row.room_id)) notMineRooms.add(row.room_id);
        return;
      }
      if (row.user_id && row.user_id !== uid && !nickCache.has(row.user_id)) {
        const { data } = await sb.from("profiles").select("nickname").eq("id", row.user_id).single();
        if (data?.nickname) nickCache.set(row.user_id, data.nickname);
      }
      const target = get().rooms.find((r) => r.id === row.room_id);
      if (!alive || !target) return;
      const key = roomKey(target);
      const nickname = row.user_id ? (nickCache.get(row.user_id) ?? null) : null;
      const msg = toMsg({ ...row, profiles: { nickname } }, uid);
      set((st) => {
        const list = st.msgs[key] ?? [];
        if (list.some((m) => m.id === row.id)) return {}; // 내가 보낸 뒤 바로 붙인 것과 중복
        return { msgs: { ...st.msgs, [key]: [...list, msg] } };
      });
    };

    void loadRooms();

    // 토픽에 uid 를 넣는다 — 다른 사람이 로그인하면 필터가 달라야 하므로 채널도 달라야 한다
    const unsub = subscribePg(`chat:${uid}`, [
      {
        event: "INSERT",
        table: "messages",
        handler: ({ new: row }) => void onMsg(row as MsgRow),
      },
      // 공구를 만들거나 참여하면 방이 하나 늘어난다 — 목록을 다시 읽는다
      {
        event: "INSERT",
        table: "participations",
        filter: `user_id=eq.${uid}`,
        handler: () => void loadRooms(),
      },
      // 공구에서 나가면(leave_group_buy, #94) 방이 하나 빠진다 — 마찬가지로 다시 읽는다.
      // DELETE 페이로드에 user_id 가 실리려면 participations 에 replica identity full 이 필요하다.
      {
        event: "DELETE",
        table: "participations",
        filter: `user_id=eq.${uid}`,
        handler: () => void loadRooms(),
      },
    ]);

    return () => {
      alive = false;
      unsub();
    };
  },

  initNotis: (uid) => {
    const sb = createClient();
    void (async () => {
      // RLS 가 본인 행만 내주므로 user_id 조건은 따로 걸지 않는다
      const { data } = await sb
        .from("notifications")
        .select("id, type, payload, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      const rows = (data ?? []) as NotiRow[];
      for (const r of rows) {
        if (r.type === "deadline_soon" && r.payload?.dealId) firedDeadlines.add(r.payload.dealId);
      }
      // 응답을 기다리는 동안 Realtime 으로 먼저 들어온 알림이 있을 수 있다 — 덮지 말고 합친다
      set((st) => {
        const loaded = rows.map(toNoti);
        const ids = new Set(loaded.map((n) => n.id));
        return { notis: [...st.notis.filter((n) => !ids.has(n.id)), ...loaded] };
      });
    })();

    return subscribePg(`notis:${uid}`, [
      {
        event: "INSERT",
        table: "notifications",
        filter: `user_id=eq.${uid}`,
        handler: ({ new: row }) =>
          set((st) => {
            const n = toNoti(row as NotiRow);
            return st.notis.some((x) => x.id === n.id) ? {} : { notis: [n, ...st.notis] };
          }),
      },
    ]);
  },

  // supabase-js 쿼리 빌더는 await 해야 요청이 나간다 — 결과를 안 봐도 async 로 둔다
  toggleNoti: async () => {
    const opening = !get().notiOpen;
    set({ notiOpen: opening, profileOpen: false });
    if (!opening) return;
    // 여는 순간 미읽음을 다 읽은 것으로 본다
    const unreadIds = get()
      .notis.filter((n) => !n.isRead)
      .map((n) => n.id);
    if (!unreadIds.length) return;
    set((st) => ({ notis: st.notis.map((n) => (n.isRead ? n : { ...n, isRead: true })) }));
    await createClient().from("notifications").update({ is_read: true }).in("id", unreadIds);
  },

  notifyDeadlines: async () => {
    const { me, n1, deals } = get();
    if (!me || !n1) return;
    const now = Date.now();
    const due = deals.filter(
      (d) =>
        d.me &&
        d.status === "recruiting" &&
        d.end - now > 0 &&
        d.end - now <= DEADLINE_MS &&
        !firedDeadlines.has(d.id),
    );
    if (!due.length) return;
    due.forEach((d) => firedDeadlines.add(d.id));
    // 목록에 넣는 건 Realtime INSERT 구독이 한다
    await createClient()
      .from("notifications")
      .insert(
        due.map((d) => ({
          user_id: me.id,
          type: "deadline_soon",
          payload: { text: `${d.title} · 마감 30분 전이에요`, dealId: d.id },
        })),
      );
  },
  setChatInput: (v) => set({ chatInput: v }),
  setSearch: (v) => set({ search: v }),
  setMySearch: (v) => set({ mySearch: v }),
  setFilter: (v) => set({ filter: v }),
  setStatusFilter: (v) => set({ statusFilter: v }),
  setMyDealsOnly: (v) => set({ myDealsOnly: v }),
  setForm: (patch) => set((st) => ({ form: { ...st.form, ...patch } })),

  // 정원 검사 + joined 증가 + 정원 도달 시 settling 전환을 서버가 한 트랜잭션으로
  // 원자적으로 처리한다(supabase/schema.sql join_group_buy). 클라이언트에서 joinable()로
  // 먼저 걸러내는 건 뻔히 안 되는 상태에서 괜히 서버까지 왕복하지 않기 위한 사전 체크일
  // 뿐이고, 실제 방어(동시 클릭 레이스 차단)는 서버 쪽 UPDATE ... WHERE ... RETURNING 이 한다.
  // 시스템 메시지(참여·목표 달성)와 알림은 RPC 안에서 post_system_message/notifications로
  // 직접 기록되므로, 여기서는 성공 후 deals의 joined/status/me만 반영하면 된다 —
  // 채팅 메시지는 initChat의 Realtime 구독이, 홈 목록은 useRealtimeDeals가 알아서 갱신한다.
  join: async (id) => {
    const target = get().deals.find((d) => d.id === id);
    if (!target || !joinable(target, Date.now())) return;

    const { data, error } = await createClient().rpc("join_group_buy", { p_group_buy_id: id });
    if (error) {
      alert(error.message);
      return;
    }
    const g = data as GroupBuyRow;
    set((st) => ({
      deals: st.deals.map((d) =>
        d.id === id ? { ...d, joined: g.joined, status: g.status, me: true } : d,
      ),
    }));
  },

  // 모집중일 때만 서버가 허용한다(leave_group_buy). 시스템 메시지·주최자 알림은 RPC 안에서
  // 처리되므로, 여기서는 성공 후 deals의 joined/me만 낙관적으로 반영한다 —
  // useRealtimeDeals 구독이 실제 값으로 다시 맞춰준다.
  leave: async (id) => {
    const { error } = await createClient().rpc("leave_group_buy", { p_group_buy_id: id });
    // RPC 의 raise exception 문구가 그대로 온다 — 그걸 화면에 보여준다 (cancelDeal 과 동일 패턴)
    if (error) return error.message;
    set((st) => ({
      deals: st.deals.map((d) => (d.id === id ? { ...d, joined: d.joined - 1, me: false } : d)),
    }));
    return null;
  },

  adjustParticipationAmount: async (participationId, newAmount) => {
    const safeAmt = Math.max(0, Math.floor(newAmount) || 0);
    const { error } = await createClient().rpc("adjust_participation_amount", {
      p_participation_id: participationId,
      p_new_amount: safeAmt,
    });
    if (error) alert(error.message);
    // useRealtimeParticipations 구독이 참여자별 amount_due 변경을 반영한다
  },

  // 서버가 주최자+모집중 여부를 재확인하고(RLS와 별개로 RPC 안에서 명시 체크), 통과하면
  // "알림 + 시스템 메시지"까지 한 트랜잭션 안에서 같이 처리한다(CLAUDE.md 규칙 3의 3종 세트).
  // 1인당 금액 재계산은 lib/deal.ts의 perAmount가 (deal.total+deliveryFee)/deal.joined로 매번
  // 다시 계산하므로 여기서 따로 할 일이 없다 — total만 반영하면 화면은 자동으로 맞는다.
  changeTotalAmount: async (dealId, newTotal) => {
    if (newTotal <= 0) return;
    const { data, error } = await createClient().rpc("change_total_amount", {
      p_group_buy_id: dealId,
      p_new_total: newTotal,
    });
    if (error) {
      alert(error.message);
      return;
    }
    const g = data as GroupBuyRow;
    set((st) => ({
      deals: st.deals.map((d) => (d.id === dealId ? { ...d, total: g.total_amount } : d)),
    }));
  },

  /** 공구 카드를 채팅방에 말풍선으로 공유하고 그 방으로 이동 (#10) */
  shareDeal: (dealId, roomId) => {
    const st = get();
    if (!st.deals.some((d) => d.id === dealId)) return;
    set({ page: "chat", room: roomId, profileOpen: false });

    const target = st.rooms.find((r) => roomKey(r) === roomId);
    const nick = st.me?.nickname ?? "나";
    if (!target || !st.me) {
      // DB 연동 전(로컬 시드)에는 화면에만 남긴다
      set((s) => ({
        msgs: { ...s.msgs, [roomId]: [...(s.msgs[roomId] ?? []), { kind: "card", cardOf: dealId, who: nick }] },
      }));
      return;
    }
    void insertOwnMsg(
      target.id,
      roomId,
      st.me.id,
      { kind: "card", payload: { group_buy_id: dealId } },
      (id) => ({ kind: "card", cardOf: dealId, who: nick, id }),
    );
  },

  sendMsg: () => {
    const st = get();
    const text = st.chatInput.trim();
    if (!text) return;
    set({ chatInput: "" });

    const target = st.rooms.find((r) => roomKey(r) === st.room);
    if (!target || !st.me) {
      set((s) => ({ msgs: { ...s.msgs, [st.room]: [...(s.msgs[st.room] ?? []), { kind: "mine", text }] } }));
      return;
    }
    void insertOwnMsg(target.id, st.room, st.me.id, { kind: "text", content: text }, (id) => ({
      kind: "mine",
      text,
      id,
    }));
  },

  sendImageMsg: (imageUrl) => {
    const st = get();
    const target = st.rooms.find((r) => roomKey(r) === st.room);
    if (!target || !st.me) {
      // 사진은 이미 올라간 뒤라 여기서 조용히 사라지면 사용자는 아무 일도 안 일어난 걸로 본다
      alert("채팅방을 아직 불러오지 못했어요. 잠시 후 다시 보내주세요.");
      return;
    }
    void insertOwnMsg(
      target.id,
      st.room,
      st.me.id,
      { kind: "text", content: "", payload: { image_url: imageUrl } },
      (id) => ({ kind: "mine", text: "", imageUrl, id }),
    );
  },

  // 잔액 검증 → 차감 → is_paid → wallet_transactions 기록을 pay_with_wallet RPC 가 한
  // 트랜잭션으로 원자 처리한다. 성공하면 participations/wallets Realtime 구독이 화면을 갱신한다.
  payNow: async (participationId) => {
    const { error } = await createClient().rpc("pay_with_wallet", { p_participation_id: participationId });
    if (error) alert(error.message);
  },

  // 대파페이가 아니라서 잔액 이동은 없다 — is_paid 만 서버에서 체크한다.
  confirmSelfPaid: async (participationId, method) => {
    const { error } = await createClient().rpc("confirm_self_paid", {
      p_participation_id: participationId,
      p_method: method,
    });
    if (error) alert(error.message);
  },

  remindUnpaid: async (dealId) => {
    const { error } = await createClient().rpc("remind_unpaid", { p_group_buy_id: dealId });
    if (error) alert(error.message);
  },

  // 마감됐는데 정원을 못 채운 공구를 모인 인원 그대로 정산에 넣는다 (#131).
  // group_buys.status 는 클라이언트가 못 쓰므로 서버 RPC 가 전이·시스템 메시지·알림을 다 한다 —
  // 여기서는 성공 후 status 만 낙관적으로 반영하고 정산 화면을 연다 (useRealtimeDeals 가 재확인).
  startSettlement: async (dealId) => {
    const deal = get().deals.find((d) => d.id === dealId);
    if (!deal || !settleStartable(deal, Date.now())) return "지금은 정산을 시작할 수 없어요";
    const { error } = await createClient().rpc("start_settlement", { p_group_buy_id: dealId });
    // RPC 의 raise exception 문구가 그대로 온다 — 그걸 화면에 보여준다 (cancelDeal 과 동일 패턴)
    if (error) return error.message;
    set((st) => ({
      deals: st.deals.map((d) => (d.id === dealId ? { ...d, status: "settling" as const } : d)),
    }));
    get().openSettle(dealId);
    return null;
  },

  // 시스템 메시지·참여자 알림은 서버 RPC 가 넣는다 (채팅은 Realtime 으로 따라온다).
  // 목록은 홈에서 fetchDeals() 로 다시 읽고 useRealtimeDeals 가 group_buys UPDATE 도
  // 받으므로, 성공했을 때만 화면 상태를 바꾼다 (홈 밖에서 취소한 경우를 위해 남겨둔다).
  cancelDeal: async (dealId) => {
    const deal = get().deals.find((d) => d.id === dealId);
    if (!deal || !deal.mine) return "주최자만 취소할 수 있어요";
    if (deal.status !== "recruiting" && deal.status !== "settling") return "이미 마감된 공구예요";
    const { error } = await createClient().rpc("cancel_group_buy", { p_group_buy_id: dealId });
    // RPC 의 raise exception 문구가 그대로 온다 — 그걸 화면에 보여준다
    if (error) return error.message;
    set((st) => ({
      deals: st.deals.map((d) => (d.id === dealId ? { ...d, status: "canceled" as const } : d)),
    }));
    return null;
  },

  deleteDeal: async (dealId) => {
    const deal = get().deals.find((d) => d.id === dealId);
    if (!deal || !deal.mine) return "주최자만 삭제할 수 있어요";
    if (deal.status !== "recruiting") return "모집중인 공구만 삭제할 수 있어요";
    const { error } = await createClient().rpc("delete_group_buy", { p_group_buy_id: dealId });
    if (error) return error.message;
    set((st) => ({
      deals: st.deals.filter((d) => d.id !== dealId),
    }));
    return null;
  },

  toggleTopup: () => set((st) => ({ topupOpen: !st.topupOpen })),
  setTopupAmt: (v) => set({ topupAmt: v }),
  // 토스페이먼츠 테스트 결제창을 띄운다 (#14). 여기서는 결제 "인증"만 끝나고,
  // 실제 승인과 topup_wallet 호출은 successUrl 인 /api/payments/confirm 이 한다.
  // 잔액·내역은 wallets/wallet_transactions Realtime 구독이 알아서 따라온다.
  doTopup: async () => {
    const amt = get().topupAmt;
    if (amt <= 0) return;
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      console.error("충전 실패: NEXT_PUBLIC_TOSS_CLIENT_KEY 가 없다");
      return;
    }
    set({ topupOpen: false });
    try {
      // 결제창은 충전할 때만 필요하다 — 첫 로딩 번들에 넣지 않으려고 동적 import 한다.
      const { loadTossPayments, ANONYMOUS } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(clientKey);
      await toss.payment({ customerKey: ANONYMOUS }).requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: amt },
        // 주문번호는 6~64자 영문·숫자·`-`·`_` 만 허용된다 — UUID 가 그대로 맞는다.
        // randomUUID 는 secure context 전용이라 http://192.168.x.x:3000 같은 LAN 주소로
        // 시연할 때는 없다 — 그 경우엔 충돌 확률만 낮으면 되므로 임시 문자열로 대체한다.
        orderId: crypto.randomUUID?.() ?? `dp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
        orderName: "대파페이 충전",
        successUrl: `${window.location.origin}/api/payments/confirm`,
        failUrl: `${window.location.origin}/?topup=fail`,
        card: { flowMode: "DEFAULT", useEscrow: false, useCardPoint: false, useAppCardOnly: false },
      });
    } catch (e) {
      // 결제창을 그냥 닫은 것(UserCancelError)도 여기로 온다 — 조용히 넘긴다.
      console.error("충전 실패:", e);
    }
  },

  setTopupResult: (v) => set({ topupResult: v }),

  setSettleTotalInput: (v) => set({ settleTotalInput: v }),
  setSettleReceiptUrl: (v) => set({ settleReceiptUrl: v }),

  // 총액 확정은 confirm_settlement RPC 가 담당한다 — settlements upsert, 영수증 있으면
  // 즉시 확정 + amount_due 재분배(apply_settlement_split), 시스템 메시지까지 서버에서 처리한다.
  // useRealtimeSettlement 구독이 결과를 화면에 반영한다.
  confirmSettlement: async (dealId, overrides) => {
    const st = get();
    const deal = st.deals.find((d) => d.id === dealId);
    if (!deal || deal.settlement) return;
    const total = parseInt(st.settleTotalInput) || 0;
    if (total <= 0) return;
    // 영수증 사진이 있으면 그 R2 URL 이 곧 증빙 → 서버가 즉시 확정한다. 없으면 과반 동의 투표.
    // overrides 는 settlements.overrides 에 그대로 저장돼서, 즉시 확정이든 나중에 투표로
    // 확정되든 apply_settlement_split 이 항상 이 값을 적용한다 (RPC 안에서 처리 — #95).
    const receiptUrl = st.settleReceiptUrl;
    set({ settleTotalInput: "", settleReceiptUrl: null });
    const { error } = await createClient().rpc("confirm_settlement", {
      p_group_buy_id: dealId,
      p_total_amount: total,
      p_delivery_fee: deal.deliveryFee ?? 0,
      p_receipt_url: receiptUrl,
      p_overrides: overrides && Object.keys(overrides).length ? overrides : null,
    });
    if (error) alert(error.message);
  },

  // 본인 투표는 클라이언트가 settlement_votes_own 정책으로 직접 insert하고,
  // 과반 판정·확정 처리는 finalize_settlement_vote RPC 가 한다.
  voteSettlement: async (dealId, agree) => {
    const st = get();
    const deal = st.deals.find((d) => d.id === dealId);
    const settlementId = deal?.settlement?.id;
    if (!st.me || !settlementId || deal?.settlement?.confirmed) return;
    const sb = createClient();
    const { error: voteErr } = await sb
      .from("settlement_votes")
      .upsert({ settlement_id: settlementId, user_id: st.me.id, agree });
    if (voteErr) {
      alert(voteErr.message);
      return;
    }
    const { error: finalizeErr } = await sb.rpc("finalize_settlement_vote", {
      p_settlement_id: settlementId,
    });
    if (finalizeErr) alert(finalizeErr.message);
  },

  toggleWithdraw: () => set((st) => ({ withdrawOpen: !st.withdrawOpen })),
  setWithdrawAmt: (v) => set({ withdrawAmt: v }),
  doWithdraw: async () => {
    const { withdrawAmt: amt, balance } = get();
    if (amt <= 0 || amt > balance) return;
    set({ withdrawOpen: false });
    const { error } = await createClient().rpc("withdraw_wallet", { p_amount: amt });
    if (error) console.error("출금 실패:", error.message);
  },

  toggleAutoPay: () => {
    const autoPay = !get().autoPay;
    set({ autoPay });
    const me = get().me;
    if (me) void patchProfile(me.id, { auto_pay: autoPay });
  },
  toggleN1: () => {
    const n1 = !get().n1;
    set({ n1 });
    const me = get().me;
    if (me) void patchProfile(me.id, { notify_deadline: n1 });
  },
  toggleN2: () => {
    const n2 = !get().n2;
    set({ n2 });
    const me = get().me;
    if (me) void patchProfile(me.id, { notify_payment: n2 });
  },

  saveProfile: (patch) => {
    const me = get().me;
    if (!me) return;
    set({ me: { ...me, ...patch } });
    void patchProfile(
      me.id,
      Object.fromEntries(Object.entries(patch).map(([k, v]) => [PROFILE_COL[k], v])),
    );
  },

  submitNew: () =>
    set((st) => {
      const f = st.form;
      const totalN = parseInt(f.total) || 0;
      const goalN = parseInt(f.goal) || 0;
      if (!f.title || totalN <= 0 || goalN <= 1) return {};
      const id = Math.max(0, ...st.deals.map((x) => x.id)) + 1;
      const nd: Deal = {
        id,
        emoji: CAT_EMOJI[f.cat],
        title: f.title,
        cat: f.cat,
        total: totalN,
        goal: goalN,
        joined: 1,
        end: Date.now() + (parseInt(f.mins) || 60) * 60_000,
        place: f.place || "채팅방에서 협의",
        host: "나",
        status: "recruiting",
        me: true,
        mine: true,
      };
      const msgs = { ...st.msgs };
      msgs["d" + id] = [{ kind: "sys", text: sysText.roomOpened(goalN) }];
      msgs.lounge = [...(msgs.lounge ?? []), { kind: "card", cardOf: id, who: "나" }];
      return { deals: [nd, ...st.deals], msgs, page: "home", form: EMPTY_FORM };
    }),
}));
