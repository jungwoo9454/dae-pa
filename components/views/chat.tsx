"use client";

import { Avatar } from "@/components/ui";
import { fmt, perAmount, remainLabel, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";

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
  const bySearch = (r: RoomDef) => !search || r.name.includes(search);
  const current = [...loungeRooms, ...dealRooms].find((r) => r.id === room) ?? loungeRooms[0];
  const roomMsgs = msgs[current.id] ?? [];

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-[250px] flex-col gap-2 overflow-auto border-r border-[#dde9dc] bg-[#f7faf6] p-3.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 채팅방 검색"
          className="rounded-[10px] border-[1.5px] border-[#d5e6d6] bg-white px-3 py-2 text-[13px] outline-none"
        />
        <div className="mt-1.5 text-[11.5px] font-extrabold tracking-[.5px] text-[#6b8573]">동네</div>
        {loungeRooms.filter(bySearch).map((r) => (
          <RoomItem key={r.id} room={r} active={room === r.id} onPick={() => goRoom(r.id)} />
        ))}
        <div className="mt-1.5 text-[11.5px] font-extrabold tracking-[.5px] text-[#6b8573]">내 공구방</div>
        {dealRooms.filter(bySearch).map((r) => (
          <RoomItem key={r.id} room={r} active={room === r.id} onPick={() => goRoom(r.id)} />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex items-center gap-2.5 border-b border-[#e6efe4] px-[18px] py-3">
          <b className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px]">
            {current.emoji} {current.name}
          </b>
          <span className="flex-none whitespace-nowrap text-xs text-[#6b8573]">{current.sub}</span>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 overflow-auto bg-[#fbfdf9] px-[18px] py-4">
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
                      {cd.joined}/{cd.goal}명 · ⏱ {remainLabel(cd, now)} · 1인 {fmt(perAmount(cd))} ·
                      탭해서 보기 →
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
                    <div className="rounded-[4px_16px_16px_16px] border border-[#e2eee2] bg-white px-[13px] py-[9px] leading-normal">
                      {mg.text}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={i}
                className="max-w-[72%] self-end rounded-[16px_4px_16px_16px] bg-[#1f8a4c] px-[13px] py-[9px] leading-normal text-white"
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
