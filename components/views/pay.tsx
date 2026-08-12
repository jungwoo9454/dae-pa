"use client";

import { Banknote, CreditCard, Coins, ReceiptText, Wallet, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Toggle } from "@/components/ui";
import { fmt } from "@/lib/deal";
import { useStore } from "@/lib/store";

const TOPUP_OPTIONS = [
  { value: 5000, label: "+5천" },
  { value: 10000, label: "+1만" },
  { value: 30000, label: "+3만" },
];

/** wallet_transactions.kind → 내역 아이콘 (#65) */
const TX_ICON: Record<string, LucideIcon> = {
  charge: Zap,
  withdraw: Banknote,
  pay: ReceiptText,
  receive: Coins,
};

export default function PayView() {
  const balance = useStore((s) => s.balance);
  const topupOpen = useStore((s) => s.topupOpen);
  const topupAmt = useStore((s) => s.topupAmt);
  const topupResult = useStore((s) => s.topupResult);
  const setTopupResult = useStore((s) => s.setTopupResult);
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
    { value: 5000, label: "5천" },
    { value: 10000, label: "1만" },
    { value: 30000, label: "3만" },
  ];

  const KIND_LABEL: Record<string, string> = {
    charge: "충전",
    withdraw: "출금",
    pay: "결제",
    receive: "수령",
  };

  return (
    <div className="flex-1 overflow-auto px-9 py-8">
      <div className="mx-auto flex w-[960px] justify-center gap-[30px]">
        <div className="w-[420px] flex-none">
          {topupResult && (
            <div
              onClick={() => setTopupResult(null)}
              className={`mb-3.5 cursor-pointer border-[1.5px] px-3.5 py-2.5 text-[14.5px] font-bold ${
                topupResult === "ok"
                  ? "border-[#1b1917] text-[#1b1917]"
                  : "border-[#e14e2b] text-[#e14e2b]"
              }`}
            >
              {topupResult === "ok" ? "충전이 완료됐어요" : "결제에 실패했어요. 다시 시도해주세요"}
            </div>
          )}

          {/* 금전출납기 — LED 잔액판 */}
          <div className="rounded-md bg-[#26262b] p-6 shadow-[0_14px_28px_rgba(27,25,23,.3)]">
            <div className="text-[12.5px] tracking-[.2em] text-[#9b948c]">대파페이 · 금고 잔액</div>
            <div className="mt-3 rounded border border-[#3c3c42] bg-[#111114] px-5 py-[18px] text-right">
              <span
                className="tnum text-[45px] font-bold text-[#7ce28c]"
                style={{ textShadow: "0 0 12px rgba(124,226,140,.5)" }}
              >
                {balance.toLocaleString("ko-KR")}
              </span>
              <span className="text-[17px] text-[#7ce28c] opacity-70"> 원</span>
            </div>
            <div className="mt-4 flex gap-2 text-sm">
              <div onClick={toggleTopup} className="key key-primary flex-1 py-3 tracking-[.1em]">
                [ 충전 ]
              </div>
              <div
                onClick={toggleWithdraw}
                className="key flex-1 border-[1.5px] border-[#9b948c] py-3 tracking-[.1em] text-[#e4e4e0] hover:bg-[#3c3c42]"
              >
                [ 출금 ]
              </div>
            </div>
            <div className="mt-[18px] flex items-center border-t border-dashed border-[#3c3c42] pt-4">
              <div>
                <div className="text-[14.5px] font-bold text-[#e4e4e0]">정산 자동 결제</div>
                <div className="mt-1 text-[12px] text-[#9b948c]">정산 확정 시 잔액에서 즉시 차감</div>
              </div>
              <span className="ml-auto">
                <Toggle on={autoPay} onClick={toggleAutoPay} />
              </span>
            </div>
          </div>

          {topupOpen && (
            <div className="receipt mt-4 p-[18px]">
              <div className="rule-dash border-b border-t-0 pb-2.5 text-xs font-bold tracking-[.14em]">
                충전 금액
              </div>
              <div className="mt-3 flex gap-1.5">
                {TOPUP_OPTIONS.map((tc) => (
                  <div
                    key={tc.value}
                    onClick={() => setTopupAmt(tc.value)}
                    className={`chip flex-1 text-center ${topupAmt === tc.value ? "chip-on" : ""}`}
                  >
                    {tc.label}
                  </div>
                ))}
              </div>
              <input
                type="number"
                min={0}
                value={topupAmt || ""}
                onChange={(e) => setTopupAmt(parseInt(e.target.value) || 0)}
                placeholder="직접 입력"
                className="field tnum mt-2 w-full text-right font-bold"
              />
              {topupAmt <= 0 ? (
                <div className="key key-off mt-2.5 py-2.5 text-[14.5px]">[ 금액을 입력해주세요 ]</div>
              ) : (
                <div onClick={doTopup} className="key key-primary mt-2.5 py-2.5 text-[14.5px]">
                  [ {fmt(topupAmt)} 충전하기 ]
                </div>
              )}
              <div className="mt-2.5 text-[12.5px] text-[#9c9ca3]">
                토스페이먼츠 테스트 결제 · 실제 출금 없음
              </div>
            </div>
          )}

          {withdrawOpen && (
            <div className="receipt mt-4 p-[18px]">
              <div className="rule-dash border-b border-t-0 pb-2.5 text-xs font-bold tracking-[.14em]">
                출금 금액
              </div>
              <div className="mt-3 flex gap-1.5">
                {withdrawOptions.map((tc) => (
                  <div
                    key={tc.label}
                    onClick={() => setWithdrawAmt(tc.value)}
                    className={`chip flex-1 text-center ${withdrawAmt === tc.value ? "chip-on" : ""}`}
                  >
                    {tc.label}
                  </div>
                ))}
              </div>
              <input
                type="number"
                min={0}
                value={withdrawAmt || ""}
                onChange={(e) => setWithdrawAmt(parseInt(e.target.value) || 0)}
                placeholder="직접 입력"
                className="field tnum mt-2 w-full text-right font-bold"
              />
              {withdrawAmt > balance ? (
                <div className="key key-off mt-2.5 py-2.5 text-[14.5px]">[ 잔액이 부족해요 ]</div>
              ) : (
                <div onClick={doWithdraw} className="key key-primary mt-2.5 py-2.5 text-[14.5px]">
                  [ {fmt(withdrawAmt)} 출금하기 ]
                </div>
              )}
              <div className="mt-2.5 text-[12.5px] text-[#9c9ca3]">출금 계좌 · 초록은행 1104-04</div>
            </div>
          )}
        </div>

        {/* 출납 저널 */}
        <div className="w-[500px] flex-none">
          <div className="receipt px-7 py-6">
            <div className="rule-dash receipt-head border-b border-t-0 pb-3 text-[14.5px] tracking-[.4em]">
              ＊ 출납 저널 ＊
            </div>
            {history.length === 0 && (
              <div className="py-10 text-center text-[14.5px] text-[#8b8478]">이용 내역이 없어요</div>
            )}
            {history.map((h, i) => (
              <div key={i} className="rule-dot flex items-center gap-3 py-[15px] text-[14.5px]">
                <span
                  className={`flex-none px-2.5 py-[3px] text-[12.5px] font-bold ${
                    h.amt > 0
                      ? "border-[1.5px] border-[#1b1917]"
                      : "border border-[#8b8478] text-[#6e675e]"
                  }`}
                >
                  {KIND_LABEL[h.kind] ?? "거래"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-sans-ko truncate font-bold">{h.title}</div>
                  <div className="mt-[3px] text-[12px] text-[#9c9ca3]">{h.when}</div>
                </div>
                <b className="tnum text-base" style={{ color: h.amt > 0 ? "#e14e2b" : "#1b1917" }}>
                  {(h.amt > 0 ? "+" : "−") + Math.abs(h.amt).toLocaleString("ko-KR") + "원"}
                </b>
              </div>
            ))}
            {history.length > 0 && <div className="barcode mt-3" />}
          </div>
          <div className="receipt-edge" />
        </div>
      </div>
    </div>
  );
}
