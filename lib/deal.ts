import type { ParticipationWithProfile } from "./db-types";
import type { Category, Deal } from "./types";

export const CAT_EMOJI: Record<Category, string> = {
  식료품: "🥬",
  배달음식: "🍗",
  생활용품: "🧻",
  대량구매: "📦",
  기타: "🛒",
};

export function fmt(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

/** wallet_transactions.created_at(ISO) → "방금"/"N분 전"/"어제"/"8월 7일" 같은 상대 표기 */
export function relativeWhen(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return minutes + "분 전";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "시간 전";
  const days = Math.floor(hours / 24);
  if (days < 2) return "어제";
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export interface StatusView {
  key: "settling" | "closed" | "closing" | "recruiting";
  label: string;
  bg: string;
  fg: string;
}

/** 마감임박은 DB 상태가 아니라 마감 1시간 전부터 파생 표시 */
export function statusOf(d: Deal, now: number): StatusView {
  if (d.status === "settling") return { key: "settling", label: "정산중", bg: "#e0f0f1", fg: "#0e7490" };
  const left = d.end - now;
  // completed/canceled 는 배지 문구가 '마감' 으로 같다 (CLAUDE.md 디자인 규칙)
  if (d.status !== "recruiting" || left <= 0) return { key: "closed", label: "마감", bg: "#eceff0", fg: "#64748b" };
  if (left < 3_600_000) return { key: "closing", label: "마감임박", bg: "#fdf0dc", fg: "#b45309" };
  return { key: "recruiting", label: "모집중", bg: "#e9f6ec", fg: "#166b3a" };
}

export function remainLabel(d: Deal, now: number) {
  if (d.status !== "recruiting") return "마감됨";
  const ms = d.end - now;
  if (ms <= 0) return "마감됨";
  const s = Math.floor(ms / 1000);
  const dd = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (x: number) => String(x).padStart(2, "0");
  return (dd > 0 ? dd + "일 " : "") + p(h) + ":" + p(m) + ":" + p(ss);
}

/** 1인당 금액 = 총 금액 ÷ 현재 참여자 수 (목표 인원이 아니라 joined) — docs/PLANNING.md 4.2 */
export function perAmount(d: Deal) {
  return Math.ceil(d.total / Math.max(1, d.joined));
}

/** 입금 유예 — 마감 후 하루까지는 미납이어도 신뢰도를 깎지 않는다 */
const PAY_GRACE_MS = 24 * 3_600_000;

/**
 * 프로필 팝오버용 집계 (#19).
 * 신뢰도 = 기한 내 입금율 — 정산에 들어간 내 공구 중 마감 + 유예까지 안 낸 건만 감점한다.
 * 집계 대상이 없으면 100%.
 */
export function profileStats(deals: Deal[], now: number, meId: string | null) {
  const hosted = deals.filter((d) => d.mine).length;
  const joined = deals.filter((d) => d.me && !d.mine).length;
  const dues = deals
    .filter((d) => d.status === "settling" || d.status === "completed")
    .map((d) => ({ deal: d, mine: d.participations?.find((p) => p.user_id === meId) }))
    .filter((x): x is { deal: Deal; mine: ParticipationWithProfile } => !!x.mine);
  const late = dues.filter((x) => !x.mine.is_paid && x.deal.end + PAY_GRACE_MS <= now).length;
  const trust = dues.length === 0 ? 100 : Math.round(((dues.length - late) / dues.length) * 100);
  return { hosted, joined, trust };
}

export function joinable(d: Deal, now: number) {
  return d.status === "recruiting" && !d.me && d.end - now > 0;
}

export function joinLabel(d: Deal, now: number) {
  if (d.status === "settling") return "정산 보기";
  if (d.me) return "참여중 ✓";
  if (!joinable(d, now)) return "마감됨";
  return "참여하기";
}
