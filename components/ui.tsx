"use client";

import type { StatusView } from "@/lib/deal";

/** 상태 태그 — 각진 네모 + 기호. 마감임박(▲)만 점멸한다 (#143) */
export function StatusBadge({ s }: { s: StatusView }) {
  return (
    <span
      className="tag"
      style={{
        borderColor: s.bd,
        borderStyle: s.dashed ? "dashed" : "solid",
        color: s.fg,
        textDecoration: s.dashed ? "line-through" : undefined,
      }}
    >
      {s.mark && (
        <span className={s.key === "closing" ? "mark-pulse" : undefined} aria-hidden>
          {s.mark}
        </span>
      )}
      {s.label}
    </span>
  );
}

/** 참여 진행바 — 트랙은 감열지 위 옅은 띠, 채움은 상태 색 */
export function ProgressBar({ pct, color = "#1b1917", h = 8 }: { pct: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-[#ebe6da]" style={{ height: h }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color, transition: "width .4s" }}
      />
    </div>
  );
}

/** 단말 ON/OFF 키 — 스위치 대신 눌리는 키로 (#143) */
export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-[4px] px-3.5 py-1.5 text-xs font-bold ${
        on ? "bg-[#1b1917] text-[#7ce28c]" : "border-[1.5px] border-[#c9c9c4] text-[#9c9ca3]"
      }`}
    >
      {on ? "ON" : "OFF"}
    </button>
  );
}

/** 참여자 이니셜 — 전표에 찍힌 각진 인장 */
export function Avatar({ ch, size = 26 }: { ch: string; size?: number }) {
  return (
    <span
      className="inline-flex flex-none items-center justify-center border-[1.5px] border-[#1b1917] text-[11px] font-bold"
      style={{ minWidth: size, height: size }}
    >
      {ch}
    </span>
  );
}

/** 전표 번호 — NO.MMDD-NN. 공구 id 로 만들어 화면마다 같은 값이 나온다 */
export function receiptNo(id: number, createdAt?: string) {
  const d = createdAt ? new Date(createdAt) : null;
  const mm = d ? String(d.getMonth() + 1).padStart(2, "0") : "00";
  const dd = d ? String(d.getDate()).padStart(2, "0") : "00";
  return `NO.${mm}${dd}-${String(id).padStart(2, "0")}`;
}
