"use client";

import { fmt, joinLabel, joinable, perAmount, perLabel, remainLabel, settleStartable, stampRemainLabel, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import type { Deal } from "@/lib/types";
import { Barcode, ProgressBar, StatusStamp, receiptNo } from "./ui";

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
    // 카드 높이는 제목 줄 수·바코드 유무로 제각각이었다 — 그리드 칸을 꽉 채우고
    // 아래 묶음(바코드·참여 키)을 바닥에 붙여 한 줄의 카드 높이를 맞춘다.
    <div onClick={() => openDeal(deal.id)} className="flex h-full cursor-pointer flex-col">
      {/* 위아래로 뜯어낸 전표 한 장 — 인쇄될 때 뜯긴 윗변이 먼저 나온다 */}
      <div className={`receipt-edge receipt-edge-top ${dead ? "receipt-edge-dead" : ""}`} />
      <div className={`receipt flex flex-1 flex-col px-[26px] pb-[22px] pt-6 ${dead ? "receipt-dead" : ""}`}>
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
          {/* 상태는 도장 하나로 말한다 — 태그까지 붙이면 같은 걸 두 번 말하게 된다 (#169) */}
          <div className="ml-auto">
            <StatusStamp s={st} countdown={stampRemainLabel(deal, now)} />
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

        <div className="mt-4">
          <ProgressBar pct={pct} color={dead ? "#dad4c8" : st.fg} />
        </div>

        <div className="mt-[18px] flex items-baseline">
          <span className="text-[14.5px] text-[#8b8478]">{perLabel(deal)}</span>
          <span className={`tnum ml-auto text-[30px] font-black ${dead ? "text-[#8b8478]" : ""}`}>
            {fmt(perAmount(deal))}
          </span>
        </div>

        <div className="mt-auto pt-3.5">
          {!dead && <Barcode seed={deal.id} className="h-8" />}

          <div onClick={onJoin} className={`${keyClass} mt-3.5 py-3 text-sm tracking-[.1em]`}>
            [ {joinLabel(deal, now)} ]
          </div>
        </div>
      </div>
      <div className={`receipt-edge ${dead ? "receipt-edge-dead" : ""}`} />
    </div>
  );
}
