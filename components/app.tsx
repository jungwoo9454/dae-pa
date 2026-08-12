"use client";

import { useStore } from "@/lib/store";
import Sidebar from "./sidebar";
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
  if (page === "login") return <AuthView />;
  return (
    <div className="flex h-screen overflow-hidden bg-[#eef4ec] text-[14px] text-[#17301f]">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
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
