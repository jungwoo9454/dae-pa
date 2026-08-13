"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 목록에서 빠진 항목을 잠깐 더 들고 있다가 버린다 (#181).
 *
 * 삭제·취소된 항목은 상태가 바뀌는 순간 목록에서 사라져서, 그대로 두면 애니메이션을 걸 틈이
 * 없다. 그래서 사라지기 직전 자리(index)와 함께 ms 동안 붙잡아 두고, 화면은 그 자리에 도로
 * 끼워 넣어 그린다.
 *
 * `guard` 는 "목록이 줄어든 이유"를 가르는 열쇠다 — 필터·검색을 바꿔서 빠진 것뿐이면
 * 사라지는 연출을 하면 안 된다. 필터 값을 문자열로 넘기면, 그 값이 바뀐 렌더에서는 건너뛴다.
 */
export function useLeaving<T extends { id: number }>(list: T[], guard = "", ms = 560) {
  const [leaving, setLeaving] = useState<{ item: T; index: number }[]>([]);
  const prevList = useRef<T[] | null>(null);
  const prevGuard = useRef(guard);
  const key = list.map((x) => x.id).join(",");

  useEffect(() => {
    const before = prevList.current;
    if (before === null) return; // 첫 렌더는 비교 대상이 없다
    if (prevGuard.current !== guard) return; // 필터가 바뀐 것뿐 — 데이터가 사라진 게 아니다
    const gone = before
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !list.some((x) => x.id === item.id));
    if (!gone.length) return;
    setLeaving((s) => [...s, ...gone]);
    const t = setTimeout(
      () => setLeaving((s) => s.filter((x) => !gone.some((g) => g.item.id === x.item.id))),
      ms,
    );
    return () => clearTimeout(t);
    // list 는 매 렌더 새 배열이라 id 목록으로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /**
   * 직전 목록 기록 — **반드시 위 감지 effect 보다 뒤에** 선언해야 한다.
   * 같은 커밋에서 effect 는 선언 순서대로 도니까, 감지 쪽은 아직 옛 값을 본다.
   * (렌더 중에 갱신하면 감지 시점엔 이미 새 값이라 사라진 항목을 못 찾는다.)
   */
  useEffect(() => {
    prevList.current = list;
    prevGuard.current = guard;
  });

  // 나가는 중인 항목을 원래 자리에 도로 끼워 넣는다
  return useMemo(() => {
    if (!leaving.length) return list.map((item) => ({ item, gone: false }));
    const out = list.map((item) => ({ item, gone: false }));
    for (const { item, index } of leaving) {
      out.splice(Math.min(index, out.length), 0, { item, gone: true });
    }
    return out;
  }, [list, leaving]);
}
