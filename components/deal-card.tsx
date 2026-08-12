"use client";

import { Timer } from "lucide-react";
import { countdownDisplay, fmt, joinLabel, joinable, perAmount, remainLabel, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import type { Deal } from "@/lib/types";
import { ProgressBar, StatusBadge } from "./ui";

export default function DealCard({ deal, now }: { deal: Deal; now: number }) {
  const openDeal = useStore((s) => s.openDeal);
  const openSettle = useStore((s) => s.openSettle);
  const join = useStore((s) => s.join);

  const st = statusOf(deal, now);
  const pct = Math.min(100, Math.round((deal.joined / deal.goal) * 100));
  const closing = st.key === "closing";
  const active = joinable(deal, now);
  const cd = countdownDisplay(deal, now);

  // 상태별 색상 팔레트
  const colorScheme = (() => {
    if (deal.status === "settling") {
      return { primary: "#0e7490", light: "#cffafe", text: "#0e7490", textLight: "#06b6d4", borderHover: "#06b6d4" };
    }
    // 정산중을 제외한 모든 마감된 공고 → 회색
    if (deal.status !== "recruiting") {
      return { primary: "#64748b", light: "#f1f5f9", text: "#64748b", textLight: "#94a3b8", borderHover: "#94a3b8" };
    }
    // recruiting 상태에서 시간 초과 → 회색
    if (deal.end - now <= 0) {
      return { primary: "#64748b", light: "#f1f5f9", text: "#64748b", textLight: "#94a3b8", borderHover: "#94a3b8" };
    }
    // 마감임박 → 주황색
    if (closing) {
      return { primary: "#d97706", light: "#fef3c7", text: "#b45309", textLight: "#d97706", borderHover: "#d97706" };
    }
    // 모집중 → 초록색
    return { primary: "#1f8a4c", light: "#e9f6ec", text: "#1f8a4c", textLight: "#4ade80", borderHover: "#9fd4ae" };
  })();

  const onJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.status === "settling") openSettle(deal.id);
    else join(deal.id);
  };

  return (
    <div
      onClick={() => openDeal(deal.id)}
      className="flex cursor-pointer flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(18,49,30,.05)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(18,70,38,.13)]"
      style={{ borderColor: colorScheme.primary, borderWidth: "1px" }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-[22px]" style={{ backgroundColor: colorScheme.light }}>
          {deal.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-extrabold">
            {deal.title}
          </div>
          <div className="text-xs" style={{ color: colorScheme.text }}>
            {deal.cat} · {deal.host}
          </div>
        </div>
        <StatusBadge s={st} />
      </div>
      <ProgressBar pct={pct} color={colorScheme.primary} />
      <div className="flex items-center justify-between text-[13px]">
        <span className="whitespace-nowrap" style={{ color: colorScheme.text }}>
          <b>{deal.joined}</b>
          <span style={{ color: colorScheme.textLight }}>/{deal.goal}명</span>
        </span>
        <span className="tnum inline-flex items-center gap-1 font-extrabold" style={{ color: colorScheme.primary }}>
          <Timer aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> {remainLabel(deal, now)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[13px]" style={{ color: colorScheme.text }}>
          1인 <b className="text-[15px]" style={{ color: colorScheme.primary }}>{fmt(perAmount(deal))}</b>
        </div>
        <div
          onClick={onJoin}
          className="cursor-pointer rounded-[10px] px-4 py-2 text-[13.5px] font-extrabold hover:brightness-105"
          style={{
            backgroundColor: active || deal.status === "settling" ? colorScheme.primary : colorScheme.light,
            color: active || deal.status === "settling" ? "white" : colorScheme.text,
          }}
        >
          {joinLabel(deal, now)}
        </div>
      </div>
    </div>
  );
}
