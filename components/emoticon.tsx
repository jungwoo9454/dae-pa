"use client";

import { EMOTICONS, EMO_RATIO, emoStyle } from "@/lib/emoticons";

/** 이모티콘 한 칸. h 는 높이(px) — 폭은 시트 비율대로 따라간다 */
export function Emoticon({ i, h = 104 }: { i: number; h?: number }) {
  return (
    <div
      role="img"
      aria-label={`이모티콘: ${EMOTICONS[i]}`}
      style={{ ...emoStyle(i), height: h, width: Math.round(h * EMO_RATIO) }}
    />
  );
}

/**
 * 이모티콘 고르는 팝오버 (#179).
 * 바깥을 덮는 투명한 판을 깔아 아무 데나 누르면 닫히게 한다 — 팝오버 안에서 누른 클릭은
 * 판까지 안 내려가야 하므로 판보다 위(z-50)에 얹는다.
 */
export function EmoticonPicker({ onPick, onClose }: { onPick: (i: number) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="receipt absolute bottom-[calc(100%+10px)] left-0 z-50 w-[356px] border-[1.5px] border-[#1b1917] p-3">
        <div className="rule-dash flex items-center border-b border-t-0 pb-2 text-[11.5px] tracking-[.14em] text-[#8b8478]">
          ＊ 이모티콘 ＊
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {EMOTICONS.map((label, i) => (
            <button
              key={label}
              type="button"
              title={label}
              onClick={() => onPick(i)}
              className="flex h-[84px] items-center justify-center border-[1.5px] border-transparent hover:border-[#1b1917]"
            >
              <Emoticon i={i} h={70} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
