"use client";

import { Toggle } from "@/components/ui";
import { useStore } from "@/lib/store";

function Row({
  title,
  sub,
  right,
  clickable,
}: {
  title: string;
  sub: string;
  right: React.ReactNode;
  clickable?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-[#eef4ec] px-[18px] py-3.5 last:border-b-0 ${
        clickable ? "cursor-pointer hover:bg-[#fbfdf9]" : ""
      }`}
    >
      <div>
        <b>{title}</b>
        <div className="text-xs text-[#8aa392]">{sub}</div>
      </div>
      {right}
    </div>
  );
}

export default function SettingsView() {
  const n1 = useStore((s) => s.n1);
  const n2 = useStore((s) => s.n2);
  const toggleN1 = useStore((s) => s.toggleN1);
  const toggleN2 = useStore((s) => s.toggleN2);
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
        <Row title="정산 받을 계좌" sub="초록은행 1104-04" right={chevron} clickable />
        <Row title="기본 송금 앱" sub="토스" right={chevron} clickable />
        <Row title="계정 관리" sub="프로필 · 동네 인증 · 로그아웃" right={chevron} clickable />
      </div>
    </div>
  );
}
