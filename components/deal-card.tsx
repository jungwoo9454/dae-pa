"use client";

import { Timer } from "lucide-react";
import { fmt, joinLabel, joinable, perAmount, perLabel, remainLabel, settleStartable, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import type { Deal } from "@/lib/types";
import { ProgressBar, StatusBadge } from "./ui";

export default function DealCard({ deal, now }: { deal: Deal; now: number }) {
  const openDeal = useStore((s) => s.openDeal);
  const openSettle = useStore((s) => s.openSettle);
  const join = useStore((s) => s.join);

  const st = statusOf(deal, now);
  const pct = Math.min(100, Math.round((deal.joined / deal.goal) * 100));
  const active = joinable(deal, now);
  // 마감·취소 카드는 배경까지 죽여서 모집중 카드와 한눈에 구분한다 (#89).
  // 색은 statusOf 가 이미 쓰는 bg/fg 만 재사용한다 (CLAUDE.md — 임의 팔레트 금지).
  const dimmed = st.key === "closed" || st.key === "canceled";

  // 정원 미달 마감 → 주최자만 보이는 '정산 시작' (#131). 시작 후 정산 화면까지 여는 흐름이
  // 상세에만 있어서 카드에서는 상세로 넘긴다 — 라벨만 바뀌고 눌러도 안 되는 걸 막는다.
  const startable = settleStartable(deal, now);

  const onJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.status === "settling") openSettle(deal.id);
    else if (startable) openDeal(deal.id);
    else join(deal.id);
  };

  return (
    <div
      onClick={() => openDeal(deal.id)}
      className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl border p-5 shadow-[0_1px_2px_rgba(18,49,30,.05)] transition-all duration-150 ${
        dimmed
          ? "border-[#e3e7e6] bg-[#f4f6f5]"
          : "border-[#dbe9da] bg-white hover:-translate-y-0.5 hover:border-[#9fd4ae] hover:shadow-[0_8px_20px_rgba(18,70,38,.13)]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-xl text-[22px]" style={{ backgroundColor: st.bg }}>
          {deal.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */
            <img src={deal.imageUrl} alt="" className={`h-full w-full object-cover ${dimmed ? "grayscale" : ""}`} />
          ) : (
            deal.emoji
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[17px] font-extrabold">
            {deal.title}
          </div>
          <div className="text-xs text-[#6b8573]">
            {deal.cat} · {deal.host}
          </div>
        </div>
        <StatusBadge s={st} />
      </div>
      <ProgressBar pct={pct} color={st.fg} />
      <div className="flex items-center justify-between text-[13px]">
        <span className="whitespace-nowrap">
          <b>{deal.joined}</b>
          <span className="text-[#6b8573]">/{deal.goal}명</span>
        </span>
        <span className="tnum inline-flex items-center gap-1 font-extrabold" style={{ color: st.fg }}>
          <Timer aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> {remainLabel(deal, now)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-[#6b8573]">
          {perLabel(deal)} <b className="text-[15px] text-[#17301f]">{fmt(perAmount(deal))}</b>
        </div>
        <div
          onClick={onJoin}
          className={`cursor-pointer rounded-[10px] px-4 py-2 text-[13.5px] font-extrabold hover:brightness-105 ${
            active || startable || deal.status === "settling"
              ? "bg-[#1f8a4c] text-white"
              : "bg-[#e6efe4] text-[#6b8573]"
          }`}
        >
          {joinLabel(deal, now)}
        </div>
      </div>
    </div>
  );
}
