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
  amt: number;
  note: string;
  paid: boolean;
}

export interface Settlement {
  finalTotal: number;
  hasReceipt: boolean;
  confirmed: boolean;
  /** 참여자 이름 → 동의 여부. 영수증 없을 때 과반 동의로 확정할 때만 사용 */
  votes: Record<string, boolean>;
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
  settlement?: Settlement;
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
