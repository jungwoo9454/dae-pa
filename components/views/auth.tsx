"use client";

import { MapPin, MessageCircle, ReceiptText, ShoppingBasket } from "lucide-react";
import { isSubmitEnter } from "@/lib/keys";
import { useStore } from "@/lib/store";

/** 구글 공식 4색 마크 — lucide 에는 브랜드 아이콘이 없어서 SVG 로 둔다 (#81) */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/** 깃허브 마크 — lucide-react v1 에서 브랜드 아이콘(Github)이 빠져서 인라인으로 둔다 (#81) */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** 소셜 영역과 이메일 폼을 갈라 주는 섹션 라벨 (#81) */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 flex items-center gap-2.5 text-[11.5px] font-extrabold tracking-[.5px] text-[#6b8573]">
      <div className="h-px flex-1 bg-[#e2eee2]" />
      {children}
      <div className="h-px flex-1 bg-[#e2eee2]" />
    </div>
  );
}

export default function AuthView() {
  const authMode = useStore((s) => s.authMode);
  const auth = useStore((s) => s.auth);
  const dongOk = useStore((s) => s.dongOk);
  const dongValue = useStore((s) => s.dongValue);
  const setDongValue = useStore((s) => s.setDongValue);
  const confirmDong = useStore((s) => s.confirmDong);
  const authBusy = useStore((s) => s.authBusy);
  const authError = useStore((s) => s.authError);
  const setAuth = useStore((s) => s.setAuth);
  const switchAuthMode = useStore((s) => s.switchAuthMode);
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

          {/* 소셜·이메일 어느 쪽에서 난 오류든 보이도록 카드 위쪽에 둔다 (#81) */}
          {authError && (
            <div className="rounded-[10px] bg-[#fdecec] px-3 py-2 text-[12.5px] font-bold text-[#b3261e]">
              {authError}
            </div>
          )}

          {/* 1) 소셜 — 깃허브·구글 계정으로 바로 시작 */}
          <SectionLabel>{isSignup ? "간편하게 시작" : "간편 로그인"}</SectionLabel>
          <div
            onClick={() => signInWithOAuth("github")}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-[11px] bg-[#24292f] p-[11px] font-extrabold text-white hover:brightness-125"
          >
            <GithubMark className="h-[18px] w-[18px] flex-none" />
            깃허브로 3초 만에 시작
          </div>
          <div
            onClick={() => signInWithOAuth("google")}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-[#d5e6d6] p-[11px] font-bold hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
          >
            <GoogleMark className="h-[18px] w-[18px] flex-none" />
            구글로 계속하기
          </div>

          {/* 2) 이메일 — 대파 자체 계정. 위 소셜과 다른 수단이라는 걸 라벨로 분명히 한다 */}
          <SectionLabel>{isSignup ? "이메일로 시작" : "이메일로 로그인"}</SectionLabel>
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
            <div className="flex flex-col gap-2 rounded-[11px] border-[1.5px] border-dashed border-[#9fd4ae] bg-[#f5faf4] px-3.5 py-[11px]">
              <div className="flex items-center gap-[9px]">
                <MapPin aria-hidden className="h-[18px] w-[18px] flex-none text-[#1f8a4c]" />
                <div className="flex-1">
                  <div className="text-[13.5px] font-extrabold">동네 인증</div>
                  <div className="text-xs text-[#6b8573]">
                    {dongOk ? `${dongValue} 인증 완료 ✓` : "우리 동네를 직접 적어주세요"}
                  </div>
                </div>
              </div>
              {!dongOk && (
                <div className="flex gap-2">
                  <input
                    value={dongValue}
                    onChange={(e) => setDongValue(e.target.value)}
                    onKeyDown={(e) => isSubmitEnter(e) && confirmDong()}
                    placeholder="동네 이름 — 예: 역삼동"
                    className="input-base min-w-0 flex-1"
                  />
                  <div
                    onClick={confirmDong}
                    className="flex-none cursor-pointer rounded-[9px] bg-[#1f8a4c] px-3 py-[7px] text-[12.5px] font-extrabold text-white hover:brightness-105"
                  >
                    확정
                  </div>
                </div>
              )}
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
