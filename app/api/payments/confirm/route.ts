// app/api/payments/confirm/route.ts
import { createClient } from "@/lib/supabase/server";

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

/**
 * GET /api/payments/confirm — 토스 결제창의 successUrl (#14).
 *
 * 결제창은 인증만 끝낸 상태로 브라우저를 여기로 돌려보낸다. 승인(confirm)을 호출해야
 * 실제 결제가 확정되므로, 지갑 충전은 반드시 이 응답을 받은 뒤에만 한다.
 *
 * ⚠️ 쿼리(paymentKey·orderId·amount)는 브라우저를 거쳐 오므로 믿지 않는다.
 *    충전 금액은 토스가 확정해준 totalAmount 만 쓴다 — 쿼리 amount 를 그대로 쓰면
 *    주소창에서 금액을 바꿔 무한 충전할 수 있다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => Response.redirect(new URL(`/?${q}`, url.origin), 303);

  const paymentKey = url.searchParams.get("paymentKey");
  const orderId = url.searchParams.get("orderId");
  const amount = Number(url.searchParams.get("amount"));
  if (!paymentKey || !orderId || !Number.isInteger(amount) || amount <= 0) return back("topup=fail");

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    console.error("[payments/confirm] TOSS_SECRET_KEY 가 없다");
    return back("topup=fail");
  }

  // 승인 전에 먼저 확인한다 — 세션이 없으면 누구 지갑에 넣을지 알 수 없다.
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return back("topup=fail");

  // Idempotency-Key 를 일부러 안 붙인다. 뒤로가기·새로고침으로 같은 paymentKey 가
  // 두 번 들어오면 토스가 ALREADY_PROCESSED_PAYMENT 로 막아주는 게 중복 충전 방지가 된다.
  const res = await fetch(TOSS_CONFIRM_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const payment = await res.json();
  if (!res.ok) {
    console.error("[payments/confirm]", payment.code, payment.message);
    return back("topup=fail");
  }

  const { error } = await sb.rpc("topup_wallet", { p_amount: payment.totalAmount });
  if (error) {
    // 돈은 승인됐는데 지갑 반영만 실패한 상태 — 데모에선 로그로 충분하다.
    // ponytail: 보상 취소(cancel API) 생략, 실서비스면 여기서 결제 취소 호출
    console.error("[payments/confirm] topup_wallet", error.message);
    return back("topup=fail");
  }

  return back("topup=ok");
}
