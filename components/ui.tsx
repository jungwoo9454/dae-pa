"use client";

import type { StatusView } from "@/lib/deal";

export function StatusBadge({ s }: { s: StatusView }) {
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export function ProgressBar({ pct, color = "#1f8a4c", h = 9 }: { pct: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-[#e6efe4]" style={{ height: h }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color, transition: "width .4s" }}
      />
    </div>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="box-border h-[26px] w-[46px] cursor-pointer rounded-full p-[3px]"
      style={{ background: on ? "#1f8a4c" : "#cbd8cc", transition: "background .2s" }}
    >
      <div
        className="h-5 w-5 rounded-full bg-white"
        style={{ transform: `translateX(${on ? 20 : 0}px)`, transition: "transform .2s" }}
      />
    </div>
  );
}

export function Avatar({ ch, size = 30 }: { ch: string; size?: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-[#dceede] text-xs font-extrabold text-[#2f6d45]"
      style={{ width: size, height: size }}
    >
      {ch}
    </div>
  );
}
