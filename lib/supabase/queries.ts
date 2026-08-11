// lib/supabase/queries.ts
"use client";

import { createClient } from "./client";
import type { Deal, Category } from "@/lib/types";
import type { GroupBuyRow, ParticipationRow } from "@/lib/db-types";
import { CAT_EMOJI } from "@/lib/deal";
import { useStore } from "@/lib/store";

/**
 * 공구 목록 조회 (카테고리 필터 옵션)
 * Supabase: group_buys 테이블에서 최신순 조회
 */
export async function fetchDeals(category?: Category | "전체"): Promise<Deal[]> {
  const sb = createClient();

  // 목록 카드는 참여자 수(deal.joined)만 필요 — group_buys.joined 컬럼이 이미
  // join_group_buy RPC로 원자적으로 유지되는 값이라 participations 조인은 불필요하다.
  // (참고: participations!inner로 조인하면 참여자가 아직 없는 공구는 결과에서
  //  통째로 빠지는 위험도 있다 — 주최자 자동 참여 트리거로 항상 1명 이상이긴 하지만
  //  그 보장에 기대는 것 자체가 취약하다.)
  let query = sb.from("group_buys").select("*").order("created_at", { ascending: false });

  // 카테고리 필터 (전체 제외)
  if (category && category !== "전체") {
    query = query.eq("category", category);
  }

  const uid = await getUserId(sb);
  const [{ data, error }, myDealIds] = await Promise.all([query, fetchMyParticipatingDealIds(sb, uid)]);
  if (error) {
    console.error("[fetchDeals]", error.message);
    return [];
  }

  const rows = (data ?? []) as GroupBuyRow[];
  return rows.map((row) => {
    const mine = uid != null && row.host_id === uid;
    const me = mine || myDealIds.has(row.id);
    return rowToDeal(row, undefined, { me, mine });
  });
}

/** 현재 로그인 유저의 uid (없으면 null) */
async function getUserId(sb: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * 내가 참여 중인 공구 id 집합 — "내 공구" 판정(me)에 쓴다.
 * 목록 조회에서는 participations를 통째로 조인하지 않으므로 id만 별도로 가볍게 가져온다.
 */
async function fetchMyParticipatingDealIds(
  sb: ReturnType<typeof createClient>,
  uid: string | null,
): Promise<Set<number>> {
  if (!uid) return new Set();

  const { data, error } = await sb.from("participations").select("group_buy_id").eq("user_id", uid);
  if (error) {
    console.error("[fetchMyParticipatingDealIds]", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.group_buy_id as number));
}

/**
 * 공구 한 건 조회
 */
export async function fetchDeal(dealId: number): Promise<Deal | null> {
  const sb = createClient();

  const [{ data, error }, uid] = await Promise.all([
    sb
      .from("group_buys")
      .select(
        `
      *,
      participations!inner (*)
    `,
      )
      .eq("id", dealId)
      .single(),
    getUserId(sb),
  ]);

  if (error || !data) {
    console.error("[fetchDeal]", error?.message ?? "Not found");
    return null;
  }

  const row = data as GroupBuyRow & { participations: ParticipationRow[] };
  const participations = row.participations ?? [];
  const mine = uid != null && row.host_id === uid;
  const me = mine || participations.some((p) => p.user_id === uid);
  return rowToDeal(row, participations, { me, mine });
}

/**
 * store.deals에 해당 공구가 없을 때(필터 변경으로 목록이 바뀌었거나, 딥링크로 곧장
 * 들어온 경우) 상세 화면에서 단건 보강 조회 후 store에 병합한다.
 */
export async function ensureDealLoaded(dealId: number): Promise<void> {
  const exists = useStore.getState().deals.some((d) => d.id === dealId);
  if (exists) return;

  const deal = await fetchDeal(dealId);
  if (!deal) return;

  useStore.setState((st) =>
    st.deals.some((d) => d.id === dealId) ? {} : { deals: [...st.deals, deal] },
  );
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
function rowToDeal(
  row: GroupBuyRow,
  participations?: ParticipationRow[],
  flags?: { me: boolean; mine: boolean },
): Deal {
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
    // group_buys.joined는 join_group_buy RPC가 원자적으로 유지하는 값 — 참여자
    // 목록을 함께 불러왔을 때(fetchDeal)는 실제 행 수로, 아니면(fetchDeals) 이 컬럼으로 채운다.
    // 상세 화면은 마운트 즉시 useRealtimeParticipations가 participations.length로 다시 덮어쓴다.
    joined: participations ? participations.length : row.joined,
    end: deadlineMs,
    place: row.place || "채팅방에서 협의",
    store_link: row.store_link || undefined,
    status: row.status,
    created_at: row.created_at,
    participations: participations ?? [],

    // 로그인 유저 정보로 계산 — 호출부(fetchDeals/fetchDeal)에서 uid와 대조해 넘겨준다.
    me: flags?.me ?? false,
    mine: flags?.mine ?? false,
  };
}
