import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 소셜 로그인(PKCE) 리디렉트 착지점. code → 세션 쿠키 교환 후 홈으로 보낸다.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(origin);
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
