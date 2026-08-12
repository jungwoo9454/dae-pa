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
    <div className="receipt absolute right-[150px] top-[70px] z-50 flex max-h-[420px] w-[300px] flex-col overflow-hidden">
      <div className="rule-dash receipt-head flex-none border-b border-t-0 px-3.5 py-3 text-[13.5px] tracking-[.4em]">＊ 알림 ＊</div>
      {notis.length === 0 ? (
        <div className="px-3.5 py-7 text-center text-[14.5px] text-[#8b8478]">새 알림이 없어요</div>
      ) : (
        <div className="overflow-auto">
          {notis.map((n) => (
            <div
              key={n.id}
              onClick={() => n.dealId && openDeal(n.dealId)}
              className={`flex gap-2.5 rule-dot px-3.5 py-3 last:border-b-0 ${
                n.dealId ? "cursor-pointer hover:bg-[#f1efe8]" : ""
              } ${n.isRead ? "" : "border-l-[3px] border-l-[#e14e2b]"}`}
            >
              {(() => {
                const Icon = ICON[n.type];
                return <Icon aria-hidden className="mt-0.5 h-[17px] w-[17px] flex-none text-[#e14e2b]" />;
              })()}
              <div className="min-w-0">
                <div className="font-sans-ko text-[15px] leading-snug">{n.text}</div>
                <div className="mt-0.5 text-[12.5px] text-[#9c9ca3]">{ago(n.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
