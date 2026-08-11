"use client";

import { ShieldCheck } from "lucide-react";
import { profileStats } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";

export default function ProfilePopover() {
  const go = useStore((s) => s.go);
  const me = useStore((s) => s.me);
  const logout = useStore((s) => s.logout);
  const deals = useStore((s) => s.deals);
  const now = useNow();
  const { hosted, joined, trust } = profileStats(deals, now, me?.id ?? null);
  return (
    <div className="absolute right-5 top-[58px] z-50 flex w-[230px] flex-col gap-[9px] rounded-[14px] border border-[#d5e6d6] bg-white p-3.5 shadow-[0_12px_32px_rgba(18,49,30,.18)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-full bg-[#cde8d2] font-extrabold text-[#14532d]">
          {me?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 소셜 아바타는 외부 도메인이라 next/image 설정 없이 쓴다
            <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (me?.nickname[0] ?? "파")
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate font-extrabold">{me?.nickname ?? "파티원"}</div>
          <div className="text-xs text-[#6b8573]">
            {me?.dong ? `${me.dong} · ` : ""}참여 {joined} · 주최 {hosted}
          </div>
        </div>
      </div>
      <div className="rounded-lg bg-[#e9f6ec] px-2.5 py-1.5 text-[12.5px] font-bold text-[#166b3a]">
        <ShieldCheck aria-hidden className="inline-block h-[1em] w-[1em] shrink-0 translate-y-[.09em]" /> 정산 신뢰도 {trust}%
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
