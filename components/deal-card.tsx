"use client";

import { fmt, joinLabel, joinable, perAmount, perLabel, remainLabel, settleStartable, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import type { Deal } from "@/lib/types";
import { Barcode, ProgressBar, StatusBadge, receiptNo } from "./ui";

/**
 * 공구 카드 = 감열지 전표 한 장 (#143).
 * 머리글 → 전표번호 → 제목 + 마감 도장 → 점선 리더 항목 → 진행바 → 1인당 → 바코드 → 참여 키.
 */
export default function DealCard({ deal, now }: { deal: Deal; now: number }) {
  const openDeal = useStore((s) => s.openDeal);
  const openSettle = useStore((s) => s.openSettle);
  const join = useStore((s) => s.join);

  const st = statusOf(deal, now);
  const pct = Math.min(100, Math.round((deal.joined / deal.goal) * 100));
  const active = joinable(deal, now);
  const dead = st.key === "closed" || st.key === "canceled";
  const startable = settleStartable(deal, now);

  const onJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.status === "settling") openSettle(deal.id);
    else if (startable) openDeal(deal.id);
    else join(deal.id);
  };

  const keyClass = dead
    ? "key key-off"
    : active || startable || deal.status === "settling"
      ? st.key === "closing"
        ? "key key-primary"
        : "key key-ink"
      : "key key-off";

  return (
    <div onClick={() => openDeal(deal.id)} className="cursor-pointer">
      <div className={`receipt px-[26px] pb-[22px] pt-6 ${dead ? "receipt-dead" : ""}`}>
        <div className="receipt-head">＊ 대파 공구 ＊</div>
        <div className="mt-[7px] text-center text-[12.5px] text-[#8b8478]">
          {receiptNo(deal.id, deal.created_at)} ｜ {deal.cat} ｜ 주최: {deal.host}
        </div>
        <div className="rule-dash mt-3.5" />

        <div className="mt-4 flex min-h-[70px] items-start gap-3.5">
          <div
            className={`font-sans-ko text-[24.5px] font-black leading-[1.35] ${dead ? "text-[#8b8478]" : ""}`}
          >
            {deal.title}
          </div>
          {/* 상태 태그는 전표 안 우측 상단에 — 종이 밖에 두면 카드마다 높이가 달라 붕 뜬다 */}
          <div className="ml-auto flex flex-none flex-col items-end gap-2">
            <StatusBadge s={st} />
            {/* 도장은 실제로 초가 흐를 때만 (정산중·마감이면 '마감됨' 만 찍혀 의미가 없다) */}
            {deal.status === "recruiting" && deal.end > now && (
              <div
                className="stamp h-[70px] w-[70px] flex-col"
                style={{ borderColor: st.fg, color: st.fg }}
              >
                <span className="text-[10px] font-bold">마감까지</span>
                <span className="tnum mt-0.5 text-[13.5px] font-bold">{remainLabel(deal, now)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3.5 flex flex-col gap-[9px] text-sm text-[#6e675e]">
          <div className="leader">
            <span>수령지</span>
            <i />
            <b className={dead ? "text-[#8b8478]" : ""}>{deal.place}</b>
          </div>
          <div className="leader">
            <span>참여</span>
            <i />
            <b className={dead ? "text-[#8b8478]" : ""}>
              {deal.joined}/{deal.goal}명
            </b>
          </div>
          <div className="leader" style={st.key === "closing" ? { color: st.fg } : undefined}>
            <span>마감까지</span>
            <i />
            <span className="tnum font-bold" style={{ color: dead ? "#8b8478" : st.fg }}>
              {remainLabel(deal, now)}
            </span>
          </div>
        </div>

        {dead ? (
          <div className="relative mt-6 h-2 rounded-full bg-[#dad4c8]">
            {/* .stamp 이 border/color 를 직접 잡고 있어(레이어 밖 CSS) 유틸리티로는 안 덮인다 — 인라인으로 */}
            <span
              className="stamp absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-1 text-base tracking-[.4em]"
              style={{
                borderWidth: 2.5,
                borderColor: "rgba(140,133,120,.55)",
                color: "rgba(140,133,120,.7)",
                background: "rgba(241,239,232,.85)",
              }}
            >
              {st.label}
            </span>
          </div>
        ) : (
          <div className="mt-4">
            <ProgressBar pct={pct} color={st.fg} />
          </div>
        )}

        <div className={`flex items-baseline ${dead ? "mt-[30px]" : "mt-[18px]"}`}>
          <span className="text-[14.5px] text-[#8b8478]">{perLabel(deal)}</span>
          <span className={`tnum ml-auto text-[30px] font-black ${dead ? "text-[#8b8478]" : ""}`}>
            {fmt(perAmount(deal))}
          </span>
        </div>

        {!dead && <Barcode seed={deal.id} className="mt-3.5 h-8" />}

        <div onClick={onJoin} className={`${keyClass} mt-3.5 py-3 text-sm tracking-[.1em]`}>
          [ {joinLabel(deal, now)} ]
        </div>
      </div>
      <div className={`receipt-edge ${dead ? "receipt-edge-dead" : ""}`} />
    </div>
  );
}
