"use client";

import { Bell, Bike, Landmark, Lock, ReceiptText, Vote, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ImageUpload from "@/components/image-upload";
import { Avatar, ProgressBar } from "@/components/ui";
import { commaFmt, digits, fmt } from "@/lib/deal";
import type { ParticipationWithProfile } from "@/lib/db-types";
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
  const settleReceiptUrl = useStore((s) => s.settleReceiptUrl);
  const setSettleTotalInput = useStore((s) => s.setSettleTotalInput);
  const setSettleReceiptUrl = useStore((s) => s.setSettleReceiptUrl);
  const confirmSettlement = useStore((s) => s.confirmSettlement);
  const voteSettlement = useStore((s) => s.voteSettlement);
  // 총액 확정 전, 주최자가 참여자별로 손수 조정한 금액 (participation id → 금액).
  // DB엔 확정 시점까지 아무것도 안 쓰고 화면 미리보기로만 들고 있는다.
  const [overrides, setOverrides] = useState<Record<number, number>>({});

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

  // openSettle 이 총액을 못 채운 경우(공구가 아직 로딩 전) 한 번만 보강한다 (#127).
  // 공구당 1회로 막아야 주최자가 칸을 비우고 다시 칠 때 값이 되돌아오지 않는다.
  const prefilled = useRef<number | null>(null);
  useEffect(() => {
    if (!sd || sd.settlement || prefilled.current === sd.id) return;
    prefilled.current = sd.id;
    if (!useStore.getState().settleTotalInput && sd.total > 0) setSettleTotalInput(String(sd.total));
  }, [sd, setSettleTotalInput]);

  // 정산 대상 공구가 바뀌거나(다른 공구 열람) 확정되고 나면 이전 미리보기 조정값은 의미가 없다
  useEffect(() => {
    setOverrides({});
  }, [sel, sd?.settlement?.confirmed]);

  if (!sd) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#6b8573]">
        아직 정산 중인 공구가 없어요
      </div>
    );
  }

  const mem = sd.participations ?? [];
  // 주최자는 나머지를 자동 부담하는 쪽이라 "n빵 입금" 진행률에서는 뺀다
  const guestMem = mem.filter((p) => p.user_id !== sd.host_id);
  const paidGuestN = guestMem.filter((p) => p.is_paid).length;
  const mine = mem.find((p) => p.user_id === me?.id);
  const insufficient = !!mine && balance < (mine.amount_due ?? 0);
  const settlement = sd.settlement;
  const agreeN = Object.values(settlement?.votes ?? {}).filter(Boolean).length;
  const myVote = me ? settlement?.votes[me.id] : undefined;
  const isHost = sd.host_id === me?.id;

  // 확정 전(주최자가 총액 입력 중이거나, 확정 요청 후 과반 동의 대기 중)엔 얼마씩 내는지
  // 미리 보여준다. 실제 확정 값(participations.amount_due)은 apply_settlement_split RPC 가
  // 정산 "확정" 시점에만 채우므로 그 전엔 항상 null — 여기선 같은 공식(항목 균등 + 배달비 균등,
  // 나머지는 주최자)을 클라이언트에서 그대로 계산만 해서 보여준다. DB엔 아무것도 쓰지 않는다.
  //
  // 총액·조정값 출처: settlements 행이 아직 없으면(주최자가 타이핑 중) 로컬 상태를, 이미
  // 있으면(확정 대기 중 — 영수증 없이 투표로 넘어간 경우) 서버에 저장된 settlement.overrides를
  // 쓴다 — 이래야 동의 투표 화면에서도(주최자뿐 아니라 참여자 전원에게) 조정값이 보인다.
  //
  // 참여자별 손수 조정이 있으면 그 사람 몫은 조정값 그대로, 나머지 미조정 참여자는 균등
  // 분배값 그대로 두고, 그 차액을 전부 주최자가 흡수한다 — 확정 시점에 apply_settlement_split
  // RPC가 실제로 하는 계산과 정확히 같은 결과가 나오도록 맞춘 것.
  const previewTotalN = settlement ? settlement.finalTotal : parseInt(settleTotalInput) || 0;
  const effectiveOverrides = settlement ? (settlement.overrides ?? {}) : overrides;
  const showPreview = !settlement?.confirmed && previewTotalN > 0;
  const n = Math.max(1, mem.length);
  const deliveryFee = sd.deliveryFee ?? 0;
  const itemTotal = previewTotalN - deliveryFee;
  const itemBase = Math.floor(itemTotal / n);
  const itemRemainder = itemTotal - itemBase * n;
  const deliveryBase = Math.floor(deliveryFee / n);
  const deliveryRemainder = deliveryFee - deliveryBase * n;
  const autoEven = itemBase + deliveryBase;
  const autoHostShare = itemBase + itemRemainder + deliveryBase + deliveryRemainder;
  const overrideDeltaSum = Object.entries(effectiveOverrides).reduce((sum, [pid, amt]) => {
    const p = mem.find((m) => m.id === Number(pid));
    if (!p || p.user_id === sd.host_id) return sum;
    return sum + (amt - autoEven);
  }, 0);
  const previewAmount = (p: ParticipationWithProfile) => {
    if (p.user_id === sd.host_id) return autoHostShare - overrideDeltaSum;
    return effectiveOverrides[p.id] ?? autoEven;
  };

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
              {settlement.receiptUrl ? (
                <a
                  href={settlement.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="영수증 크게 보기"
                  className="h-16 w-[52px] flex-none overflow-hidden rounded-lg border border-[#d8e7d6]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */}
                  <img src={settlement.receiptUrl} alt="첨부된 영수증" className="h-full w-full object-cover" />
                </a>
              ) : (
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
              )}
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
              {/* 동의 여부는 "내가 얼마 내는지"를 보고 정하는 것이라 예상 금액을 같이 보여준다 (#128) */}
              {mine && (
                <div className="text-[12.5px] font-bold text-[#4d6d58]">
                  내가 낼 예상 금액 <b className="tnum text-[14px] text-[#17301f]">{fmt(previewAmount(mine))}</b>
                </div>
              )}
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
                value={commaFmt(settleTotalInput)}
                onChange={(e) => setSettleTotalInput(digits(e.target.value))}
                placeholder="예: 54,500"
                className="tnum rounded-lg border border-[#d5e6d6] px-3 py-2 text-[14px] outline-none focus:border-[#1f8a4c]"
              />
              <div className="flex flex-col gap-1.5">
                <div className="text-[12.5px] text-[#4d6d58]">
                  영수증 사진 (선택) — 첨부하면 투표 없이 바로 확정돼요
                </div>
                <ImageUpload
                  kind="receipts"
                  value={settleReceiptUrl}
                  onChange={setSettleReceiptUrl}
                  label="영수증 사진 첨부"
                  height={104}
                />
              </div>
              <div
                onClick={() => confirmSettlement(sd.id, overrides)}
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
              // 손수 입력은 "주최자가 아직 총액 확정 전에 타이핑 중"이거나 "확정된 뒤"에만
              // 의미가 있다 — 영수증 없이 확정 요청해서 과반 동의 대기 중일 땐(settlement 존재,
              // 미확정) 이미 서버에 넘어간 제안이라 화면에서 더 손댈 수 없다(읽기 전용 미리보기).
              const composing = !settlement && showPreview;
              const editable = isHost && !isHostRow && (composing || !!settlement?.confirmed);
              const displayAmount = showPreview ? previewAmount(p) : (p.amount_due ?? 0);
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
                        value={composing ? (overrides[p.id] ?? autoEven) : (p.amount_due ?? 0)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 0;
                          if (composing) setOverrides((o) => ({ ...o, [p.id]: v }));
                          else void adjustParticipationAmount(p.id, v);
                        }}
                        className="tnum w-[90px] rounded-lg border border-[#d5e6d6] px-2 py-1 text-right text-[13px] outline-none focus:border-[#1f8a4c]"
                      />
                    </div>
                  )}
                  <b className="tnum">{fmt(displayAmount)}</b>
                  {showPreview && <span className="text-[10.5px] text-[#8aa392]">예상</span>}
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
          <ProgressBar pct={Math.round((paidGuestN / Math.max(1, guestMem.length)) * 100)} h={11} />
          <div className="text-center text-[13px] text-[#4d6d58]">
            {paidGuestN}/{guestMem.length}명 입금 완료 — 전원 완료 시 자동으로 마감돼요
          </div>
          {isHost && sd.status === "settling" && paidGuestN < guestMem.length && (
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
              {mine ? fmt(showPreview ? previewAmount(mine) : (mine.amount_due ?? 0)) : "—"}
            </div>
          </div>
          {mine && !mine.is_paid && (
            <>
              {isHost ? (
                <div className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-xl bg-[#e6efe4] p-3 text-[15px] font-extrabold text-[#8a9a8e]">
                  <Wallet aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 대파페이로 바로 내기
                </div>
              ) : insufficient ? (
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
              {isHost ? (
                <div className="flex cursor-not-allowed flex-wrap items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#e6efe4] p-2.5 text-[13.5px] font-bold text-[#b7c3ba]">
                  <Landmark aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 계좌로 보내기
                </div>
              ) : (
                <div
                  onClick={() => confirmSelfPaid(mine.id, "account")}
                  className="flex cursor-pointer flex-wrap items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#d5e6d6] p-2.5 text-[13.5px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
                >
                  <Landmark aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 계좌로 보내기
                  <span className="rounded-md bg-[#e9f6ec] px-[7px] py-px text-[11px] text-[#166b3a]">
                    복사
                  </span>
                </div>
              )}
              <div className="text-center text-[11.5px] text-[#8aa392]">
                {isHost
                  ? "주최자는 먼저 대용량으로 사고 참여자들에게 엔빵 받는 쪽이라 따로 낼 필요 없어요"
                  : insufficient
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
