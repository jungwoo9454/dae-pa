// lib/supabase/queries.ts
"use client";

import { createClient } from "./client";
import type { Deal, Category } from "@/lib/types";
import type { GroupBuyRow, ParticipationRow } from "@/lib/db-types";
import { CAT_EMOJI } from "@/lib/deal";

/**
 * 공구 목록 조회 (카테고리 필터 옵션)
 * Supabase: group_buys 테이블에서 최신순 조회
 */
export async function fetchDeals(category?: Category | "전체"): Promise<Deal[]> {
  const sb = createClient();

  let query = sb
    .from("group_buys")
    .select(
      `
      *,
      participations!inner (*)
    `,
    )
    .order("created_at", { ascending: false });

  // 카테고리 필터 (전체 제외)
  if (category && category !== "전체") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[fetchDeals]", error.message);
    return [];
  }

  const rows = (data ?? []) as (GroupBuyRow & { participations: ParticipationRow[] })[];
  return rows.map((row) => rowToDeal(row, row.participations));
}

/**
 * 공구 한 건 조회
 */
export async function fetchDeal(dealId: number): Promise<Deal | null> {
  const sb = createClient();

  const { data, error } = await sb
    .from("group_buys")
    .select(
      `
      *,
      participations!inner (*)
    `,
    )
    .eq("id", dealId)
    .single();

  if (error || !data) {
    console.error("[fetchDeal]", error?.message ?? "Not found");
    return null;
  }

  const row = data as GroupBuyRow & { participations: ParticipationRow[] };
  return rowToDeal(row, row.participations ?? []);
}

/**
 * Participations Realtime 구독
 * dealId별로 참여자 정보 실시간 업데이트
 *
 * 사용:
 *   const unsubscribe = subscribeToParticipations(dealId, (parts) => {
 *     updateUI(parts.length); // 참여자 수 갱신
 *   });
 *
 *   // cleanup
 *   return () => unsubscribe();
 */
export function subscribeToParticipations(
  dealId: number,
  callback: (parts: ParticipationRow[]) => void,
): () => void {
  const sb = createClient();

  const loadParticipations = async () => {
    const { data, error } = await sb
      .from("participations")
      .select("*")
      .eq("group_buy_id", dealId);
    if (error) {
      console.error("[subscribeToParticipations]", error.message);
      return;
    }
    if (data) callback(data as ParticipationRow[]);
  };

  // Step 1: 초기 데이터 로드
  void loadParticipations();

  // Step 2: Realtime 구독 시작
  const channel = sb
    .channel(`participations:${dealId}`)
    .on(
      "postgres_changes",
      {
        event: "*", // INSERT, UPDATE, DELETE 모두
        schema: "public",
        table: "participations",
        filter: `group_buy_id=eq.${dealId}`,
      },
      () => {
        // Step 3: 변경 감지 시 전체 목록 다시 로드
        void loadParticipations();
      },
    )
    .subscribe();

  // cleanup 함수 반환
  return () => {
    void sb.removeChannel(channel);
  };
}

/**
 * 내부 헬퍼: Supabase 행 → 화면 모델 (Deal) 변환
 */
function rowToDeal(row: GroupBuyRow, participations: ParticipationRow[]): Deal {
  const deadlineMs = new Date(row.deadline).getTime();

  return {
    id: row.id,
    host_id: row.host_id,
    // 닉네임 조인은 별도 태스크(profiles) 범위 — 우선 host_id로 채워둔다.
    host: row.host_id,
    emoji: CAT_EMOJI[row.category],
    title: row.title,
    cat: row.category,
    description: row.description || undefined,
    total: row.total_amount,
    deliveryFee: row.delivery_fee,
    goal: row.goal,
    joined: participations.length, // participations 수 = 참여자 수
    end: deadlineMs,
    place: row.place || "채팅방에서 협의",
    store_link: row.store_link || undefined,
    status: row.status,
    created_at: row.created_at,
    participations,

    // 클라이언트에서 결정할 필드들 (로그인 유저 정보로 계산)
    me: false,
    mine: false,
  };
}
