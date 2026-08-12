"use client";

import { Ban, Coins, MapPin, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ProgressBar, StatusBadge } from "@/components/ui";
import {
  LEAVE_CUTOFF_MS,
  countdownDisplay,
  fmt,
  joinLabel,
  joinable,
  leavable,
  perAmount,
  perLabel,
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
  const closing = st.key === "closing";
  const cd = countdownDisplay(deal, now);
  const active = joinable(deal, now);
  // 참여자 아바타 — participations.user_id → profiles.id embed로 받은 닉네임 첫 글자를 쓴다.
  // profile을 못 찾은 경우(고아 user_id 등)에만 user_id로 폴백한다.
  const participantAvatars = (deal.participations ?? []).slice(0, 4).map((p) => ({
    userId: p.user_id,
    initials: (p.profile?.nickname ?? p.user_id).slice(0, 1).toUpperCase(),
  }));
  // 취소는 주최자만, 모집중·정산중일 때만 (#29 — DB 의 cancel_group_buy 판정과 같다)
  const cancelable = deal.mine && (deal.status === "recruiting" || deal.status === "settling");
  // 나가기는 주최자가 아닌 참여자만, 모집중이고 마감 5분 전까지만 (#94 — DB 의 leave_group_buy 판정과 같다).
  // 정산 시작 후엔 금액이 걸려있어 범위 밖 — 1차는 모집중에서만 허용.
  const canLeave = leavable(deal, now);
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
    else if (canLeave) setAskLeave(true);
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
          {deal.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */
            <img
              src={deal.imageUrl}
              alt=""
              className="h-[220px] w-full rounded-2xl border border-[#d8e7d6] object-cover"
            />
          ) : (
            <div
              className="flex h-[220px] items-center justify-center rounded-2xl border border-[#d8e7d6] text-[40px] text-[#8aa392]"
              style={{ background: "repeating-linear-gradient(45deg,#e4efe2 0 14px,#eef5ec 14px 28px)" }}
            >
              {deal.emoji}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-jua text-2xl">{deal.title}</span>
              <StatusBadge s={st} />
            </div>
            <div className="mt-1 text-[#6b8573]">
              {deal.cat} · 주최 {deal.host}
            </div>
          </div>
          <div className="whitespace-pre-line rounded-[14px] border border-[#dbe9da] bg-white px-4 py-3.5 leading-[1.7] text-[#3c5546]">
            {deal.description ||
              "품질 좋은 걸 대용량으로 사서 나눠요. 마감되면 채팅방에서 수령 시간을 맞추고, 정산은 앱에서 자동 1/N로 진행됩니다."}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 rounded-[10px] border border-[#dbe9da] bg-white px-3 py-2 text-[13px]">
              <MapPin aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 수령 · <b>{deal.place}</b>
            </div>
            {editingTotal && canEditTotal ? (
              <div className="flex items-center gap-1.5 rounded-[10px] border border-[#1f8a4c] bg-white px-3 py-2 text-[13px]">
                <Coins aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" />
                <input
                  type="number"
                  autoFocus
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  onKeyDown={(e) => isSubmitEnter(e) && saveTotal()}
                  className="tnum w-[110px] rounded-md border border-[#d5e6d6] px-2 py-1 text-right outline-none focus:border-[#1f8a4c]"
                />
                <span
                  onClick={saveTotal}
                  className="cursor-pointer rounded-md bg-[#1f8a4c] px-2.5 py-1 font-bold text-white hover:bg-[#187741]"
                >
                  저장
                </span>
                <span
                  onClick={() => setEditingTotal(false)}
                  className="cursor-pointer rounded-md border border-[#d5e6d6] px-2.5 py-1 font-bold text-[#4d6d58] hover:border-[#1f8a4c]"
                >
                  취소
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-[10px] border border-[#dbe9da] bg-white px-3 py-2 text-[13px]">
                <Coins aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" />
                <span>
                  총액 · <b>{fmt(deal.total)}</b>{" "}
                  {canEditTotal ? (
                    <span
                      onClick={startEditTotal}
                      className="cursor-pointer text-[11.5px] font-bold text-[#1f8a4c] underline"
                    >
                      수정
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-[#8aa392]">정산 전까지 변경 가능</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex w-[300px] flex-none flex-col gap-3.5 rounded-[18px] border border-[#cfe4d0] bg-white p-5 shadow-[0_6px_18px_rgba(18,70,38,.08)]">
          <div className="text-center">
            <div className="font-jua tnum text-[30px]" style={{ color: cd.color }}>
              {cd.text}
            </div>
            <div className="text-xs text-[#6b8573]">{cd.caption}</div>
          </div>
          <ProgressBar pct={pct} color={closing ? "#d97706" : "#1f8a4c"} h={11} />
          <div className="flex justify-between text-sm">
            <span>
              참여 <b>{deal.joined}</b>/{deal.goal}명
            </span>
            <span>
              {perLabel(deal)} <b className="text-base">{fmt(perAmount(deal))}</b>
            </span>
          </div>
          <div className="flex">
            {participantAvatars.map((avatar) => (
              <div
                key={avatar.userId}
                className="-mr-[7px] flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-[#dceede] text-xs font-extrabold text-[#2f6d45]"
              >
                {avatar.initials}
              </div>
            ))}
            <span className="ml-3.5 self-center text-[12.5px] text-[#6b8573]">
              {deal.joined > 4 ? `+${deal.joined - 4}명 참여중` : `${deal.joined}명 참여중`}
            </span>
          </div>
          <div
            onClick={onMainAction}
            className={`cursor-pointer rounded-xl p-[13px] text-center text-base font-extrabold hover:brightness-105 ${
              canLeave
                ? "border-[1.5px] border-[#d5e6d6] bg-white text-[#4d6d58] hover:border-[#b3261e] hover:text-[#b3261e]"
                : active || deal.status === "settling"
                  ? "bg-[#1f8a4c] text-white"
                  : "bg-[#e6efe4] text-[#6b8573]"
            }`}
          >
            {canLeave ? "나가기" : joinLabel(deal, now)}
          </div>
          {leaveClosed && (
            <div className="-mt-2.5 text-center text-[12px] text-[#8aa392]">
              마감 {LEAVE_CUTOFF_MS / 60_000}분 전부터는 나갈 수 없어요
            </div>
          )}
          {askLeave && (
            <div className="flex flex-col gap-2 rounded-xl bg-[#fdecec] p-3">
              <div className="text-[13px] font-extrabold text-[#b3261e]">공구에서 나갈까요?</div>
              <div className="text-[12px] text-[#8a6a6a]">참여가 취소되고 채팅방에 나갔다는 메시지가 남아요.</div>
              {leaveErr && (
                <div className="rounded-[8px] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#b3261e]">
                  {leaveErr}
                </div>
              )}
              <div className="flex gap-2">
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
                  className="flex-1 cursor-pointer rounded-[10px] bg-[#b3261e] p-2 text-center text-[13px] font-extrabold text-white hover:brightness-110"
                >
                  {leaving ? "나가는 중…" : "나가기"}
                </div>
                <div
                  onClick={() => {
                    setAskLeave(false);
                    setLeaveErr(null);
                  }}
                  className="flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[#d5e6d6] bg-white p-2 text-center text-[13px] font-bold text-[#4d6d58] hover:border-[#1f8a4c]"
                >
                  그만두기
                </div>
              </div>
            </div>
          )}
          <div
            onClick={() => canChat && goRoom("d" + deal.id)}
            title={canChat ? undefined : "참여 후 이용할 수 있어요"}
            className={`flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] p-2.5 font-extrabold ${
              canChat
                ? "cursor-pointer border-[#1f8a4c] text-[#1f8a4c] hover:bg-[#e9f6ec]"
                : "cursor-default border-[#e0eadf] text-[#a8bdb0]"
            }`}
          >
            <MessageCircle aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 공구 채팅방
          </div>
          {!canChat && (
            <div className="-mt-2.5 text-center text-[12px] text-[#8aa392]">
              참여 후 이용할 수 있어요
            </div>
          )}
          {/* 라운지에 카드 말풍선으로 공유 → 대화 중 바로 참여로 이어진다 (#10) */}
          <div
            onClick={() => shareDeal(deal.id, "lounge")}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#d5e6d6] p-2.5 text-[13.5px] font-bold text-[#4d6d58] hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
          >
            <Share2 aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 동네 라운지에 공유
          </div>
          {/* 주최자 취소 (#29) — 어느 단계에서든 주최자는 공구를 취소할 수 있다 */}
          {cancelable &&
            (askCancel ? (
              <div className="flex flex-col gap-2 rounded-xl bg-[#fdecec] p-3">
                <div className="text-[13px] font-extrabold text-[#b3261e]">공구를 취소할까요?</div>
                <div className="text-[12px] text-[#8a6a6a]">
                  참여자 전원에게 알림이 가고 되돌릴 수 없어요.
                </div>
                {cancelErr && (
                  <div className="rounded-[8px] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#b3261e]">
                    {cancelErr}
                  </div>
                )}
                <div className="flex gap-2">
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
                    className="flex-1 cursor-pointer rounded-[10px] bg-[#b3261e] p-2 text-center text-[13px] font-extrabold text-white hover:brightness-110"
                  >
                    {canceling ? "취소 중…" : "취소하기"}
                  </div>
                  <div
                    onClick={() => {
                      setAskCancel(false);
                      setCancelErr(null);
                    }}
                    className="flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-[#d5e6d6] bg-white p-2 text-center text-[13px] font-bold text-[#4d6d58] hover:border-[#1f8a4c]"
                  >
                    그만두기
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setAskCancel(true)}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#d5e6d6] p-2.5 text-[13.5px] font-bold text-[#4d6d58] hover:border-[#b3261e] hover:text-[#b3261e]"
              >
                <Ban aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> 공구 취소
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
