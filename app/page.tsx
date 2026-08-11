"use client";

import { useEffect, useState } from "react";
import App from "@/components/app";
import { useStore } from "@/lib/store";

/**
 * 프로토타입은 전부 클라이언트 상태(카운트다운 포함)라
 * SSR 하이드레이션 불일치를 피하려고 마운트 후에만 렌더한다.
 */
export default function Page() {
  const [ready, setReady] = useState(false);
  const authReady = useStore((s) => s.authReady);
  useEffect(() => {
    setReady(true);
    // 세션 복원·소셜 로그인 착지·로그아웃 전부 여기 구독으로 처리된다
    return useStore.getState().initAuth();
  }, []);
  if (!ready || !authReady) return null;
  return <App />;
}
