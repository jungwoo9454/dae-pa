"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import type { PageKey } from "@/lib/types";

const TITLES: Record<PageKey, string> = {
  login: "로그인",
  home: "홈",
  detail: "공고 상세",
  my: "내 공구",
  chat: "채팅",
  pay: "대파페이",
  new: "공구 올리기",
  set: "설정",
  settle: "정산",
};

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

  useEffect(() => {
    if (!uid) return;
    const { notifyDeadlines } = useStore.getState();
    notifyDeadlines();
    const t = setInterval(notifyDeadlines, 30_000);
    return () => clearInterval(t);
  }, [uid, deals]);

  return (
    <div className="flex flex-none items-center gap-3 border-b border-[#dde9dc] bg-white px-6 py-3">
      <div className="font-jua text-[19px]">{TITLES[page]}</div>
      <span className="flex-1" />
      <div
        onClick={() => go("new")}
        className="cursor-pointer rounded-[10px] bg-[#1f8a4c] px-3.5 py-2 text-[13.5px] font-bold text-white hover:bg-[#187741]"
      >
        + 공구 올리기
      </div>
      <div
        onClick={toggleNoti}
        title="알림"
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-[#9fd4ae] bg-white text-[15px] hover:bg-[#e9f6ec]"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-[#d97706] px-1 text-center text-[10.5px] font-extrabold leading-[17px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>
      <div
        onClick={toggleProfile}
        title={me?.nickname}
        className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-[#9fd4ae] bg-[#cde8d2] font-extrabold text-[#14532d]"
      >
        {me?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 소셜 아바타는 외부 도메인이라 next/image 설정 없이 쓴다
          <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          (me?.nickname[0] ?? "파")
        )}
      </div>
    </div>
  );
}
