"use client";

import { useStore } from "@/lib/store";
import type { PageKey } from "@/lib/types";

const NAV: { key: PageKey; label: string }[] = [
  { key: "home", label: "홈" },
  { key: "my", label: "내 공구" },
  { key: "chat", label: "채팅" },
  { key: "pay", label: "대파페이" },
  { key: "set", label: "설정" },
];

export default function Sidebar() {
  const page = useStore((s) => s.page);
  const go = useStore((s) => s.go);
  const isActive = (k: PageKey) =>
    page === k || (k === "home" && page === "detail") || (k === "my" && page === "settle");
  return (
    <div className="flex w-48 flex-none flex-col gap-0.5 bg-[#12311e] px-2.5 py-4 text-[#e9f4ec]">
      <div className="px-3 pb-5 pt-2">
        <div className="font-jua text-[32px] leading-none text-white">
          대<span className="text-[#7fdc95]">파</span>
        </div>
        <div className="mt-[5px] text-[11.5px] tracking-[.5px] text-[#8fbf9a]">
          대용량 파티원 · 같이 사면 이득
        </div>
      </div>
      {NAV.map((n) => (
        <div
          key={n.key}
          onClick={() => go(n.key)}
          className={`cursor-pointer rounded-[10px] px-3 py-2.5 text-sm font-bold ${
            isActive(n.key) ? "bg-[#1f8a4c] text-white" : "text-[#bcd6c2] hover:bg-white/10"
          }`}
        >
          {n.label}
        </div>
      ))}
      <div className="mt-auto px-3 py-2.5 text-[11px] text-[#6f9c7c]">대파 v0.1 프로토타입</div>
    </div>
  );
}
