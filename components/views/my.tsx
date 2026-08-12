"use client";

import { StatusBadge } from "@/components/ui";
import { fmt, perAmount, perLabel, remainLabel, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";

export default function MyView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const mySearch = useStore((s) => s.mySearch);
  const setMySearch = useStore((s) => s.setMySearch);
  const goRoom = useStore((s) => s.goRoom);
  const openSettle = useStore((s) => s.openSettle);

  const myDeals = deals.filter((x) => x.me && (!mySearch || x.title.includes(mySearch)));

  return (
    <div className="max-w-[860px] flex-1 overflow-auto px-6 py-5">
      <input
        value={mySearch}
        onChange={(e) => setMySearch(e.target.value)}
        placeholder="내 공구 검색"
        className="mb-4 w-[280px] rounded-[10px] border-[1.5px] border-[#d5e6d6] bg-white px-3.5 py-[9px] text-[13.5px] outline-none"
      />
      <div className="flex flex-col gap-2.5">
        {myDeals.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3.5 rounded-[14px] border border-[#dbe9da] bg-white px-4 py-3.5"
          >
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-[#e9f6ec] text-xl">
              {m.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <b>{m.title}</b>
                <StatusBadge s={statusOf(m, now)} />
                <span className="text-[11.5px] text-[#8aa392]">{m.mine ? "주최" : "참여"}</span>
              </div>
              <div className="mt-[3px] text-[12.5px] text-[#6b8573]">
                {m.joined}/{m.goal}명 · ⏱ {remainLabel(m, now)} · {perLabel(m)} {fmt(perAmount(m))}
              </div>
            </div>
            <div
              onClick={() => goRoom("d" + m.id)}
              className="cursor-pointer rounded-[9px] border-[1.5px] border-[#cfe4d0] px-3 py-[7px] text-[13px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
            >
              채팅
            </div>
            {m.status === "settling" && (
              <div
                onClick={() => openSettle(m.id)}
                className="cursor-pointer rounded-[9px] bg-[#1f8a4c] px-3 py-2 text-[13px] font-extrabold text-white hover:bg-[#187741]"
              >
                정산하기
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
