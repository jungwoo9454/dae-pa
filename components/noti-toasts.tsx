"use client";

import { AlarmClock, Ban, Coins, LogOut, PartyPopper, ReceiptText, Send, X } from "lucide-react";
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

/**
 * 새 알림이 들어오면 우측 하단에 4초간 뜨는 전표 조각 (#161).
 * 사라지는 타이머는 store 가 들고 있어서 화면을 옮겨도 끊기지 않는다.
 */
export default function NotiToasts() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);
  const openDeal = useStore((s) => s.openDeal);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none absolute bottom-6 right-6 z-[60] flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.type];
        return (
          <div
            key={t.id}
            onClick={() => {
              dismissToast(t.id);
              if (t.dealId) openDeal(t.dealId);
            }}
            className={`receipt pointer-events-auto flex w-[290px] items-start gap-2.5 rounded border-l-[3px] border-l-[#e14e2b] px-3.5 py-3 ${
              t.dealId ? "cursor-pointer hover:bg-[#f1efe8]" : ""
            }`}
          >
            <Icon aria-hidden className="mt-0.5 h-[17px] w-[17px] flex-none text-[#e14e2b]" />
            <div className="min-w-0 flex-1 font-sans-ko text-[15px] leading-snug">{t.text}</div>
            <button
              type="button"
              aria-label="닫기"
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(t.id);
              }}
              className="-mr-1 mt-0.5 flex-none text-[#a29b8e] hover:text-[#1b1917]"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
