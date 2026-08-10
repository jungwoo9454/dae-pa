"use client";

import { useEffect, useState } from "react";

/** 1초마다 갱신되는 현재 시각 — 카운트다운/상태 배지 파생용 */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
