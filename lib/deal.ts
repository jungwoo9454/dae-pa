import { Carrot, Package, ShoppingBag, SprayCan, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ParticipationWithProfile } from "./db-types";
import type { Category, Deal } from "./types";

/** 카테고리 이모지 — 화면·API 모두 이 한 벌만 쓴다 (예전엔 API 에 다른 맵이 하나 더 있었다, #90) */
export const CAT_EMOJI: Record<Category, string> = {
  식료품: "🥬",
  배달음식: "🍗",
  생활용품: "🧻",
  대량구매: "📦",
  기타: "🛒",
};

/** 카테고리 아이콘 — 앱 전반이 lucide 체제(#65)라 칩·버튼은 이모지 대신 이걸 쓴다 (#90) */
export const CAT_ICON: Record<Category, LucideIcon> = {
  식료품: Carrot,
  배달음식: UtensilsCrossed,
  생활용품: SprayCan,
  대량구매: Package,
  기타: ShoppingBag,
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
  key: "settling" | "closed" | "closing" | "recruiting" | "canceled";
  /** 배지 문구 5종 고정 (CLAUDE.md 디자인 규칙) */
  label: string;
  /** 태그 글자·진행바·강조에 쓰는 주 색 */
  fg: string;
  /** 태그 테두리 — 마감만 글자보다 진하다 */
  bd: string;
  /** 썸네일·연한 배경 */
  bg: string;
  /** 라벨 앞 기호 — 전표 태그 규칙 (#143). 마감임박만 점멸한다 */
  mark: string;
  /** 취소됨만 파선 테두리 + 취소선 */
  dashed?: boolean;
}

/** 마감임박은 DB 상태가 아니라 마감 1시간 전부터 파생 표시 */
export function statusOf(d: Deal, now: number): StatusView {
  if (d.status === "settling")
    return { key: "settling", label: "정산중", fg: "#4a6fa5", bd: "#4a6fa5", bg: "#e7edf5", mark: "◆" };
  if (d.status === "canceled")
    return { key: "canceled", label: "취소됨", fg: "#e14e2b", bd: "#e14e2b", bg: "#f1efe8", mark: "", dashed: true };
  const left = d.end - now;
  if (d.status !== "recruiting" || left <= 0)
    return { key: "closed", label: "마감", fg: "#9c9ca3", bd: "#b9b9b4", bg: "#ededea", mark: "■" };
  if (left < 3_600_000)
    return { key: "closing", label: "마감임박", fg: "#e14e2b", bd: "#e14e2b", bg: "#fbe9e3", mark: "▲" };
  return { key: "recruiting", label: "모집중", fg: "#1b1917", bd: "#1b1917", bg: "#ededea", mark: "●" };
}

/** 금액 입력창에서 숫자만 남긴다 — 저장은 항상 이 원 단위 정수 문자열로 한다 (핵심 규칙 5) */
export const digits = (v: string) => v.replace(/[^0-9]/g, "");
/** 입력창에 천 단위 콤마로 보여준다. 저장 값(digits 결과)은 그대로 두고 표시만 바꾼다 (#95) */
export const commaFmt = (v: string) => (v ? Number(v).toLocaleString("ko-KR") : "");

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

/**
 * 상태 도장(70px 원) 안에 쓰는 짧은 표기 (#187) — remainLabel 은 "3일 02:11:07" 처럼 길어져
 * 원 밖으로 넘친다. 초 단위가 의미 있는 건 마감 한 시간 안쪽뿐이다.
 */
export function stampRemainLabel(d: Deal, now: number) {
  const ms = d.end - now;
  if (d.status !== "recruiting" || ms <= 0) return "마감됨";
  const dd = Math.floor(ms / 86_400_000);
  if (dd > 0) return dd + "일 남음";
  const h = Math.floor(ms / 3_600_000);
  if (h > 0) return h + "시간 남음";
  return remainLabel(d, now);
}

/**
 * 1인당 예상 금액 — 정산 확정 전 미리보기용 추정치. 참여자 수는 목표가 아니라 현재 joined
 * 기준(실시간 갱신, docs/PLANNING.md 4.2).
 *
 * 배달음식은 사람마다 메뉴·금액이 달라 총액을 나눠 보여줄 수 없다 — 다 같이 내는 건 배달비뿐이라
 * 배달비만 엔빵해서 보여준다(핵심 규칙 4). 그 외 카테고리는 총액을 다 같이 부담하는 공동구매라
 * (총 금액 + 배달비) 전체를 나눈다.
 */
/**
 * 상세 카운트다운 표기 (#87) — 마감·정산중·취소된 공구까지 "남은 시간 · 실시간" 초록 카운트다운을
 * 그대로 보여주면 아직 모집 중인 것처럼 읽힌다. 문구는 statusOf 의 배지 문구를 그대로 쓴다.
 */
export function countdownDisplay(d: Deal, now: number) {
  const st = statusOf(d, now);
  if (st.key === "recruiting")
    return { text: remainLabel(d, now), caption: "남은 시간 · 실시간", color: "#1f8a4c" };
  if (st.key === "closing")
    return { text: remainLabel(d, now), caption: "곧 마감돼요 · 실시간", color: "#b45309" };
  if (st.key === "settling") return { text: st.label, caption: "정산 진행 중", color: st.fg };
  if (st.key === "canceled") return { text: st.label, caption: "주최자가 취소했어요", color: st.fg };
  return { text: st.label, caption: "모집 종료", color: st.fg };
}

/** "1인" 라벨 — 배달음식은 배달비만 나눈 값이라 그대로 쓰면 음식값까지 포함된 걸로 읽힌다 (#95) */
export function perLabel(d: Deal) {
  return d.cat === "배달음식" ? "1인 배달비" : "1인";
}

export function perAmount(d: Deal) {
  // 항목·배달비를 각각 내림해서 더한다 — DB 의 apply_settlement_split 과 같은 식이라야
  // 카드에서 본 금액과 정산서 금액이 안 어긋난다. 나머지는 주최자 부담(핵심 규칙 5, #189).
  const n = Math.max(1, d.joined);
  const fee = Math.floor((d.deliveryFee ?? 0) / n);
  return d.cat === "배달음식" ? fee : Math.floor(d.total / n) + fee;
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

/** 공구 마감까지 최소로 잡을 수 있는 시간(분) — 올리기 폼과 API 가 같은 값을 본다 */
export const MIN_DEADLINE_MIN = 5;

/** 마감 상한(분) = 반년 — 없으면 영영 안 끝나는 공구가 만들어진다 (#186) */
export const MAX_DEADLINE_MIN = 180 * 24 * 60;
/** 상한 안내 문구 — 폼·API 가 같은 말을 쓰도록 여기 한 벌만 둔다 */
export const MAX_DEADLINE_LABEL = "반년";

/** 마감 몇 ms 전부터 나가기를 막는지 — DB 의 leave_group_buy 판정과 같은 값이어야 한다 */
export const LEAVE_CUTOFF_MS = 5 * 60_000;

export function joinable(d: Deal, now: number) {
  return d.status === "recruiting" && !d.me && d.end - now > 0;
}

/**
 * 나가기(참여 취소) 가능 여부 (#94) — 주최자가 아닌 참여자가, 모집중이고, 마감 5분 전까지만.
 * 마감 직전에 빠지면 남은 사람 1인당 금액이 갑자기 뛰는데 주최자가 대응할 시간이 없다.
 * 서버(leave_group_buy RPC)도 같은 기준으로 거부하므로 화면 판정은 안내용이다.
 */
export function leavable(d: Deal, now: number) {
  return d.me && !d.mine && d.status === "recruiting" && d.end - now > LEAVE_CUTOFF_MS;
}

/**
 * 정원 미달로 마감된 공구를 주최자가 모인 인원 그대로 정산 시작할 수 있는지 (#131).
 * settling 으로 가는 다른 경로(정원 도달)는 join_group_buy 가 자동 처리하므로 여기 안 걸린다.
 * 마감돼도 DB status 는 recruiting 그대로라(마감 크론 없음) deadline 을 같이 본다.
 * 주최자 혼자(joined < 2)면 1/N 할 게 없어 정산 대신 취소 — DB 의 start_settlement 판정과 같다.
 */
export function settleStartable(d: Deal, now: number) {
  return d.mine && d.status === "recruiting" && d.end - now <= 0 && d.joined >= 2;
}

export function joinLabel(d: Deal, now: number) {
  if (d.status === "settling") return "정산 보기";
  if (settleStartable(d, now)) return "정산 시작";
  // 마감·취소·완료된 공구는 참여 여부와 상관없이 '마감됨' — 버튼은 "누르면 뭐가 되는지"를
  // 말해야 하고, 참여 여부는 배지·'내 공구' 탭이 따로 알려준다 (#131).
  // joinable() 로는 못 가른다 — !d.me 가 들어 있어 모집중인 내 공구도 false 가 된다.
  if (d.status !== "recruiting" || d.end - now <= 0) return "마감됨";
  if (d.me) return "참여중 ✓";
  return "참여하기";
}
