"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 목표값까지 숫자를 굴려 올린다 (#174) — 대파페이 금고 잔액용.
 * 처음에는 0 에서 시작하고, 그 뒤로는 직전 값에서 새 값까지 이어서 굴린다
 * (충전·출금하면 바뀐 금액까지만 움직인다).
 */
export function useCountUp(target: number, ms = 900) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      // ease-out — 빠르게 올라가다 끝에서 잦아든다
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return shown;
}
