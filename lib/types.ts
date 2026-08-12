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
  /** 가입 수단 — auth user.app_metadata.provider ("email" | "google" | "github") (#81) */
  provider: string | null;
  /** 정산 받을 계좌 (#20) */
  bankAccount: string | null;
  /** 기본 송금 앱 (#20) */
  transferApp: string | null;
}

/** 인앱 알림 한 건 (#13) — notifications 행에서 만든다 */
export interface Noti {
  id: number;
  type: "deadline_soon" | "total_changed" | "payment_reminder" | "settle_start" | "join" | "cancel" | "leave";
  text: string;
  /** 누르면 이동할 공구. 없으면 이동하지 않는다 */
  dealId: number | null;
  isRead: boolean;
  createdAt: number;
}

export type DealStatus = "recruiting" | "settling" | "completed" | "canceled";

export interface Settlement {
  /** settlements.id — 투표 insert·finalize_settlement_vote RPC 호출에 필요 */
  id: number;
  finalTotal: number;
  hasReceipt: boolean;
  /** 첨부된 영수증 사진 — R2 공개 URL (#15). 없으면 과반 동의로 확정하는 흐름 */
  receiptUrl?: string | null;
  confirmed: boolean;
  /** 참여자 user_id(uuid) → 동의 여부. 영수증 없을 때 과반 동의로 확정할 때만 사용 */
  votes: Record<string, boolean>;
  /** 확정 전 주최자가 손수 조정한 {participation_id: 금액} (#95). 동의 대기 중에도 미리보기에 쓴다 */
  overrides: Record<number, number> | null;
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
  /** 대표 이미지 — R2 공개 URL (#15). 없으면 emoji 를 그대로 쓴다 */
  imageUrl?: string | null;
  /** 배달비 — 있으면 항상 균등 분배, 개별 조정 대상 아님 */
  deliveryFee?: number;
  /** 배달음식 전용 — 가게 최소 주문 금액 (#95) */
  minOrderAmount?: number | null;
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

/** emoticon 은 이모티콘 시트에서 몇 번째 칸인지 (0~11, lib/emoticons.ts) */
export type Msg =
  | { kind: "sys"; text: string; id?: number }
  | { kind: "card"; cardOf: number; who: string; id?: number; avatarUrl?: string | null }
  | {
      kind: "other";
      who: string;
      text: string;
      id?: number;
      imageUrl?: string;
      emoticon?: number;
      avatarUrl?: string | null;
    }
  | { kind: "mine"; text: string; id?: number; imageUrl?: string; emoticon?: number };

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
  /** wallet_transactions.kind — 아이콘 결정은 화면(pay.tsx)이 한다 (#65) */
  kind: string;
  title: string;
  when: string;
  amt: number;
}

export interface DealForm {
  cat: Category;
  title: string;
  /** 설명 (선택) — 품목·수량은 별도 칸 없이 줄바꿈으로 여기 적는다 (#91) */
  description: string;
  /** 배달음식은 선택 — 비워두면 서버가 minOrderAmount로 채운다 (#95) */
  total: string;
  goal: string;
  mins: string;
  place: string;
  store_link: string;
  /** 대표 이미지 R2 URL — 빈 문자열이면 첨부 안 함 */
  imageUrl: string;
  /** 배달음식 전용 필수 입력 — 가게 최소 주문 금액 (#95) */
  minOrderAmount: string;
  /** 배달음식 전용 필수 입력 (#95). 다른 카테고리는 항상 "0" */
  deliveryFee: string;
}
