"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { profileStats } from "@/lib/deal";
import { isSubmitEnter } from "@/lib/keys";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";

export default function ProfilePopover() {
  const go = useStore((s) => s.go);
  const me = useStore((s) => s.me);
  const logout = useStore((s) => s.logout);
  const deals = useStore((s) => s.deals);
  const saveProfile = useStore((s) => s.saveProfile);
  const now = useNow();
  // 참여·주최 수는 내 공구로 옮겼다 (#84) — 여기서는 신뢰도만 보여준다
  const { trust } = profileStats(deals, now, me?.id ?? null);
  const [bank, setBank] = useState(me?.bankAccount ?? "");

  const saveBank = () => saveProfile({ bankAccount: bank.trim() || null });

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
          <div className="text-xs text-[#6b8573]">{me?.dong ?? "동네 미인증"}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-[#e9f6ec] px-2.5 py-1.5 text-[12.5px] font-bold text-[#166b3a]">
        <ShieldCheck aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 정산 신뢰도 {trust}%
      </div>
      <div className="h-px bg-[#e2eee2]" />
      {/* 계좌는 설정 화면까지 가지 않고 여기서 바로 고친다 (#84) — 저장은 설정과 같은 saveProfile */}
      <div>
        <div className="mb-1 text-[11.5px] font-extrabold text-[#6b8573]">정산 받을 계좌</div>
        <div className="flex gap-1.5">
          <input
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            onKeyDown={(e) => isSubmitEnter(e) && saveBank()}
            placeholder="초록은행 1104-04"
            className="w-full min-w-0 rounded-[9px] border-[1.5px] border-[#d5e6d6] bg-white px-2.5 py-[6px] text-[12.5px] outline-none focus:border-[#1f8a4c]"
          />
          <button
            onClick={saveBank}
            className="flex-none cursor-pointer rounded-[9px] bg-[#1f8a4c] px-2.5 py-[6px] text-[12px] font-extrabold text-white hover:bg-[#187741]"
          >
            저장
          </button>
        </div>
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
