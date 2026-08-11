// lib/supabase/queries.ts
"use client";

import { createClient } from "./client";
import type { Deal, Category } from "@/lib/types";
import type { GroupBuyRow, ParticipationWithProfile, ProfileRow } from "@/lib/db-types";
import { CAT_EMOJI } from "@/lib/deal";
import { useStore } from "@/lib/store";

/** group_buys.host_id → profiles.id FK를 PostgREST embed로 한 번에 받아온다 (별도 왕복 없음) */
type GroupBuyWithHost = GroupBuyRow & { host_profile: ProfileRow | null };

/** participations.user_id → profiles.id FK embed — 참여자 아바타에 쓸 닉네임을 함께 받는다 */
const PARTICIPATION_WITH_PROFILE_SELECT = "*, profile:profiles!user_id(id, nickname, avatar_url)";

/**
 * 공구 목록 조회 (카테고리 필터 옵션)
 * Supabase: group_buys 테이블에서 최신순 조회
 */
export async function fetchDeals(category?: Category | "전체"): Promise<Deal[]> {
  const sb = createClient();

  // 목록 카드는 참여자 수(deal.joined)만 필요 — group_buys.joined 컬럼이 이미
  // join_group_buy RPC로 원자적으로 유지되는 값이라 participations 조인은 불필요하다.
  // host_profile은 host_id → profiles.id FK를 이용한 embed — 별도 쿼리 없이 닉네임을 함께 받는다.
  let query = sb
    .from("group_buys")
    .select("*, host_profile:profiles!host_id(id, nickname, avatar_url)")
    .order("created_at", { ascending: false });

  if (category && category !== "전체") {
    query = query.eq("category", category);
  }

  const uid = await getUserId(sb);
  const [{ data, error }, myDealIds] = await Promise.all([query, fetchMyParticipatingDealIds(sb, uid)]);
  if (error) {
    console.error("[fetchDeals]", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as GroupBuyWithHost[];
  return rows.map((row) => {
    const mine = uid != null && row.host_id === uid;
    const me = mine || myDealIds.has(row.id);
    return rowToDeal(row, undefined, { me, mine, host: row.host_profile?.nickname });
  });
}

async function getUserId(sb: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

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

  return new Set((data ?? []).map((row) => row.group_buy_id as number));
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
      participations!inner (${PARTICIPATION_WITH_PROFILE_SELECT}),
      host_profile:profiles!host_id (id, nickname, avatar_url)
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

  const row = data as unknown as GroupBuyWithHost & { participations: ParticipationWithProfile[] };
  const participations = row.participations ?? [];
  const mine = uid != null && row.host_id === uid;
  const me = mine || participations.some((p) => p.user_id === uid);

  return rowToDeal(row, participations, { me, mine, host: row.host_profile?.nickname });
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
 * dealId별로 참여자 정보를 실시간 업데이트한다.
 */
export function subscribeToParticipations(
  dealId: number,
  callback: (parts: ParticipationWithProfile[]) => void,
): () => void {
  const sb = createClient();

  const loadParticipations = async () => {
    // profile embed — 참여자 아바타에 user_id 대신 실제 닉네임 이니셜을 쓸 수 있게
    const { data, error } = await sb
      .from("participations")
      .select(PARTICIPATION_WITH_PROFILE_SELECT)
      .eq("group_buy_id", dealId);

    if (error) {
      console.error("[subscribeToParticipations]", error.message);
      return;
    }

    callback((data ?? []) as unknown as ParticipationWithProfile[]);
  };

  void loadParticipations();

  const channel = sb
    .channel(`participations:${dealId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "participations",
        filter: `group_buy_id=eq.${dealId}`,
      },
      () => {
        void loadParticipations();
      },
    )
    .subscribe();

  return () => {
    void sb.removeChannel(channel);
  };
}

/**
 * 내부 헬퍼: Supabase 행 → 화면 모델 (Deal) 변환
 */
function rowToDeal(
  row: GroupBuyRow,
  participations?: ParticipationWithProfile[],
  flags?: { me: boolean; mine: boolean; host?: string },
): Deal {
  return {
    id: row.id,
    host_id: row.host_id,
    // host_profile embed가 없거나(고아 host_id 등) 조회에 실패하면 "주최자"로 표시한다.
    host: flags?.host ?? "주최자",
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
    end: new Date(row.deadline).getTime(),
    place: row.place || "채팅방에서 협의",
    store_link: row.store_link || undefined,
    status: row.status,
    created_at: row.created_at,
    participations: participations ?? [],
    me: flags?.me ?? false,
    mine: flags?.mine ?? false,
  };
}
