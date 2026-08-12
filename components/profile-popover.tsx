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
  // 참여·주최 수는 내 공구로 옮겼다 (#84) — 여기서는 신뢰도만 보여준다
  const { trust } = profileStats(deals, now, me?.id ?? null);

  return (
    <div className="absolute right-5 top-[58px] z-50 flex w-[230px] flex-col gap-[9px]  border border-[#c9c9c4] bg-[#fdfdfb] p-3.5 shadow-[0_12px_32px_rgba(18,49,30,.18)]">
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
          <div className="text-xs text-[#6e675e]">{me?.dong ?? "동네 미인증"}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-[#f1efe8] px-2.5 py-1.5 text-[14px] font-bold text-[#1b1917]">
        <ShieldCheck aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 정산 신뢰도 {trust}%
      </div>
      {/* 계좌 입력은 설정 화면에만 둔다 (#160) — 여기 자유 입력 한 칸이 남아 있으면
          설정의 "은행 선택 + 계좌번호"(#155)와 저장 형식이 갈린다 */}
      <div className="h-px bg-[#e2eee2]" />
      <div onClick={() => go("my")} className="cursor-pointer px-0.5 py-1 hover:text-[#e14e2b]">
        내 공구 내역
      </div>
      <div onClick={() => go("pay")} className="cursor-pointer px-0.5 py-1 hover:text-[#e14e2b]">
        대파페이 지갑
      </div>
      <div onClick={() => go("set")} className="cursor-pointer px-0.5 py-1 hover:text-[#e14e2b]">
        알림 · 계좌 설정
      </div>
      <div onClick={logout} className="cursor-pointer px-0.5 py-1 text-[#94a89a] hover:text-[#e14e2b]">
        로그아웃
      </div>
    </div>
  );
}
