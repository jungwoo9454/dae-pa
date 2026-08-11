import type { ParticipationWithProfile } from "./db-types";

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
  /** 정산 받을 계좌 (#20) */
  bankAccount: string | null;
  /** 기본 송금 앱 (#20) */
  transferApp: string | null;
}

/** 인앱 알림 한 건 (#13) — notifications 행에서 만든다 */
export interface Noti {
  id: number;
  type: "deadline_soon" | "total_changed" | "payment_reminder" | "settle_start" | "join" | "cancel";
  text: string;
  /** 누르면 이동할 공구. 없으면 이동하지 않는다 */
  dealId: number | null;
  isRead: boolean;
  createdAt: number;
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

  // Supabase fields
  /** UUID string (Supabase auth.users.id) */
  host_id?: string;

  /** 상점 링크 */
  store_link?: string;

  /** 공구 설명 */
  description?: string;

  /** ISO 8601 timestamp (생성 시간) */
  created_at?: string;

  /** Realtime 데이터 (participations 테이블 행들 — user_id의 profile을 embed로 함께 받는다) */
  participations?: ParticipationWithProfile[];
}

export type Msg =
  | { kind: "sys"; text: string; id?: number }
  | { kind: "card"; cardOf: number; who: string; id?: number }
  | { kind: "other"; who: string; text: string; id?: number }
  | { kind: "mine"; text: string; id?: number };

/** 채팅방 한 개 (#7) — chat_rooms 행에서 만든다 */
export interface Room {
  /** chat_rooms.id — 메시지 조회·구독 키 */
  id: number;
  type: "lounge" | "group_buy";
  name: string;
  /** 공구방이면 해당 공구 id, 라운지면 null */
  dealId: number | null;
}

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
  store_link: string;
}
