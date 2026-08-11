"use client";

import { create } from "zustand";
import { CAT_EMOJI, fmt } from "./deal";
import type { Deal, DealForm, HistoryItem, Msg, PageKey } from "./types";

const t0 = Date.now();

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
  status: "recruit",
  me: false,
  mine: false,
  ...extra,
});

const seedDeals: Deal[] = [
  mk(1, "🧅", "대파 5단 같이 나눠요", "식료품", 12500, 5, 3, 134, "행복아파트 정문", "파밍맘"),
  mk(2, "🍗", "치킨 같이 시켜요", "배달음식", 54500, 4, 4, -30, "201동 로비", "준호", {
    status: "settle",
    me: true,
    members: [
      { name: "민지", amt: 15000, note: "후라이드+콜라", paid: true },
      { name: "수현", amt: 12500, note: "순살", paid: true },
      { name: "준호", amt: 13375, note: "양념 · 주최", paid: false },
      { name: "나", amt: 13625, note: "반반", paid: false },
    ],
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

interface StoreState {
  page: PageKey;
  sel: number | null;
  room: string;
  chatInput: string;
  search: string;
  mySearch: string;
  filter: string;
  profileOpen: boolean;
  topupOpen: boolean;
  topupAmt: number;
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

  go: (page: PageKey) => void;
  openDeal: (id: number) => void;
  openSettle: (id: number) => void;
  goRoom: (roomId: string) => void;
  toggleProfile: () => void;
  setChatInput: (v: string) => void;
  setSearch: (v: string) => void;
  setMySearch: (v: string) => void;
  setFilter: (v: string) => void;
  setForm: (patch: Partial<DealForm>) => void;
  join: (id: number) => void;
  sendMsg: () => void;
  payNow: (dealId: number) => void;
  toggleTopup: () => void;
  setTopupAmt: (v: number) => void;
  doTopup: () => void;
  toggleWithdraw: () => void;
  setWithdrawAmt: (v: number) => void;
  doWithdraw: () => void;
  toggleAutoPay: () => void;
  toggleN1: () => void;
  toggleN2: () => void;
  submitNew: () => void;
}

export const useStore = create<StoreState>((set) => ({
  page: "home",
  sel: null,
  room: "lounge",
  chatInput: "",
  search: "",
  mySearch: "",
  filter: "전체",
  profileOpen: false,
  topupOpen: false,
  topupAmt: 10000,
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

  go: (page) => set({ page, profileOpen: false }),
  openDeal: (id) => set({ page: "detail", sel: id, profileOpen: false }),
  openSettle: (id) => set({ page: "settle", sel: id, profileOpen: false }),
  goRoom: (roomId) => set({ page: "chat", room: roomId, profileOpen: false }),
  toggleProfile: () => set((st) => ({ profileOpen: !st.profileOpen })),
  setChatInput: (v) => set({ chatInput: v }),
  setSearch: (v) => set({ search: v }),
  setMySearch: (v) => set({ mySearch: v }),
  setFilter: (v) => set({ filter: v }),
  setForm: (patch) => set((st) => ({ form: { ...st.form, ...patch } })),

  join: (id) =>
    set((st) => {
      const target = st.deals.find((d) => d.id === id);
      if (!target || target.me || target.status === "settle" || target.end - Date.now() <= 0) return {};
      const deals = st.deals.map((x) => {
        if (x.id !== id) return x;
        const joined = x.joined + 1;
        const done = joined >= x.goal;
        return {
          ...x,
          joined,
          me: true,
          status: done ? ("settle" as const) : x.status,
          members: done
            ? Array.from({ length: joined }, (_, i) => ({
                name: i === joined - 1 ? "나" : "이웃" + (i + 1),
                amt: Math.ceil(x.total / joined),
                note: "균등 1/N",
                paid: i < joined - 2,
              }))
            : x.members,
        };
      });
      const full = deals.find((x) => x.id === id)!;
      const key = "d" + id;
      const msgs = { ...st.msgs };
      msgs[key] = [
        ...(msgs[key] ?? []),
        { kind: "sys", text: `파티원님이 참여했어요 (${full.joined}/${full.goal})` },
      ];
      if (full.status === "settle") {
        msgs[key] = [...msgs[key], { kind: "sys", text: "목표 달성! 정산이 시작돼요 🎉" }];
      }
      return { deals, msgs };
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
        status: "recruit",
        me: true,
        mine: true,
      };
      const msgs = { ...st.msgs };
      msgs["d" + id] = [{ kind: "sys", text: `공구방이 열렸어요 · 목표 ${goalN}명` }];
      msgs.lounge = [...(msgs.lounge ?? []), { kind: "card", cardOf: id, who: "나" }];
      return { deals: [nd, ...st.deals], msgs, page: "home", form: EMPTY_FORM };
    }),
}));
