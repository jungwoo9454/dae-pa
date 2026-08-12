"use client";

import { useStore } from "@/lib/store";
import { useRealtimeDeals } from "@/lib/use-realtime-deals";
import TopBar from "./top-bar";
import ProfilePopover from "./profile-popover";
import NotiPopover from "./noti-popover";
import DongBanner from "./dong-banner";
import AuthView from "./views/auth";
import HomeView from "./views/home";
import DetailView from "./views/detail";
import MyView from "./views/my";
import ChatView from "./views/chat";
import SettleView from "./views/settle";
import PayView from "./views/pay";
import NewDealView from "./views/new-deal";
import SettingsView from "./views/settings";

export default function App() {
  const page = useStore((s) => s.page);
  const sel = useStore((s) => s.sel);
  const profileOpen = useStore((s) => s.profileOpen);
  const notiOpen = useStore((s) => s.notiOpen);
  // group_buys 구독은 홈·상세에만 있어서, pay·채팅 화면에 있는 동안 일어난 settling→completed
  // 전이(전원 입금)를 못 받아 채팅방이 안 잠기고 배지가 '정산중'에 멈춘다. 전역으로 한 번 더 건다
  // (subscribePg 가 토픽 단위로 중복 구독을 합쳐줘서 홈·상세와 겹쳐도 채널은 하나다).
  useRealtimeDeals();
  if (page === "login") return <AuthView />;
  return (
    // 좌측 사이드바 → 상단 단말 바 (#143). 화면은 데스크(회색) 위에 전표로 얹힌다
    <div className="flex h-screen flex-col overflow-hidden bg-[#e4e4e0] text-[15.5px] text-[#1b1917]">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <TopBar />
        {profileOpen && <ProfilePopover />}
        {notiOpen && <NotiPopover />}
        {page === "home" && <DongBanner />}
        {page === "home" && <HomeView />}
        {/* key={sel} — 알림에서 다른 공구 상세로 바로 넘어갈 때 이전 공구의 에러 문구·
            열려있던 확인창이 그대로 따라붙는다. 공구가 바뀌면 통째로 새로 마운트한다. */}
        {page === "detail" && <DetailView key={sel} />}
        {page === "my" && <MyView />}
        {page === "chat" && <ChatView />}
        {page === "settle" && <SettleView />}
        {page === "pay" && <PayView />}
        {page === "new" && <NewDealView />}
        {page === "set" && <SettingsView />}
      </div>
    </div>
  );
}
