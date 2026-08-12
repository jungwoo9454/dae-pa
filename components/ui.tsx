"use client";

import { useMemo } from "react";
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

/**
 * 단말 ON/OFF 키 — 스위치 대신 눌리는 키로 (#143).
 * 폭을 고정하고 두 상태 모두 같은 두께의 테두리를 둔다 — 안 그러면 ON(테두리 없음, 2자)과
 * OFF(테두리 1.5px, 3자)의 박스 크기가 달라 누를 때마다 줄이 흔들린다 (#156).
 * 색은 잉크/감열지 — 형광 초록은 대파페이 금고 LED 전용이라 여기선 안 쓴다.
 */
export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`w-[54px] rounded-[4px] border-[1.5px] py-1.5 text-center text-xs font-bold ${
        on
          ? "border-[#1b1917] bg-[#1b1917] text-[#fdfdfb]"
          : "border-[#c9c9c4] text-[#9c9ca3] hover:border-[#1b1917] hover:text-[#1b1917]"
      }`}
    >
      {on ? "ON" : "OFF"}
    </button>
  );
}

/** 참여자 이니셜 — 전표에 찍힌 각진 인장 */
export function Avatar({
  ch,
  size = 26,
  src,
}: {
  ch: string;
  size?: number;
  /** 프로필 사진 URL — 없으면 이름 첫 글자로 떨어진다 */
  src?: string | null;
}) {
  return (
    <span
      className="inline-flex flex-none items-center justify-center overflow-hidden border-[1.5px] border-[#1b1917] text-[12.5px] font-bold"
      style={{ minWidth: size, width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- 소셜·R2 아바타는 외부 도메인이라 next/image 설정 없이 쓴다
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        ch
      )}
    </span>
  );
}

/**
 * 전표 바코드 — 공구마다 다른 막대 패턴 (#166).
 *
 * 난수를 그때그때 뽑으면 카운트다운이 1초마다 다시 그릴 때 바코드가 춤춘다. 그래서 공구 id 를
 * 씨앗으로 쓰는 결정적 난수(LCG)로 만든다 — 같은 공구는 언제 봐도 같은 바코드, 다른 공구는 다른 바코드.
 */
export function Barcode({ seed, className = "" }: { seed: number; className?: string }) {
  const image = useMemo(() => {
    let s = (Math.abs(seed) * 2654435761) % 2147483647 || 1;
    const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
    const stops: string[] = [];
    let x = 0;
    // 300px 한 마디를 만들고 가로로 반복시킨다 — 카드 폭이 달라도 자연스럽게 이어진다
    while (x < 300) {
      const bar = 1 + Math.floor(rnd() * 3);
      const gap = 1 + Math.floor(rnd() * 3);
      stops.push(`#1b1917 ${x}px ${x + bar}px`, `transparent ${x + bar}px ${x + bar + gap}px`);
      x += bar + gap;
    }
    return { backgroundImage: `linear-gradient(90deg, ${stops.join(",")})`, backgroundSize: `${x}px 100%` };
  }, [seed]);

  return (
    <div
      aria-hidden
      className={`h-7 w-full ${className}`}
      style={{ ...image, backgroundRepeat: "repeat-x" }}
    />
  );
}

/** 전표 번호 — NO.MMDD-NN. 공구 id 로 만들어 화면마다 같은 값이 나온다 */
export function receiptNo(id: number, createdAt?: string) {
  const d = createdAt ? new Date(createdAt) : null;
  const mm = d ? String(d.getMonth() + 1).padStart(2, "0") : "00";
  const dd = d ? String(d.getDate()).padStart(2, "0") : "00";
  return `NO.${mm}${dd}-${String(id).padStart(2, "0")}`;
}
