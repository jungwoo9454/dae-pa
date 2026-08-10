"use client";

import { useEffect, useState } from "react";
import App from "@/components/app";

/**
 * 프로토타입은 전부 클라이언트 상태(카운트다운 포함)라
 * SSR 하이드레이션 불일치를 피하려고 마운트 후에만 렌더한다.
 */
export default function Page() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return <App />;
}
