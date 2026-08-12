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

const INPUT =
  "w-full rounded-[10px] border-[1.5px] border-[#d5e6d6] bg-white px-3.5 py-[9px] text-[13.5px] outline-none focus:border-[#1f8a4c]";
const BTN =
  "cursor-pointer rounded-[9px] bg-[#1f8a4c] px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-[#187741]";

function Row({
  title,
  sub,
  right,
  onClick,
  children,
}: {
  title: string;
  sub: string;
  right: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[#eef4ec] last:border-b-0">
      <div
        onClick={onClick}
        className={`flex items-center justify-between px-[18px] py-3.5 ${
          onClick ? "cursor-pointer hover:bg-[#fbfdf9]" : ""
        }`}
      >
        <div>
          <b>{title}</b>
          <div className="text-xs text-[#8aa392]">{sub}</div>
        </div>
        {right}
      </div>
      {children && <div className="border-t border-[#eef4ec] bg-[#fbfdf9] px-[18px] py-3.5">{children}</div>}
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

  const chevron = <span className="text-[#8aa392]">›</span>;

  return (
    <div className="max-w-[640px] flex-1 overflow-auto px-6 py-5">
      <div className="overflow-hidden rounded-2xl border border-[#dbe9da] bg-white">
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

        <Row
          title="정산 받을 계좌"
          sub={me?.bankAccount ?? "등록 안 함"}
          right={chevron}
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
          sub={me?.transferApp ?? "선택 안 함"}
          right={chevron}
          onClick={() => open("app")}
        >
          {edit === "app" && (
            <div className="flex flex-wrap gap-2">
              {TRANSFER_APPS.map((app) => {
                const on = me?.transferApp === app;
                return (
                  <div
                    key={app}
                    onClick={() => {
                      saveProfile({ transferApp: app });
                      setEdit(null);
                    }}
                    className={`cursor-pointer rounded-[9px] border-[1.5px] px-3 py-[7px] text-[13px] font-bold ${
                      on
                        ? "border-[#1f8a4c] bg-[#e9f6ec] text-[#166b3a]"
                        : "border-[#cfe4d0] hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
                    }`}
                  >
                    {app}
                  </div>
                );
              })}
            </div>
          )}
        </Row>

        <Row
          title="계정 관리"
          sub={[
            me?.nickname ?? "파티원",
            me?.dong,
            me?.provider ? (PROVIDER_LABEL[me.provider] ?? me.provider) : null,
            "로그아웃",
          ]
            .filter(Boolean)
            .join(" · ")}
          right={chevron}
          onClick={() => open("account")}
        >
          {edit === "account" && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <ImageUpload
                  kind="avatars"
                  value={me?.avatarUrl}
                  onChange={(url) => saveProfile({ avatarUrl: url })}
                  height={64}
                  round
                />
                <div className="text-[12.5px] text-[#6b8573]">
                  프로필 사진
                  <br />
                  정사각형으로 잘려요
                </div>
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
              <button
                onClick={logout}
                className="cursor-pointer self-start rounded-[9px] border-[1.5px] border-[#cfe4d0] px-3.5 py-2 text-[13px] font-bold text-[#94a89a] hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
              >
                로그아웃
              </button>
            </div>
          )}
        </Row>
      </div>
    </div>
  );
}
