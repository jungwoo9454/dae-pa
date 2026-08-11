"use client";

import { Avatar, ProgressBar } from "@/components/ui";
import { fmt } from "@/lib/deal";
import { useStore } from "@/lib/store";

export default function SettleView() {
  const deals = useStore((s) => s.deals);
  const sel = useStore((s) => s.sel);
  const balance = useStore((s) => s.balance);
  const go = useStore((s) => s.go);
  const payNow = useStore((s) => s.payNow);
  const confirmSelfPaid = useStore((s) => s.confirmSelfPaid);
  const remindUnpaid = useStore((s) => s.remindUnpaid);

  const sd =
    deals.find((x) => x.id === sel && (x.status === "settling" || x.status === "completed")) ??
    deals.find((x) => x.status === "settling");

  if (!sd) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#6b8573]">
        아직 정산 중인 공구가 없어요
      </div>
    );
  }

  const mem = sd.members ?? [];
  const paidN = mem.filter((m) => m.paid).length;
  const mine = mem.find((m) => m.name === "나");

  return (
    <div className="flex-1 overflow-auto px-7 py-5">
      <div
        onClick={() => go("my")}
        className="mb-3.5 inline-block cursor-pointer font-bold text-[#4d6d58] hover:text-[#1f8a4c]"
      >
        ← 내 공구
      </div>
      <div className="flex max-w-[900px] items-start gap-5">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-jua text-[22px] leading-[1.4]">
              {sd.emoji} {sd.title} 정산
            </span>
            <span
              className="badge"
              style={
                sd.status === "completed"
                  ? { background: "#eceff0", color: "#64748b" }
                  : { background: "#e0f0f1", color: "#0e7490" }
              }
            >
              {sd.status === "completed" ? "마감" : "정산중"}
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-[14px] border border-[#cfe4d0] bg-white px-4 py-3.5">
            <div
              className="flex h-16 w-[52px] items-center justify-center rounded-lg border border-[#d8e7d6]"
              style={{ background: "repeating-linear-gradient(0deg,#f2f6ef 0 6px,#fff 6px 12px)" }}
            >
              🧾
            </div>
            <div className="flex-1">
              <div className="font-extrabold">
                영수증 인증 완료 <span className="text-[#1f8a4c]">✓</span>
              </div>
              <div className="text-[12.5px] text-[#6b8573]">
                인식 총액 {fmt(sd.total)} · 금액 확정 · 수정 잠금 🔒
              </div>
            </div>
            <div className="cursor-pointer rounded-[9px] border-[1.5px] border-[#cfe4d0] px-[11px] py-1.5 text-[12.5px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]">
              영수증 보기
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {mem.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-[11px] rounded-xl border border-[#dbe9da] bg-white px-3.5 py-[11px]"
              >
                <Avatar ch={p.name[0]} size={32} />
                <div className="flex-1 font-bold">
                  {p.name}
                  <span className="text-xs font-normal text-[#8aa392]"> · {p.note}</span>
                </div>
                <b className="tnum">{fmt(p.amt)}</b>
                <span
                  className="badge"
                  style={
                    p.paid
                      ? { background: "#e9f6ec", color: "#166b3a" }
                      : { background: "#f1f3ee", color: "#8a9a8e" }
                  }
                >
                  {p.paid ? "입금완료" : "대기중"}
                </span>
              </div>
            ))}
          </div>
          <ProgressBar pct={Math.round((paidN / Math.max(1, mem.length)) * 100)} h={11} />
          <div className="text-center text-[13px] text-[#4d6d58]">
            {paidN}/{mem.length}명 입금 완료 — 전원 완료 시 자동으로 마감돼요
          </div>
          {sd.host === "나" && sd.status === "settling" && paidN < mem.length && (
            <div
              onClick={() => remindUnpaid(sd.id)}
              className="cursor-pointer self-center rounded-lg border-[1.5px] border-[#f0dca0] bg-[#fdf8ec] px-3.5 py-2 text-[12.5px] font-bold text-[#8a6d1f] hover:border-[#d9b64a]"
            >
              🔔 미입금자에게 리마인드 보내기
            </div>
          )}
        </div>

        <div className="flex w-[290px] flex-none flex-col gap-3 rounded-[18px] border border-[#cfe4d0] bg-white p-5 shadow-[0_6px_18px_rgba(18,70,38,.08)]">
          <div className="text-center">
            <div className="text-[12.5px] text-[#6b8573]">내가 낼 금액 (개별 조정 반영)</div>
            <div className="font-jua text-[30px] text-[#17301f]">{mine ? fmt(mine.amt) : "—"}</div>
          </div>
          {mine && !mine.paid && (
            <>
              <div
                onClick={() => payNow(sd.id)}
                className="cursor-pointer rounded-xl bg-[#1f8a4c] p-3 text-center text-[15px] font-extrabold text-white hover:bg-[#187741]"
              >
                🥬 대파페이로 바로 내기
              </div>
              <div
                onClick={() => confirmSelfPaid(sd.id, "account")}
                className="cursor-pointer rounded-xl border-[1.5px] border-[#d5e6d6] p-2.5 text-center text-[13.5px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
              >
                🏦 계좌로 보내기 · 초록은행 1104-04{" "}
                <span className="rounded-md bg-[#e9f6ec] px-[7px] py-px text-[11px] text-[#166b3a]">
                  복사
                </span>
              </div>
              <div
                onClick={() => confirmSelfPaid(sd.id, "toss")}
                className="cursor-pointer rounded-xl border-[1.5px] border-[#d5e6d6] p-2.5 text-center text-[13.5px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
              >
                💸 토스 송금 링크 열기
              </div>
              <div className="text-center text-[11.5px] text-[#8aa392]">
                대파페이는 자동 확인 · 계좌/토스는 셀프 체크
              </div>
            </>
          )}
          {mine?.paid && (
            <div className="rounded-xl bg-[#e9f6ec] p-3.5 text-center font-extrabold text-[#166b3a]">
              입금 완료 ✓
              <div className="mt-[3px] text-xs font-normal">
                {mine.payMethod === "wallet"
                  ? "대파페이 잔액에서 차감됐어요"
                  : mine.payMethod === "toss"
                    ? "토스 송금으로 셀프 체크했어요"
                    : "계좌 이체로 셀프 체크했어요"}
              </div>
            </div>
          )}
          <div className="rounded-[10px] bg-[#f5f9f3] px-[11px] py-[9px] text-[12.5px] text-[#6b8573]">
            잔액 <b>{fmt(balance)}</b> · 부족하면 충전 후 결제돼요
          </div>
        </div>
      </div>
    </div>
  );
}
