"use client";

import { ProgressBar, StatusBadge } from "@/components/ui";
import { fmt, joinLabel, joinable, perAmount, remainLabel, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";

const FACES = ["김", "이", "박", "최", "정"];

export default function DetailView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const sel = useStore((s) => s.sel);
  const go = useStore((s) => s.go);
  const goRoom = useStore((s) => s.goRoom);
  const shareDeal = useStore((s) => s.shareDeal);
  const join = useStore((s) => s.join);
  const openSettle = useStore((s) => s.openSettle);

  const deal = deals.find((d) => d.id === sel) ?? deals[0];
  if (!deal) return null;

  const st = statusOf(deal, now);
  const pct = Math.min(100, Math.round((deal.joined / deal.goal) * 100));
  const closing = st.key === "closing";
  const active = joinable(deal, now);
  const faces = FACES.slice(0, Math.min(4, deal.joined));

  const onJoin = () => {
    if (deal.status === "settling") openSettle(deal.id);
    else join(deal.id);
  };

  return (
    <div className="flex-1 overflow-auto px-7 py-5">
      <div
        onClick={() => go("home")}
        className="mb-3.5 inline-block cursor-pointer font-bold text-[#4d6d58] hover:text-[#1f8a4c]"
      >
        ← 목록으로
      </div>
      <div className="flex max-w-[980px] items-start gap-6">
        <div className="flex flex-[1.5] flex-col gap-3.5">
          <div
            className="flex h-[220px] items-center justify-center rounded-2xl border border-[#d8e7d6] text-[40px] text-[#8aa392]"
            style={{ background: "repeating-linear-gradient(45deg,#e4efe2 0 14px,#eef5ec 14px 28px)" }}
          >
            {deal.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-jua text-2xl">{deal.title}</span>
              <StatusBadge s={st} />
            </div>
            <div className="mt-1 text-[#6b8573]">
              {deal.cat} · 주최 {deal.host}
            </div>
          </div>
          <div className="rounded-[14px] border border-[#dbe9da] bg-white px-4 py-3.5 leading-[1.7] text-[#3c5546]">
            품질 좋은 걸 대용량으로 사서 나눠요. 마감되면 채팅방에서 수령 시간을 맞추고, 정산은 앱에서
            자동 1/N로 진행됩니다.
          </div>
          <div className="flex flex-wrap gap-2.5">
            <div className="rounded-[10px] border border-[#dbe9da] bg-white px-3 py-2 text-[13px]">
              📍 수령 · <b>{deal.place}</b>
            </div>
            <div className="rounded-[10px] border border-[#dbe9da] bg-white px-3 py-2 text-[13px]">
              💰 총액 · <b>{fmt(deal.total)}</b>{" "}
              <span className="text-[11.5px] text-[#8aa392]">정산 전까지 변경 가능</span>
            </div>
          </div>
        </div>
        <div className="flex w-[300px] flex-none flex-col gap-3.5 rounded-[18px] border border-[#cfe4d0] bg-white p-5 shadow-[0_6px_18px_rgba(18,70,38,.08)]">
          <div className="text-center">
            <div className="font-jua tnum text-[30px] text-[#1f8a4c]">{remainLabel(deal, now)}</div>
            <div className="text-xs text-[#6b8573]">남은 시간 · 실시간</div>
          </div>
          <ProgressBar pct={pct} color={closing ? "#d97706" : "#1f8a4c"} h={11} />
          <div className="flex justify-between text-sm">
            <span>
              참여 <b>{deal.joined}</b>/{deal.goal}명
            </span>
            <span>
              1인 <b className="text-base">{fmt(perAmount(deal))}</b>
            </span>
          </div>
          <div className="flex">
            {faces.map((ch, i) => (
              <div
                key={i}
                className="-mr-[7px] flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-[#dceede] text-xs font-extrabold text-[#2f6d45]"
              >
                {ch}
              </div>
            ))}
            <span className="ml-3.5 self-center text-[12.5px] text-[#6b8573]">
              {deal.joined > 4 ? `+${deal.joined - 4}명 참여중` : `${deal.joined}명 참여중`}
            </span>
          </div>
          <div
            onClick={onJoin}
            className={`cursor-pointer rounded-xl p-[13px] text-center text-base font-extrabold hover:brightness-105 ${
              active || deal.status === "settling"
                ? "bg-[#1f8a4c] text-white"
                : "bg-[#e6efe4] text-[#6b8573]"
            }`}
          >
            {joinLabel(deal, now)}
          </div>
          <div
            onClick={() => goRoom("d" + deal.id)}
            className="cursor-pointer rounded-xl border-[1.5px] border-[#1f8a4c] p-2.5 text-center font-extrabold text-[#1f8a4c] hover:bg-[#e9f6ec]"
          >
            💬 공구 채팅방
          </div>
          {/* 라운지에 카드 말풍선으로 공유 → 대화 중 바로 참여로 이어진다 (#10) */}
          <div
            onClick={() => shareDeal(deal.id, "lounge")}
            className="cursor-pointer rounded-xl border-[1.5px] border-[#d5e6d6] p-2.5 text-center text-[13.5px] font-bold text-[#4d6d58] hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
          >
            🔗 동네 라운지에 공유
          </div>
        </div>
      </div>
    </div>
  );
}
