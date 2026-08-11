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

/** 로그인한 본인 — profiles 행에서 읽어온다 */
export interface Me {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  dong: string | null;
}

export type DealStatus = "recruiting" | "settling" | "completed" | "canceled";

export interface Member {
  name: string;
  /** 개인 항목 금액 — 배달비 제외, 주최자가 조정 가능 (주최자 본인 몫은 나머지로 자동 계산) */
  itemAmt: number;
  /** 최종 부담금 = itemAmt + 배달비 균등 분담분 */
  amt: number;
  note: string;
  paid: boolean;
  /** 입금 수단 — paid=true 일 때만 의미 있음 */
  payMethod?: "wallet" | "account" | "toss";
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
  /** 배달비 — 있으면 항상 균등 분배, 개별 조정 대상 아님 */
  deliveryFee?: number;
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
