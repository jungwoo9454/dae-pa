// app/api/deals/route.ts
import { createClient } from "@/lib/supabase/server"; //SUPERBASE추가후
import { CAT_EMOJI, MIN_DEADLINE_MIN } from "@/lib/deal";
import type { Category } from "@/lib/types";

/** 카테고리 이모지는 lib/deal.ts 의 CAT_EMOJI 한 벌만 쓴다 (#90) — DB 값이 정해진 카테고리를 벗어나면 기타 */
const emojiOf = (cat: string) => CAT_EMOJI[cat as Category] ?? CAT_EMOJI.기타;

/**
 * POST /api/deals
 * 새로운 공구를 생성합니다
 *
 * body: { title, cat, description?, total, goal, mins, place, store_link?, image_url?, min_order_amount?, delivery_fee? }
 * response: { id, title, cat, emoji, ... }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, cat, description, total, goal, mins, place, store_link, image_url, min_order_amount, delivery_fee } =
      body;

    // ✅ 1. 유효성 검증
    if (!title || !title.trim()) {
      return Response.json(
        { error: "제목은 필수입니다" },
        { status: 400 }
      );
    }

    const goalN = parseInt(goal) || 0;
    if (goalN < 2) {
      return Response.json(
        { error: "목표 인원은 2명 이상이어야 합니다" },
        { status: 400 }
      );
    }

    // ✅ 2. 배달음식 카테고리 검증 — 가게 링크·최소 주문 금액·배달비가 필수, 총 금액은 선택 (#95)
    // 채팅에서 메뉴를 취합해야 총액을 알 수 있어서, 올릴 때는 최소 주문 금액으로 시작하고
    // 나중에 "총 금액 수정"으로 실제 금액으로 바꾼다.
    const isDelivery = cat === "배달음식";
    let totalN = parseInt(total) || 0;
    let minOrderN = 0;
    let deliveryFeeN = 0;

    if (isDelivery) {
      if (!store_link) {
        return Response.json(
          { error: "배달음식은 가게 링크가 필수입니다" },
          { status: 400 }
        );
      }
      minOrderN = parseInt(min_order_amount) || 0;
      if (minOrderN <= 0) {
        return Response.json(
          { error: "최소 주문 금액은 0보다 커야 합니다" },
          { status: 400 }
        );
      }
      if (delivery_fee === undefined || delivery_fee === null || String(delivery_fee).trim() === "") {
        return Response.json(
          { error: "배달비를 입력해주세요" },
          { status: 400 }
        );
      }
      deliveryFeeN = parseInt(delivery_fee) || 0;
      if (deliveryFeeN < 0) {
        return Response.json(
          { error: "배달비는 0 이상이어야 합니다" },
          { status: 400 }
        );
      }
      // 총 금액을 안 적으면 최소 주문 금액 + 배달비로 시작한다 — total_amount 는 DB에서 not null.
      // 배달비를 더하는 건 정산식이 total_amount 에 배달비가 포함돼 있다고 보기 때문이다
      // (supabase/schema.sql apply_settlement_split: 항목비 = total_amount - delivery_fee).
      if (totalN <= 0) totalN = minOrderN + deliveryFeeN;
    } else if (totalN <= 0) {
      return Response.json(
        { error: "총 금액은 0보다 커야 합니다" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // 마감이 너무 짧으면 아무도 못 보고 끝난다 — 폼에서도 막지만 서버에서도 거부한다.
    // || 60 폴백을 두면 0 을 보냈을 때 조용히 60분짜리가 만들어진다 (#164) — 못 읽으면 그냥 거부.
    const minN = Number.parseInt(mins, 10);
    if (!Number.isFinite(minN)) {
      return Response.json({ error: "마감 시간을 입력해주세요" }, { status: 400 });
    }
    if (minN < MIN_DEADLINE_MIN) {
      return Response.json(
        { error: `마감 시간은 최소 ${MIN_DEADLINE_MIN}분이에요` },
        { status: 400 }
      );
    }

    const { data: newDeal, error } = await supabase
      .from('group_buys')
      .insert({
        host_id: user.id,
        title: title,
        description: (description ?? "").trim() || null,
        category: cat,
        total_amount: totalN,
        delivery_fee: deliveryFeeN,
        min_order_amount: isDelivery ? minOrderN : null,
        goal: goalN,
        joined: 1,
        deadline: new Date(Date.now() + minN * 60_000).toISOString(),
        store_link: store_link || "",
        place: place || "채팅방에서 협의",
        // 대표 이미지 — /api/upload 가 돌려준 R2 공개 URL (#15). 없으면 UI 가 이모지를 쓴다
        image_url: image_url || null,
        status: 'recruiting',
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const dealForClient = {
      id: Number(newDeal.id),
      emoji: emojiOf(newDeal.category),
      title: newDeal.title,
      cat: newDeal.category,
      description: newDeal.description ?? undefined,
      total: newDeal.total_amount,
      goal: newDeal.goal,
      joined: newDeal.joined,
      end: new Date(newDeal.deadline).getTime(),
      place: newDeal.place,
      imageUrl: newDeal.image_url,
      host: "나",
      status: newDeal.status,
      me: true,
      mine: true,
      deliveryFee: newDeal.delivery_fee,
      minOrderAmount: newDeal.min_order_amount,
    };

    return Response.json(dealForClient, { status: 201 });
  } catch (error) {
    console.error("[POST /api/deals]", error);
    return Response.json(
      { error: "공구 생성 중 오류 발생" },
      { status: 500 }
    );
   }
}


/**
 * GET /api/deals
 * ⚠️ 사용 안 함 — home.tsx는 lib/supabase/queries.ts의 fetchDeals()를 직접 호출한다
 * (Task 3, #4). 이 핸들러를 고쳐도 화면엔 반영되지 않는다 — 로직을 바꿔야 하면
 * fetchDeals() 쪽을 고치는 게 맞다. 삭제하지 않고 남겨둔 이유는 POST가 같은 파일에
 * 있어서(app/api/deals/route.ts) — POST /api/deals(공구 생성, new-deal.tsx가 씀)는 계속 쓴다.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 주최자는 UUID 가 아니라 닉네임으로 보여야 한다 — profiles 를 함께 읽는다
    const { data, error } = await supabase
      .from("group_buys")
      .select("*, profiles!host_id(nickname)")
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const deals = (data ?? []).map((row:any) => ({
      id: Number(row.id),
      emoji: emojiOf(row.category),
      title: row.title,
      cat: row.category,
      total: row.total_amount,
      goal: row.goal,
      joined: row.joined,
      end: new Date(row.deadline).getTime(),
      place: row.place,
      imageUrl: row.image_url,
      host: row.host_id === user?.id ? "나" : (row.profiles?.nickname ?? "주최자"),
      status: row.status,
      me: row.host_id === user?.id,
      mine: row.host_id === user?.id,
      deliveryFee: row.delivery_fee,
    }));

    return Response.json(deals);
  } catch (error) {
    console.error("[GET /api/deals]", error);
    return Response.json(
      { error: "공구 목록 조회 중 오류 발생" },
      { status: 500 }
    );
  }   
  
}
