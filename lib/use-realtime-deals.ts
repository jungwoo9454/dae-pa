"use client";

import { useEffect } from "react";
import { subscribePg } from "@/lib/supabase/realtime";
import { fetchDeals } from "@/lib/supabase/queries";
import { useStore } from "@/lib/store";
import { CAT_EMOJI } from "@/lib/deal";
import type { GroupBuyRow } from "@/lib/db-types";

/**
 * 홈 목록 Realtime 갱신 (#4 Task 4 마무리) — group_buys 테이블 변경을 구독해서
 * store.deals를 최신 상태로 유지한다.
 *
 * store.deals는 홈 전용이 아니라 my.tsx/profile-popover.tsx/top-bar.tsx(notifyDeadlines)/
 * chat.tsx/settle.tsx가 전체 목록이라고 가정하고 공유해서 쓴다(#4 리뷰) — 그래서 카테고리로
 * 거르지 않고 항상 전체를 대상으로 구독·갱신한다. 홈 화면에 보여줄 목록만 home.tsx가
 * 클라이언트에서 필터링한다.
 *
 * UPDATE만으로 참여자 수·총액·상태 변화를 전부 커버한다:
 * - joined/status는 join_group_buy 등 security definer RPC가 바꾸는 컬럼이라 클라이언트가
 *   직접 못 건드리지만(supabase/schema.sql GRANT 참고), RPC가 만든 UPDATE도 동일하게
 *   postgres_changes로 브로드캐스트된다 — 그래서 이 하나의 구독으로 "다른 세션 참여"와
 *   "호스트의 총액/설명 수정" 둘 다 잡힌다.
 * - group_buys.joined는 RPC가 원자적으로 유지하는 값이라, 상세(useRealtimeParticipations)처럼
 *   participations를 다시 세지 않고 payload.new를 그대로 반영한다 — fetchDeals와 같은 source of truth.
 *
 * INSERT(새 공구 등록)는 필드를 그대로 옮기는 대신 fetchDeals()로 전체를 다시 불러온다 —
 * me/mine 계산을 fetchDeals와 어긋나지 않게 재사용하기 위해서다. 단, 이미 store에 있던
 * participations는 그대로 유지한다 — fetchDeals는 목록용이라 participations가 비어 있다.
 */
export function useRealtimeDeals(): void {
  useEffect(() => {
    return subscribePg("home-group-buys", [
      {
        event: "UPDATE",
        table: "group_buys",
        handler: (payload) => {
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
                      imageUrl: row.image_url,
                      store_link: row.store_link || undefined,
                      status: row.status,
                    }
                  : d,
              ),
            };
          });
        },
      },
      {
        // 삭제도 실시간으로 빠져야 홈에서 파쇄 애니메이션이 돈다 (#174).
        // group_buys 는 replica identity 가 기본(PK)이라 old 에는 id 만 실려 온다 — 그거면 충분하다.
        event: "DELETE",
        table: "group_buys",
        handler: (payload) => {
          const gone = (payload.old as { id?: number }).id;
          if (gone == null) return;
          useStore.setState((st) => ({ deals: st.deals.filter((d) => d.id !== gone) }));
        },
      },
      {
        event: "INSERT",
        table: "group_buys",
        handler: () => {
          void fetchDeals().then((fresh) =>
            useStore.setState((st) => {
              // fetchDeals는 목록용이라 participations를 비운 채로 준다 — 이미 상세에서
              // 불러둔 참여자 정보를 통째로 덮어쓰면 아바타가 사라진다 (#72).
              const kept = new Map(st.deals.map((d) => [d.id, d.participations]));
              return {
                deals: fresh.map((d) => {
                  const parts = kept.get(d.id);
                  return parts ? { ...d, participations: parts } : d;
                }),
              };
            }),
          );
        },
      },
    ]);
  }, []);
}
