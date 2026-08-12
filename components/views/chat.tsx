"use client";
import { useEffect, useRef, useState } from "react";
import { Emoticon, EmoticonPicker } from "@/components/emoticon";
import { uploadImage } from "@/components/image-upload";
import { Avatar, StatusBadge, receiptNo } from "@/components/ui";
import {
  fmt,
  joinLabel,
  joinable,
  perAmount,
  perLabel,
  remainLabel,
  statusOf,
  type StatusView,
} from "@/lib/deal";
import { isSubmitEnter } from "@/lib/keys";
import { RECENT_LIMIT, roomLocked, useStore } from "@/lib/store";
import { useNow } from "@/lib/use-now";

interface RoomDef {
  id: string;
  name: string;
  sub: string;
  /** 라운지는 상태가 없어 고정 태그로 표시한다 */
  st?: StatusView;
  pinned?: boolean;
}

function RoomItem({ room, active, onPick }: { room: RoomDef; active: boolean; onPick: () => void }) {
  const st = room.st;
  const dead = st?.key === "closed" || st?.key === "canceled";
  const edge = room.pinned ? "#e14e2b" : (st?.fg ?? "#c9c9c4");
  return (
    <div
      onClick={onPick}
      className={`cursor-pointer px-[18px] py-4 ${dead ? "receipt receipt-dead" : "receipt"} ${
        active ? "outline outline-[1.5px] outline-[#1b1917]" : ""
      }`}
      style={{ borderLeft: `5px solid ${edge}` }}
    >
      <div className="flex items-center gap-2">
        {room.pinned ? (
          <span className="bg-[#e14e2b] px-2 py-0.5 text-[12.5px] font-bold text-white">고정</span>
        ) : (
          st && <StatusBadge s={st} />
        )}
        <span className="font-sans-ko truncate text-sm font-extrabold">{room.name}</span>
      </div>
      <div className="mt-2 truncate text-[12.5px] text-[#9c9ca3]">{room.sub}</div>
    </div>
  );
}

export default function ChatView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const msgs = useStore((s) => s.msgs);
  const me = useStore((s) => s.me);
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
  const sendEmoticon = useStore((s) => s.sendEmoticon);
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [emoOpen, setEmoOpen] = useState(false);

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
        .map((r) => ({ id: "lounge", name: r.name, sub: "이웃과 자유 수다", pinned: true }))
    : [{ id: "lounge", name: "크래프톤 정글 라운지", sub: "이웃과 자유 수다", pinned: true }];

  const dealRooms: RoomDef[] = chatReady
    ? rooms
        .filter((r) => r.type === "group_buy")
        .map((r) => {
          const d = deals.find((x) => x.id === r.dealId);
          return {
            id: "d" + r.dealId,
            name: r.name,
            sub: d ? `${d.joined}명 · ${receiptNo(d.id, d.created_at)}` : "공구방",
            st: d ? statusOf(d, now) : undefined,
          };
        })
    : deals
        .filter((x) => x.me)
        .map((x) => ({
          id: "d" + x.id,
          name: x.title,
          sub: `${x.joined}명 · ${receiptNo(x.id, x.created_at)}`,
          st: statusOf(x, now),
        }));

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
  // 마감·취소된 공구방은 기록만 본다 (#129). 라운지는 항상 열려 있다.
  const locked = current ? roomLocked(deals, rooms, current.id) : false;
  const currentDeal = current ? deals.find((d) => "d" + d.id === current.id) : null;
  const allMsgs = current ? (msgs[current.id] ?? []) : [];
  const roomMsgs = allMsgs.slice(-RECENT_LIMIT);

  // 방 전환·새 메시지 시 항상 최신 메시지가 보이도록 하단 고정
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [current?.id, allMsgs.length]);

  // 방을 옮기면 열어둔 이모티콘 창은 닫는다 (새 메시지에는 닫지 않는다 — 고르는 중일 수 있다)
  useEffect(() => setEmoOpen(false), [current?.id]);

  return (
    <div className="flex min-h-0 flex-1 gap-6 px-9 py-7">
      <div className="flex w-[320px] flex-none flex-col gap-3 overflow-auto pb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="방 검색_"
          className="field h-[42px] flex-none text-[14.5px]"
        />
        {foundLounge.length > 0 && (
          <div className="px-1 text-[12.5px] font-bold tracking-[.14em] text-[#8b8478]">// 동네</div>
        )}
        {foundLounge.map((r) => (
          <RoomItem key={r.id} room={r} active={room === r.id} onPick={() => goRoom(r.id)} />
        ))}
        {foundDeals.length > 0 && (
          <div className="mt-2 px-1 text-[12.5px] font-bold tracking-[.14em] text-[#8b8478]">
            // 내 공구방
          </div>
        )}
        {foundDeals.map((r) => (
          <RoomItem key={r.id} room={r} active={room === r.id} onPick={() => goRoom(r.id)} />
        ))}
        {noResult && (
          <div className="mt-4 text-center text-[14px] text-[#8b8478]">
            &lsquo;{search.trim()}&rsquo; 검색 결과가 없어요
            <div onClick={() => setSearch("")} className="mt-1.5 cursor-pointer font-bold text-[#e14e2b]">
              검색 지우기
            </div>
          </div>
        )}
        {!q && dealRooms.length === 0 && (
          <div className="px-1 text-[13.5px] leading-relaxed text-[#8b8478]">
            참여한 공구가 없어요. 공구에 참여하면 채팅방이 여기에 생겨요.
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col pb-4">
        <div className="receipt flex min-h-0 flex-1 flex-col">
          <div className="rule-dash flex flex-none items-center gap-3 border-b border-t-0 px-[22px] py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-sans-ko truncate text-base font-extrabold">
                  {current?.name ?? missingDeal?.title ?? "채팅방"}
                </span>
                {current?.st && <StatusBadge s={current.st} />}
              </div>
              <div className="tnum mt-1 text-[12.5px] text-[#8b8478]">
                {current?.sub ?? "참여 후 이용 가능"}
              </div>
            </div>
            {currentDeal && (
              <div onClick={() => openDeal(currentDeal.id)} className="key key-line ml-auto px-3 py-1.5 text-xs">
                [공구 보기]
              </div>
            )}
          </div>

          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto px-6 py-5">
            {!current && (
              <div className="m-auto flex max-w-[320px] flex-col items-center gap-3 text-center">
                <div className="font-sans-ko text-sm font-extrabold">
                  {missingDeal ? `‘${missingDeal.title}’ 채팅방` : "채팅방을 찾을 수 없어요"}
                </div>
                <div className="text-[14.5px] leading-relaxed text-[#8b8478]">
                  {missingDeal?.me
                    ? "채팅방을 준비하고 있어요"
                    : "공구 채팅방은 참여자만 들어갈 수 있어요"}
                </div>
                <div className="mt-1 flex gap-2 text-[14.5px]">
                  {missingDeal && (
                    <div onClick={() => openDeal(missingDeal.id)} className="key key-primary px-4 py-2">
                      [ 공구 보기 ]
                    </div>
                  )}
                  <div onClick={() => goRoom("lounge")} className="key key-line px-4 py-2">
                    [ 라운지로 ]
                  </div>
                </div>
              </div>
            )}
            {current && roomMsgs.length === 0 && (
              <div className="m-auto text-center text-[14.5px] text-[#8b8478]">아직 대화가 없어요</div>
            )}

            {roomMsgs.map((mg, i) => {
              if (mg.kind === "sys") {
                // 문구가 빈 시스템 메시지는 "--- ---" 빈 줄로만 남는다 — 건너뛴다
                if (!mg.text?.trim()) return null;
                return (
                  <div key={i} className="self-center text-center text-[12.5px] text-[#8b8478]">
                    --- {mg.text} ---
                  </div>
                );
              }
              if (mg.kind === "card") {
                const cd = deals.find((x) => x.id === mg.cardOf);
                if (!cd) return null;
                const st = statusOf(cd, now);
                return (
                  // 공유 카드는 보낸 사람이 따로 있다 — 오른쪽(=내 말풍선) 정렬이면 내가 보낸 걸로 읽힌다
                  <div key={i} className="flex max-w-[78%] gap-2.5 self-start">
                    <Avatar ch={mg.who[0] ?? "?"} src={mg.avatarUrl} />
                    <div
                      onClick={() => openDeal(cd.id)}
                      className="w-[250px] cursor-pointer border-[1.5px] border-dashed border-[#1b1917] bg-white p-4"
                    >
                      <div className="rule-dash border-b border-t-0 pb-2 text-center text-[11px] tracking-[.14em] text-[#8b8478]">
                        ＊ 공구 공유 · {receiptNo(cd.id, cd.created_at)} ＊
                      </div>
                      <div className="font-sans-ko mt-2.5 text-[14.5px] font-extrabold">{cd.title}</div>
                      <div className="tnum mt-1.5 text-[12.5px] text-[#6e675e]">
                        {cd.joined}/{cd.goal}명 · {remainLabel(cd, now)} · {fmt(perAmount(cd))}{" "}
                        {perLabel(cd)}
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          join(cd.id);
                        }}
                        className={`mt-2.5 py-2 text-xs ${
                          joinable(cd, now) ? "key key-primary" : "key key-off"
                        }`}
                        style={joinable(cd, now) ? { background: st.fg } : undefined}
                      >
                        [ {joinable(cd, now) ? "바로 참여" : joinLabel(cd, now)} ]
                      </div>
                    </div>
                  </div>
                );
              }
              if (mg.kind === "other") {
                return (
                  <div key={i} className="flex max-w-[78%] gap-2.5 self-start">
                    <Avatar ch={mg.who[0] ?? "?"} src={mg.avatarUrl} />
                    <div className="min-w-0">
                      <div className="mb-1 text-[11px] text-[#9c9ca3]">{mg.who}</div>
                      {mg.emoticon !== undefined ? (
                        <Emoticon i={mg.emoticon} />
                      ) : mg.imageUrl ? (
                        <a href={mg.imageUrl} target="_blank" rel="noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */}
                          <img
                            src={mg.imageUrl}
                            alt="보낸 사진"
                            className="max-h-[260px] border-[1.5px] border-[#1b1917] object-cover"
                          />
                        </a>
                      ) : (
                        <div className="font-sans-ko whitespace-pre-wrap break-words border-[1.5px] border-[#1b1917] bg-white px-3.5 py-2.5 leading-[1.6]">
                          {mg.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              if (mg.emoticon !== undefined) {
                return (
                  <div key={i} className="flex max-w-[78%] flex-row-reverse gap-2.5 self-end">
                    <Avatar ch={me?.nickname?.[0] ?? "나"} src={me?.avatarUrl} />
                    <Emoticon i={mg.emoticon} />
                  </div>
                );
              }
              if (mg.imageUrl) {
                return (
                  <div key={i} className="flex max-w-[78%] flex-row-reverse gap-2.5 self-end">
                    <Avatar ch={me?.nickname?.[0] ?? "나"} src={me?.avatarUrl} />
                    <a href={mg.imageUrl} target="_blank" rel="noreferrer" className="min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- R2 공개 URL 이라 next/image 도메인 설정 없이 쓴다 */}
                      <img
                        src={mg.imageUrl}
                        alt="보낸 사진"
                        className="max-h-[260px] border-[1.5px] border-[#1b1917] object-cover"
                      />
                    </a>
                  </div>
                );
              }
              return (
                <div key={i} className="flex max-w-[78%] flex-row-reverse gap-2.5 self-end">
                  <Avatar ch={me?.nickname?.[0] ?? "나"} src={me?.avatarUrl} />
                  <div className="min-w-0">
                    <div className="mb-1 text-right text-[11px] text-[#9c9ca3]">나</div>
                    <div className="font-sans-ko whitespace-pre-wrap break-words bg-[#1b1917] px-3.5 py-2.5 leading-[1.6] text-[#fdfdfb]">
                      {mg.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 못 연 방에서는 입력창을 감춘다 — sendMsg 가 조용히 아무 일도 안 하는 게 더 헷갈린다 */}
          {current && locked && (
            <div className="rule-dash flex flex-none items-center justify-center border-b-0 border-t bg-[#f1efe8] px-4 py-4 text-[14.5px] text-[#a29b8e]">
              마감된 공구방이에요 · 대화 기록만 볼 수 있어요
            </div>
          )}
          {current && !locked && (
            <div className="rule-dash flex flex-none items-center gap-2.5 border-b-0 border-t px-[18px] py-3.5">
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
                className="key key-line px-3 py-2 text-xs"
              >
                [{photoBusy ? "전송 중" : "사진"}]
              </div>
              <div className="relative flex-none">
                <div
                  onClick={() => setEmoOpen((v) => !v)}
                  title="이모티콘 보내기"
                  className={`key px-3 py-2 text-xs ${emoOpen ? "key-ink" : "key-line"}`}
                >
                  [이모티콘]
                </div>
                {emoOpen && (
                  <EmoticonPicker
                    onPick={(n) => {
                      sendEmoticon(n);
                      setEmoOpen(false);
                    }}
                    onClose={() => setEmoOpen(false)}
                  />
                )}
              </div>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (isSubmitEnter(e)) sendMsg();
                }}
                placeholder="메시지 입력_"
                className="field font-sans-ko h-[42px] flex-1 text-sm"
              />
              <div onClick={sendMsg} className="key key-primary px-5 py-3 text-[14.5px]">
                [전송]
              </div>
            </div>
          )}
        </div>
        <div className="receipt-edge flex-none" />
      </div>
    </div>
  );
}
