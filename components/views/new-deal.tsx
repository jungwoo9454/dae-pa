"use client";

import ImageUpload from "@/components/image-upload";
import { ProgressBar } from "@/components/ui";
import { CAT_ICON, MIN_DEADLINE_MIN, commaFmt, digits, fmt } from "@/lib/deal";
import { useStore } from "@/lib/store";
import type { Category } from "@/lib/types";

const FORM_CATS: Category[] = ["식료품", "배달음식", "생활용품", "대량구매", "기타"];

export default function NewDealView() {
  const form = useStore((s) => s.form);
  const me = useStore((s) => s.me);
  const setForm = useStore((s) => s.setForm);
  // const submitNew = useStore((s) => s.submitNew); //zustand 방식
  const isDelivery = form.cat === "배달음식";

  const submitNew = async () => {
  try {
    const f = form;
    const totalN = parseInt(f.total) || 0;
    const goalN = parseInt(f.goal) || 0;
    const minOrderN = parseInt(f.minOrderAmount) || 0;
    // 비워두면 60분이 기본값 — 적었다면 최소 마감 시간을 지켜야 한다
    const minsN = parseInt(f.mins) || 60;

    // 배달음식은 예상 총 금액이 선택(#95) — 대신 최소주문금액·배달비가 필수.
    // 총액을 안 적으면 서버가 최소주문금액으로 채운다.
    const requiredOk = isDelivery
      ? minOrderN > 0 && f.deliveryFee.trim() !== "" && !!f.store_link
      : totalN > 0;

    if (!f.title || goalN <= 1 || !requiredOk) {
      alert("필수 입력값을 확인하세요");
      return;
    }
    if (minsN < MIN_DEADLINE_MIN) {
      alert(`마감 시간은 최소 ${MIN_DEADLINE_MIN}분이에요`);
      return;
    }

    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.title,
        cat: f.cat,
        description: f.description,
        total: totalN,
        goal: goalN,
        mins: minsN,
        place: f.place,
        store_link: f.store_link,
        image_url: f.imageUrl || null,
        min_order_amount: isDelivery ? minOrderN : undefined,
        delivery_fee: isDelivery ? parseInt(f.deliveryFee) || 0 : undefined,
      }),
    });

    const newDeal = await res.json();

    if (!res.ok) {
      alert(newDeal.error || "공구 올리기에 실패했어요");
      return;
    }

    useStore.setState((st) => ({
      deals: [newDeal, ...st.deals],
      page: "home",
      form: {
        cat: "식료품",
        title: "",
        description: "",
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
  // 비워두면 기본 60분이라 통과, 적었다면 최소 마감 시간(5분) 아래로는 못 올린다
  const minsTooShort = form.mins !== "" && (parseInt(form.mins) || 0) < MIN_DEADLINE_MIN;
  const canSubmit =
    !!form.title &&
    goalN > 1 &&
    !minsTooShort &&
    (isDelivery ? minOrderN > 0 && form.deliveryFee.trim() !== "" && !!form.store_link : totalN > 0);

  return (
    <div className="flex-1 overflow-auto px-9 py-8">
      <div className="mx-auto flex w-[960px] justify-center gap-[30px]">
        <div className="receipt w-[540px] flex-none p-7 text-[14.5px]">
          <div className="rule-dash border-b border-t-0 pb-3 text-[14.5px] font-extrabold tracking-[.2em]">
            발행 정보 입력
          </div>

          <div className="mt-4 text-[13px] font-bold text-[#8b8478]">카테고리</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FORM_CATS.map((c) => {
              const Icon = CAT_ICON[c];
              return (
                <div
                  key={c}
                  onClick={() => setForm({ cat: c })}
                  className={`chip flex items-center gap-1.5 px-3.5 py-[7px] text-xs ${
                    form.cat === c ? "chip-on" : ""
                  }`}
                >
                  <Icon aria-hidden className="h-[1.15em] w-[1.15em] shrink-0" />
                  {c}
                </div>
              );
            })}
          </div>

          <input
            value={form.title}
            onChange={(e) => setForm({ title: e.target.value })}
            placeholder="제목 — 예: 제주 감귤 10kg 같이 사요"
            className="field font-sans-ko mt-4 h-[46px] w-full font-bold"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ description: e.target.value })}
            placeholder={"설명·품목 (선택) — 예: 대파 5단 · 감자 3kg"}
            rows={3}
            className="field field-sub font-sans-ko mt-2 w-full resize-none"
          />

          {isDelivery && (
            <div className="mt-3.5 border-[1.5px] border-dashed border-[#e14e2b] p-4">
              <div className="text-[12.5px] font-bold tracking-[.1em] text-[#e14e2b]">
                배달음식 전용 필드
              </div>
              <input
                value={form.store_link}
                onChange={(e) => setForm({ store_link: e.target.value })}
                placeholder="가격/메뉴 링크"
                className="field field-sub mt-2.5 h-10 w-full text-xs"
              />
              <div className="mt-2 flex gap-2">
                <input
                  value={commaFmt(form.minOrderAmount)}
                  onChange={(e) => setForm({ minOrderAmount: digits(e.target.value) })}
                  placeholder="최소 주문 금액"
                  className="field field-sub tnum h-10 flex-1 text-xs"
                />
                <input
                  value={commaFmt(form.deliveryFee)}
                  onChange={(e) => setForm({ deliveryFee: digits(e.target.value) })}
                  placeholder="배달비"
                  className="field field-sub tnum h-10 flex-1 text-xs"
                />
              </div>
            </div>
          )}

          <div className="mt-3.5 flex gap-2.5">
            <div className="flex-1">
              <div className="text-[13px] font-bold text-[#8b8478]">
                예상 총 금액{isDelivery ? " (선택)" : ""}
              </div>
              <input
                value={commaFmt(form.total)}
                onChange={(e) => setForm({ total: digits(e.target.value) })}
                placeholder="0"
                className="field tnum mt-[7px] h-11 w-full text-base font-bold"
              />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-[#8b8478]">목표 인원</div>
              <input
                value={form.goal}
                onChange={(e) => setForm({ goal: digits(e.target.value) })}
                placeholder="0"
                className="field tnum mt-[7px] h-11 w-full text-base font-bold"
              />
            </div>
          </div>

          <div className="mt-3.5 text-[13px] font-bold text-[#8b8478]">
            마감까지 <span className="font-normal text-[#9c9ca3]">(최소 {MIN_DEADLINE_MIN}분)</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {[MIN_DEADLINE_MIN, 15, 30, 60].map((m) => (
              <div
                key={m}
                onClick={() => setForm({ mins: String(m) })}
                className={`chip px-4 py-2 text-xs ${form.mins === String(m) ? "chip-on" : ""}`}
              >
                {m}분
              </div>
            ))}
            <input
              value={form.mins}
              onChange={(e) => setForm({ mins: digits(e.target.value) })}
              placeholder="직접 입력(분)_"
              className="field field-sub tnum h-9 flex-1 py-0 text-xs"
            />
          </div>
          {minsTooShort && (
            <div className="mt-2 text-[13px] font-bold text-[#e14e2b]">
              마감은 최소 {MIN_DEADLINE_MIN}분 뒤로 잡아주세요
            </div>
          )}

          <input
            value={form.place}
            onChange={(e) => setForm({ place: e.target.value })}
            placeholder="수령 장소/방법"
            className="field font-sans-ko mt-3.5 h-11 w-full"
          />

          <div className="mt-2">
            <ImageUpload
              kind="deals"
              value={form.imageUrl || null}
              onChange={(url) => setForm({ imageUrl: url ?? "" })}
              label="대표 사진 첨부 — 없으면 카테고리 인장"
              height={92}
            />
          </div>

          <div
            onClick={submitNew}
            className={`mt-[18px] py-3.5 text-[17px] tracking-[.14em] ${
              canSubmit ? "key key-primary" : "key key-off"
            }`}
          >
            [ 전표 발행 ]
          </div>
        </div>

        {/* 실시간 인쇄 미리보기 */}
        <div className="w-[360px] flex-none">
          <div className="mb-2.5 text-[12.5px] tracking-[.14em] text-[#8b8478]">
            // 실시간 인쇄 미리보기
          </div>
          <div className="receipt px-[22px] pb-[18px] pt-[22px]">
            <div className="receipt-head text-[14.5px]">＊ 대파 공구 ＊</div>
            <div className="mt-1.5 text-center text-[12px] text-[#8b8478]">
              {form.cat} ｜ 주최: {me?.nickname ?? "나"}
            </div>
            <div className="rule-dash mt-3" />
            <div className="font-sans-ko mt-3.5 text-[19px] font-black leading-[1.4]">
              {form.title || "제목을 입력하면 여기 보여요"}
            </div>
            <div className="mt-3 flex flex-col gap-2 text-[14.5px] text-[#6e675e]">
              <div className="leader">
                <span>수령지</span>
                <i />
                <b>{form.place || "미정"}</b>
              </div>
              <div className="leader">
                <span>참여</span>
                <i />
                <b>1/{goalN || "?"}명</b>
              </div>
              <div className="leader">
                <span>마감까지</span>
                <i />
                <b className="tnum">{parseInt(form.mins) || 60}분</b>
              </div>
            </div>
            <div className="mt-3.5">
              <ProgressBar pct={goalN > 0 ? Math.min(100, Math.round(100 / goalN)) : 0} />
            </div>
            <div className="rule-dash mt-3.5 flex items-baseline pt-3">
              <span className="tnum text-[12.5px] text-[#8b8478]">
                1인당{goalN > 0 && previewShared > 0 ? ` (${previewShared.toLocaleString("ko-KR")}÷${goalN})` : ""}
              </span>
              <span className="tnum ml-auto text-[26px] font-black">
                {goalN > 0 && previewShared > 0 ? fmt(Math.ceil(previewShared / goalN)) : "— 원"}
              </span>
            </div>
            <div className="barcode mt-3" />
          </div>
          <div className="receipt-edge" />
        </div>
      </div>
    </div>
  );
}
