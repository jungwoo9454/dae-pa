"use client";

import { useEffect, useState } from "react";
import { ProgressBar, StatusBadge, receiptNo } from "@/components/ui";
import { fmt, perAmount, perLabel, profileStats, remainLabel, statusOf } from "@/lib/deal";
import { useStore } from "@/lib/store";
import { fetchDeals } from "@/lib/supabase/queries";
import { useLeaving } from "@/lib/use-leaving";
import { useNow } from "@/lib/use-now";

export default function MyView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const me = useStore((s) => s.me);
  const mySearch = useStore((s) => s.mySearch);
  const setMySearch = useStore((s) => s.setMySearch);
  const goRoom = useStore((s) => s.goRoom);
  const openSettle = useStore((s) => s.openSettle);
  const openDeal = useStore((s) => s.openDeal);
  const deleteDeal = useStore((s) => s.deleteDeal);
  const [askDeleteId, setAskDeleteId] = useState<number | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 홈을 거치지 않고 바로 들어오면 store.deals 가 비어 있어 요약이 0 으로 뜬다 (#84)
  useEffect(() => {
    (async () => {
      const list = await fetchDeals();
      useStore.setState({ deals: list });
    })();
  }, []);

  const { hosted, joined } = profileStats(deals, now, me?.id ?? null);
  const myDeals = deals.filter((x) => x.me && (!mySearch || x.title.includes(mySearch)));
  // 삭제한 줄은 떨어지면서 자리를 닫는다 (#181) — 검색을 바꿔 빠진 줄은 그냥 사라진다
  const rows = useLeaving(myDeals, mySearch);

  return (
    <div className="flex-1 overflow-auto px-9 py-8">
      <div className="mx-auto w-[820px]">
        <div className="mb-4 flex items-baseline gap-3.5">
          <span className="font-sans-ko text-2xl font-black">내 공구</span>
          <span className="text-xs text-[#77777f]">
            주최 {hosted} · 참여 {joined}
          </span>
          <input
            value={mySearch}
            onChange={(e) => setMySearch(e.target.value)}
            placeholder="내 공구 검색_"
            className="field ml-auto h-10 w-[220px] text-[14.5px]"
          />
        </div>

        <div className="receipt px-7 py-6">
          <div className="rule-dash receipt-head border-b border-t-0 pb-3 text-[14.5px] tracking-[.4em]">
            ＊ {me?.nickname ?? "파티원"} 님의 공구 기록 ＊
          </div>

          {rows.length === 0 && (
            <div className="py-10 text-center text-[14.5px] text-[#8b8478]">기록된 공구가 없어요</div>
          )}

          {rows.map(({ item: m, gone }) => {
            const deletable = m.mine && m.status === "recruiting";
            const showDeleteDialog = askDeleteId === m.id;
            const st = statusOf(m, now);
            const dead = st.key === "closed" || st.key === "canceled";
            const pct = Math.min(100, Math.round((m.joined / m.goal) * 100));

            const row = (
              <div className="py-[18px]">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`px-2.5 py-[3px] font-bold ${
                      m.mine ? "bg-[#1b1917] text-white" : "border border-[#8b8478] text-[#6e675e]"
                    }`}
                  >
                    {m.mine ? "주최" : "참여"}
                  </span>
                  <StatusBadge s={st} />
                  <span className="text-[#8b8478]">{receiptNo(m.id, m.created_at)}</span>
                  <span className="tnum ml-auto text-[14.5px] text-[#6e675e]">
                    {m.joined}/{m.goal}명 · <span style={{ color: st.fg }}>{remainLabel(m, now)}</span> ·{" "}
                    <b className="text-[#1b1917]">{fmt(perAmount(m))}</b>
                    <span className="text-[#8b8478]"> {perLabel(m)}</span>
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-3">
                  <span
                    onClick={() => openDeal(m.id)}
                    className={`font-sans-ko cursor-pointer text-[19px] font-extrabold hover:text-[#e14e2b] ${
                      dead ? "text-[#a29b8e] line-through" : ""
                    }`}
                  >
                    {m.title}
                  </span>
                  <div className="ml-auto flex gap-1.5 text-xs">
                    <div onClick={() => goRoom("d" + m.id)} className="key key-line px-3 py-1.5">
                      [채팅]
                    </div>
                    {m.status === "settling" && (
                      <div
                        onClick={() => openSettle(m.id)}
                        className="key px-3 py-1.5 text-white"
                        style={{ background: "#4a6fa5" }}
                      >
                        [정산서 →]
                      </div>
                    )}
                    {deletable && !showDeleteDialog && (
                      <div
                        onClick={() => {
                          setAskDeleteId(m.id);
                          setDeleteErr(null);
                        }}
                        className="key key-line border-[#e14e2b] px-3 py-1.5 text-[#e14e2b] hover:bg-[#e14e2b]"
                      >
                        [삭제]
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <ProgressBar pct={pct} color={st.fg} h={7} />
                </div>

                {showDeleteDialog && (
                  <div className="mt-3 border-[1.5px] border-dashed border-[#e14e2b] p-3.5">
                    <div className="text-[14.5px] font-bold text-[#e14e2b]">
                      공구를 삭제할까요? 되돌릴 수 없어요.
                    </div>
                    {deleteErr && (
                      <div className="mt-2 text-xs font-bold text-[#e14e2b]">{deleteErr}</div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <div
                        onClick={async () => {
                          if (deleting) return;
                          setDeleting(true);
                          setDeleteErr(null);
                          const err = await deleteDeal(m.id);
                          setDeleting(false);
                          if (err) setDeleteErr(err);
                          else setAskDeleteId(null);
                        }}
                        className="key key-primary flex-1 py-2 text-[14.5px]"
                      >
                        [ {deleting ? "삭제 중…" : "삭제하기"} ]
                      </div>
                      <div
                        onClick={() => {
                          setAskDeleteId(null);
                          setDeleteErr(null);
                        }}
                        className="key key-line flex-1 py-2 text-[14.5px]"
                      >
                        [ 그만두기 ]
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );

            // 나가는 줄은 자리를 닫는 껍데기 안에서 떨어뜨린다
            const line = "rule-dash border-b border-t-0 last:border-b-0";
            return gone ? (
              <div key={m.id} className={`${line} row-close`}>
                <div className="card-drop">{row}</div>
              </div>
            ) : (
              <div key={m.id} className={line}>
                {row}
              </div>
            );
          })}

          {rows.length > 0 && <div className="barcode mt-4" />}
        </div>
        <div className="receipt-edge" />
      </div>
    </div>
  );
}
