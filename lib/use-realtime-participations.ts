"use client";

import { useEffect } from "react";
import { subscribeToParticipations } from "@/lib/supabase/queries";
import { useStore } from "@/lib/store";

/**
 * participations Realtime 구독 + store 자동 갱신
 *
 * 사용:
 *   export default function DetailView() {
 *     const sel = useStore((s) => s.sel);
 *     useRealtimeParticipations(sel);
 *     const deal = useStore((s) => s.deals.find(d => d.id === sel));
 *     // deal.joined와 deal.participations이 실시간 갱신됨
 *   }
 */
export function useRealtimeParticipations(dealId: number | null): void {
  useEffect(() => {
    // dealId 없으면 구독하지 않음
    if (!dealId) return;

    // subscribeToParticipations 호출:
    // 1. 초기 데이터 로드 (Task 2에서 구현)
    // 2. Realtime 구독 시작
    // 3. 변경 시마다 callback 호출
    const unsubscribe = subscribeToParticipations(dealId, (parts) => {
      // store의 deals 배열에서 해당 공구 찾아 갱신
      useStore.setState((st) => ({
        deals: st.deals.map((d) =>
          d.id === dealId
            ? {
                ...d,
                joined: parts.length,  // participations 수 = 참여자 수
                participations: parts,  // 최신 참여자 정보
              }
            : d
        ),
      }));
    });

    // cleanup: 컴포넌트 언마운트 시 구독 해제
    return () => {
      unsubscribe();
    };
  }, [dealId]);  // dealId 변경 시만 재구독
}
