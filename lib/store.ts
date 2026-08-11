"use client";

import { create } from "zustand";
import { CAT_EMOJI, fmt, joinable, recalcMembers } from "./deal";
import { createClient } from "./supabase/client";
import type { AuthMode, Deal, DealForm, HistoryItem, Me, Msg, Noti, PageKey, Settlement } from "./types";

/** 동네 인증은 아직 모의 — 위치 기반 판정은 별도 이슈 */
export const DONG = "역삼동";

const t0 = Date.now();

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

const toNoti = (r: NotiRow): Noti => ({
  id: r.id,
  type: r.type,
  text: r.payload?.text ?? "",
  dealId: r.payload?.dealId ?? null,
  isRead: r.is_read,
  createdAt: Date.parse(r.created_at),
});

const mk = (
  id: number,
  emoji: string,
  title: string,
  cat: Deal["cat"],
  total: number,
  goal: number,
  joined: number,
  endMin: number,
  place: string,
  host: string,
  extra?: Partial<Deal>,
): Deal => ({
  id,
  emoji,
  title,
  cat,
  total,
  goal,
  joined,
  end: t0 + endMin * 60_000,
  place,
  host,
  status: "recruiting",
  me: false,
  mine: false,
  ...extra,
});

const seedDeals: Deal[] = [
  mk(1, "🧅", "대파 5단 같이 나눠요", "식료품", 12500, 5, 3, 134, "행복아파트 정문", "파밍맘"),
  mk(2, "🍗", "치킨 같이 시켜요", "배달음식", 54500, 4, 4, -30, "201동 로비", "준호", {
    status: "settling",
    me: true,
    deliveryFee: 3050,
    members: recalcMembers(
      { total: 54500, host: "준호", deliveryFee: 3050 },
      [
        { name: "민지", itemAmt: 13000, amt: 0, note: "후라이드+콜라", paid: true },
        { name: "수현", itemAmt: 11000, amt: 0, note: "순살", paid: true },
        { name: "준호", itemAmt: 0, amt: 0, note: "양념 · 주최", paid: false },
        { name: "나", itemAmt: 12500, amt: 0, note: "반반", paid: false },
      ],
    ),
    settlement: { finalTotal: 54500, hasReceipt: true, confirmed: true, votes: {} },
  }),
  mk(3, "🍊", "제주 감귤 10kg", "식료품", 45000, 10, 7, 342, "회사 1층 로비", "나", { me: true, mine: true }),
  mk(4, "☕", "원두 2kg 공구", "식료품", 80000, 10, 9, 41, "3층 탕비실", "커피덕후"),
  mk(5, "🧻", "화장지 48롤 반씩", "생활용품", 32000, 2, 1, 1580, "경비실 앞", "알뜰킹"),
];

const seedMsgs: Record<string, Msg[]> = {
  lounge: [
    { kind: "sys", text: "🏘 역삼동 이웃 128명이 함께하고 있어요" },
    { kind: "other", who: "민지", text: "치킨 같이 시키실 분? 배달비 아까워요 😂" },
    { kind: "card", cardOf: 2, who: "준호" },
    { kind: "mine", text: "저요저요!!" },
    { kind: "card", cardOf: 1, who: "파밍맘" },
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

const seedHistory: HistoryItem[] = [
  { emoji: "🍊", title: "제주 감귤 정산 받음", when: "어제", amt: 4500 },
  { emoji: "⚡", title: "충전", when: "8월 7일", amt: 30000 },
  { emoji: "🧻", title: "화장지 공구 정산", when: "8월 2일", amt: -16000 },
];

const EMPTY_FORM: DealForm = { cat: "식료품", title: "", total: "", goal: "", mins: "", place: "" };

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
  room: string;
  chatInput: string;
  search: string;
  mySearch: string;
  filter: string;
  profileOpen: boolean;
  notiOpen: boolean;
  notis: Noti[];
  topupOpen: boolean;
  topupAmt: number;
  settleTotalInput: string;
  settleReceipt: boolean;
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
  verifyDong: () => void;
  /** 세션 구독 시작. 정리 함수를 돌려준다 */
  initAuth: () => () => void;
  signIn: () => Promise<void>;
  signUp: () => Promise<void>;
  signInWithOAuth: (provider: "google" | "kakao") => Promise<void>;
  logout: () => Promise<void>;
  go: (page: PageKey) => void;
  openDeal: (id: number) => void;
  openSettle: (id: number) => void;
  goRoom: (roomId: string) => void;
  toggleProfile: () => void;
  /** 알림 목록 로드 + Realtime 구독 시작. 정리 함수를 돌려준다 */
  initNotis: (uid: string) => () => void;
  /** 열 때 미읽음을 전부 읽음 처리한다 */
  toggleNoti: () => Promise<void>;
  /** 참여한 공구의 마감 30분 전 알림을 넣는다 — 주기 호출 */
  notifyDeadlines: () => Promise<void>;
  setChatInput: (v: string) => void;
  setSearch: (v: string) => void;
  setMySearch: (v: string) => void;
  setFilter: (v: string) => void;
  setForm: (patch: Partial<DealForm>) => void;
  join: (id: number) => void;
  adjustMemberItem: (dealId: number, name: string, itemAmt: number) => void;
  sendMsg: () => void;
  payNow: (dealId: number) => void;
  toggleTopup: () => void;
  setTopupAmt: (v: number) => void;
  doTopup: () => void;
  setSettleTotalInput: (v: string) => void;
  toggleSettleReceipt: () => void;
  confirmSettlement: (dealId: number) => void;
  voteSettlement: (dealId: number, agree: boolean) => void;
  toggleWithdraw: () => void;
  setWithdrawAmt: (v: number) => void;
  doWithdraw: () => void;
  toggleAutoPay: () => void;
  toggleN1: () => void;
  toggleN2: () => void;
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
  room: "lounge",
  chatInput: "",
  search: "",
  mySearch: "",
  filter: "전체",
  profileOpen: false,
  notiOpen: false,
  notis: [],
  topupOpen: false,
  topupAmt: 10000,
  settleTotalInput: "",
  settleReceipt: false,
  withdrawOpen: false,
  withdrawAmt: 10000,
  balance: 23500,
  autoPay: true,
  n1: true,
  n2: true,
  form: EMPTY_FORM,
  deals: seedDeals,
  msgs: seedMsgs,
  history: seedHistory,

  setAuth: (patch) => set((st) => ({ auth: { ...st.auth, ...patch }, authError: "" })),
  switchAuthMode: () =>
    set((st) => ({ authMode: st.authMode === "signup" ? "login" : "signup", authError: "" })),
  verifyDong: () => set({ dongOk: true }),

  initAuth: () => {
    const sb = createClient();
    // 소셜 로그인 콜백이 실패하면 /?auth_error=1 로 돌아온다
    if (new URLSearchParams(window.location.search).has("auth_error")) {
      set({ authError: "소셜 로그인에 실패했어요. 다시 시도해주세요" });
      window.history.replaceState(null, "", window.location.pathname);
    }
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id;
      if (!uid) {
        // 다음 사람이 남의 알림을 보지 않게 목록·중복 표시를 비운다
        firedDeadlines.clear();
        set((st) => ({
          me: null,
          notis: [],
          page: "login",
          authMode: "login",
          profileOpen: false,
          notiOpen: false,
          authReady: true,
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
        const { data: p } = await sb
          .from("profiles")
          .select("nickname, avatar_url, dong")
          .eq("id", uid)
          .single();
        set({
          me: {
            id: uid,
            nickname: p?.nickname ?? "파티원",
            avatarUrl: p?.avatar_url ?? null,
            dong: p?.dong ?? null,
          },
        });
      }, 0);
    });
    return () => data.subscription.unsubscribe();
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
      // 닉네임·동네는 raw_user_meta_data 로 들어가 handle_new_user 트리거가 profiles 에 넣는다
      options: { data: { nickname: nick, dong: get().dongOk ? DONG : null } },
    });
    if (error) {
      set({ authBusy: false, authError: error.message });
      return;
    }
    // 대시보드에서 Confirm email 이 켜져 있으면 세션 없이 끝난다
    if (!data.session) {
      set({ authBusy: false, authError: "메일로 보낸 인증 링크를 확인한 뒤 로그인해주세요" });
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
  openSettle: (id) => set({ page: "settle", sel: id, profileOpen: false, notiOpen: false }),
  goRoom: (roomId) => set({ page: "chat", room: roomId, profileOpen: false, notiOpen: false }),
  toggleProfile: () => set((st) => ({ profileOpen: !st.profileOpen, notiOpen: false })),

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
      set({ notis: rows.map(toNoti) });
    })();

    const ch = sb
      .channel("notis")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        ({ new: row }) =>
          set((st) => {
            const n = toNoti(row as NotiRow);
            return st.notis.some((x) => x.id === n.id) ? {} : { notis: [n, ...st.notis] };
          }),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
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
    // 공구는 아직 목데이터라 payload.dealId 도 목 id 다 — 공구 연동(#4) 때 같이 실 id 로 바뀐다
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
  setForm: (patch) => set((st) => ({ form: { ...st.form, ...patch } })),

  join: (id) =>
    set((st) => {
      const target = st.deals.find((d) => d.id === id);
      if (!target || !joinable(target, Date.now())) return {};
      const deals = st.deals.map((x) => {
        if (x.id !== id) return x;
        const joined = x.joined + 1;
        const done = joined >= x.goal;
        const deliveryFee = x.deliveryFee ?? 0;
        const itemShare = Math.floor((x.total - deliveryFee) / joined);
        const roughMembers = done
          ? Array.from({ length: joined }, (_, i) => {
              const isLast = i === joined - 1;
              const isHostSlot = i === 0;
              const name = isLast ? "나" : isHostSlot ? x.host : "이웃" + i;
              return {
                name,
                itemAmt: itemShare,
                amt: 0,
                note: isHostSlot && !isLast ? "균등 1/N · 주최" : "균등 1/N",
                paid: i < joined - 2,
              };
            })
          : x.members;
        return {
          ...x,
          joined,
          me: true,
          status: done ? ("settling" as const) : x.status,
          members: done ? recalcMembers(x, roughMembers!) : x.members,
        };
      });
      const full = deals.find((x) => x.id === id)!;
      const key = "d" + id;
      const msgs = { ...st.msgs };
      msgs[key] = [
        ...(msgs[key] ?? []),
        { kind: "sys", text: `파티원님이 참여했어요 (${full.joined}/${full.goal})` },
      ];
      if (full.status === "settling") {
        msgs[key] = [...msgs[key], { kind: "sys", text: "목표 달성! 정산이 시작돼요 🎉" }];
      }
      return { deals, msgs };
    }),

  adjustMemberItem: (dealId, name, itemAmt) =>
    set((st) => {
      const deal = st.deals.find((d) => d.id === dealId);
      if (!deal || name === deal.host) return {};
      const safeAmt = Math.max(0, Math.floor(itemAmt) || 0);
      const members = (deal.members ?? []).map((m) => (m.name === name ? { ...m, itemAmt: safeAmt } : m));
      const recalced = recalcMembers(deal, members);
      const deals = st.deals.map((d) => (d.id === dealId ? { ...d, members: recalced } : d));
      return { deals };
    }),

  sendMsg: () =>
    set((st) => {
      const text = st.chatInput.trim();
      if (!text) return {};
      const msgs = { ...st.msgs };
      msgs[st.room] = [...(msgs[st.room] ?? []), { kind: "mine", text }];
      return { msgs, chatInput: "" };
    }),

  payNow: (dealId) =>
    set((st) => {
      const deal = st.deals.find((d) => d.id === dealId);
      const mine = deal?.members?.find((m) => m.name === "나");
      if (!deal || !mine || mine.paid) return {};
      const deals = st.deals.map((x) =>
        x.id !== dealId
          ? x
          : { ...x, members: x.members!.map((m) => (m.name === "나" ? { ...m, paid: true } : m)) },
      );
      const key = "d" + dealId;
      const msgs = { ...st.msgs };
      msgs[key] = [
        ...(msgs[key] ?? []),
        { kind: "sys", text: `파티원님이 ${fmt(mine.amt)} 입금 완료 ✓ (대파페이)` },
      ];
      return {
        deals,
        msgs,
        balance: st.balance - mine.amt,
        history: [{ emoji: deal.emoji, title: deal.title + " 정산", when: "방금", amt: -mine.amt }, ...st.history],
      };
    }),

  toggleTopup: () => set((st) => ({ topupOpen: !st.topupOpen })),
  setTopupAmt: (v) => set({ topupAmt: v }),
  doTopup: () =>
    set((st) => ({
      balance: st.balance + st.topupAmt,
      topupOpen: false,
      history: [{ emoji: "⚡", title: "충전", when: "방금", amt: st.topupAmt }, ...st.history],
    })),

  setSettleTotalInput: (v) => set({ settleTotalInput: v }),
  toggleSettleReceipt: () => set((st) => ({ settleReceipt: !st.settleReceipt })),

  confirmSettlement: (dealId) =>
    set((st) => {
      const deal = st.deals.find((d) => d.id === dealId);
      if (!deal || deal.settlement) return {};
      const finalTotal = parseInt(st.settleTotalInput) || deal.total;
      const hasReceipt = st.settleReceipt;
      const settlement: Settlement = { finalTotal, hasReceipt, confirmed: hasReceipt, votes: {} };
      const deals = st.deals.map((d) =>
        d.id !== dealId ? d : { ...d, settlement, total: hasReceipt ? finalTotal : d.total },
      );
      const key = "d" + dealId;
      const msgs = { ...st.msgs };
      msgs[key] = [
        ...(msgs[key] ?? []),
        hasReceipt
          ? { kind: "sys" as const, text: `🧾 영수증 인증 완료 · 총 ${fmt(finalTotal)} · 금액 잠금` }
          : {
              kind: "sys" as const,
              text: `총 ${fmt(finalTotal)}으로 정산 요청 · 영수증 없이 참여자 과반 동의로 확정돼요`,
            },
      ];
      return { deals, msgs, settleTotalInput: "", settleReceipt: false };
    }),

  voteSettlement: (dealId, agree) =>
    set((st) => {
      const deal = st.deals.find((d) => d.id === dealId);
      if (!deal?.settlement || deal.settlement.confirmed) return {};
      const votes = { ...deal.settlement.votes, 나: agree };
      const mem = deal.members ?? [];
      const confirmed = Object.values(votes).filter(Boolean).length > mem.length / 2;
      const settlement: Settlement = { ...deal.settlement, votes, confirmed };
      const deals = st.deals.map((d) =>
        d.id !== dealId ? d : { ...d, settlement, total: confirmed ? settlement.finalTotal : d.total },
      );
      const key = "d" + dealId;
      const msgs = { ...st.msgs };
      if (confirmed) {
        msgs[key] = [
          ...(msgs[key] ?? []),
          { kind: "sys", text: `✅ 참여자 과반 동의로 총 ${fmt(settlement.finalTotal)} 확정 · 금액 잠금` },
        ];
      }
      return { deals, msgs };
    }),

  toggleWithdraw: () => set((st) => ({ withdrawOpen: !st.withdrawOpen })),
  setWithdrawAmt: (v) => set({ withdrawAmt: v }),
  doWithdraw: () =>
    set((st) => {
      if (st.withdrawAmt <= 0 || st.withdrawAmt > st.balance) return {};
      return {
        balance: st.balance - st.withdrawAmt,
        withdrawOpen: false,
        history: [{ emoji: "🏧", title: "출금", when: "방금", amt: -st.withdrawAmt }, ...st.history],
      };
    }),

  toggleAutoPay: () => set((st) => ({ autoPay: !st.autoPay })),
  toggleN1: () => set((st) => ({ n1: !st.n1 })),
  toggleN2: () => set((st) => ({ n2: !st.n2 })),

  submitNew: () =>
    set((st) => {
      const f = st.form;
      const totalN = parseInt(f.total) || 0;
      const goalN = parseInt(f.goal) || 0;
      if (!f.title || totalN <= 0 || goalN <= 1) return {};
      const id = Math.max(...st.deals.map((x) => x.id)) + 1;
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
      msgs["d" + id] = [{ kind: "sys", text: `공구방이 열렸어요 · 목표 ${goalN}명` }];
      msgs.lounge = [...(msgs.lounge ?? []), { kind: "card", cardOf: id, who: "나" }];
      return { deals: [nd, ...st.deals], msgs, page: "home", form: EMPTY_FORM };
    }),
}));
