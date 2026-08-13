"use client";

import { useEffect, useState } from "react";
import { Avatar, Barcode, ProgressBar, StatusBadge, receiptNo } from "@/components/ui";
import {
  LEAVE_CUTOFF_MS,
  countdownDisplay,
  fmt,
  joinLabel,
  joinable,
  leavable,
  perAmount,
  perLabel,
  settleStartable,
  stampRemainLabel,
  statusOf,
} from "@/lib/deal";
import { isSubmitEnter } from "@/lib/keys";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { useRealtimeParticipations } from "@/lib/use-realtime-participations";
import { useRealtimeDeals } from "@/lib/use-realtime-deals";
import { ensureDealLoaded } from "@/lib/supabase/queries";

export default function DetailView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const sel = useStore((s) => s.sel);
  const go = useStore((s) => s.go);
  const goRoom = useStore((s) => s.goRoom);
  const shareDeal = useStore((s) => s.shareDeal);
  const join = useStore((s) => s.join);
  const leave = useStore((s) => s.leave);
  const openSettle = useStore((s) => s.openSettle);
  const cancelDeal = useStore((s) => s.cancelDeal);
  const startSettlement = useStore((s) => s.startSettlement);
  const [settleErr, setSettleErr] = useState<string | null>(null);
  const [askCancel, setAskCancel] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const [leaveErr, setLeaveErr] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const changeTotalAmount = useStore((s) => s.changeTotalAmount);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState("");

  // 선택된 공구의 participations 실시간 갱신 — store.deals의 joined/participations이 자동 반영된다
  useRealtimeParticipations(sel);
  // group_buys 변경(총액 등) 실시간 반영 — 홈에서만 구독하던 걸 상세에서도 구독해서,
  // 다른 세션에서 주최자가 총액을 바꾸면 이 화면도 새로고침 없이 바로 갱신된다 (#12)
  useRealtimeDeals();

  // 홈에서 카테고리 필터를 바꾸면 deals 배열 전체가 교체되므로, 필터에 안 걸리는
  // 공구를 상세로 보고 있던 경우 store에서 사라질 수 있다 — 그런 경우 단건으로 보강 조회한다.
  // (deals[0]로 조용히 폴백하면 엉뚱한 공구를 보여주게 된다.)
  useEffect(() => {
    if (sel == null) return;
    if (deals.some((d) => d.id === sel)) return;
    void ensureDealLoaded(sel);
  }, [sel, deals]);

  const deal = deals.find((d) => d.id === sel);
  if (!deal) return null;

  const st = statusOf(deal, now);
  const pct = Math.min(100, Math.round((deal.joined / deal.goal) * 100));
  const cd = countdownDisplay(deal, now);
  const active = joinable(deal, now);
  // 참여 명단 — participations.user_id → profiles.id embed로 받은 닉네임을 쓴다.
  // profile을 못 찾은 경우(고아 user_id 등)에만 user_id로 폴백한다.
  const participantAvatars = (deal.participations ?? []).map((p) => ({
    userId: p.user_id,
    nickname: p.profile?.nickname ?? "이웃",
    initials: (p.profile?.nickname ?? p.user_id).slice(0, 1).toUpperCase(),
    avatarUrl: p.profile?.avatar_url ?? null,
    isHost: p.user_id === deal.host_id,
  }));
  // 취소는 주최자만, 모집중·정산중일 때만 (#29 — DB 의 cancel_group_buy 판정과 같다)
  const cancelable = deal.mine && (deal.status === "recruiting" || deal.status === "settling");
  // 나가기는 주최자가 아닌 참여자만, 모집중이고 마감 5분 전까지만 (#94 — DB 의 leave_group_buy 판정과 같다).
  // 정산 시작 후엔 금액이 걸려있어 범위 밖 — 1차는 모집중에서만 허용.
  const canLeave = leavable(deal, now);
  // 정원 미달로 마감된 공구 — 주최자가 모인 인원 그대로 정산에 넣을 수 있다 (#131).
  // DB 의 start_settlement 판정과 같은 기준이고, 서버도 같은 조건으로 다시 거부한다.
  const canStartSettle = settleStartable(deal, now);
  // 마감됐는데 주최자 혼자면 정산할 게 없다 — 버튼만 '마감됨'이면 이유를 알 수 없어 따로 안내한다.
  const settleAlone = deal.mine && deal.status === "recruiting" && deal.end <= now && deal.joined < 2;
  // 나갈 수 있었는데 마감이 임박해서 막힌 경우 — 버튼만 바뀌면 이유를 알 수 없어 따로 알려준다.
  // 이미 마감된 공구는 배지가 '마감'이라 굳이 다시 알리지 않는다.
  const leaveClosed =
    deal.me && !deal.mine && deal.status === "recruiting" && !canLeave && deal.end > now;
  // 공구 채팅방은 참여자(주최자 포함)만 들어갈 수 있다 — store.rooms 는 내 participations 로만
  // 채워지므로, 미참여자를 들여보내면 방을 못 찾고 조용히 동네 라운지가 열렸다 (#93).
  // deal.me 는 "주최자이거나 참여 행이 있음" 이라 방 목록 판정과 정확히 같다.
  const canChat = deal.me;

  const onMainAction = () => {
    if (deal.status === "settling") openSettle(deal.id);
    else if (canStartSettle) {
      setSettleErr(null);
      void startSettlement(deal.id).then((err) => setSettleErr(err));
    } else if (canLeave) setAskLeave(true);
    else join(deal.id);
  };

  // 총액 수정 (#12) — 주최자 + 모집중 상태에서만. 정산 진입하면 서버(RLS/RPC)가 거부하지만,
  // 그 전에 버튼 자체를 숨겨서 눌러도 안 되는 걸 미리 보여주지 않는다.
  // 마감 시각이 지나도 DB status 는 recruiting 그대로라(마감 크론 없음) deadline 도 같이 본다 (#73).
  const canEditTotal = deal.mine && deal.status === "recruiting" && deal.end > now;
  const startEditTotal = () => {
    setTotalInput(String(deal.total));
    setEditingTotal(true);
  };
  const saveTotal = () => {
    // parseInt 는 number 입력이 허용하는 "1e5"(=100000)를 1 로 잘라먹는다 → Number 로 파싱하고
    // 원 단위 정수(CLAUDE.md 규칙 5)가 아니면 저장하지 않는다.
    const n = Number(totalInput);
    if (!Number.isInteger(n) || n <= 0) return;
    setEditingTotal(false);
    if (n !== deal.total) void changeTotalAmount(deal.id, n);
  };

  const mainKeyClass = canLeave
    ? "key key-line"
    : active || canStartSettle || deal.status === "settling"
      ? "key key-primary"
      : "key key-off";

  return (
    <div className="flex-1 overflow-auto px-9 py-8">
      <div
        onClick={() => go("home")}
        className="mb-4 inline-block cursor-pointer text-[14.5px] text-[#77777f] hover:text-[#e14e2b]"
      >
        ← 목록으로
      </div>
      <div className="flex justify-center gap-[30px]">
        <div className="w-[560px] flex-none">
          <div className="receipt px-[30px] pb-6 pt-7">
            <div className="receipt-head text-[17px]">＊ 공구 상세 ＊</div>
            <div className="mt-[7px] text-center text-xs text-[#8b8478]">
              {receiptNo(deal.id, deal.created_at)} ｜ {deal.cat} ｜ 주최: {deal.host}
              {deal.mine ? "(나)" : ""}
            </div>
            <div className="rule-dash mt-3.5" />

            {deal.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */
              <img src={deal.imageUrl} alt="" className="mt-4 h-[220px] w-full object-cover" />
            ) : (
              <div className="mt-4 flex h-[130px] items-center justify-center bg-[#ededea]">
                <span className="font-sans-ko text-[49.5px] font-extrabold text-[#b9b9b4]">
                  {deal.cat.slice(0, 1)}
                </span>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3.5">
              <div className="font-sans-ko text-[26px] font-black leading-[1.35]">{deal.title}</div>
              <div className="ml-auto flex flex-none flex-col items-end gap-2">
                <StatusBadge s={st} />
                {/* 도장은 실제로 초가 흐를 때만 — 마감·정산중이면 문구가 원 밖으로 넘친다 */}
                {deal.status === "recruiting" && deal.end > now && (
                  <div
                    className="stamp h-[74px] w-[74px] flex-col"
                    style={{ borderColor: cd.color, color: cd.color }}
                  >
                    <span className="text-[10px] font-bold">마감까지</span>
                    <span className="tnum mt-0.5 text-[13.5px] font-bold">{stampRemainLabel(deal, now)}</span>
                  </div>
                )}
              </div>
            </div>

            {deal.description && (
              <div className="font-sans-ko mt-3 whitespace-pre-line text-[14.5px] leading-[1.8] text-[#55524b]">
                {deal.description}
              </div>
            )}

            <div className="rule-dash mt-3.5 flex flex-col gap-[9px] pt-3.5 text-sm text-[#6e675e]">
              <div className="leader">
                <span>수령지</span>
                <i />
                <b>{deal.place}</b>
              </div>
              <div className="leader">
                <span>참여</span>
                <i />
                <b>
                  {deal.joined}/{deal.goal}명
                  {deal.goal > deal.joined ? ` · ${deal.goal - deal.joined}자리 남음` : ""}
                </b>
              </div>
              {editingTotal && canEditTotal ? (
                <div className="flex items-center gap-2">
                  <span>총액</span>
                  <input
                    type="number"
                    autoFocus
                    value={totalInput}
                    onChange={(e) => setTotalInput(e.target.value)}
                    onKeyDown={(e) => isSubmitEnter(e) && saveTotal()}
                    className="field tnum ml-auto w-[130px] py-1.5 text-right"
                  />
                  <span onClick={saveTotal} className="key key-ink px-3 py-1.5 text-xs">
                    저장
                  </span>
                  <span onClick={() => setEditingTotal(false)} className="key key-line px-3 py-1.5 text-xs">
                    취소
                  </span>
                </div>
              ) : (
                <div className="leader">
                  <span>총액</span>
                  <i />
                  <b className="text-[17px]">{fmt(deal.total)}</b>
                  {canEditTotal && (
                    <span
                      onClick={startEditTotal}
                      className="ml-2 cursor-pointer border-b-[1.5px] border-[#e14e2b] text-xs font-bold text-[#e14e2b]"
                    >
                      수정
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4">
              <ProgressBar pct={pct} color={st.fg} />
            </div>

            <div className="rule-dash mt-4 flex items-baseline pt-3.5">
              <span className="text-[14.5px] text-[#8b8478]">{perLabel(deal)}</span>
              <span className="tnum ml-auto text-[31.5px] font-black">{fmt(perAmount(deal))}</span>
            </div>

            <Barcode seed={deal.id} className="mt-3.5" />

            <div onClick={onMainAction} className={`${mainKeyClass} mt-3.5 py-3 text-[17px]`}>
              [ {canLeave ? "나가기" : joinLabel(deal, now)} ]
            </div>
            {settleErr && <div className="mt-2 text-center text-xs text-[#e14e2b]">{settleErr}</div>}
            {settleAlone && (
              <div className="mt-2 text-center text-xs text-[#8b8478]">
                참여자가 없어 정산할 게 없어요 — 공구를 취소해주세요
              </div>
            )}
            {leaveClosed && (
              <div className="mt-2 text-center text-xs text-[#8b8478]">
                마감 {LEAVE_CUTOFF_MS / 60_000}분 전부터는 나갈 수 없어요
              </div>
            )}

            {askLeave && (
              <div className="mt-3 border-[1.5px] border-dashed border-[#e14e2b] p-3.5">
                <div className="text-[14.5px] font-bold text-[#e14e2b]">공구에서 나갈까요?</div>
                <div className="mt-1 text-xs text-[#8b8478]">
                  참여가 취소되고 채팅방에 나갔다는 메시지가 남아요.
                </div>
                {leaveErr && <div className="mt-2 text-xs font-bold text-[#e14e2b]">{leaveErr}</div>}
                <div className="mt-3 flex gap-2">
                  <div
                    onClick={async () => {
                      if (leaving) return;
                      setLeaving(true);
                      setLeaveErr(null);
                      const err = await leave(deal.id);
                      setLeaving(false);
                      if (err) setLeaveErr(err);
                      else setAskLeave(false);
                    }}
                    className="key key-primary flex-1 py-2 text-[14.5px]"
                  >
                    [ {leaving ? "나가는 중…" : "나가기"} ]
                  </div>
                  <div
                    onClick={() => {
                      setAskLeave(false);
                      setLeaveErr(null);
                    }}
                    className="key key-line flex-1 py-2 text-[14.5px]"
                  >
                    [ 그만두기 ]
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3.5 flex gap-2 text-sm">
              <div
                onClick={() => canChat && goRoom("d" + deal.id)}
                title={canChat ? undefined : "참여 후 이용할 수 있어요"}
                className={`flex-[1.3] py-3 ${canChat ? "key key-line" : "key key-off"}`}
              >
                [ 채팅방 입장 ]
              </div>
              <div onClick={() => shareDeal(deal.id, "lounge")} className="key key-line flex-1 py-3">
                [ 라운지 공유 ]
              </div>
            </div>
            {!canChat && (
              <div className="mt-2 text-center text-xs text-[#8b8478]">참여 후 이용할 수 있어요</div>
            )}

            {/* 주최자 취소 (#29) — 어느 단계에서든 주최자는 공구를 취소할 수 있다 */}
            {cancelable &&
              (askCancel ? (
                <div className="rule-dash mt-3.5 border-[1.5px] border-dashed border-[#e14e2b] p-3.5">
                  <div className="text-[14.5px] font-bold text-[#e14e2b]">공구를 취소할까요?</div>
                  <div className="mt-1 text-xs text-[#8b8478]">
                    참여자 전원에게 알림이 가고 되돌릴 수 없어요.
                  </div>
                  {cancelErr && <div className="mt-2 text-xs font-bold text-[#e14e2b]">{cancelErr}</div>}
                  <div className="mt-3 flex gap-2">
                    <div
                      onClick={async () => {
                        if (canceling) return;
                        setCanceling(true);
                        setCancelErr(null);
                        const err = await cancelDeal(deal.id);
                        setCanceling(false);
                        if (err) setCancelErr(err);
                        else setAskCancel(false);
                      }}
                      className="key key-primary flex-1 py-2 text-[14.5px]"
                    >
                      [ {canceling ? "취소 중…" : "취소하기"} ]
                    </div>
                    <div
                      onClick={() => {
                        setAskCancel(false);
                        setCancelErr(null);
                      }}
                      className="key key-line flex-1 py-2 text-[14.5px]"
                    >
                      [ 그만두기 ]
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setAskCancel(true)}
                  className="rule-dash mt-3.5 cursor-pointer pt-3 text-center text-xs font-bold text-[#e14e2b]"
                >
                  공구 취소
                </div>
              ))}
          </div>
          <div className="receipt-edge" />
        </div>

        <div className="w-[280px] flex-none">
          <div className="receipt px-5 py-[18px]">
            <div className="rule-dash border-b border-t-0 pb-2.5 text-xs font-bold tracking-[.14em]">
              참여 명단 // 실시간
            </div>
            <div className="mt-3 flex flex-col gap-2.5 text-[14.5px]">
              {participantAvatars.map((p) => (
                <div key={p.userId} className="flex items-center gap-2.5">
                  <Avatar ch={p.initials} src={p.avatarUrl} />
                  <span className="font-sans-ko truncate">{p.nickname}</span>
                  {p.isHost && <span className="ml-auto text-[11px] text-[#9c9ca3]">주최</span>}
                </div>
              ))}
              {Array.from({ length: Math.max(0, deal.goal - deal.joined) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-2.5 text-[#9c9ca3]">
                  <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center border-[1.5px] border-dashed border-[#c9c9c4] text-[12.5px]">
                    ·
                  </span>
                  <span>공석</span>
                </div>
              ))}
            </div>
          </div>
          <div className="receipt-edge" />
        </div>
      </div>
    </div>
  );
}
