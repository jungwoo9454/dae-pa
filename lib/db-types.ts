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
