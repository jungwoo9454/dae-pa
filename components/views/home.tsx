"use client";
import { useState, useEffect } from "react";
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
  const [search, setSearch] = useState("");

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

    // 검색: 제목 + 설명에서 품목 찾기
    if (search) {
      const searchLower = search.toLowerCase();
      const titleMatch = d.title.toLowerCase().includes(searchLower);
      const descMatch = d.description?.toLowerCase().includes(searchLower);
      if (!titleMatch && !descMatch) return false;
    }

    // 마감임박 판정은 statusOf 한 곳에만 둔다 (1시간 임계값 중복 금지)
    const key = statusOf(d, now).key;
    if (statusFilter === "모집중") return key === "recruiting" || key === "closing";
    if (statusFilter === "마감임박") return key === "closing";
    return true;
  });
  return (
    <div className="flex-1 overflow-auto px-10 pb-12">
      <div className="flex items-center gap-6 pb-6 pt-8">
        <div className="font-sans-ko text-[51.5px] font-black leading-[1.15] tracking-[-.03em]">
          오늘의 <span className="text-[#e14e2b]">알뜰</span> 공구
        </div>
        <div className="ml-auto flex items-center gap-5">
          <input
            type="text"
            placeholder="공구 검색_"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field h-11 w-[240px] text-[14.5px]"
          />
          <div className="border-[1.5px] border-dashed border-[#b9b9b4] px-5 py-3 text-left text-[#8b8478]">
            <div className="text-[14.5px] font-semibold tracking-[.18em]">DAEPA MARKET</div>
            <div className="tnum mt-1.5 text-[12.5px]">
              {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
            </div>
          </div>
        </div>
      </div>
      <div className="h-px bg-[#c9c9c4]" />

      {/* 카드가 길어져서 스크롤해도 필터는 남아 있게 한다 (#89) */}
      <div className="sticky top-0 z-10 -mx-10 bg-[#e4e4e0] px-10 pb-3 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          {CATS.map((c) => (
            <div key={c} onClick={() => setFilter(c)} className={`chip ${filter === c ? "chip-on" : ""}`}>
              {c}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((s) => (
            <div
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`chip px-4 py-1.5 text-[13.5px] ${statusFilter === s ? "chip-on" : ""}`}
            >
              {s}
            </div>
          ))}
          <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-[14px] font-bold text-[#6e675e]">
            <input
              type="checkbox"
              checked={myDealsOnly}
              onChange={(e) => setMyDealsOnly(e.target.checked)}
              className="h-[15px] w-[15px] cursor-pointer accent-[#e14e2b]"
            />
            내 공구만 보기
          </label>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="receipt mx-auto mt-10 max-w-[420px] px-8 py-10 text-center text-[15px] text-[#8b8478]">
          <div className="receipt-head">＊ 공구 없음 ＊</div>
          <div className="mt-4">조건에 맞는 공구가 없어요</div>
        </div>
      ) : (
        <div className="grid gap-[26px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))" }}>
          {cards.map((d) => (
            <DealCard key={d.id} deal={d} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
