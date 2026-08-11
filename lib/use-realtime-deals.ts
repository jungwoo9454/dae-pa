"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchDeals } from "@/lib/supabase/queries";
import { useStore } from "@/lib/store";
import { CAT_EMOJI } from "@/lib/deal";
import type { GroupBuyRow } from "@/lib/db-types";
import type { Category } from "@/lib/types";

/**
 * 홈 목록 Realtime 갱신 (#4 Task 4 마무리) — group_buys 테이블 변경을 구독해서
 * store.deals를 최신 상태로 유지한다.
 *
 * UPDATE만으로 참여자 수·총액·상태 변화를 전부 커버한다:
 * - joined/status는 join_group_buy 등 security definer RPC가 바꾸는 컬럼이라 클라이언트가
 *   직접 못 건드리지만(supabase/schema.sql GRANT 참고), RPC가 만든 UPDATE도 동일하게
 *   postgres_changes로 브로드캐스트된다 — 그래서 이 하나의 구독으로 "다른 세션 참여"와
 *   "호스트의 총액/설명 수정" 둘 다 잡힌다.
 * - group_buys.joined는 RPC가 원자적으로 유지하는 값이라, 상세(useRealtimeParticipations)처럼
 *   participations를 다시 세지 않고 payload.new를 그대로 반영한다 — fetchDeals와 같은 source of truth.
 *
 * INSERT(새 공구 등록)는 필드를 그대로 옮기는 대신 fetchDeals(category)로 다시 불러온다 —
 * me/mine 계산과 카테고리 필터 판정을 fetchDeals와 어긋나지 않게 재사용하기 위해서다.
 *
 * store.deals에 없는(현재 필터에 안 걸리는) 공구의 이벤트는 무시한다 — 필터링은 fetchDeals가
 * 이미 담당하므로 이 훅에서 다시 필터 로직을 만들지 않는다.
 */
export function useRealtimeDeals(filter: string): void {
  useEffect(() => {
    const sb = createClient();
    const category = filter === "전체" ? undefined : (filter as Category);

    const channel = sb
      .channel("home-group-buys")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_buys" },
        (payload) => {
          const row = payload.new as GroupBuyRow;
          useStore.setState((st) => {
            if (!st.deals.some((d) => d.id === row.id)) return {};
            return {
              deals: st.deals.map((d) =>
                d.id === row.id
                  ? {
                      ...d,
                      title: row.title,
                      description: row.description || undefined,
                      cat: row.category,
                      emoji: CAT_EMOJI[row.category],
                      total: row.total_amount,
                      deliveryFee: row.delivery_fee,
                      goal: row.goal,
                      joined: row.joined,
                      end: new Date(row.deadline).getTime(),
                      place: row.place || "채팅방에서 협의",
                      store_link: row.store_link || undefined,
                      status: row.status,
                    }
                  : d,
              ),
            };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_buys" },
        () => {
          void fetchDeals(category).then((deals) => useStore.setState({ deals }));
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [filter]);
}
