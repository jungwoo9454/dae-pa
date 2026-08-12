"use client";

import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import type { PageKey } from "@/lib/types";

/**
 * 상단 단말 바 (#143) — 예전 좌측 사이드바를 대신한다.
 * 화면 제목은 각 화면이 직접 큰 머리글로 들고 있어서 여기선 이동만 담당한다.
 */
const NAV: { key: PageKey; label: string }[] = [
  { key: "home", label: "홈" },
  { key: "my", label: "내 공구" },
  { key: "chat", label: "채팅" },
  { key: "pay", label: "대파페이" },
  { key: "set", label: "설정" },
];

export default function TopBar() {
  const page = useStore((s) => s.page);
  const go = useStore((s) => s.go);
  const me = useStore((s) => s.me);
  const toggleProfile = useStore((s) => s.toggleProfile);
  const toggleNoti = useStore((s) => s.toggleNoti);
  const unread = useStore((s) => s.notis.filter((n) => !n.isRead).length);

  // 마감 30분 전 알림은 클라이언트에서 주기적으로 확인한다 (Supabase cron 대신).
  // 공구가 새로 생기면 바로 한 번 더 본다 — 마감 30분 안쪽으로 올릴 수 있어서.
  const uid = me?.id;
  const deals = useStore((s) => s.deals);

  useEffect(() => {
    if (!uid) return;
    return useStore.getState().initNotis(uid);
  }, [uid]);

  // 채팅은 어느 화면에 있든 받아야 해서 채팅 화면이 아니라 여기서 구독한다 (#7)
  useEffect(() => {
    if (!uid) return;
    return useStore.getState().initChat(uid);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const { notifyDeadlines } = useStore.getState();
    notifyDeadlines();
    const t = setInterval(notifyDeadlines, 30_000);
    return () => clearInterval(t);
  }, [uid, deals]);

  const isActive = (k: PageKey) =>
    page === k || (k === "home" && page === "detail") || (k === "my" && page === "settle");

  return (
    <div className="flex h-[66px] flex-none items-center gap-6 bg-[#141210] px-8">
      <span className="text-[21.5px] font-bold tracking-[.04em] text-white">
        DAEPA_POS<span className="text-[#e14e2b]">★</span>
      </span>
      <div className="flex items-center gap-1.5 text-[14.5px] font-semibold">
        {NAV.map((n) => (
          <div
            key={n.key}
            onClick={() => go(n.key)}
            className={`cursor-pointer rounded-lg px-4 py-[7px] ${
              isActive(n.key)
                ? "border border-[#4a4540] text-white"
                : "border border-transparent text-[#9b948c] hover:text-white"
            }`}
          >
            {n.label}
          </div>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div
          onClick={toggleNoti}
          title="알림"
          className="relative cursor-pointer text-white hover:text-[#e14e2b]"
        >
          <Bell aria-hidden className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full border-2 border-[#141210] bg-[#e14e2b] px-1 text-center text-[11px] font-bold leading-[14px] text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </div>
        <div
          onClick={toggleProfile}
          title={me?.nickname}
          className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#f0e4d2] text-sm font-extrabold text-[#6b4e1e]"
        >
          {me?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 소셜 아바타는 외부 도메인이라 next/image 설정 없이 쓴다
            <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (me?.nickname[0] ?? "파")
          )}
        </div>
        <div
          onClick={() => go("new")}
          className="key key-primary flex h-11 items-center px-5 text-sm"
        >
          + 공구 올리기
        </div>
      </div>
    </div>
  );
}
