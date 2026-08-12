"use client";

import { AlarmClock, Ban, Coins, LogOut, PartyPopper, ReceiptText, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Noti } from "@/lib/types";

const ICON: Record<Noti["type"], LucideIcon> = {
  deadline_soon: AlarmClock,
  total_changed: Coins,
  payment_reminder: Send,
  settle_start: ReceiptText,
  join: PartyPopper,
  cancel: Ban,
  leave: LogOut,
};

function ago(ms: number) {
  const m = Math.floor((Date.now() - ms) / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}

export default function NotiPopover() {
  const notis = useStore((s) => s.notis);
  const openDeal = useStore((s) => s.openDeal);
  return (
    <div className="absolute right-[62px] top-[58px] z-50 flex max-h-[420px] w-[300px] flex-col overflow-hidden rounded-[14px] border border-[#d5e6d6] bg-white shadow-[0_12px_32px_rgba(18,49,30,.18)]">
      <div className="flex-none border-b border-[#eef4ec] px-3.5 py-2.5 font-extrabold">알림</div>
      {notis.length === 0 ? (
        <div className="px-3.5 py-7 text-center text-[13px] text-[#8aa392]">새 알림이 없어요</div>
      ) : (
        <div className="overflow-auto">
          {notis.map((n) => (
            <div
              key={n.id}
              onClick={() => n.dealId && openDeal(n.dealId)}
              className={`flex gap-2.5 border-b border-[#f0f6ef] px-3.5 py-2.5 last:border-b-0 ${
                n.dealId ? "cursor-pointer hover:bg-[#fbfdf9]" : ""
              } ${n.isRead ? "" : "bg-[#e9f6ec]"}`}
            >
              {(() => {
                const Icon = ICON[n.type];
                return <Icon aria-hidden className="mt-0.5 h-[17px] w-[17px] flex-none text-[#1f8a4c]" />;
              })()}
              <div className="min-w-0">
                <div className="text-[13.5px] leading-snug">{n.text}</div>
                <div className="mt-0.5 text-[11.5px] text-[#8aa392]">{ago(n.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
