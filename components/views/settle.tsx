"use client";


import { useEffect, useRef, useState } from "react";
import ImageUpload from "@/components/image-upload";
import { Avatar, Barcode, ProgressBar, StatusBadge, receiptNo } from "@/components/ui";
import { commaFmt, digits, fmt, statusOf } from "@/lib/deal";
import type { ParticipationWithProfile } from "@/lib/db-types";
import { useStore } from "@/lib/store";
import { ensureDealLoaded } from "@/lib/supabase/queries";
import { useRealtimeParticipations } from "@/lib/use-realtime-participations";
import { useRealtimeSettlement } from "@/lib/use-realtime-settlement";
import { useNow } from "@/lib/use-now";

export default function SettleView() {
  const now = useNow();
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
      <div className="flex flex-1 items-center justify-center text-[#8b8478]">
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

  const st = statusOf(sd, now);

  return (
    <div className="flex-1 overflow-auto px-9 py-8">
      <div
        onClick={() => go("my")}
        className="mb-4 inline-block cursor-pointer text-[14.5px] text-[#77777f] hover:text-[#e14e2b]"
      >
        ← 내 공구로
      </div>
      <div className="mx-auto w-[580px]">
        <div className="receipt px-[30px] pb-6 pt-7">
          <div className="receipt-head text-base tracking-[.6em]">＊ 정 산 서 ＊</div>
          <div className="mt-[7px] flex items-center justify-center gap-2 text-xs text-[#8b8478]">
            {receiptNo(sd.id, sd.created_at)} ｜ <span className="font-sans-ko">{sd.title}</span>
            <StatusBadge s={st} />
          </div>
          <div className="rule-dash mt-3.5" />

          {settlement?.confirmed ? (
            <div className="mt-[18px] flex items-center gap-3.5 border-[1.5px] border-[#1b1917] p-4">
              {settlement.receiptUrl && (
                <a
                  href={settlement.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="영수증 크게 보기"
                  className="h-16 w-[52px] flex-none overflow-hidden border border-[#c9c9c4]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */}
                  <img src={settlement.receiptUrl} alt="첨부된 영수증" className="h-full w-full object-cover" />
                </a>
              )}
              <div className="flex-1">
                <div className="text-[14.5px] font-bold">
                  {settlement.hasReceipt ? "영수증 인증 완료" : "참여자 과반 동의로 확정"}
                </div>
                <div className="tnum mt-1 text-xs text-[#6e675e]">
                  확정 총액 {fmt(settlement.finalTotal)} · 수정 잠금
                </div>
              </div>
              <span className="stamp h-[54px] w-[54px] flex-none text-[12.5px]">확정</span>
            </div>
          ) : settlement ? (
            <div className="mt-[18px] border-[1.5px] border-[#1b1917] p-4">
              <div className="text-[14.5px] font-bold">영수증 없이 정산 · 과반 동의 필요</div>
              <div className="tnum mt-2.5 text-xs text-[#6e675e]">
                제안 총액 <b className="text-[#1b1917]">{fmt(settlement.finalTotal)}</b> · 동의{" "}
                <b className="text-[#1b1917]">
                  {agreeN}/{mem.length}
                </b>
              </div>
              {/* 동의 여부는 "내가 얼마 내는지"를 보고 정하는 것이라 예상 금액을 같이 보여준다 (#128) */}
              {mine && (
                <div className="tnum mt-1.5 text-xs text-[#6e675e]">
                  내가 낼 예상 금액{" "}
                  <b className="text-sm text-[#1b1917]">{fmt(previewAmount(mine))}</b>
                </div>
              )}
              {myVote === undefined ? (
                <div className="mt-3 flex gap-2 text-[14.5px]">
                  <div onClick={() => voteSettlement(sd.id, true)} className="key key-ink flex-1 py-2">
                    [ 동의 ]
                  </div>
                  <div onClick={() => voteSettlement(sd.id, false)} className="key key-line flex-1 py-2">
                    [ 비동의 ]
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs font-bold text-[#6e675e]">
                  {myVote ? "동의했어요 ✓" : "비동의했어요"}
                </div>
              )}
            </div>
          ) : isHost ? (
            <div className="mt-[18px] border-[1.5px] border-[#1b1917] p-4">
              <div className="text-[14.5px] font-bold">
                최종 총액 확정 <span className="text-[12.5px] font-normal text-[#9c9ca3]">(주최자 전용)</span>
              </div>
              <input
                value={commaFmt(settleTotalInput)}
                onChange={(e) => setSettleTotalInput(digits(e.target.value))}
                placeholder="예: 54,500"
                className="field tnum mt-3 h-[46px] w-full text-[21.5px] font-bold"
              />
              <div className="mt-3">
                <ImageUpload
                  kind="receipts"
                  value={settleReceiptUrl}
                  onChange={setSettleReceiptUrl}
                  label="영수증 사진 첨부 — 붙이면 투표 없이 바로 확정"
                  height={92}
                />
              </div>
              <div
                onClick={() => confirmSettlement(sd.id, overrides)}
                className="key key-primary mt-3 py-3 text-[15px]"
              >
                [ 총액 확정하기 ]
              </div>
            </div>
          ) : (
            <div className="mt-[18px] border-[1.5px] border-dashed border-[#c9c9c4] p-4 text-center text-[14.5px] text-[#8b8478]">
              주최자가 최종 총액을 입력하면 정산이 시작돼요
            </div>
          )}

          <div className="mt-[18px]">
            <div className="rule-dash flex border-b border-t-0 pb-2.5 text-[12.5px] tracking-[.1em] text-[#8b8478]">
              <span className="tnum">
                참여자별 부담{settlement ? ` (총 ${fmt(settlement.finalTotal)} ÷ ${mem.length})` : ""}
              </span>
              <span className="tnum ml-auto">
                입금 {paidGuestN}/{guestMem.length}
              </span>
            </div>

            {mem.map((p) => {
              const isHostRow = p.user_id === sd.host_id;
              // 손수 입력은 "주최자가 아직 총액 확정 전에 타이핑 중"이거나 "확정된 뒤"에만
              // 의미가 있다 — 영수증 없이 확정 요청해서 과반 동의 대기 중일 땐(settlement 존재,
              // 미확정) 이미 서버에 넘어간 제안이라 화면에서 더 손댈 수 없다(읽기 전용 미리보기).
              const composing = !settlement && showPreview;
              // 확정 = 참여자들이 "이 금액으로 내겠다"에 동의한 시점 — 그 뒤로는 주최자도 못 고친다 (#150).
              // 확정 후에도 열어두면 동의한 금액과 실제 청구 금액이 갈리고, 이미 입금한 사람 몫까지 바뀐다.
              const editable = isHost && !isHostRow && composing;
              const displayAmount = showPreview ? previewAmount(p) : (p.amount_due ?? 0);
              const nickname = p.profile?.nickname ?? "탈퇴한 사용자";
              return (
                <div key={p.id} className="rule-dot flex items-center gap-2.5 py-3 text-[15px]">
                  <Avatar ch={nickname[0]} src={p.profile?.avatar_url} />
                  <span className="font-sans-ko truncate">
                    {nickname}
                    {isHostRow && (
                      <span className="ml-1 text-[11px] text-[#9c9ca3]">주최 · 나머지 부담</span>
                    )}
                    {/* 주최자 행은 DB 트리거가 note 를 '주최자' 로 넣어둬서 위 태그와 겹친다 */}
                    {p.note && !isHostRow && (
                      <span className="ml-1 text-[12.5px] text-[#9c9ca3]">· {p.note}</span>
                    )}
                  </span>
                  <span className="mb-[3px] flex-1 border-b-[1.5px] border-dotted border-[#d8d2c6]" />
                  {editable ? (
                    <input
                      type="number"
                      value={composing ? (overrides[p.id] ?? autoEven) : (p.amount_due ?? 0)}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        if (composing) setOverrides((o) => ({ ...o, [p.id]: v }));
                        else void adjustParticipationAmount(p.id, v);
                      }}
                      className="field tnum w-[100px] px-2 py-1 text-right text-[14.5px]"
                    />
                  ) : (
                    <span className="tnum border-b-[1.5px] border-dashed border-[#8b8478] font-bold">
                      {fmt(displayAmount)}
                    </span>
                  )}
                  {showPreview && <span className="text-[11px] text-[#9c9ca3]">예상</span>}
                  {p.is_paid ? (
                    <span className="stamp h-[29px] w-12 flex-none text-[10px]">입금완료</span>
                  ) : (
                    <span className="flex-none border-[1.5px] border-dashed border-[#8b8478] px-2 py-1.5 text-[11px] text-[#8b8478]">
                      대기중
                    </span>
                  )}
                </div>
              );
            })}

            <div className="mt-3">
              <ProgressBar
                pct={Math.round((paidGuestN / Math.max(1, guestMem.length)) * 100)}
                color="#4a6fa5"
              />
            </div>
            {isHost && sd.status === "settling" && paidGuestN < guestMem.length && (
              <div
                onClick={() => remindUnpaid(sd.id)}
                className="mt-3 cursor-pointer text-center text-xs font-bold text-[#e14e2b]"
              >
                미입금자에게 리마인드 보내기
              </div>
            )}
          </div>

          <div className="mt-[18px] border-2 border-[#1b1917] bg-white p-[18px]">
            <div className="flex items-baseline">
              <span className="text-[14.5px] font-bold tracking-[.14em]">내가 낼 금액</span>
              <span className="tnum ml-auto text-[36px] font-black text-[#e14e2b]">
                {mine ? fmt(showPreview ? previewAmount(mine) : (mine.amount_due ?? 0)) : "—"}
              </span>
            </div>

            {/* 총액 확정 전에는 결제·셀프체크를 막는다 — amount_due 가 아직 null 이라
                즉시결제는 서버가 거부해 alert 만 뜨고, 셀프체크는 confirm_self_paid 가
                그대로 통과시켜 "안 낸 돈"이 입금완료로 굳는다(주최자 손실). 확정 후에만 연다. */}
            {mine && !mine.is_paid && !settlement?.confirmed && (
              <div className="mt-3.5 text-center text-[13px] text-[#8b8478]">
                총액이 확정되면 결제할 수 있어요
              </div>
            )}
            {mine && !mine.is_paid && settlement?.confirmed && (
              <>
                {isHost ? (
                  <>
                    <div className="key key-off mt-3.5 py-3 text-sm">[ 대파페이로 즉시 결제 ]</div>
                    <div className="mt-2.5 text-center text-[12.5px] text-[#9c9ca3]">
                      주최자는 받는 쪽이라 낼 금액이 없어요
                    </div>
                  </>
                ) : insufficient ? (
                  <>
                    <div className="key key-off mt-3.5 py-3 text-sm">[ 대파페이로 즉시 결제 ]</div>
                    <div className="tnum mt-2.5 text-center text-xs font-bold text-[#e14e2b]">
                      잔액이 {fmt((mine.amount_due ?? 0) - balance)} 부족해요
                      <span onClick={() => go("pay")} className="ml-2 cursor-pointer underline">
                        충전하기 →
                      </span>
                    </div>
                  </>
                ) : (
                  <div onClick={() => payNow(mine.id)} className="key key-primary mt-3.5 py-3 text-sm">
                    [ 대파페이로 즉시 결제 — 잔액 {fmt(balance)} ]
                  </div>
                )}
                {!isHost && (
                  <div
                    onClick={() => confirmSelfPaid(mine.id, "account")}
                    className="mt-3 flex cursor-pointer items-center gap-2.5 text-xs text-[#55524b] hover:text-[#e14e2b]"
                  >
                    <span className="inline-block h-4 w-4 border-[1.5px] border-[#8b8478]" />
                    계좌·토스로 직접 보냈어요 (셀프 체크)
                  </div>
                )}
              </>
            )}
            {mine?.is_paid && (
              <div className="mt-3.5 flex justify-center py-2">
                <span className="stamp h-[68px] w-[68px] text-sm">입금완료</span>
              </div>
            )}
          </div>

          {!!sd.deliveryFee && (
            <div className="tnum mt-3 text-center text-[12.5px] text-[#8b8478]">
              배달비 {fmt(sd.deliveryFee)} · 참여자 {mem.length}명 균등 분담
            </div>
          )}

          <Barcode seed={sd.id} className="mt-[18px]" />
        </div>
        <div className="receipt-edge" />
      </div>
    </div>
  );
}
