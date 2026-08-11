import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";


// 서버 컴포넌트 · Route Handler 용. 요청마다 새로 만들어야 한다 (모듈 전역 캐싱 금지).
// @ts-ignore
export async function createClient() :any {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다.
            // 세션 갱신은 middleware.ts 가 맡아야 한다 — 인증 연동 시 함께 추가할 것 (아직 없음).
          }
        },
      },
    },
  );
}
