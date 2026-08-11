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

  // 토스 결제창에서 /api/payments/confirm 을 거쳐 ?topup=ok|fail 로 돌아온 경우 (#14).
  // 로그인 복원이 page 를 "home" 으로 덮어쓰기 때문에 authReady 이후에 실행한다.
  useEffect(() => {
    if (!authReady) return;
    const topup = new URLSearchParams(window.location.search).get("topup");
    if (topup !== "ok" && topup !== "fail") return;
    window.history.replaceState({}, "", "/"); // 새로고침 때 결과 띠가 다시 뜨지 않게
    // 로그아웃 상태로 이 주소에 들어오면 로그인 화면을 그대로 둔다 — go("pay") 는
    // page:"login" 을 덮어써서 비로그인 사용자에게 앱 껍데기를 보여준다.
    // me 로 판단하면 안 된다 — me 는 profiles 조회 뒤에 채워져서 이 시점엔 아직 null 이다.
    // page 는 authReady 와 같은 set() 에서 정해지므로 여기서 이미 확정돼 있다.
    if (useStore.getState().page === "login") return;
    useStore.getState().setTopupResult(topup);
    useStore.getState().go("pay");
  }, [authReady]);

  if (!ready || !authReady) return null;
  return <App />;
}
