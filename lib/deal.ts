import type { Category, Deal, Member } from "./types";

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

export function perAmount(d: Deal) {
  return Math.ceil(d.total / d.goal);
}

export function splitEven(amount: number, n: number) {
  const base = Math.floor(amount / n);
  return { base, remainder: amount - base * n };
}

/**
 * 개인 부담금 = 개인 항목 금액 + (배달비 ÷ 참여자 수).
 * 배달비는 항상 균등 분배하고, 항목 금액·배달비 나머지는 모두 주최자가 부담해
 * 멤버 amt 합계가 항상 deal.total과 일치하도록 만든다.
 */
export function recalcMembers(deal: Pick<Deal, "total" | "host" | "deliveryFee">, members: Member[]): Member[] {
  const n = members.length;
  if (n === 0) return members;
  const deliveryFee = deal.deliveryFee ?? 0;
  const itemTotal = deal.total - deliveryFee;
  const { base: dBase, remainder: dRem } = splitEven(deliveryFee, n);
  const othersItemSum = members.filter((m) => m.name !== deal.host).reduce((s, m) => s + m.itemAmt, 0);
  const hostItemAmt = itemTotal - othersItemSum;
  return members.map((m) => {
    const isHost = m.name === deal.host;
    const itemAmt = isHost ? hostItemAmt : m.itemAmt;
    const deliveryShare = isHost ? dBase + dRem : dBase;
    return { ...m, itemAmt, amt: itemAmt + deliveryShare };
  });
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
