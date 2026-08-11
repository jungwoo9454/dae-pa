import type { KeyboardEvent } from "react";

/**
 * Enter 로 확정(전송·저장)해야 하는 입력인지 (#54).
 *
 * 한글·일본어·중국어처럼 IME 조합이 있는 언어에서는 **조합을 확정하는 Enter 도
 * keydown 으로 온다.** 그대로 처리하면 조합 중이던 마지막 글자가 한 번 더 전송된다.
 * Safari 는 조합 확정 keydown 에 isComposing 을 안 채우는 경우가 있어 keyCode 229 도 함께 본다.
 */
export const isSubmitEnter = (e: KeyboardEvent) =>
  e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229;
