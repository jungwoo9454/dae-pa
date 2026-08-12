"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import DealCard from "@/components/deal-card";
import { statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { fetchDeals } from "@/lib/supabase/queries";
import { useRealtimeDeals } from "@/lib/use-realtime-deals";
import type { Deal } from "@/lib/types";

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
  const dealKey = deals.map((d) => d.id).join(",");

  /**
   * 삭제된 카드는 잠깐 더 들고 있다가 파쇄 애니메이션을 끝내고 버린다 (#174).
   * 있던 자리에서 갈려야 해서 사라지기 직전 index 를 같이 기억한다.
   *
   * 판정 기준은 화면 목록(cards)이 아니라 **원본 목록(deals)** 이다 — 카테고리 필터를 바꿔서
   * 화면에서 빠진 것뿐인데 파쇄기를 돌리면 안 된다.
   */
  const [shredding, setShredding] = useState<{ deal: Deal; index: number }[]>([]);
  const prevCards = useRef<Deal[]>([]);
  const prevDealIds = useRef<number[] | null>(null);
  useEffect(() => {
    const prevIds = prevDealIds.current;
    if (prevIds === null) return; // 첫 렌더는 비교 대상이 없다
    const removed = prevIds.filter((id) => !deals.some((d) => d.id === id));
    if (!removed.length) return;
    const gone = prevCards.current
      .map((deal, index) => ({ deal, index }))
      .filter(({ deal }) => removed.includes(deal.id));
    if (!gone.length) return;
    setShredding((s) => [...s, ...gone]);
    const t = setTimeout(
      () => setShredding((s) => s.filter((x) => !gone.some((g) => g.deal.id === x.deal.id))),
      560,
    );
    return () => clearTimeout(t);
    // deals 는 매 렌더 새 배열이라 id 목록으로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey]);

  /**
   * 직전 목록 기록 — **반드시 위 감지 effect 보다 뒤에** 선언해야 한다.
   * 같은 커밋에서 effect 는 선언 순서대로 도니까, 감지 쪽은 아직 옛 값을 본다.
   * (렌더 중에 갱신하면 감지 시점엔 이미 새 값이라 사라진 카드를 못 찾는다.)
   */
  useEffect(() => {
    prevCards.current = cards;
    prevDealIds.current = deals.map((d) => d.id);
  });

  // 파쇄 중인 카드를 원래 자리에 도로 끼워 넣는다
  const display = useMemo(() => {
    if (!shredding.length) return cards.map((deal) => ({ deal, shred: false }));
    const list = cards.map((deal) => ({ deal, shred: false }));
    for (const { deal, index } of shredding) {
      list.splice(Math.min(index, list.length), 0, { deal, shred: true });
    }
    return list;
  }, [cards, shredding]);

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
          {display.map(({ deal, shred }, i) => (
            // 새로 붙는 카드만 인쇄된다 — 이미 있던 카드는 다시 mount 되지 않아 애니메이션이 재생되지 않는다.
            // 첫 진입에는 전부 mount 되므로 index 만큼 시차를 줘 차례로 인쇄되는 것처럼 보인다.
            // 바깥 칸(card-slot)은 종이가 나오는 출구다 — 위로 넘친 부분을 여기서 자른다.
            <div key={deal.id} className="card-slot">
              <div
                className={shred ? "card-shred" : "card-print"}
                style={shred ? undefined : { animationDelay: `${Math.min(i, 11) * 55}ms` }}
              >
                <DealCard deal={deal} now={now} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
