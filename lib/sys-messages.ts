import { fmt } from "./deal";

/**
 * 시스템 메시지 표준 문구 (#9).
 * 참여·마감·금액변경·정산 이벤트는 반드시 여기 함수를 통해 문구를 만든다.
 * DB에서는 kind='sys' 로 기록되며, 클라이언트 INSERT 가 막혀 있어
 * 서버의 post_system_message() RPC 가 같은 문구를 쓴다 (supabase/schema.sql).
 */
export const sysText = {
  roomOpened: (goal: number) => `공구방이 열렸어요 · 목표 ${goal}명`,
  joined: (who: string, joined: number, goal: number) => `${who}님이 참여했어요 (${joined}/${goal})`,
  goalReached: () => "목표 달성! 정산이 시작돼요 🎉",
  deadlineClosed: () => "마감 시간이 지나 모집이 종료됐어요",
  /** 금액 변경 — 규칙 3의 3종 세트 중 채팅 기록 담당 (#12에서 호출) */
  totalChanged: (before: number, after: number, perPerson: number, reason?: string) =>
    `💰 총액 변경 ${fmt(before)} → ${fmt(after)}${reason ? ` (${reason})` : ""} · 1인 ${fmt(perPerson)}`,
  settleReceipt: (total: number) => `🧾 영수증 인증 완료 · 총 ${fmt(total)} · 금액 잠금`,
  settleVoteOpen: (total: number) =>
    `총 ${fmt(total)}으로 정산 요청 · 영수증 없이 참여자 과반 동의로 확정돼요`,
  settleVoteConfirmed: (total: number) => `✅ 참여자 과반 동의로 총 ${fmt(total)} 확정 · 금액 잠금`,
  paid: (who: string, amount: number) => `${who}님이 ${fmt(amount)} 입금 완료 ✓ (대파페이)`,
  allPaid: () => "전원 입금 완료! 공구가 마감됐어요 🎉",
  /** 주최자 취소 (#29) — DB 의 cancel_group_buy RPC 도 같은 문구를 넣는다 */
  canceled: () => "🚫 주최자가 공구를 취소했어요",
} as const;
