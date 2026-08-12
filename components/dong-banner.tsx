"use client";

import { MapPin, X } from "lucide-react";
import { useState } from "react";
import { isSubmitEnter } from "@/lib/keys";
import { useStore } from "@/lib/store";

/**
 * 소셜 가입 사용자는 profiles.dong 이 null 이다 (#83) — 첫 로그인 때 동네를 적도록 유도한다.
 * 확정하면 saveProfile 이 me.dong 을 채워서 이 배너는 스스로 사라진다.
 */
export default function DongBanner() {
  const me = useStore((s) => s.me);
  const dongValue = useStore((s) => s.dongValue);
  const setDongValue = useStore((s) => s.setDongValue);
  const confirmDong = useStore((s) => s.confirmDong);
  const [hidden, setHidden] = useState(false);

  if (!me || me.dong || hidden) return null;

  return (
    <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-[12px] border-[1.5px] border-dashed border-[#9fd4ae] bg-[#f5faf4] px-4 py-3">
      <MapPin aria-hidden className="h-[18px] w-[18px] flex-none text-[#1f8a4c]" />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-extrabold">동네 인증이 아직이에요</div>
        <div className="text-xs text-[#6b8573]">우리 동네를 적으면 이웃 공구가 더 잘 보여요</div>
      </div>
      <input
        value={dongValue}
        onChange={(e) => setDongValue(e.target.value)}
        onKeyDown={(e) => isSubmitEnter(e) && confirmDong()}
        placeholder="동네 이름 — 예: 역삼동"
        className="w-[180px] flex-none rounded-[9px] border-[1.5px] border-[#d5e6d6] bg-white px-3 py-[7px] text-[13px] outline-none focus:border-[#1f8a4c]"
      />
      <div
        onClick={confirmDong}
        className="flex-none cursor-pointer rounded-[9px] bg-[#1f8a4c] px-3 py-[7px] text-[12.5px] font-extrabold text-white hover:brightness-105"
      >
        확정
      </div>
      <X
        aria-label="닫기"
        onClick={() => setHidden(true)}
        className="h-4 w-4 flex-none cursor-pointer text-[#8aa392] hover:text-[#17301f]"
      />
    </div>
  );
}
