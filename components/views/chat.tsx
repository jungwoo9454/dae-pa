"use client";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { fmt, joinLabel, joinable, perAmount, remainLabel, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";

/** 입장 시 보여줄 최근 메시지 수 — Supabase 연동 후엔 이 값으로 쿼리 limit을 건다 */
const RECENT_LIMIT = 100;

interface RoomDef {
  id: string;
  emoji: string;
  name: string;
  sub: string;
}

function RoomItem({ room, active, onPick }: { room: RoomDef; active: boolean; onPick: () => void }) {
  return (
    <div
      onClick={onPick}
      className={`flex cursor-pointer items-center gap-[9px] rounded-[11px] border-[1.5px] px-[11px] py-[9px] hover:border-[#9fd4ae] ${
        active ? "border-[#1f8a4c] bg-[#e9f6ec]" : "border-transparent"
      }`}
    >
      <span className="text-[17px]">{room.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-bold">
          {room.name}
        </div>
        <div className="text-[11.5px] text-[#8aa392]">{room.sub}</div>
      </div>
    </div>
  );
}

export default function ChatView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const msgs = useStore((s) => s.msgs);
  const room = useStore((s) => s.room);
  const search = useStore((s) => s.search);
  const chatInput = useStore((s) => s.chatInput);
  const setSearch = useStore((s) => s.setSearch);
  const setChatInput = useStore((s) => s.setChatInput);
  const goRoom = useStore((s) => s.goRoom);
  const sendMsg = useStore((s) => s.sendMsg);
  const openDeal = useStore((s) => s.openDeal);
  const join = useStore((s) => s.join);

  useEffect(() => {
  const loadMessages = async () => {
    const supabase = createClient();

    let roomQuery = supabase
      .from("chat_rooms")
      .select("id")
      .limit(1);

    if (room === "lounge") {
      roomQuery = roomQuery.eq("type", "lounge");
    } else if (room.startsWith("d")) {
      const groupBuyId = Number(room.slice(1));

      roomQuery = roomQuery
        .eq("type", "group_buy")
        .eq("group_buy_id", groupBuyId);
    } else {
      return;
    }

    const { data: roomData, error: roomError } = await roomQuery.single();

    if (roomError || !roomData) {
      console.error("[chat_rooms]", roomError);
      return;
    }

    const dbRoomId = roomData.id;

    const { data: messageRows, error: messageError } = await supabase
      .from("messages")
      .select("id, user_id, kind, content, payload, created_at")
      .eq("room_id", dbRoomId)
      .order("created_at", { ascending: true });

    if (messageError) {
      console.error("[messages]", messageError);
      return;
    }

    const mappedMessages = (messageRows ?? []).map((row: any) => {
      if (row.kind === "card") {
        return {
          kind: "card" as const,
          cardOf: Number(row.payload?.group_buy_id),
          who: "나",
        };
      }

      if (row.kind === "sys") {
        return {
          kind: "sys" as const,
          text: row.content ?? "",
        };
      }

      return {
        kind: "other" as const,
        who: "나",
        text: row.content ?? "",
      };
    });

    useStore.setState((st) => ({
      msgs: {
        ...st.msgs,
        [room]: mappedMessages,
      },
    }));
  };

  loadMessages();
}, [room]);

  const loungeRooms: RoomDef[] = [
    { id: "lounge", emoji: "🏘", name: "역삼동 라운지", sub: "이웃 128명 · 자유 수다" },
  ];
  const dealRooms: RoomDef[] = deals
    .filter((x) => x.me)
    .map((x) => ({
      id: "d" + x.id,
      emoji: x.emoji,
      name: x.title,
      sub: `${x.joined}명 · ${statusOf(x, now).label}`,
    }));
  // 검색: 대소문자·앞뒤 공백 무시 (#11)
  const q = search.trim().toLowerCase();
  const bySearch = (r: RoomDef) => !q || r.name.toLowerCase().includes(q);
  const foundLounge = loungeRooms.filter(bySearch);
  const foundDeals = dealRooms.filter(bySearch);
  const noResult = q !== "" && foundLounge.length === 0 && foundDeals.length === 0;
  const current = [...loungeRooms, ...dealRooms].find((r) => r.id === room) ?? loungeRooms[0];
  const allMsgs = msgs[current.id] ?? [];
  const roomMsgs = allMsgs.slice(-RECENT_LIMIT);

  // 방 전환·새 메시지 시 항상 최신 메시지가 보이도록 하단 고정
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [current.id, allMsgs.length]);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-[250px] flex-col gap-2 overflow-auto border-r border-[#dde9dc] bg-[#f7faf6] p-3.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 채팅방 검색"
          className="rounded-[10px] border-[1.5px] border-[#d5e6d6] bg-white px-3 py-2 text-[13px] outline-none"
        />
        {foundLounge.length > 0 && (
          <div className="mt-1.5 text-[11.5px] font-extrabold tracking-[.5px] text-[#6b8573]">동네</div>
        )}
        {foundLounge.map((r) => (
          <RoomItem key={r.id} room={r} active={room === r.id} onPick={() => goRoom(r.id)} />
        ))}
        {foundDeals.length > 0 && (
          <div className="mt-1.5 text-[11.5px] font-extrabold tracking-[.5px] text-[#6b8573]">
            내 공구방
          </div>
        )}
        {foundDeals.map((r) => (
          <RoomItem key={r.id} room={r} active={room === r.id} onPick={() => goRoom(r.id)} />
        ))}
        {noResult && (
          <div className="mt-4 text-center text-[12.5px] leading-relaxed text-[#8aa392]">
            &lsquo;{search.trim()}&rsquo; 검색 결과가 없어요
            <div
              onClick={() => setSearch("")}
              className="mt-1.5 cursor-pointer font-bold text-[#1f8a4c]"
            >
              검색 지우기
            </div>
          </div>
        )}
        {!q && dealRooms.length === 0 && (
          <div className="mt-2 px-1 text-[12px] leading-relaxed text-[#8aa392]">
            참여한 공구가 없어요. 공구에 참여하면 채팅방이 여기에 생겨요.
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex items-center gap-2.5 border-b border-[#e6efe4] px-[18px] py-3">
          <b className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px]">
            {current.emoji} {current.name}
          </b>
          <span className="flex-none whitespace-nowrap text-xs text-[#6b8573]">{current.sub}</span>
        </div>
        <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-auto bg-[#fbfdf9] px-[18px] py-4">
          {roomMsgs.length === 0 && (
            <div className="m-auto text-center text-[13px] text-[#8aa392]">
              아직 대화가 없어요
              <div className="mt-1 text-xs">첫 메시지를 보내 이웃과 이야기를 시작해보세요</div>
            </div>
          )}
          {roomMsgs.map((mg, i) => {
            if (mg.kind === "sys") {
              return (
                <div
                  key={i}
                  className="self-center rounded-full bg-[#eaf3e8] px-3.5 py-1 text-xs text-[#4d6d58]"
                >
                  {mg.text}
                </div>
              );
            }
            if (mg.kind === "card") {
              const cd = deals.find((x) => x.id === mg.cardOf);
              if (!cd) return null;
              return (
                <div key={i} className="flex max-w-[78%] gap-2 self-start">
                  <Avatar ch={mg.who[0] ?? "?"} />
                  <div
                    onClick={() => openDeal(cd.id)}
                    className="flex cursor-pointer flex-col gap-[5px] rounded-[14px] border-[1.5px] border-[#9fd4ae] bg-white px-3.5 py-2.5 hover:shadow-[0_4px_12px_rgba(18,70,38,.12)]"
                  >
                    <div className="font-extrabold">
                      {cd.emoji} {cd.title}
                    </div>
                    <div className="text-[12.5px] font-bold text-[#1f8a4c]">
                      {cd.joined}/{cd.goal}명 · ⏱ {remainLabel(cd, now)} · 1인 {fmt(perAmount(cd))}
                    </div>
                    {/* 대화 중 카드에서 바로 참여 — 상세로 안 나가도 됨 (#10) */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        join(cd.id);
                      }}
                      className={`mt-0.5 rounded-lg py-1.5 text-center text-[12.5px] font-extrabold ${
                        joinable(cd, now)
                          ? "cursor-pointer bg-[#1f8a4c] text-white hover:bg-[#187741]"
                          : "cursor-default bg-[#e6efe4] text-[#6b8573]"
                      }`}
                    >
                      {joinable(cd, now) ? "바로 참여하기" : joinLabel(cd, now)}
                    </div>
                  </div>
                </div>
              );
            }
            if (mg.kind === "other") {
              return (
                <div key={i} className="flex max-w-[72%] gap-2 self-start">
                  <Avatar ch={mg.who[0] ?? "?"} />
                  <div>
                    <div className="mb-[3px] ml-1 text-[11.5px] text-[#8aa392]">{mg.who}</div>
                    <div className="whitespace-pre-wrap break-words rounded-[4px_16px_16px_16px] border border-[#e2eee2] bg-white px-[13px] py-[9px] leading-normal">
                      {mg.text}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={i}
                className="max-w-[72%] self-end whitespace-pre-wrap break-words rounded-[16px_4px_16px_16px] bg-[#1f8a4c] px-[13px] py-[9px] leading-normal text-white"
              >
                {mg.text}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 border-t border-[#e6efe4] px-4 py-3">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMsg();
            }}
            placeholder="메시지 입력…"
            className="flex-1 rounded-xl border-[1.5px] border-[#d5e6d6] px-3.5 py-2.5 text-sm outline-none"
          />
          <div
            onClick={sendMsg}
            className="cursor-pointer rounded-xl bg-[#1f8a4c] px-[18px] py-2.5 font-extrabold text-white hover:bg-[#187741]"
          >
            전송
          </div>
        </div>
      </div>
    </div>
  );
}
