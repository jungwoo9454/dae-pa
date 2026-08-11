// app/api/deals/route.ts
import { createClient } from "@/lib/supabase/server"; //SUPERBASE추가후
import type { Deal } from "@/lib/types";

/**
 * POST /api/deals
 * 새로운 공고를 생성합니다
 *
 * body: { title, cat, total, goal, mins, place, store_link? }
 * response: { id, title, cat, emoji, ... }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, cat, total, goal, mins, place, store_link } = body;

    // ✅ 1. 유효성 검증
    if (!title || !title.trim()) {
      return Response.json(
        { error: "제목은 필수입니다" },
        { status: 400 }
      );
    }

    const totalN = parseInt(total) || 0;
    const goalN = parseInt(goal) || 0;

    if (totalN <= 0) {
      return Response.json(
        { error: "총 금액은 0보다 커야 합니다" },
        { status: 400 }
      );
    }

    if (goalN < 2) {
      return Response.json(
        { error: "목표 인원은 2명 이상이어야 합니다" },
        { status: 400 }
      );
    }

    // ✅ 2. 배달음식 카테고리 검증
    if (cat === "배달음식" && !store_link) {
      return Response.json(
        { error: "배달음식은 가게 링크가 필수입니다" },
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

    // 임시 수정 (인증 스킵):
    // const user = {id: "30019992-ef88-40c5-b7a7-5cad74ea6a4e",};

    const minN = parseInt(mins) || 60;

    const { data: newDeal, error } = await supabase
      .from('group_buys')
      .insert({
        host_id: user.id,
        title: title,
        description: "",
        category: cat,
        total_amount: totalN,
        delivery_fee: 0,
        goal: goalN,
        joined: 1,
        deadline: new Date(Date.now() + minN * 60_000).toISOString(),
        store_link: store_link || "",
        place: place || "채팅방에서 협의",
        status: 'recruiting',
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

        // ⭐ 이 response만 남김
        if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const dealForClient = {
      id: Number(newDeal.id),
      emoji: getCategoryEmoji(newDeal.category),
      title: newDeal.title,
      cat: newDeal.category,
      total: newDeal.total_amount,
      goal: newDeal.goal,
      joined: newDeal.joined,
      end: new Date(newDeal.deadline).getTime(),
      place: newDeal.place,
      host: "나",
      status: newDeal.status,
      me: true,
      mine: true,
      deliveryFee: newDeal.delivery_fee,
    };

    return Response.json(dealForClient, { status: 201 });
  } catch (error) {
    console.error("[POST /api/deals]", error);
    return Response.json(
      { error: "공고 생성 중 오류 발생" },
      { status: 500 }
    );
   }
}


/**
 * GET /api/deals
 * ⚠️ 사용 안 함 — home.tsx는 lib/supabase/queries.ts의 fetchDeals()를 직접 호출한다
 * (Task 3, #4). 이 핸들러를 고쳐도 화면엔 반영되지 않는다 — 로직을 바꿔야 하면
 * fetchDeals() 쪽을 고치는 게 맞다. 삭제하지 않고 남겨둔 이유는 POST가 같은 파일에
 * 있어서(app/api/deals/route.ts) — POST /api/deals(공고 생성, new-deal.tsx가 씀)는 계속 쓴다.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("group_buys")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const hostIds = Array.from(new Set((data ?? []).map((row: any) => row.host_id).filter(Boolean)));
    const { data: profiles } = hostIds.length
      ? await supabase.from("profiles").select("id, nickname").in("id", hostIds)
      : { data: [] };
    const hostsById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.nickname]));

    const deals = (data ?? []).map((row:any) => ({
      id: Number(row.id),
      emoji: getCategoryEmoji(row.category),
      title: row.title,
      cat: row.category,
      total: row.total_amount,
      goal: row.goal,
      joined: row.joined,
      end: new Date(row.deadline).getTime(),
      place: row.place,
      host: hostsById.get(row.host_id) ?? "주최자",
      status: row.status,
      me: row.host_id === user?.id,
      mine: row.host_id === user?.id,
      deliveryFee: row.delivery_fee,
    }));

    return Response.json(deals);
  } catch (error) {
    console.error("[GET /api/deals]", error);
    return Response.json(
      { error: "공고 목록 조회 중 오류 발생" },
      { status: 500 }
    );
  }   
  
}

/**
 * 카테고리에 맞는 이모지 반환
 */
function getCategoryEmoji(cat: string): string {
  const emojiMap: Record<string, string> = {
    식료품: "🧅",
    배달음식: "🍗",
    생활용품: "🧻",
    대량구매: "📦",
    기타: "🎁",
  };
  return emojiMap[cat] || "🧅";
}
