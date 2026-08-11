"use client";

import { useStore } from "@/lib/store";
import type { PageKey } from "@/lib/types";

const TITLES: Record<PageKey, string> = {
  login: "로그인",
  home: "홈",
  detail: "공고 상세",
  my: "내 공구",
  chat: "채팅",
  pay: "대파페이",
  new: "공구 올리기",
  set: "설정",
  settle: "정산",
};

export default function TopBar() {
  const page = useStore((s) => s.page);
  const go = useStore((s) => s.go);
  const me = useStore((s) => s.me);
  const toggleProfile = useStore((s) => s.toggleProfile);
  return (
    <div className="flex flex-none items-center gap-3 border-b border-[#dde9dc] bg-white px-6 py-3">
      <div className="font-jua text-[19px]">{TITLES[page]}</div>
      <span className="flex-1" />
      <div
        onClick={() => go("new")}
        className="cursor-pointer rounded-[10px] bg-[#1f8a4c] px-3.5 py-2 text-[13.5px] font-bold text-white hover:bg-[#187741]"
      >
        + 공구 올리기
      </div>
      <div
        onClick={toggleProfile}
        title={me?.nickname}
        className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-[#9fd4ae] bg-[#cde8d2] font-extrabold text-[#14532d]"
      >
        {me?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 소셜 아바타는 외부 도메인이라 next/image 설정 없이 쓴다
          <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          (me?.nickname[0] ?? "파")
        )}
      </div>
    </div>
  );
}
