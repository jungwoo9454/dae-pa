"use client";

import { useState } from "react";
import ImageUpload from "@/components/image-upload";
import { Toggle } from "@/components/ui";
import { isSubmitEnter } from "@/lib/keys";
import { useStore } from "@/lib/store";

const TRANSFER_APPS = ["토스", "카카오페이", "네이버페이", "은행 앱"];

/** 가입 수단 표기 (#81) — auth user.app_metadata.provider 값 그대로 들어온다 */
const PROVIDER_LABEL: Record<string, string> = {
  email: "이메일 가입",
  google: "구글 계정",
  github: "깃허브 계정",
};

type EditKey = "bank" | "app" | "account";

const INPUT = "field w-full text-[13.5px]";
const BTN = "key key-ink px-4 py-2 text-[13px]";

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
  const [bank, setBank] = useState("");
  const [nick, setNick] = useState("");

  const open = (k: EditKey) => {
    if (k === "bank") setBank(me?.bankAccount ?? "");
    if (k === "account") setNick(me?.nickname ?? "");
    setEdit(edit === k ? null : k);
  };

  const saveBank = () => {
    saveProfile({ bankAccount: bank.trim() || null });
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
                <span className="flex h-full w-full items-center justify-center text-[22px] font-extrabold">
                  {me?.nickname?.[0] ?? "파"}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-sans-ko text-[17px] font-extrabold">
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

          <div className="pt-4 text-[11px] font-bold tracking-[.14em] text-[#8b8478]">// 알림</div>
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

          <div className="pt-4 text-[11px] font-bold tracking-[.14em] text-[#8b8478]">// 정산</div>
          <Row
            title="정산 받을 계좌"
            sub={me?.bankAccount ?? "등록 안 함"}
            right={edited}
            onClick={() => open("bank")}
          >
            {edit === "bank" && (
              <div className="flex gap-2">
                <input
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  onKeyDown={(e) => isSubmitEnter(e) && saveBank()}
                  placeholder="초록은행 1104-04"
                  className={INPUT}
                  autoFocus
                />
                <button onClick={saveBank} className={BTN}>
                  저장
                </button>
              </div>
            )}
          </Row>
          <Row
            title="기본 송금 앱"
            right={
              <div className="flex gap-1.5">
                {TRANSFER_APPS.map((app) => (
                  <span
                    key={app}
                    onClick={() => saveProfile({ transferApp: app })}
                    className={`chip px-3.5 py-1.5 text-xs ${me?.transferApp === app ? "chip-on" : ""}`}
                  >
                    {app}
                  </span>
                ))}
              </div>
            }
          />

          <div className="flex items-center pt-5">
            <span onClick={logout} className="cursor-pointer text-[13px] font-extrabold tracking-[.1em] text-[#e14e2b]">
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
