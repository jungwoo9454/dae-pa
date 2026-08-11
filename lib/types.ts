export type Category = "식료품" | "배달음식" | "생활용품" | "대량구매" | "기타";

export type PageKey =
  | "login"
  | "home"
  | "detail"
  | "my"
  | "chat"
  | "pay"
  | "new"
  | "set"
  | "settle";

export type AuthMode = "login" | "signup";

export type DealStatus = "recruit" | "settle";

export interface Member {
  name: string;
  /** 개인 항목 금액 — 배달비 제외, 주최자가 조정 가능 (주최자 본인 몫은 나머지로 자동 계산) */
  itemAmt: number;
  /** 최종 부담금 = itemAmt + 배달비 균등 분담분 */
  amt: number;
  note: string;
  paid: boolean;
}

export interface Deal {
  id: number;
  emoji: string;
  title: string;
  cat: Category;
  total: number;
  goal: number;
  joined: number;
  end: number;
  place: string;
  host: string;
  status: DealStatus;
  me: boolean;
  mine: boolean;
  members?: Member[];
  /** 배달비 — 있으면 항상 균등 분배, 개별 조정 대상 아님 */
  deliveryFee?: number;
}

export type Msg =
  | { kind: "sys"; text: string }
  | { kind: "card"; cardOf: number; who: string }
  | { kind: "other"; who: string; text: string }
  | { kind: "mine"; text: string };

export interface HistoryItem {
  emoji: string;
  title: string;
  when: string;
  amt: number;
}

export interface DealForm {
  cat: Category;
  title: string;
  total: string;
  goal: string;
  mins: string;
  place: string;
}
