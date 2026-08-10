"use client";

import { useStore } from "@/lib/store";
import Sidebar from "./sidebar";
import TopBar from "./top-bar";
import ProfilePopover from "./profile-popover";
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
  const profileOpen = useStore((s) => s.profileOpen);
  return (
    <div className="flex h-screen overflow-hidden bg-[#eef4ec] text-[14px] text-[#17301f]">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar />
        {profileOpen && <ProfilePopover />}
        {page === "home" && <HomeView />}
        {page === "detail" && <DetailView />}
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
