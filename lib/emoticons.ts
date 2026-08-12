import type { CSSProperties } from "react";

/**
 * 대파 캐릭터 이모티콘 12종 (#179).
 *
 * public/emoticon.png 한 장(1008×681)이 4열 × 3행 스프라이트다 — 12장을 따로 두는 대신
 * background-position 으로 잘라 쓴다. 요청이 한 번만 나가고, 순서만 지키면 잘라둘 필요도 없다.
 * **시트를 갈아끼울 땐 아래 순서·라벨과 SHEET 크기를 함께 맞출 것.**
 */
const COLS = 4;
const ROWS = 3;
const SHEET_W = 1008;
const SHEET_H = 681;

/** 화면에 안 보이는 라벨 — 스크린리더·툴팁·알림 미리보기에 쓴다 */
export const EMOTICONS = [
  "안녕하세요",
  "부탁해요",
  "좋아요",
  "죄송해요",
  "고마워요",
  "네 좋아요",
  "기대돼요",
  "대파페이 할게요",
  "사람 더 모집 중",
  "저요",
  "가는 중",
  "기다리는 중",
] as const;

/** 칸 하나의 가로:세로 — 크기를 줄 때 이 비율을 지켜야 캐릭터가 안 눌린다 */
export const EMO_RATIO = SHEET_W / COLS / (SHEET_H / ROWS);

export const isEmoticon = (i: unknown): i is number =>
  typeof i === "number" && Number.isInteger(i) && i >= 0 && i < EMOTICONS.length;

/** 시트에서 i 번째 칸만 보이게 하는 배경 스타일 */
export function emoStyle(i: number): CSSProperties {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return {
    backgroundImage: "url(/emoticon.png)",
    backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
    backgroundPosition: `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
    backgroundRepeat: "no-repeat",
  };
}
