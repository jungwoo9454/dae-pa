"use client";

import { Bell, Bike, Landmark, Lock, ReceiptText, Send, Vote, Wallet } from "lucide-react";
import { useEffect } from "react";
import { Avatar, ProgressBar } from "@/components/ui";
import { fmt } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { ensureDealLoaded } from "@/lib/supabase/queries";
import { useRealtimeParticipations } from "@/lib/use-realtime-participations";
import { useRealtimeSettlement } from "@/lib/use-realtime-settlement";

export default function SettleView() {
  const deals = useStore((s) => s.deals);
  const sel = useStore((s) => s.sel);
  const me = useStore((s) => s.me);
  const balance = useStore((s) => s.balance);
  const go = useStore((s) => s.go);
  const payNow = useStore((s) => s.payNow);
  const confirmSelfPaid = useStore((s) => s.confirmSelfPaid);
  const remindUnpaid = useStore((s) => s.remindUnpaid);
  const adjustParticipationAmount = useStore((s) => s.adjustParticipationAmount);
  const settleTotalInput = useStore((s) => s.settleTotalInput);
  const settleReceipt = useStore((s) => s.settleReceipt);
  const setSettleTotalInput = useStore((s) => s.setSettleTotalInput);
  const toggleSettleReceipt = useStore((s) => s.toggleSettleReceipt);
  const confirmSettlement = useStore((s) => s.confirmSettlement);
  const voteSettlement = useStore((s) => s.voteSettlement);

  useRealtimeParticipations(sel);
  useRealtimeSettlement(sel);

  // 필터 변경 등으로 store.deals에서 사라진 공구를 딥링크로 곧장 열었을 때 보강 조회
  useEffect(() => {
    if (sel == null) return;
    if (deals.some((d) => d.id === sel)) return;
    void ensureDealLoaded(sel);
  }, [sel, deals]);

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

  const mem = sd.participations ?? [];
  const paidN = mem.filter((p) => p.is_paid).length;
  const mine = mem.find((p) => p.user_id === me?.id);
  const insufficient = !!mine && balance < (mine.amount_due ?? 0);
  const settlement = sd.settlement;
  const agreeN = Object.values(settlement?.votes ?? {}).filter(Boolean).length;
  const myVote = me ? settlement?.votes[me.id] : undefined;
  const isHost = sd.host_id === me?.id;

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
          {settlement?.confirmed ? (
            <div className="flex items-center gap-3 rounded-[14px] border border-[#cfe4d0] bg-white px-4 py-3.5">
              <div
                className="flex h-16 w-[52px] items-center justify-center rounded-lg border border-[#d8e7d6]"
                style={{ background: "repeating-linear-gradient(0deg,#f2f6ef 0 6px,#fff 6px 12px)" }}
              >
                {settlement.hasReceipt ? (
                  <ReceiptText aria-hidden className="h-6 w-6 text-[#1f8a4c]" />
                ) : (
                  <Vote aria-hidden className="h-6 w-6 text-[#1f8a4c]" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-extrabold">
                  {settlement.hasReceipt ? "영수증 인증 완료" : "참여자 과반 동의로 확정"}{" "}
                  <span className="text-[#1f8a4c]">✓</span>
                </div>
                <div className="text-[12.5px] text-[#6b8573]">
                  확정 총액 {fmt(settlement.finalTotal)} · 금액 확정 ·{" "}
                  <span className="inline-flex items-center gap-1 align-middle">
                    <Lock aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 수정 잠금
                  </span>
                </div>
              </div>
            </div>
          ) : settlement ? (
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#f0dca0] bg-[#fdf8ec] px-4 py-3.5">
              <div className="flex items-center gap-1.5 font-extrabold">
                <Vote aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 영수증 없이 정산 · 과반 동의 필요
              </div>
              <div className="text-[12.5px] text-[#6b8573]">
                제안 총액 {fmt(settlement.finalTotal)} · {agreeN}/{mem.length}명 동의
              </div>
              {myVote === undefined ? (
                <div className="flex gap-2">
                  <div
                    onClick={() => voteSettlement(sd.id, true)}
                    className="flex-1 cursor-pointer rounded-lg bg-[#1f8a4c] py-2 text-center text-[13px] font-bold text-white hover:bg-[#187741]"
                  >
                    동의
                  </div>
                  <div
                    onClick={() => voteSettlement(sd.id, false)}
                    className="flex-1 cursor-pointer rounded-lg border-[1.5px] border-[#d5e6d6] py-2 text-center text-[13px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
                  >
                    비동의
                  </div>
                </div>
              ) : (
                <div className="text-[12.5px] font-bold text-[#4d6d58]">
                  {myVote ? "동의했어요 ✓" : "비동의했어요"}
                </div>
              )}
            </div>
          ) : isHost ? (
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#cfe4d0] bg-white px-4 py-3.5">
              <div className="font-extrabold">최종 총액 확정</div>
              <input
                type="number"
                value={settleTotalInput}
                onChange={(e) => setSettleTotalInput(e.target.value)}
                placeholder={String(sd.total)}
                className="tnum rounded-lg border border-[#d5e6d6] px-3 py-2 text-[14px] outline-none focus:border-[#1f8a4c]"
              />
              <label className="flex items-center gap-2 text-[12.5px] text-[#4d6d58]">
                <input type="checkbox" checked={settleReceipt} onChange={toggleSettleReceipt} />
                영수증 사진 첨부함 (선택)
              </label>
              <div
                onClick={() => confirmSettlement(sd.id)}
                className="cursor-pointer rounded-lg bg-[#1f8a4c] py-2.5 text-center text-[13.5px] font-extrabold text-white hover:bg-[#187741]"
              >
                총액 확정하기
              </div>
            </div>
          ) : (
            <div className="rounded-[14px] border border-[#cfe4d0] bg-white px-4 py-3.5 text-center text-[13px] text-[#6b8573]">
              주최자가 최종 총액을 입력하면 정산이 시작돼요
            </div>
          )}
          {!!sd.deliveryFee && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-[#6b8573]">
              <Bike aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" />
              <span>배달비 {fmt(sd.deliveryFee)} · 참여자 {mem.length}명 균등 분담</span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {mem.map((p) => {
              const isHostRow = p.user_id === sd.host_id;
              const editable = isHost && !isHostRow;
              const nickname = p.profile?.nickname ?? "탈퇴한 사용자";
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-[11px] rounded-xl border border-[#dbe9da] bg-white px-3.5 py-[11px]"
                >
                  <Avatar ch={nickname[0]} size={32} />
                  <div className="flex-1 font-bold">
                    {nickname}
                    {p.note && <span className="text-xs font-normal text-[#8aa392]"> · {p.note}</span>}
                    {isHostRow && (
                      <span className="ml-1 text-[10.5px] font-normal text-[#8aa392]">(나머지 자동 부담)</span>
                    )}
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#8aa392]">금액</span>
                      <input
                        type="number"
                        value={p.amount_due ?? 0}
                        onChange={(e) => adjustParticipationAmount(p.id, parseInt(e.target.value) || 0)}
                        className="tnum w-[90px] rounded-lg border border-[#d5e6d6] px-2 py-1 text-right text-[13px] outline-none focus:border-[#1f8a4c]"
                      />
                    </div>
                  )}
                  <b className="tnum">{fmt(p.amount_due ?? 0)}</b>
                  <span
                    className="badge"
                    style={
                      p.is_paid
                        ? { background: "#e9f6ec", color: "#166b3a" }
                        : { background: "#f1f3ee", color: "#8a9a8e" }
                    }
                  >
                    {p.is_paid ? "입금완료" : "대기중"}
                  </span>
                </div>
              );
            })}
          </div>
          <ProgressBar pct={Math.round((paidN / Math.max(1, mem.length)) * 100)} h={11} />
          <div className="text-center text-[13px] text-[#4d6d58]">
            {paidN}/{mem.length}명 입금 완료 — 전원 완료 시 자동으로 마감돼요
          </div>
          {isHost && sd.status === "settling" && paidN < mem.length && (
            <div
              onClick={() => remindUnpaid(sd.id)}
              className="flex cursor-pointer items-center gap-1.5 self-center rounded-lg border-[1.5px] border-[#f0dca0] bg-[#fdf8ec] px-3.5 py-2 text-[12.5px] font-bold text-[#8a6d1f] hover:border-[#d9b64a]"
            >
              <Bell aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 미입금자에게 리마인드 보내기
            </div>
          )}
        </div>

        <div className="flex w-[290px] flex-none flex-col gap-3 rounded-[18px] border border-[#cfe4d0] bg-white p-5 shadow-[0_6px_18px_rgba(18,70,38,.08)]">
          <div className="text-center">
            <div className="text-[12.5px] text-[#6b8573]">내가 낼 금액 (개별 조정 반영)</div>
            <div className="font-jua text-[30px] text-[#17301f]">
              {mine ? fmt(mine.amount_due ?? 0) : "—"}
            </div>
          </div>
          {mine && !mine.is_paid && (
            <>
              {insufficient ? (
                <div className="rounded-xl bg-[#fdecec] p-3 text-center text-[13px] font-bold text-[#b3261e]">
                  잔액이 {fmt((mine.amount_due ?? 0) - balance)} 부족해요
                  <div
                    onClick={() => go("pay")}
                    className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-bold text-[#1f8a4c] underline"
                  >
                    <Wallet aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 대파페이 충전하러 가기 →
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => payNow(mine.id)}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#1f8a4c] p-3 text-[15px] font-extrabold text-white hover:bg-[#187741]"
                >
                  <Wallet aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 대파페이로 바로 내기
                </div>
              )}
              <div
                onClick={() => confirmSelfPaid(mine.id, "account")}
                className="flex cursor-pointer flex-wrap items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#d5e6d6] p-2.5 text-[13.5px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
              >
                <Landmark aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 계좌로 보내기 · 초록은행 1104-04
                <span className="rounded-md bg-[#e9f6ec] px-[7px] py-px text-[11px] text-[#166b3a]">
                  복사
                </span>
              </div>
              <div
                onClick={() => confirmSelfPaid(mine.id, "toss")}
                className="flex cursor-pointer flex-wrap items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#d5e6d6] p-2.5 text-[13.5px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
              >
                <Send aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 토스 송금 링크 열기
              </div>
              <div className="text-center text-[11.5px] text-[#8aa392]">
                {insufficient
                  ? "잔액 부족 시 계좌/토스로 보내고 셀프 체크해주세요"
                  : "대파페이는 자동 확인 · 계좌/토스는 셀프 체크"}
              </div>
            </>
          )}
          {mine?.is_paid && (
            <div className="rounded-xl bg-[#e9f6ec] p-3.5 text-center font-extrabold text-[#166b3a]">
              입금 완료 ✓
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
