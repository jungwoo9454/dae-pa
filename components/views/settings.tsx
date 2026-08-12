"use client";

import { useState } from "react";
import ImageUpload from "@/components/image-upload";
import { Toggle } from "@/components/ui";
import { isSubmitEnter } from "@/lib/keys";
import { useStore } from "@/lib/store";

/** 정산 계좌를 받을 수 있는 국내 은행 (#155) — 표기가 제각각이 되지 않게 목록에서만 고른다 */
const BANKS = [
  "KB국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "NH농협은행",
  "IBK기업은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "SC제일은행",
  "새마을금고",
  "신협",
  "우체국",
  "수협은행",
  "부산은행",
  "대구은행",
  "경남은행",
  "광주은행",
  "전북은행",
  "제주은행",
];

/** 저장된 "은행명 계좌번호" 를 다시 두 칸으로 가른다 — 목록에 없는 예전 값은 통째로 번호 칸에 둔다 */
function splitAccount(v: string | null | undefined): { bank: string; no: string } {
  const s = (v ?? "").trim();
  if (!s) return { bank: "", no: "" };
  const bank = BANKS.find((b) => s.startsWith(b));
  return bank ? { bank, no: s.slice(bank.length).trim() } : { bank: "", no: s };
}

/** 가입 수단 표기 (#81) — auth user.app_metadata.provider 값 그대로 들어온다 */
const PROVIDER_LABEL: Record<string, string> = {
  email: "이메일 가입",
  google: "구글 계정",
  github: "깃허브 계정",
};

type EditKey = "bank" | "account";

const INPUT = "field w-full text-[15px]";
const BTN = "key key-ink px-4 py-2 text-[14.5px]";

/** 단말 설정 한 줄 — 점선 구분, 우측에 키 */
function Row({
  title,
  sub,
  right,
  onClick,
  children,
}: {
  title: string;
  sub?: string;
  right: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rule-dot last:border-b-0">
      <div
        onClick={onClick}
        className={`flex items-center gap-3 py-3.5 text-sm ${onClick ? "cursor-pointer" : ""}`}
      >
        <div className="min-w-0">
          <span className="font-sans-ko">{title}</span>
          {sub && <div className="mt-1 truncate text-xs text-[#8b8478]">{sub}</div>}
        </div>
        <span className="ml-auto flex-none">{right}</span>
      </div>
      {children && <div className="pb-4">{children}</div>}
    </div>
  );
}

export default function SettingsView() {
  const me = useStore((s) => s.me);
  const n1 = useStore((s) => s.n1);
  const n2 = useStore((s) => s.n2);
  const toggleN1 = useStore((s) => s.toggleN1);
  const toggleN2 = useStore((s) => s.toggleN2);
  const saveProfile = useStore((s) => s.saveProfile);
  const logout = useStore((s) => s.logout);

  const [edit, setEdit] = useState<EditKey | null>(null);
  const [bankName, setBankName] = useState("");
  const [bankNo, setBankNo] = useState("");
  const [nick, setNick] = useState("");

  const open = (k: EditKey) => {
    if (k === "bank") {
      const cur = splitAccount(me?.bankAccount);
      setBankName(cur.bank);
      setBankNo(cur.no);
    }
    if (k === "account") setNick(me?.nickname ?? "");
    setEdit(edit === k ? null : k);
  };

  // 은행·번호가 다 있어야 저장한다 — 한쪽만 있으면 정산 때 어디로 보낼지 알 수 없다
  const bankOk = !!bankName && bankNo.trim() !== "";
  const saveBank = () => {
    if (!bankOk) return;
    saveProfile({ bankAccount: `${bankName} ${bankNo.trim()}` });
    setEdit(null);
  };

  const saveNick = () => {
    const v = nick.trim();
    if (!v) return; // 닉네임은 비울 수 없다
    saveProfile({ nickname: v });
    setEdit(null);
  };

  const providerLabel = me?.provider ? (PROVIDER_LABEL[me.provider] ?? me.provider) : null;
  const edited = <span className="key key-line px-3.5 py-2 text-xs">[변경]</span>;

  return (
    <div className="flex-1 overflow-auto px-9 py-8">
      <div className="mx-auto w-[680px]">
        <div className="receipt px-8 py-7">
          <div className="rule-dash receipt-head border-b border-t-0 pb-3.5 tracking-[.5em]">
            ＊ 단말 설정 ＊
          </div>

          <div className="rule-dash flex items-center gap-4 border-b border-t-0 py-5">
            <div className="h-14 w-14 flex-none overflow-hidden bg-[#1b1917] text-white">
              {me?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 소셜 아바타는 외부 도메인이라 next/image 설정 없이 쓴다
                <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[24.5px] font-extrabold">
                  {me?.nickname?.[0] ?? "파"}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-sans-ko text-[19px] font-extrabold">
                {me?.nickname ?? "파티원"}
              </div>
              <div className="mt-1.5 text-xs text-[#8b8478]">
                {[providerLabel, me?.dong ? `${me.dong} 인증 ✓` : null].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div onClick={() => open("account")} className="key key-line ml-auto px-3.5 py-2 text-xs">
              [계정 관리]
            </div>
          </div>
          {edit === "account" && (
            <div className="rule-dash flex flex-col gap-3 border-b border-t-0 py-4">
              <div className="flex items-center gap-3">
                <ImageUpload
                  kind="avatars"
                  value={me?.avatarUrl}
                  onChange={(url) => saveProfile({ avatarUrl: url })}
                  height={64}
                  round
                />
                <div className="text-xs text-[#8b8478]">프로필 사진</div>
              </div>
              <div className="flex gap-2">
                <input
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  onKeyDown={(e) => isSubmitEnter(e) && saveNick()}
                  placeholder="닉네임"
                  className={INPUT}
                  autoFocus
                />
                <button onClick={saveNick} className={BTN}>
                  저장
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 text-[12.5px] font-bold tracking-[.14em] text-[#8b8478]">// 알림</div>
          <Row
            title="마감 임박 알림"
            sub="참여한 공구 마감 30분 전"
            right={<Toggle on={n1} onClick={toggleN1} />}
          />
          <Row
            title="입금 요청 알림"
            sub="정산 시작·리마인드"
            right={<Toggle on={n2} onClick={toggleN2} />}
          />

          <div className="pt-4 text-[12.5px] font-bold tracking-[.14em] text-[#8b8478]">// 정산</div>
          <Row
            title="정산 받을 계좌"
            sub={me?.bankAccount ?? "등록 안 함"}
            right={edited}
            onClick={() => open("bank")}
          >
            {edit === "bank" && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="field w-[168px] flex-none cursor-pointer text-[15px]"
                    autoFocus
                  >
                    <option value="">은행 선택</option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <input
                    value={bankNo}
                    onChange={(e) => setBankNo(e.target.value.replace(/[^0-9-]/g, ""))}
                    onKeyDown={(e) => isSubmitEnter(e) && saveBank()}
                    placeholder="계좌번호 (- 포함)"
                    inputMode="numeric"
                    className="field tnum min-w-0 flex-1 text-[15px]"
                  />
                  <button onClick={saveBank} className={bankOk ? BTN : "key key-off px-4 py-2 text-[14.5px]"}>
                    저장
                  </button>
                </div>
                {!bankOk && (
                  <div className="text-xs text-[#8b8478]">은행과 계좌번호를 모두 입력해주세요</div>
                )}
              </div>
            )}
          </Row>
          <div className="flex items-center pt-5">
            <span onClick={logout} className="cursor-pointer text-[14.5px] font-extrabold tracking-[.1em] text-[#e14e2b]">
              [ 로그아웃 ]
            </span>
          </div>

          <div className="barcode mt-4" />
        </div>
        <div className="receipt-edge" />
      </div>
    </div>
  );
}
