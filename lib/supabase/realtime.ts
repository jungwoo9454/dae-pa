import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "./client";

type PgPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

export type PgBinding = {
  event: "*" | "INSERT" | "UPDATE" | "DELETE";
  table: string;
  filter?: string;
  handler: (payload: PgPayload) => void;
};

type Entry = { channel: RealtimeChannel; handlers: Set<PgBinding["handler"]>[] };

const registry = new Map<string, Entry>();

/**
 * Postgres Changes 구독 — 토픽당 채널 하나를 열어두고 리스너만 붙였다 뗀다 (#77, #78, #107).
 *
 * 채널을 leave 하면 안 되기 때문이다. 라이브 프로젝트에서 확인한 서버 동작:
 * 한 소켓에서 채널이 한 번이라도 leave(=`unsubscribe()`/`removeChannel()`) 하면,
 * 그 뒤 같은 소켓에서 새로 join 하는 채널은 `SUBSCRIBED` 와 서버의 "Subscribed to PostgreSQL"
 * 응답까지 받고도 postgres_changes 이벤트를 하나도 못 받는다. 토픽 이름·필터·이벤트를 바꿔도,
 * leave ack 를 기다린 뒤 열어도 같다 (@supabase/supabase-js 2.112.2 / 2.112.3).
 * 화면을 한 번 벗어났다 들어오면 실시간이 조용히 죽는 증상이 여기서 나온다.
 *
 * 그래서 정리 단계에서 채널을 닫지 않는다. 대신 콜백만 떼서 이전 화면이 store 를 건드리지 못하게 한다.
 * 채널을 새로 만들 때 `.on()` 을 두 번 걸 수 없으므로(구독 뒤 추가 불가) 바인딩은 첫 구독 때 확정하고,
 * 이후 구독자는 같은 바인딩의 리스너 목록에 얹힌다.
 *
 * ponytail: 열어둔 채널은 페이지를 떠날 때까지 남는다. 공구를 많이 돌아다니면 그만큼 쌓인다.
 * 실제로 문제가 되면 리스너가 0인 채널을 일정 시간 뒤 닫는 정리를 붙인다 — 단, 위 서버 동작 때문에
 * 닫는 순간 그 소켓의 이후 구독이 죽으므로 소켓 재연결까지 같이 다뤄야 한다.
 */
export function subscribePg(topic: string, bindings: PgBinding[]): () => void {
  const sb = createClient();
  let entry = registry.get(topic);

  if (!entry) {
    const handlers: Entry["handlers"] = bindings.map(() => new Set());
    let channel = sb.channel(topic);
    bindings.forEach((b, i) => {
      channel = channel.on(
        "postgres_changes",
        { event: b.event, schema: "public", table: b.table, ...(b.filter ? { filter: b.filter } : {}) },
        (payload) => handlers[i].forEach((h) => h(payload as PgPayload)),
      );
    });
    entry = { channel, handlers };
    registry.set(topic, entry);
    channel.subscribe();
  } else if (entry.handlers.length !== bindings.length) {
    // 같은 토픽에 다른 바인딩 구성을 붙이려는 실수 — 먼저 연 쪽 구성이 유지된다
    console.error("[subscribePg] 같은 토픽에 다른 바인딩 구성", topic);
  }

  const { handlers } = entry;
  bindings.forEach((b, i) => handlers[i]?.add(b.handler));

  return () => {
    bindings.forEach((b, i) => handlers[i]?.delete(b.handler));
  };
}
