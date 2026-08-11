"use client";
import { useEffect } from "react";
import DealCard from "@/components/deal-card";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { fetchDeals } from "@/lib/supabase/queries";
import type { Category } from "@/lib/types";

const CATS = ["전체", "식료품", "배달음식", "생활용품"];

export default function HomeView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);

  // filter 초기값이 "전체"이므로 이 effect 하나로 최초 로드 + 필터 변경 조회를 모두 처리한다
  // (마운트 시 별도 effect를 두면 동일한 무필터 조회가 중복 발생한다)
  useEffect(() => {
    (async () => {
      const cat = filter === "전체" ? undefined : (filter as Category);
      const deals = await fetchDeals(cat);
      useStore.setState({ deals });
    })();
  }, [filter]);

  const cards = deals;
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
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(272px,1fr))" }}>
        {cards.map((d) => (
          <DealCard key={d.id} deal={d} now={now} />
        ))}
      </div>
    </div>
  );
}
