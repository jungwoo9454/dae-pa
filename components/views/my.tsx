"use client";

import { Ban } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/ui";
import { countdownDisplay, fmt, perAmount, remainLabel, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";

export default function MyView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const mySearch = useStore((s) => s.mySearch);
  const setMySearch = useStore((s) => s.setMySearch);
  const goRoom = useStore((s) => s.goRoom);
  const openSettle = useStore((s) => s.openSettle);
  const deleteDeal = useStore((s) => s.deleteDeal);
  const [askDeleteId, setAskDeleteId] = useState<number | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const myDeals = deals.filter((x) => x.me && (!mySearch || x.title.includes(mySearch)));
  const sel = useStore((s) => s.sel);
  const go = useStore((s) => s.go);

  return (
    <div className="max-w-[860px] flex-1 overflow-auto px-6 py-5">
      <input
        value={mySearch}
        onChange={(e) => setMySearch(e.target.value)}
        placeholder="내 공구 검색"
        className="mb-4 w-[280px] rounded-[10px] border-[1.5px] border-[#d5e6d6] bg-white px-3.5 py-[9px] text-[13.5px] outline-none"
      />
      <div className="flex flex-col gap-2.5">
        {myDeals.map((m) => {
          const deletable = m.mine && m.status === "recruiting";
          const showDeleteDialog = askDeleteId === m.id;
          const cd = countdownDisplay(m, now);
          const left = m.end - now;
          const isClosing = m.status === "recruiting" && left < 3_600_000;

          // 상태별 색상
          let borderColor = "#dbe9da";
          let bgColor = "white";
          let hoverBgColor = "#f9fdf9";
          let textColor = "#6b8573";

          if (m.status === "settling") {
            borderColor = "#0891b2";
            bgColor = "#ecf9ff";
            hoverBgColor = "#cffafe";
            textColor = "#0e7490";
          } else if (m.status === "canceled") {
            borderColor = "#dc2626";
            bgColor = "white";
            hoverBgColor = "#fafafa";
            textColor = "#dc2626";
          } else if (m.status !== "recruiting") {
            borderColor = "#78716c";
            bgColor = "#f5f3f0";
            hoverBgColor = "#ede9e6";
            textColor = "#57534e";
          } else if (left <= 0) {
            borderColor = "#78716c";
            bgColor = "#f5f3f0";
            hoverBgColor = "#ede9e6";
            textColor = "#57534e";
          } else if (isClosing) {
            borderColor = "#d97706";
            bgColor = "#fef3c7";
            hoverBgColor = "#fde68a";
            textColor = "#b45309";
          } else {
            borderColor = "#16a34a";
            bgColor = "#f0fdf4";
            hoverBgColor = "#dcfce7";
            textColor = "#166b3a";
          }

          return (
            <div key={m.id}>
              <div
                onClick={() => {
                  useStore.setState({ sel: m.id });
                  go("detail");
                }}
                className="flex cursor-pointer items-center gap-3.5 rounded-[14px] border px-4 py-3.5 transition-all"
                style={{
                  borderColor,
                  backgroundColor: bgColor,
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBgColor}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = bgColor}
              >
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] text-xl" style={{ backgroundColor: `${cd.color}20` }}>
                  {m.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <b style={{ color: cd.color }}>{m.title}</b>
                    <StatusBadge s={statusOf(m, now)} />
                    <span className="text-[11.5px]" style={{ color: textColor }}>{m.mine ? "주최" : "참여"}</span>
                  </div>
                  <div className="mt-[3px] text-[12.5px]" style={{ color: textColor }}>
                    {m.joined}/{m.goal}명 · ⏱ {remainLabel(m, now)} · 1인 {fmt(perAmount(m))}
                  </div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    goRoom("d" + m.id);
                  }}
                  className="cursor-pointer rounded-[9px] border-[1.5px] border-[#cfe4d0] px-3 py-[7px] text-[13px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
                >
                  채팅
                </div>
                {m.status === "settling" && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      openSettle(m.id);
                    }}
                    className="cursor-pointer rounded-[9px] bg-[#1f8a4c] px-3 py-2 text-[13px] font-extrabold text-white hover:bg-[#187741]"
                  >
                    정산하기
                  </div>
                )}
                {deletable && !showDeleteDialog && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setAskDeleteId(m.id);
                      setDeleteErr(null);
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-[9px] border-[1.5px] border-[#d5e6d6] px-3 py-2 text-[13px] font-bold text-[#4d6d58] hover:border-[#b3261e] hover:text-[#b3261e]"
                  >
                    <Ban className="h-4 w-4" /> 삭제
                  </div>
                )}
              </div>
              {showDeleteDialog && (
                <div className="ml-14 mt-2 rounded-xl bg-[#fdecec] p-3">
                  <div className="text-[13px] font-extrabold text-[#b3261e]">공구를 삭제할까요?</div>
                  <div className="mt-1 text-[12px] text-[#8a6a6a]">
                    되돌릴 수 없어요.
                  </div>
                  {deleteErr && (
                    <div className="mt-2 rounded-[8px] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#b3261e]">
                      {deleteErr}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <div
                      onClick={async () => {
                        if (deleting) return;
                        setDeleting(true);
                        setDeleteErr(null);
                        const err = await deleteDeal(m.id);
                        setDeleting(false);
                        if (err) setDeleteErr(err);
                        else setAskDeleteId(null);
                      }}
                      className="flex-1 cursor-pointer rounded-[10px] bg-[#b3261e] p-2 text-center text-[13px] font-extrabold text-white hover:brightness-110"
                    >
                      {deleting ? "삭제 중…" : "삭제하기"}
                    </div>
                    <div
                      onClick={() => {
                        setAskDeleteId(null);
                        setDeleteErr(null);
                      }}
                      className="flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[#d5e6d6] bg-white p-2 text-center text-[13px] font-bold text-[#4d6d58] hover:border-[#1f8a4c]"
                    >
                      그만두기
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
