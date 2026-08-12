"use client";

import { Coins, Timer } from "lucide-react";
import ImageUpload from "@/components/image-upload";
import { CAT_EMOJI, fmt } from "@/lib/deal";
import { useStore } from "@/lib/store";
import type { Category } from "@/lib/types";

const FORM_CATS: Category[] = ["식료품", "배달음식", "생활용품", "대량구매", "기타"];
const digits = (v: string) => v.replace(/[^0-9]/g, "");
/** 입력창에 천 단위 콤마로 보여준다 — 저장은 digits()가 걸러낸 원 단위 정수 문자열 그대로 (#95) */
const commaFmt = (v: string) => (v ? Number(v).toLocaleString("ko-KR") : "");

export default function NewDealView() {
  const form = useStore((s) => s.form);
  const setForm = useStore((s) => s.setForm);
  // const submitNew = useStore((s) => s.submitNew); //zustand 방식
  const isDelivery = form.cat === "배달음식";

  const submitNew = async () => {
  try {
    const f = form;
    const totalN = parseInt(f.total) || 0;
    const goalN = parseInt(f.goal) || 0;
    const minOrderN = parseInt(f.minOrderAmount) || 0;

    // 배달음식은 예상 총 금액이 선택(#95) — 대신 최소주문금액·배달비가 필수.
    // 총액을 안 적으면 서버가 최소주문금액으로 채운다.
    const requiredOk = isDelivery
      ? minOrderN > 0 && f.deliveryFee.trim() !== "" && !!f.store_link
      : totalN > 0;

    if (!f.title || goalN <= 1 || !requiredOk) {
      alert("필수 입력값을 확인하세요");
      return;
    }

    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.title,
        cat: f.cat,
        total: totalN,
        goal: goalN,
        mins: parseInt(f.mins) || 60,
        place: f.place,
        store_link: f.store_link,
        image_url: f.imageUrl || null,
        min_order_amount: isDelivery ? minOrderN : undefined,
        delivery_fee: isDelivery ? parseInt(f.deliveryFee) || 0 : undefined,
      }),
    });

    const newDeal = await res.json();

    if (!res.ok) {
      alert(newDeal.error || "공고 작성 실패");
      return;
    }

    useStore.setState((st) => ({
      deals: [newDeal, ...st.deals],
      page: "home",
      form: {
        cat: "식료품",
        title: "",
        total: "",
        goal: "",
        mins: "",
        place: "",
        store_link: "",
        imageUrl: "",
        minOrderAmount: "",
        deliveryFee: "",
      },
    }));

  } catch (error) {
    // 5-1. 네트워크 에러 등 처리
    console.error("[submitNew]", error);
    alert("오류가 발생했습니다: " + (error as Error).message);
  }
};


  const goalN = parseInt(form.goal) || 0;
  const totalN = parseInt(form.total) || 0;
  const minOrderN = parseInt(form.minOrderAmount) || 0;
  const deliveryFeeN = parseInt(form.deliveryFee) || 0;
  // 배달음식은 메뉴가 사람마다 달라 총액을 안 나누고 배달비만 엔빵해서 보여준다 (lib/deal.ts perAmount 와 동일 기준).
  // 그 외 카테고리는 다 같이 부담하는 공동구매라 총액을 그대로 나눈다.
  const previewShared = isDelivery ? deliveryFeeN : totalN;
  const canSubmit =
    !!form.title &&
    goalN > 1 &&
    (isDelivery ? minOrderN > 0 && form.deliveryFee.trim() !== "" && !!form.store_link : totalN > 0);

  return (
    <div className="flex-1 overflow-auto px-7 py-5">
      <div className="flex max-w-[940px] flex-wrap items-start gap-[26px]">
        <div className="flex min-w-[320px] flex-[1.3] flex-col gap-[13px]">
          <div>
            <div className="mb-2 font-extrabold">카테고리</div>
            <div className="flex flex-wrap gap-2">
              {FORM_CATS.map((c) => (
                <div
                  key={c}
                  onClick={() => setForm({ cat: c })}
                  className={`cursor-pointer rounded-full border-[1.5px] px-4 py-2 text-[13.5px] font-bold hover:border-[#1f8a4c] ${
                    form.cat === c
                      ? "border-[#1f8a4c] bg-[#1f8a4c] text-white"
                      : "border-[#d5e6d6] bg-white text-[#4d6d58]"
                  }`}
                >
                  {c}
                </div>
              ))}
            </div>
          </div>
          <input
            value={form.title}
            onChange={(e) => setForm({ title: e.target.value })}
            placeholder="제목 — 예: 제주 감귤 10kg 같이 사요"
            className="input-base"
          />
          {isDelivery && (
            <>
              <input
                value={form.store_link}
                onChange={(e) => setForm({ store_link: e.target.value })}
                placeholder="가격/메뉴 링크"
                className="input-base"
              />
              <div className="flex gap-2.5">
                <input
                  value={commaFmt(form.minOrderAmount)}
                  onChange={(e) => setForm({ minOrderAmount: digits(e.target.value) })}
                  placeholder="최소 주문 금액 (원)"
                  className="input-base flex-1"
                />
                <input
                  value={commaFmt(form.deliveryFee)}
                  onChange={(e) => setForm({ deliveryFee: digits(e.target.value) })}
                  placeholder="배달비 (원)"
                  className="input-base flex-1"
                />
              </div>
              <div className="rounded-[10px] bg-[#f0f7ee] px-3 py-[9px] text-[12.5px] text-[#4d6d58]">
                배달음식 공구 · 배달비도 자동 1/N · 메뉴는 채팅방에서 취합 · 주문 후 실제 금액으로 수정
                가능
              </div>
            </>
          )}
          <div className="flex gap-2.5">
            <input
              value={commaFmt(form.total)}
              onChange={(e) => setForm({ total: digits(e.target.value) })}
              placeholder={isDelivery ? "예상 총 금액 (원) · 선택" : "예상 총 금액 (원)"}
              className="input-base flex-1"
            />
            <input
              value={form.goal}
              onChange={(e) => setForm({ goal: digits(e.target.value) })}
              placeholder="목표 인원"
              className="input-base flex-1"
            />
          </div>
          <div className="text-[11.5px] text-[#8aa392]">
            예상 총 금액이에요 — 정산을 시작할 때 실제 금액으로 확정돼요
          </div>
          <div className="flex gap-2.5">
            <input
              value={form.mins}
              onChange={(e) => setForm({ mins: digits(e.target.value) })}
              placeholder="마감까지 (분)"
              className="input-base flex-1"
            />
            <input
              value={form.place}
              onChange={(e) => setForm({ place: e.target.value })}
              placeholder="수령 장소/방법"
              className="input-base flex-[1.4]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-[12.5px] text-[#4d6d58]">대표 사진 (선택) — 없으면 카테고리 이모지로 보여요</div>
            <ImageUpload
              kind="deals"
              value={form.imageUrl || null}
              onChange={(url) => setForm({ imageUrl: url ?? "" })}
              label="대표 사진 첨부"
              height={140}
            />
          </div>
        <div className="flex gap-2">
          {[15, 30, 60].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setForm({ mins: String(m) })}
              className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                form.mins === String(m)
                  ? "border-[#1f8a4c] bg-[#1f8a4c] text-white"
                  : "border-[#d5e6d6] bg-white text-[#4d6d58]"
              }`}
            >
              {m}분
            </button>
          ))}
        </div>
        
          <div className="flex items-start gap-1.5 text-xs text-[#8aa392]">
            <Coins aria-hidden className="mt-[.15em] h-[1.15em] w-[1.15em] shrink-0" />
            <span>총 금액은 정산 시작 전까지 언제든 수정할 수 있어요 (변경 시 전원 알림)</span>
          </div>
          <div
            onClick={submitNew}
            className={`rounded-xl p-[13px] text-center text-[15px] font-extrabold ${
              canSubmit
                ? "cursor-pointer bg-[#1f8a4c] text-white hover:brightness-105"
                : "cursor-default bg-[#e6efe4] text-[#8a9a8e]"
            }`}
          >
            올리기 → 채팅방 자동 생성
          </div>
        </div>

        <div className="flex w-[300px] flex-none flex-col gap-2">
          <div className="text-[12.5px] font-extrabold text-[#6b8573]">미리보기 · 실시간</div>
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[#dbe9da] bg-white p-4 shadow-[0_6px_18px_rgba(18,70,38,.08)]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f6ec] text-[22px]">
                {CAT_EMOJI[form.cat]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap font-extrabold">
                  {form.title || "제목을 입력하면 여기 보여요"}
                </div>
                <div className="text-xs text-[#6b8573]">{form.cat} · 나</div>
              </div>
              <span className="badge" style={{ background: "#e9f6ec", color: "#166b3a" }}>
                모집중
              </span>
            </div>
            <div className="h-[9px] overflow-hidden rounded-full bg-[#e6efe4]">
              <div className="h-full w-[4%] bg-[#1f8a4c]" />
            </div>
            <div className="flex justify-between text-[13px]">
              <span>
                <b>1</b>
                <span className="text-[#6b8573]">/{goalN || "?"}명</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-[#1f8a4c]">
                <Timer aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" /> {parseInt(form.mins) || 60}분
              </span>
            </div>
            <div className="text-[13px] text-[#6b8573]">
              1인{" "}
              <b className="text-[15px] text-[#17301f]">
                {goalN > 0 && previewShared > 0 ? fmt(Math.ceil(previewShared / goalN)) : "— 원"}
              </b>
              <span className="ml-1 text-[11px] text-[#8aa392]">· 목표 인원 기준 예상</span>
            </div>
          </div>
          <div className="text-xs leading-[1.6] text-[#8aa392]">
            올리는 즉시 공구 채팅방이 생기고, 동네 라운지에 카드로 공유할 수 있어요. 1인 금액은 실제
            참여자 수에 맞춰 실시간으로 다시 계산돼요.
          </div>
        </div>
      </div>
    </div>
  );
}
