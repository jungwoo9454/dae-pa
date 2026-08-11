"use client";

import { MapPin, MessageCircle, ReceiptText, ShoppingBasket } from "lucide-react";
import { isSubmitEnter } from "@/lib/keys";
import { DONG, useStore } from "@/lib/store";

export default function AuthView() {
  const authMode = useStore((s) => s.authMode);
  const auth = useStore((s) => s.auth);
  const dongOk = useStore((s) => s.dongOk);
  const authBusy = useStore((s) => s.authBusy);
  const authError = useStore((s) => s.authError);
  const setAuth = useStore((s) => s.setAuth);
  const switchAuthMode = useStore((s) => s.switchAuthMode);
  const verifyDong = useStore((s) => s.verifyDong);
  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const signInWithOAuth = useStore((s) => s.signInWithOAuth);

  const isSignup = authMode === "signup";
  const authOk =
    !authBusy &&
    (isSignup ? !!(auth.nick && auth.email && auth.pw && dongOk) : !!(auth.email && auth.pw));

  return (
    <div className="flex h-screen bg-[#eef4ec] text-[14px] text-[#17301f]">
      <div
        className="flex w-[44%] min-w-[340px] flex-col justify-center gap-[18px] p-14 text-white"
        style={{ background: "linear-gradient(160deg,#12311e,#1f8a4c)" }}
      >
        <div className="flex items-center gap-4">
          <img src="/logo-mark-light.svg" alt="" aria-hidden className="h-[74px] w-auto" />
          <span className="font-jua text-[64px] leading-none">
            대<span className="text-[#7fdc95]">파</span>
          </span>
        </div>
        <div className="font-jua text-[22px] text-[#d7efdc]">대용량 파티원 — 같이 사면 이득</div>
        <div className="mt-2.5 flex flex-col gap-3 text-[14.5px] text-[#bfe3c8]">
          <div className="flex items-center gap-2.5">
            <ShoppingBasket aria-hidden className="h-[18px] w-[18px] flex-none" /> 이웃과 대용량으로
            나눠 사고
          </div>
          <div className="flex items-center gap-2.5">
            <MessageCircle aria-hidden className="h-[18px] w-[18px] flex-none" /> 공구별 채팅방에서
            편하게 조율하고
          </div>
          <div className="flex items-center gap-2.5">
            <ReceiptText aria-hidden className="h-[18px] w-[18px] flex-none" /> 영수증 인증으로
            투명하게 1/N 정산
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        <div className="flex w-[360px] flex-col gap-3 rounded-[20px] border border-[#dbe9da] bg-white p-[30px] shadow-[0_14px_36px_rgba(18,70,38,.12)]">
          <div className="font-jua text-2xl">
            {isSignup ? "대파 시작하기" : "다시 만나서 반가워요"}
          </div>

          {isSignup && (
            <input
              value={auth.nick}
              onChange={(e) => setAuth({ nick: e.target.value })}
              placeholder="닉네임 — 예: 파밍맘"
              className="input-base"
            />
          )}
          <input
            value={auth.email}
            onChange={(e) => setAuth({ email: e.target.value })}
            placeholder="이메일"
            className="input-base"
          />
          <input
            value={auth.pw}
            onChange={(e) => setAuth({ pw: e.target.value })}
            onKeyDown={(e) => {
              if (isSubmitEnter(e) && authOk) (isSignup ? signUp : signIn)();
            }}
            type="password"
            placeholder="비밀번호"
            className="input-base"
          />

          {isSignup && (
            <div className="flex items-center gap-[9px] rounded-[11px] border-[1.5px] border-dashed border-[#9fd4ae] bg-[#f5faf4] px-3.5 py-[11px]">
              <MapPin aria-hidden className="h-[18px] w-[18px] flex-none text-[#1f8a4c]" />
              <div className="flex-1">
                <div className="text-[13.5px] font-extrabold">동네 인증</div>
                <div className="text-xs text-[#6b8573]">
                  {dongOk ? `${DONG} 인증 완료 ✓` : "현재 위치로 우리 동네를 인증해요"}
                </div>
              </div>
              <div
                onClick={verifyDong}
                className={`flex-none cursor-pointer rounded-[9px] px-3 py-[7px] text-[12.5px] font-extrabold hover:brightness-105 ${
                  dongOk ? "bg-[#e9f6ec] text-[#166b3a]" : "bg-[#1f8a4c] text-white"
                }`}
              >
                {dongOk ? "인증됨 ✓" : "인증하기"}
              </div>
            </div>
          )}

          {authError && (
            <div className="rounded-[10px] bg-[#fdecec] px-3 py-2 text-[12.5px] font-bold text-[#b3261e]">
              {authError}
            </div>
          )}

          <div
            onClick={() => {
              if (authOk) (isSignup ? signUp : signIn)();
            }}
            className={`rounded-xl p-[13px] text-center text-[15px] font-extrabold ${
              authOk
                ? "cursor-pointer bg-[#1f8a4c] text-white hover:brightness-105"
                : "cursor-default bg-[#e6efe4] text-[#8a9a8e]"
            }`}
          >
            {authBusy ? "잠시만요…" : isSignup ? "가입하고 시작하기" : "로그인"}
          </div>

          <div className="flex items-center gap-2.5 text-xs text-[#9db5a4]">
            <div className="h-px flex-1 bg-[#e2eee2]" />
            또는
            <div className="h-px flex-1 bg-[#e2eee2]" />
          </div>

          <div
            onClick={() => signInWithOAuth("kakao")}
            className="cursor-pointer rounded-[11px] bg-[#fee500] p-[11px] text-center font-extrabold text-[#191919] hover:brightness-[.97]"
          >
            <MessageCircle aria-hidden className="inline-block h-[1em] w-[1em] shrink-0 translate-y-[.09em]" /> 카카오로 3초 만에 시작
          </div>
          <div
            onClick={() => signInWithOAuth("google")}
            className="cursor-pointer rounded-[11px] border-[1.5px] border-[#d5e6d6] p-[11px] text-center font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
          >
            G  구글로 계속하기
          </div>

          <div className="mt-0.5 text-center text-[13px] text-[#6b8573]">
            {isSignup ? "이미 파티원이신가요?" : "아직 계정이 없나요?"}{" "}
            <span onClick={switchAuthMode} className="cursor-pointer font-extrabold text-[#1f8a4c]">
              {isSignup ? "로그인" : "회원가입"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
