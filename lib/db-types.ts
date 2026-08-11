import type { Category, DealStatus } from "./types";

export interface GroupBuyRow {
  id: number; // bigint identity
  host_id: string; // uuid
  title: string;
  description: string | null;
  category: Category;
  store_link: string | null;
  total_amount: number; // 원 단위 정수
  delivery_fee: number;
  goal: number; // 목표 인원
  joined: number; // 현재 참여자 수
  deadline: string; // ISO 8601 timestamp
  place: string | null;
  status: DealStatus;
  created_at: string;
}

/** 닉네임 표시용 — group_buys.host_id 조회 시 profiles를 embed해서 함께 받는다 */
export interface ProfileRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

export interface ParticipationRow {
  id: number; // bigint identity
  group_buy_id: number;
  user_id: string; // uuid
  note: string | null;
  amount_due: number | null; // 정산 전엔 null
  is_paid: boolean;
  paid_at: string | null;
  joined_at: string;
}

/**
 * 참여자 아바타 표시용 — participations.user_id → profiles.id FK를 PostgREST embed로
 * 함께 받아온다. RLS(profiles_read: using (true))상 다른 사람 프로필도 읽을 수 있어서
 * 목록/상세 어디서든 host_profile과 동일한 패턴으로 붙일 수 있다.
 */
export type ParticipationWithProfile = ParticipationRow & { profile: ProfileRow | null };

export interface SettlementRow {
  id: number; // bigint identity
  group_buy_id: number;
  total_amount: number;
  delivery_fee: number;
  receipt_url: string | null;
  status: "pending" | "confirmed";
  confirmed_at: string | null;
  created_at: string;
}

export interface SettlementVoteRow {
  settlement_id: number;
  user_id: string; // uuid
  agree: boolean;
  created_at: string;
}
