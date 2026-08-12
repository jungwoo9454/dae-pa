"use client";
import { useEffect } from "react";
import DealCard from "@/components/deal-card";
import { statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { fetchDeals } from "@/lib/supabase/queries";
import { useRealtimeDeals } from "@/lib/use-realtime-deals";

const CATS = ["전체", "식료품", "배달음식", "생활용품", "대량구매", "기타"];
const STATUS_FILTERS = ["전체", "모집중", "마감임박"];

export default function HomeView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const statusFilter = useStore((s) => s.statusFilter);
  const setStatusFilter = useStore((s) => s.setStatusFilter);
  const myDealsOnly = useStore((s) => s.myDealsOnly);
  const setMyDealsOnly = useStore((s) => s.setMyDealsOnly);

  // 목록 카드의 참여자 수/총액/상태 등을 실시간 반영 — 다른 세션 참여, 총액 변경, 정원
  // 도달로 인한 settling 전환이 필터를 유지한 채로 카드에 바로 보인다
  useRealtimeDeals();

  // store.deals는 홈 전용이 아니다 — my.tsx/profile-popover.tsx/top-bar.tsx(notifyDeadlines)/
  // chat.tsx/settle.tsx가 전체 목록이라고 가정하고 그대로 쓴다. 그래서 여기서 서버 카테고리
  // 필터로 fetchDeals(cat)를 부르면 그 화면들이 전부 "현재 홈 필터에 걸린 것만" 보게 돼서
  // 조용히 깨진다 — 예: 다른 카테고리로 공유된 카드가 chat.tsx에서 안 보임 (#4 리뷰).
  // 그래서 여기선 항상 전체를 불러오고, 화면에 보여줄 목록만 클라이언트에서 거른다.
  useEffect(() => {
    (async () => {
      const deals = await fetchDeals();
      useStore.setState({ deals });
    })();
  }, []);

  // 취소된 공구는 모집 목록에서 뺀다 — 내 공구·채팅방에는 기록으로 남는다 (#29)
  const cards = deals.filter((d) => {
    if (d.status === "canceled") return false;
    if (filter !== "전체" && d.cat !== filter) return false;
    if (myDealsOnly && !d.me) return false;
    // 마감임박 판정은 statusOf 한 곳에만 둔다 (1시간 임계값 중복 금지)
    const key = statusOf(d, now).key;
    if (statusFilter === "모집중") return key === "recruiting" || key === "closing";
    if (statusFilter === "마감임박") return key === "closing";
    return true;
  });
  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <div
            key={c}
            onClick={() => setFilter(c)}
            className={`cursor-pointer rounded-full border-[1.5px] px-[15px] py-[7px] text-[13px] font-bold ${
              filter === c
                ? "border-[#1f8a4c] bg-[#1f8a4c] text-white"
                : "border-[#d5e6d6] bg-white text-[#4d6d58] hover:border-[#1f8a4c]"
            }`}
          >
            {c}
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <div
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`cursor-pointer rounded-full border-[1.5px] px-[15px] py-[7px] text-[13px] font-bold ${
              statusFilter === s
                ? "border-[#1f8a4c] bg-[#1f8a4c] text-white"
                : "border-[#d5e6d6] bg-white text-[#4d6d58] hover:border-[#1f8a4c]"
            }`}
          >
            {s}
          </div>
        ))}
        <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-[#4d6d58]">
          <input
            type="checkbox"
            checked={myDealsOnly}
            onChange={(e) => setMyDealsOnly(e.target.checked)}
            className="h-[15px] w-[15px] cursor-pointer accent-[#1f8a4c]"
          />
          내 공구만 보기
        </label>
      </div>
      {cards.length === 0 ? (
        <div className="mt-16 text-center text-[13.5px] text-[#8aa392]">
          조건에 맞는 공구가 없어요
          <div className="mt-1 text-xs">필터를 바꾸거나 직접 공구를 올려보세요</div>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(272px,1fr))" }}>
          {cards.map((d) => (
            <DealCard key={d.id} deal={d} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
