"use client";

import { useStore } from "@/lib/store";

export default function ProfilePopover() {
  const go = useStore((s) => s.go);
  const logout = useStore((s) => s.logout);
  return (
    <div className="absolute right-5 top-[58px] z-50 flex w-[230px] flex-col gap-[9px] rounded-[14px] border border-[#d5e6d6] bg-white p-3.5 shadow-[0_12px_32px_rgba(18,49,30,.18)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#cde8d2] font-extrabold text-[#14532d]">
          파
        </div>
        <div>
          <div className="font-extrabold">파티원</div>
          <div className="text-xs text-[#6b8573]">참여 12 · 주최 3</div>
        </div>
      </div>
      <div className="rounded-lg bg-[#e9f6ec] px-2.5 py-1.5 text-[12.5px] font-bold text-[#166b3a]">
        🥬 정산 신뢰도 100%
      </div>
      <div className="h-px bg-[#e2eee2]" />
      <div onClick={() => go("my")} className="cursor-pointer px-0.5 py-1 hover:text-[#1f8a4c]">
        내 공구 내역
      </div>
      <div onClick={() => go("pay")} className="cursor-pointer px-0.5 py-1 hover:text-[#1f8a4c]">
        대파페이 지갑
      </div>
      <div onClick={() => go("set")} className="cursor-pointer px-0.5 py-1 hover:text-[#1f8a4c]">
        알림 · 계좌 설정
      </div>
      <div onClick={logout} className="cursor-pointer px-0.5 py-1 text-[#94a89a] hover:text-[#1f8a4c]">
        로그아웃
      </div>
    </div>
  );
}
