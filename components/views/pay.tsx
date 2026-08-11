"use client";

import { Toggle } from "@/components/ui";
import { fmt } from "@/lib/deal";
import { useStore } from "@/lib/store";

const TOPUP_OPTIONS = [
  { value: 5000, label: "+5천" },
  { value: 10000, label: "+1만" },
  { value: 30000, label: "+3만" },
];

export default function PayView() {
  const balance = useStore((s) => s.balance);
  const topupOpen = useStore((s) => s.topupOpen);
  const topupAmt = useStore((s) => s.topupAmt);
  const withdrawOpen = useStore((s) => s.withdrawOpen);
  const withdrawAmt = useStore((s) => s.withdrawAmt);
  const autoPay = useStore((s) => s.autoPay);
  const history = useStore((s) => s.history);
  const toggleTopup = useStore((s) => s.toggleTopup);
  const setTopupAmt = useStore((s) => s.setTopupAmt);
  const doTopup = useStore((s) => s.doTopup);
  const toggleWithdraw = useStore((s) => s.toggleWithdraw);
  const setWithdrawAmt = useStore((s) => s.setWithdrawAmt);
  const doWithdraw = useStore((s) => s.doWithdraw);
  const toggleAutoPay = useStore((s) => s.toggleAutoPay);

  const withdrawOptions = [
    { value: 10000, label: "1만" },
    { value: 50000, label: "5만" },
    { value: 100000, label: "10만" },
  ];

  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      <div className="flex max-w-[900px] items-start gap-5">
        <div className="flex w-80 flex-none flex-col gap-3">
          <div
            className="rounded-[18px] p-[22px] text-white shadow-[0_10px_24px_rgba(18,70,38,.25)]"
            style={{ background: "linear-gradient(135deg,#14532d,#1f8a4c)" }}
          >
            <div className="text-[13px] opacity-85">🥬 대파페이 잔액</div>
            <div className="font-jua tnum mt-1 text-[34px]">{fmt(balance)}</div>
            <div className="mt-3.5 flex gap-2">
              <div
                onClick={toggleTopup}
                className="flex-1 cursor-pointer rounded-[10px] bg-white/95 p-[9px] text-center font-extrabold text-[#14532d] hover:bg-white"
              >
                + 충전
              </div>
              <div
                onClick={toggleWithdraw}
                className="flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-white/50 p-[9px] text-center font-bold hover:border-white"
              >
                출금
              </div>
            </div>
          </div>

          {topupOpen && (
            <div className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-[#9fd4ae] bg-white p-3.5">
              <b>충전 금액</b>
              <div className="flex gap-1.5">
                {TOPUP_OPTIONS.map((tc) => (
                  <div
                    key={tc.value}
                    onClick={() => setTopupAmt(tc.value)}
                    className={`flex-1 cursor-pointer rounded-[9px] border-[1.5px] px-1 py-2 text-center text-[13px] font-extrabold hover:border-[#1f8a4c] ${
                      topupAmt === tc.value
                        ? "border-[#1f8a4c] bg-[#e9f6ec] text-[#166b3a]"
                        : "border-[#d5e6d6] text-[#4d6d58]"
                    }`}
                  >
                    {tc.label}
                  </div>
                ))}
              </div>
              <div
                onClick={doTopup}
                className="cursor-pointer rounded-[10px] bg-[#1f8a4c] p-2.5 text-center font-extrabold text-white hover:bg-[#187741]"
              >
                {fmt(topupAmt)} 충전하기
              </div>
              <div className="text-[11.5px] text-[#8aa392]">충전 수단 · 초록은행 1104-04 (자동이체)</div>
            </div>
          )}

          {withdrawOpen && (
            <div className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-[#9fd4ae] bg-white p-3.5">
              <b>출금 금액</b>
              <div className="flex gap-1.5">
                {withdrawOptions.map((tc) => (
                  <div
                    key={tc.label}
                    onClick={() => setWithdrawAmt(tc.value)}
                    className={`flex-1 cursor-pointer rounded-[9px] border-[1.5px] px-1 py-2 text-center text-[13px] font-extrabold hover:border-[#1f8a4c] ${
                      withdrawAmt === tc.value
                        ? "border-[#1f8a4c] bg-[#e9f6ec] text-[#166b3a]"
                        : "border-[#d5e6d6] text-[#4d6d58]"
                    }`}
                  >
                    {tc.label}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 rounded-[9px] border-[1.5px] border-[#d5e6d6] px-2.5 py-1.5 focus-within:border-[#1f8a4c]">
                <input
                  type="number"
                  min={0}
                  value={withdrawAmt || ""}
                  onChange={(e) => setWithdrawAmt(parseInt(e.target.value) || 0)}
                  placeholder="직접 입력"
                  className="w-full text-[13px] font-extrabold text-[#17301f] outline-none"
                />
                <span className="text-[13px] font-bold text-[#8aa392]">원</span>
              </div>
              {withdrawAmt > balance ? (
                <div className="rounded-[10px] bg-[#fdf0dc] p-2.5 text-center text-[13px] font-bold text-[#b45309]">
                  잔액이 부족해요
                </div>
              ) : (
                <div
                  onClick={doWithdraw}
                  className="cursor-pointer rounded-[10px] bg-[#1f8a4c] p-2.5 text-center font-extrabold text-white hover:bg-[#187741]"
                >
                  {fmt(withdrawAmt)} 출금하기
                </div>
              )}
              <div className="text-[11.5px] text-[#8aa392]">출금 계좌 · 초록은행 1104-04</div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-[14px] border border-[#dbe9da] bg-white px-3.5 py-3">
            <div>
              <b>정산 요청 자동 결제</b>
              <div className="text-xs text-[#8aa392]">요청 오면 잔액에서 바로 차감</div>
            </div>
            <Toggle on={autoPay} onClick={toggleAutoPay} />
          </div>
        </div>

        <div className="flex-1 rounded-2xl border border-[#dbe9da] bg-white px-[18px] py-4">
          <b className="text-[15px]">이용 내역</b>
          <div className="mt-2.5 flex flex-col">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[#eef4ec] px-0.5 py-[11px]">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#e9f6ec] text-[17px]">
                  {h.emoji}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{h.title}</div>
                  <div className="text-xs text-[#8aa392]">{h.when}</div>
                </div>
                <b className="tnum" style={{ color: h.amt > 0 ? "#1f8a4c" : "#17301f" }}>
                  {(h.amt > 0 ? "+" : "−") + Math.abs(h.amt).toLocaleString("ko-KR") + "원"}
                </b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
