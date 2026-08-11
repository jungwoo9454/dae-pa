"use client";

import { useEffect } from "react";
import { subscribeToSettlement } from "@/lib/supabase/queries";
import { useStore } from "@/lib/store";

/**
 * settlements + settlement_votes Realtime 구독 + store 자동 갱신 (#62).
 * use-realtime-participations.ts 와 같은 패턴 — settle.tsx 에서 호출한다.
 */
export function useRealtimeSettlement(dealId: number | null): void {
  useEffect(() => {
    if (!dealId) return;

    const unsubscribe = subscribeToSettlement(dealId, (settlement) => {
      useStore.setState((st) => ({
        deals: st.deals.map((d) => (d.id === dealId ? { ...d, settlement: settlement ?? undefined } : d)),
      }));
    });

    return () => {
      unsubscribe();
    };
  }, [dealId]);
}
