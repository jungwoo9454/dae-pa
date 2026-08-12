"use client";
import { Home, ImagePlus, LoaderCircle, MessageCircleOff, ShoppingCart, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { uploadImage } from "@/components/image-upload";
import { Avatar } from "@/components/ui";
import { fmt, joinLabel, joinable, perAmount, perLabel, remainLabel, statusOf, type StatusView } from "@/lib/deal";
import { isSubmitEnter } from "@/lib/keys";
import { RECENT_LIMIT, roomLocked, useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";

interface RoomDef {
  id: string;
  /** 공구방은 카테고리 이모지를 그대로 쓰고, 라운지는 icon 을 쓴다 (#65) */
  emoji: string;
  icon?: LucideIcon;
  name: string;
  sub: string;
  st?: StatusView;
}

function RoomItem({ room, active, onPick }: { room: RoomDef; active: boolean; onPick: () => void }) {
  const st = room.st;
  const dimmed = st?.key === "closed";

  // 상태 색은 CSS 변수(--bc)로 넘긴다 — 인라인 borderColor 는 hover:border-* 를 이겨서 호버가 죽는다
  const borderColor = active ? "#1f8a4c" : (st?.fg ?? "transparent");

  return (
    <div
      onClick={onPick}
      className={`flex cursor-pointer items-center gap-[9px] rounded-[11px] border-[1.5px] border-[var(--bc)] px-[11px] py-[9px] ${
        active ? "bg-[#e9f6ec]" : dimmed ? "bg-[#f4f6f5] hover:border-[#d0d6d5]" : "hover:border-[#9fd4ae]"
      }`}
      style={{ "--bc": borderColor } as CSSProperties}
    >
      {room.icon ? (
        <room.icon aria-hidden className="h-[17px] w-[17px] flex-none text-[#4d6d58]" />
      ) : (
        <span className="text-[17px]">{room.emoji}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-bold" style={st && !active ? { color: st.fg } : undefined}>
          {room.name}
        </div>
        <div className="text-[11.5px]" style={st && !active ? { color: dimmed ? "#b4b8b7" : st.fg } : { color: "#8aa392" }}>
          {room.sub}
        </div>
      </div>
    </div>
  );
}

export default function ChatView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const msgs = useStore((s) => s.msgs);
  const rooms = useStore((s) => s.rooms);
  const chatReady = useStore((s) => s.chatReady);
  const room = useStore((s) => s.room);
  const search = useStore((s) => s.search);
  const chatInput = useStore((s) => s.chatInput);
  const setSearch = useStore((s) => s.setSearch);
  const setChatInput = useStore((s) => s.setChatInput);
  const goRoom = useStore((s) => s.goRoom);
  const sendMsg = useStore((s) => s.sendMsg);
  const openDeal = useStore((s) => s.openDeal);
  const join = useStore((s) => s.join);
  const sendImageMsg = useStore((s) => s.sendImageMsg);
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const sendPhoto = async (file?: File) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      sendImageMsg(await uploadImage(file, "chat"));
    } catch (e) {
      alert(e instanceof Error ? e.message : "업로드에 실패했어요");
    } finally {
      setPhotoBusy(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  // 방 목록·메시지·구독은 store 의 initChat 이 DB 에서 채운다 (#7).
  // 로그인 전이거나 아직 못 읽었으면(chatReady=false) 로컬 시드로 그린다.
  const loungeRooms: RoomDef[] = chatReady
    ? rooms
        .filter((r) => r.type === "lounge")
        .map((r) => ({
          id: "lounge",
          emoji: "",
          icon: Home,
          name: r.name,
          sub: "이웃과 자유 수다",
          st: { key: "recruiting" as const, label: "라운지", bg: "#e9f6ec", fg: "#1f8a4c" },
        }))
    : [{ id: "lounge", emoji: "", icon: Home, name: "역삼동 라운지", sub: "이웃 128명 · 자유 수다", st: { key: "recruiting" as const, label: "라운지", bg: "#e9f6ec", fg: "#1f8a4c" } }];

  const dealRooms: RoomDef[] = chatReady
    ? rooms
        .filter((r) => r.type === "group_buy")
        .map((r) => {
          const d = deals.find((x) => x.id === r.dealId);
          const st = d ? statusOf(d, now) : undefined;
          return {
            id: "d" + r.dealId,
            emoji: d?.emoji ?? "",
            icon: d ? undefined : ShoppingCart,
            name: r.name,
            sub: d ? `${d.joined}명 · ${st?.label}` : "공구방",
            st,
          };
        })
    : deals
        .filter((x) => x.me)
        .map((x) => {
          const st = statusOf(x, now);
          return {
            id: "d" + x.id,
            emoji: x.emoji,
            name: x.title,
            sub: `${x.joined}명 · ${st.label}`,
            st,
          };
        });
  // 검색: 대소문자·앞뒤 공백 무시 (#11)
  const q = search.trim().toLowerCase();
  const bySearch = (r: RoomDef) => !q || r.name.toLowerCase().includes(q);
  const foundLounge = loungeRooms.filter(bySearch);
  const foundDeals = dealRooms.filter(bySearch);
  const noResult = q !== "" && foundLounge.length === 0 && foundDeals.length === 0;
  // 내 방 목록에 없는 방 id 로 들어온 경우(미참여 공구방 등) 예전엔 loungeRooms[0] 로 조용히
  // 폴백해서 엉뚱하게 동네 라운지가 열렸다 (#93). 이제 못 연 이유를 안내한다.
  const current = [...loungeRooms, ...dealRooms].find((r) => r.id === room) ?? null;
  const missingDeal = current ? null : (deals.find((d) => "d" + d.id === room) ?? null);
  const CurrentIcon = current?.icon;
  // 마감·취소된 공구방은 기록만 본다 (#129). 라운지는 항상 열려 있다.
  const locked = current ? roomLocked(deals, rooms, current.id) : false;
  const allMsgs = current ? (msgs[current.id] ?? []) : [];
  const roomMsgs = allMsgs.slice(-RECENT_LIMIT);

  // 방 전환·새 메시지 시 항상 최신 메시지가 보이도록 하단 고정
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [current?.id, allMsgs.length]);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-[250px] flex-col gap-2 overflow-auto border-r border-[#dde9dc] bg-[#f7faf6] p-3.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="채팅방 검색"
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
          <b className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[15px]">
            {CurrentIcon ? (
              <CurrentIcon aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" />
            ) : (
              current?.emoji
            )}
            <span className="min-w-0 overflow-hidden text-ellipsis">
              {current?.name ?? missingDeal?.title ?? "채팅방"}
            </span>
          </b>
          <span className="flex-none whitespace-nowrap text-xs text-[#6b8573]">
            {current?.sub ?? "참여 후 이용 가능"}
          </span>
        </div>
        <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-auto bg-[#fbfdf9] px-[18px] py-4">
          {!current && (
            <div className="m-auto flex max-w-[320px] flex-col items-center gap-2.5 text-center">
              <MessageCircleOff aria-hidden className="h-8 w-8 text-[#b7cbbd]" />
              <div className="text-[14px] font-extrabold">
                {missingDeal ? `‘${missingDeal.title}’ 채팅방` : "채팅방을 찾을 수 없어요"}
              </div>
              <div className="text-[13px] leading-relaxed text-[#8aa392]">
                {missingDeal?.me
                  ? "채팅방을 준비하고 있어요. 잠시만 기다려주세요"
                  : "공구 채팅방은 참여자만 들어갈 수 있어요. 참여하면 바로 열려요"}
              </div>
              <div className="mt-1 flex gap-2">
                {missingDeal && (
                  <div
                    onClick={() => openDeal(missingDeal.id)}
                    className="cursor-pointer rounded-[10px] bg-[#1f8a4c] px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-[#187741]"
                  >
                    공구 보러가기
                  </div>
                )}
                <div
                  onClick={() => goRoom("lounge")}
                  className="cursor-pointer rounded-[10px] border-[1.5px] border-[#cfe4d0] bg-white px-3.5 py-2 text-[13px] font-bold text-[#4d6d58] hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
                >
                  동네 라운지로 가기
                </div>
              </div>
            </div>
          )}
          {current && roomMsgs.length === 0 && (
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
              const st = statusOf(cd, now);
              const dimmed = st.key === "closed";
              return (
                <div key={i} className="flex max-w-[78%] gap-2 self-start">
                  <Avatar ch={mg.who[0] ?? "?"} />
                  <div
                    onClick={() => openDeal(cd.id)}
                    className="flex cursor-pointer flex-col gap-[5px] rounded-[14px] border-[1.5px] px-3.5 py-2.5 hover:shadow-[0_4px_12px_rgba(18,70,38,.12)]"
                    style={{ borderColor: st.fg, backgroundColor: st.bg }}
                  >
                    <div className="font-extrabold" style={{ color: st.fg }}>
                      {cd.emoji} {cd.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1 text-[12.5px] font-bold" style={{ color: dimmed ? "#8a9089" : st.fg }}>
                      <span>
                        {cd.joined}/{cd.goal}명 ·
                      </span>
                      <Timer aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" />
                      <span>
                        {remainLabel(cd, now)} · {perLabel(cd)} {fmt(perAmount(cd))}
                      </span>
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
                  <div className="min-w-0">
                    <div className="mb-[3px] ml-1 text-[11.5px] text-[#8aa392]">{mg.who}</div>
                    {mg.imageUrl ? (
                      <a href={mg.imageUrl} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */}
                        <img
                          src={mg.imageUrl}
                          alt="보낸 사진"
                          className="max-h-[260px] rounded-[4px_16px_16px_16px] border border-[#e2eee2] object-cover"
                        />
                      </a>
                    ) : (
                      <div className="whitespace-pre-wrap break-words rounded-[4px_16px_16px_16px] border border-[#e2eee2] bg-white px-[13px] py-[9px] leading-normal">
                        {mg.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            if (mg.imageUrl) {
              return (
                <a
                  key={i}
                  href={mg.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-[72%] self-end"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */}
                  <img
                    src={mg.imageUrl}
                    alt="보낸 사진"
                    className="max-h-[260px] rounded-[16px_4px_16px_16px] object-cover"
                  />
                </a>
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
        {/* 못 연 방에서는 입력창을 감춘다 — sendMsg 가 조용히 아무 일도 안 하는 게 더 헷갈린다 */}
        {current && locked && (
          <div className="flex items-center justify-center gap-1.5 border-t border-[#e6efe4] bg-[#f4f6f5] px-4 py-4 text-[13px] text-[#8aa392]">
            <MessageCircleOff aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" />
            마감된 공구방이에요 · 대화 기록만 볼 수 있어요
          </div>
        )}
        {current && !locked && (
          <div className="flex items-center gap-2 border-t border-[#e6efe4] px-4 py-3">
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void sendPhoto(e.target.files?.[0])}
            />
            <div
              onClick={() => photoRef.current?.click()}
              title="사진 보내기"
              className="flex cursor-pointer items-center rounded-xl border-[1.5px] border-[#d5e6d6] p-2.5 text-[#4d6d58] hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
            >
              {photoBusy ? (
                <LoaderCircle aria-hidden className="h-[18px] w-[18px] animate-spin" />
              ) : (
                <ImagePlus aria-hidden className="h-[18px] w-[18px]" />
              )}
            </div>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (isSubmitEnter(e)) sendMsg();
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
        )}
      </div>
    </div>
  );
}
