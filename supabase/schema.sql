-- 대파(대용량 파티원) — Supabase 스키마
-- 적용: Supabase 대시보드 > SQL Editor에 전체 붙여넣고 실행 (처음 1회)
-- 사전 설정: Authentication > Providers 에서 Email / Google / GitHub 활성화
--            (소셜 제공자별 Client ID·Secret 입력 + 리디렉트 URL 등록은 대시보드에서)
--            데모 편의상 Email > "Confirm email" 은 끈다 (켜두면 가입 직후 세션이 안 나옴)
--            URL Configuration > Redirect URLs 에 http://localhost:3000/auth/callback 등록

-- ─────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────

-- 이미 스키마를 돌린 프로젝트는 이 파일 전체 대신 아래 줄만 실행한다
--   alter table profiles add column if not exists dong text;                                        -- #2 동네
--   alter table profiles add column if not exists notify_deadline boolean not null default true;    -- #20 알림 토글
--   alter table profiles add column if not exists notify_payment  boolean not null default true;
--   alter table profiles add column if not exists auto_pay        boolean not null default true;    -- #14 정산 요청 자동 결제
--   grant update (nickname, avatar_url, dong, bank_account, transfer_app,
--                 notify_deadline, notify_payment, auto_pay) on profiles to authenticated;
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nickname      text not null,
  avatar_url    text,
  dong          text,          -- 회원가입 동네 인증 결과 (예: '역삼동')
  bank_account  text,          -- 정산 받을 계좌 (예: '초록은행 1104-04')
  transfer_app  text,          -- 기본 송금 앱 (예: '토스')
  notify_deadline boolean not null default true,  -- 마감 임박 알림 수신 (#20)
  notify_payment  boolean not null default true,  -- 입금 요청 알림 수신 (#20)
  auto_pay        boolean not null default true,  -- 정산 요청 자동 결제 (#14)
  trust_score   int not null default 100,
  created_at    timestamptz not null default now()
);

create table wallets (
  user_id uuid primary key references profiles(id) on delete cascade,
  balance int not null default 0 check (balance >= 0)
);

create table group_buys (
  id            bigint generated always as identity primary key,
  host_id       uuid not null references profiles(id) on delete cascade,
  title         text not null,
  description   text,
  category      text not null check (category in ('식료품','배달음식','생활용품','대량구매','기타')),
  store_link    text,
  total_amount  int  not null check (total_amount > 0),   -- 원 단위 정수. 배달음식은 최소주문금액으로 시작해 채팅 취합 후 수정
  delivery_fee  int  not null default 0 check (delivery_fee >= 0),
  -- 배달음식 카테고리 전용 — 가게 최소 주문 금액 (#95). 다른 카테고리는 null
  min_order_amount int check (min_order_amount is null or min_order_amount > 0),
  goal          int  not null check (goal > 1),           -- 목표 인원 = 정원
  joined        int  not null default 1 check (joined >= 0),  -- 주최자 포함
  deadline      timestamptz not null,
  place         text,
  -- 대표 이미지 — Cloudflare R2 공개 URL (#15). 없으면 UI 가 카테고리 이모지를 보여준다
  image_url     text,
  -- recruiting(모집중) → settling(정산중) → completed(마감), canceled
  -- '마감임박'은 상태가 아니라 deadline 1시간 전부터 UI에서 파생 (lib/deal.ts statusOf)
  status        text not null default 'recruiting' check (status in ('recruiting','settling','completed','canceled')),
  created_at    timestamptz not null default now(),
  constraint joined_within_goal check (joined <= goal)
);

create table participations (
  id            bigint generated always as identity primary key,
  group_buy_id  bigint not null references group_buys(id) on delete cascade,
  user_id       uuid   not null references profiles(id) on delete cascade,
  note          text,          -- "후라이드+콜라" 같은 개인 메모
  amount_due    int,           -- 정산 확정 시 채움 (그 전엔 null)
  is_paid       boolean not null default false,
  paid_at       timestamptz,
  joined_at     timestamptz not null default now(),
  unique (group_buy_id, user_id)
);

create table chat_rooms (
  id            bigint generated always as identity primary key,
  type          text not null check (type in ('lounge','group_buy')),
  group_buy_id  bigint unique references group_buys(id) on delete cascade,
  name          text not null,
  created_at    timestamptz not null default now()
);

create table messages (
  id          bigint generated always as identity primary key,
  room_id     bigint not null references chat_rooms(id) on delete cascade,
  user_id     uuid references profiles(id) on delete set null,  -- null = 시스템 메시지
  -- text: 일반, sys: 시스템, card: 공구 카드 말풍선(payload.group_buy_id)
  kind        text not null default 'text' check (kind in ('text','sys','card')),
  content     text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create table settlements (
  id            bigint generated always as identity primary key,
  group_buy_id  bigint not null unique references group_buys(id) on delete cascade,
  total_amount  int  not null check (total_amount > 0),  -- 수동 입력 확정 총액
  delivery_fee  int  not null default 0 check (delivery_fee >= 0),
  receipt_url   text,          -- Storage 'receipts' 버킷 (참고용 첨부, 자동 인식 없음)
  status        text not null default 'pending' check (status in ('pending','confirmed')),
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table settlement_votes (
  settlement_id bigint references settlements(id) on delete cascade,
  user_id       uuid   references profiles(id) on delete cascade,
  agree         boolean not null,
  created_at    timestamptz not null default now(),
  primary key (settlement_id, user_id)
);

create table wallet_transactions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references profiles(id) on delete cascade,
  kind          text not null check (kind in ('charge','withdraw','pay','receive')),
  amount        int  not null,   -- 부호 포함: 충전/수령 +, 결제/출금 -
  group_buy_id  bigint references group_buys(id) on delete set null,
  title         text not null,
  created_at    timestamptz not null default now()
);

create table notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null,   -- join / settle_start / total_changed / payment_reminder ...
  payload     jsonb,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on group_buys (status, deadline desc);
create index on participations (group_buy_id);
create index on participations (user_id);
create index on messages (room_id, created_at);
create index on notifications (user_id, is_read);
create index on wallet_transactions (user_id, created_at desc);

-- ─────────────────────────────────────────────
-- 2. 가입 트리거 — auth.users 생성 시 프로필·지갑 자동 생성 (#2)
-- ─────────────────────────────────────────────

-- 닉네임·아바타는 제공자마다 키가 다르다. 이메일 폼은 nickname 을 직접 넣지만
-- 구글은 full_name/name + avatar_url(picture), 깃허브는 name(비어있을 수 있음)/user_name(login) + avatar_url 로 온다.
-- 하나라도 못 찾으면 기존처럼 '이웃abcd' 로 떨어진다.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  m := new.raw_user_meta_data;   -- null 이어도 아래 ->> 가 전부 null 로 떨어져 기본값으로 감
  insert into public.profiles (id, nickname, avatar_url, dong)
  values (
    new.id,
    coalesce(
      nullif(m->>'nickname', ''),        -- 이메일 회원가입 폼
      nullif(m->>'full_name', ''),       -- Google
      nullif(m->>'name', ''),            -- Google / GitHub
      nullif(m->>'user_name', ''),       -- GitHub (login) — 이름 미설정 계정의 최후 방어선
      '이웃' || left(new.id::text, 4)
    ),
    coalesce(nullif(m->>'avatar_url', ''), nullif(m->>'picture', '')),
    nullif(m->>'dong', '')             -- 이메일 회원가입 폼의 동네 인증 (소셜은 null)
  );
  insert into public.wallets (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 공구를 만들면 공구 채팅방이 자동으로 생기고, 주최자가 첫 참여자로 들어간다 (#8).
-- chat_rooms / participations 에는 클라이언트 INSERT 정책이 없으므로(#1 규약)
-- 이 두 행은 오직 이 트리거(security definer)를 통해서만 만들어진다.
-- amount_due 는 정산 확정 때 채우므로 여기서는 null.
create or replace function public.on_group_buy_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.chat_rooms (type, group_buy_id, name)
  values ('group_buy', new.id, new.title);

  insert into public.participations (group_buy_id, user_id)
  values (new.id, new.host_id)
  on conflict (group_buy_id, user_id) do nothing;

  return new;
end $$;

create trigger on_group_buy_created
  after insert on group_buys
  for each row execute function public.on_group_buy_created();

-- 공구 제목이 바뀌면 채팅방 이름도 따라간다 (목록에서 방을 못 찾는 것 방지).
create or replace function public.sync_chat_room_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.title is distinct from old.title then
    update public.chat_rooms set name = new.title where group_buy_id = new.id;
  end if;
  return new;
end $$;

create trigger on_group_buy_title_changed
  after update of title on group_buys
  for each row execute function public.sync_chat_room_name();

-- 시스템 메시지 (#9) — kind='sys' 는 messages_own_insert 정책상 클라이언트가 넣을 수 없다.
-- 참여·마감·금액변경·정산 이벤트 RPC(#5·#12·#16·#17·#18)가 이 함수를 호출해 기록한다.
-- 문구는 lib/sys-messages.ts 의 sysText 와 동일하게 맞춘다.
-- authenticated 에는 execute 를 주지 않는다 → 클라이언트가 시스템 메시지를 위조할 수 없다.
-- (다른 security definer RPC 는 소유자 권한으로 실행되므로 호출 가능)
create or replace function public.post_system_message(p_group_buy_id bigint, p_text text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_room_id bigint; v_id bigint;
begin
  select id into v_room_id from public.chat_rooms where group_buy_id = p_group_buy_id;
  if v_room_id is null then
    raise exception '공구 % 의 채팅방이 없습니다', p_group_buy_id;
  end if;

  insert into public.messages (room_id, user_id, kind, content)
  values (v_room_id, null, 'sys', p_text)   -- user_id null = 시스템
  returning id into v_id;

  return v_id;
end $$;

-- ─────────────────────────────────────────────
-- 2-0. 참여 RPC (#5) — 선착순 정원을 서버에서 원자적으로 처리한다.
--    클라이언트에서 joined < goal 을 미리 체크해도 동시 클릭 레이스는 못 막는다 —
--    UPDATE ... WHERE joined < goal ... RETURNING 패턴으로 단일 트랜잭션 안에서
--    "정원 확인 + 카운터 증가"를 원자적으로 묶는다. 행이 안 돌아오면(not found)
--    마감·정원 초과·중복 참여 중 하나 — 클라이언트는 이 예외 메시지를 그대로 보여준다.
-- ─────────────────────────────────────────────
create or replace function public.join_group_buy(p_group_buy_id bigint)
returns group_buys
language plpgsql security definer set search_path = public as $$
declare
  g          group_buys;
  v_nickname text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  -- 정원(joined < goal) + 모집중(status='recruiting') + 마감 전(deadline > now())
  -- + 중복 참여 아님을 한 UPDATE의 WHERE 절에서 동시에 검사한다. 행 잠금이 걸리는
  -- 동안 다른 트랜잭션은 대기하므로 동시 클릭 레이스가 여기서 직렬화된다.
  -- 정원에 도달하는 참여면 같은 UPDATE에서 바로 settling 으로 전환한다.
  update public.group_buys
     set joined = joined + 1,
         status = case when joined + 1 >= goal then 'settling' else status end
   where id = p_group_buy_id
     and status = 'recruiting'
     and deadline > now()
     and joined < goal
     and not exists (
       select 1 from public.participations p
        where p.group_buy_id = group_buys.id and p.user_id = auth.uid()
     )
  returning * into g;

  if not found then
    raise exception '참여할 수 없는 공구입니다 (마감·정원 초과·중복 참여)';
  end if;

  -- participations 에 INSERT 정책이 없으므로(설계 규약, 섹션 3) 이 RPC 안에서만 넣을 수 있다.
  -- unique(group_buy_id, user_id) 제약이 위 not exists 체크의 최종 안전망 역할도 한다.
  insert into public.participations (group_buy_id, user_id) values (g.id, auth.uid());

  select nickname into v_nickname from public.profiles where id = auth.uid();

  perform public.post_system_message(g.id,
    v_nickname || '님이 참여했어요 (' || g.joined || '/' || g.goal || ')');

  -- 주최자에게 참여 알림 (#13 'join' 타입 — 아이콘은 noti-popover.tsx ICON 맵에 이미 있음)
  insert into public.notifications (user_id, type, payload)
  values (g.host_id, 'join',
    jsonb_build_object('dealId', g.id, 'text', v_nickname || '님이 ' || g.title || ' 공구에 참여했어요'));

  -- 정원 도달 → 자동 정산 전환 + 참여자 전원에게 알림
  if g.status = 'settling' then
    perform public.post_system_message(g.id, '목표 달성! 정산이 시작돼요 🎉');

    insert into public.notifications (user_id, type, payload)
    select p.user_id, 'settle_start',
           jsonb_build_object('dealId', g.id, 'text', g.title || ' 목표 달성! 정산이 시작돼요')
      from public.participations p where p.group_buy_id = g.id;
  end if;

  return g;
end $$;

-- 2-1. 총 금액 변경 RPC (#12)
-- 주최자만 모집중·마감 전 총액을 수정할 수 있으며, 서버에서 권한과 상태를 검증한다.
create or replace function public.change_total_amount(
  p_group_buy_id bigint,
  p_new_total integer
)
returns public.group_buys
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.group_buys%rowtype;
  v_old_total integer;
  v_per_person integer;
begin
  if p_new_total is null or p_new_total <= 0 then
    raise exception '총 금액은 0보다 커야 합니다';
  end if;

  select *
    into g
    from public.group_buys
   where id = p_group_buy_id
   for update;

  if not found then
    raise exception '공구를 찾을 수 없습니다';
  end if;

  if g.host_id is distinct from auth.uid() then
    raise exception '주최자만 총 금액을 수정할 수 있습니다';
  end if;

  if g.status <> 'recruiting' then
    raise exception '모집중인 공구만 총 금액을 수정할 수 있습니다';
  end if;

  if g.deadline <= now() then
    raise exception '마감된 공구는 수정할 수 없습니다';
  end if;

  if g.total_amount = p_new_total then
    return g;
  end if;

  v_old_total := g.total_amount;

  update public.group_buys
     set total_amount = p_new_total
   where id = p_group_buy_id
   returning * into g;

  -- 배달음식은 메뉴가 사람마다 달라 총액을 안 나누고 배달비만 엔빵해서 보여준다 (#95, lib/deal.ts perAmount 와 동일 기준)
  if g.category = '배달음식' then
    v_per_person := ceil(g.delivery_fee::numeric / greatest(g.joined, 1))::integer;
  else
    v_per_person := ceil((g.total_amount + g.delivery_fee)::numeric / greatest(g.joined, 1))::integer;
  end if;

  insert into public.notifications (user_id, type, payload)
  select p.user_id,
         'total_changed',
         jsonb_build_object(
           'dealId', g.id,
           'text', g.title || ' 총액이 '
             || to_char(v_old_total, 'FM999,999,999') || '원에서 '
             || to_char(g.total_amount, 'FM999,999,999') || '원으로 변경됐어요'
         )
    from public.participations p
   where p.group_buy_id = g.id;

  perform public.post_system_message(
    g.id,
    '💰 총액 변경 ' || to_char(v_old_total, 'FM999,999,999') || '원 → '
      || to_char(g.total_amount, 'FM999,999,999') || '원 · 1인 '
      || to_char(v_per_person, 'FM999,999,999') || '원'
  );

  return g;
end;
$$;

revoke execute on function public.change_total_amount(bigint, integer)
  from public, anon;

grant execute on function public.change_total_amount(bigint, integer)
  to authenticated;

-- ─────────────────────────────────────────────
-- 2-2. 정산·지갑 RPC (#15~18, 팀원 C)
--
-- 시스템 메시지는 #9의 post_system_message(group_buy_id, text) 를 그대로 호출한다.
-- 문구는 lib/sys-messages.ts 의 sysText 와 맞춘다.
-- amount_due 는 join_group_buy 에서도 안 채운다(설계상 정산 시작 전까지 계속 null) —
-- apply_settlement_split 이 정산 확정 시점에 한 번에 채운다.
-- ─────────────────────────────────────────────

-- 확정 총액을 참여자 수만큼 균등 분배하고, 항목·배달비 나머지는 모두 주최자가 흡수한다.
-- (CLAUDE.md 규칙 4·5 — 배달비 항상 균등, 1/N 나머지는 주최자 부담)
create or replace function public.apply_settlement_split(
  p_group_buy_id bigint,
  p_total_amount int,
  p_delivery_fee int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_host_id uuid;
  v_n int;
  v_item_total int;
  v_item_base int;
  v_item_remainder int;
  v_delivery_base int;
  v_delivery_remainder int;
begin
  select host_id into v_host_id from public.group_buys where id = p_group_buy_id;
  select count(*) into v_n from public.participations where group_buy_id = p_group_buy_id;
  if v_n = 0 then return; end if;

  v_item_total := p_total_amount - p_delivery_fee;
  v_item_base := v_item_total / v_n;
  v_item_remainder := v_item_total - v_item_base * v_n;
  v_delivery_base := p_delivery_fee / v_n;
  v_delivery_remainder := p_delivery_fee - v_delivery_base * v_n;

  update public.participations
    set amount_due = v_item_base + v_delivery_base
  where group_buy_id = p_group_buy_id and user_id <> v_host_id;

  update public.participations
    set amount_due = v_item_base + v_item_remainder + v_delivery_base + v_delivery_remainder
  where group_buy_id = p_group_buy_id and user_id = v_host_id;
end $$;

-- 정산 시작/총액 확정 (#15). 영수증 있으면 즉시 확정, 없으면 과반 동의 대기(pending).
create or replace function public.confirm_settlement(
  p_group_buy_id bigint,
  p_total_amount int,
  p_delivery_fee int default 0,
  p_receipt_url text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_host_id uuid;
  v_settlement_id bigint;
  v_status text;
begin
  select host_id into v_host_id from public.group_buys where id = p_group_buy_id;
  if v_host_id is null then
    raise exception '공구를 찾을 수 없습니다';
  end if;
  if v_host_id <> auth.uid() then
    raise exception '주최자만 총액을 확정할 수 있습니다';
  end if;
  if p_total_amount <= 0 then
    raise exception '총액은 0보다 커야 합니다';
  end if;

  v_status := case when p_receipt_url is not null then 'confirmed' else 'pending' end;

  insert into public.settlements (group_buy_id, total_amount, delivery_fee, receipt_url, status, confirmed_at)
  values (p_group_buy_id, p_total_amount, p_delivery_fee, p_receipt_url, v_status,
          case when v_status = 'confirmed' then now() else null end)
  on conflict (group_buy_id) do update
    set total_amount = excluded.total_amount,
        delivery_fee = excluded.delivery_fee,
        receipt_url = excluded.receipt_url,
        status = excluded.status,
        confirmed_at = excluded.confirmed_at
  returning id into v_settlement_id;

  if v_status = 'confirmed' then
    perform public.apply_settlement_split(p_group_buy_id, p_total_amount, p_delivery_fee);
    perform public.post_system_message(p_group_buy_id,
      '🧾 영수증 인증 완료 · 총 ' || to_char(p_total_amount, 'FM999,999,999') || '원 · 금액 잠금');
  else
    perform public.post_system_message(p_group_buy_id,
      '총 ' || to_char(p_total_amount, 'FM999,999,999') || '원으로 정산 요청 · 영수증 없이 참여자 과반 동의로 확정돼요');
  end if;

  return v_settlement_id;
end $$;

-- 영수증 없을 때 과반 동의로 확정 (#15). 본인 투표는 settlement_votes_own 정책으로
-- 클라이언트가 먼저 직접 insert 한 뒤, 이 RPC로 과반 여부를 판정·확정한다.
create or replace function public.finalize_settlement_vote(p_settlement_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_group_buy_id bigint;
  v_total_amount int;
  v_delivery_fee int;
  v_status text;
  v_n int;
  v_agree int;
begin
  select group_buy_id, total_amount, delivery_fee, status
    into v_group_buy_id, v_total_amount, v_delivery_fee, v_status
  from public.settlements where id = p_settlement_id;

  if v_group_buy_id is null then
    raise exception '정산 정보를 찾을 수 없습니다';
  end if;
  if v_status = 'confirmed' then
    return true;
  end if;

  select count(*) into v_n from public.participations where group_buy_id = v_group_buy_id;
  select count(*) into v_agree from public.settlement_votes
    where settlement_id = p_settlement_id and agree = true;

  if v_agree * 2 <= v_n then
    return false;
  end if;

  update public.settlements set status = 'confirmed', confirmed_at = now() where id = p_settlement_id;
  perform public.apply_settlement_split(v_group_buy_id, v_total_amount, v_delivery_fee);
  perform public.post_system_message(v_group_buy_id,
    '✅ 참여자 과반 동의로 총 ' || to_char(v_total_amount, 'FM999,999,999') || '원 확정 · 금액 잠금');

  return true;
end $$;

-- 정산 분배 개별 조정 (#16). 배달비 제외 항목 금액만 조정 가능하고, 주최자 본인 몫은
-- 나머지로 자동 계산돼 합계가 항상 settlements.total_amount 와 같게 유지된다.
create or replace function public.adjust_participation_amount(p_participation_id bigint, p_new_amount int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_group_buy_id bigint;
  v_target_user uuid;
  v_host_id uuid;
  v_old_amount int;
  v_host_participation_id bigint;
  v_host_amount int;
  v_delta int;
begin
  select group_buy_id, user_id, coalesce(amount_due, 0)
    into v_group_buy_id, v_target_user, v_old_amount
  from public.participations where id = p_participation_id;

  if v_group_buy_id is null then
    raise exception '참여 정보를 찾을 수 없습니다';
  end if;

  select host_id into v_host_id from public.group_buys where id = v_group_buy_id;
  if v_host_id <> auth.uid() then
    raise exception '주최자만 금액을 조정할 수 있습니다';
  end if;
  if v_target_user = v_host_id then
    raise exception '주최자 본인 몫은 나머지로 자동 계산됩니다';
  end if;
  if p_new_amount < 0 then
    raise exception '금액은 0 이상이어야 합니다';
  end if;

  select id, coalesce(amount_due, 0) into v_host_participation_id, v_host_amount
  from public.participations where group_buy_id = v_group_buy_id and user_id = v_host_id;

  v_delta := p_new_amount - v_old_amount;

  update public.participations set amount_due = p_new_amount where id = p_participation_id;
  update public.participations set amount_due = v_host_amount - v_delta where id = v_host_participation_id;
end $$;

-- 전원 입금 완료 시 공구 마감 + 신뢰도 반영 (#17). pay_with_wallet·confirm_self_paid 에서
-- 입금 처리 직후 호출한다 — 직접 노출하지 않는다.
create or replace function public.complete_group_buy_if_all_paid(p_group_buy_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_unpaid int;
begin
  select count(*) into v_unpaid from public.participations
  where group_buy_id = p_group_buy_id and is_paid = false;

  if v_unpaid > 0 then return; end if;

  update public.group_buys set status = 'completed' where id = p_group_buy_id;

  update public.profiles set trust_score = trust_score + 1
  where id in (select user_id from public.participations where group_buy_id = p_group_buy_id);

  -- 문구는 lib/sys-messages.ts 의 sysText.allPaid() 와 맞춘다.
  perform public.post_system_message(p_group_buy_id, '전원 입금 완료! 공구가 마감됐어요 🎉');
end $$;

-- 미입금자 리마인드 (#17). 주최자만 호출 가능.
create or replace function public.remind_unpaid(p_group_buy_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_host_id uuid;
  v_names text;
begin
  select host_id into v_host_id from public.group_buys where id = p_group_buy_id;
  if v_host_id <> auth.uid() then
    raise exception '주최자만 리마인드를 보낼 수 있습니다';
  end if;

  select string_agg(p.nickname, ', ') into v_names
  from public.participations pt join public.profiles p on p.id = pt.user_id
  where pt.group_buy_id = p_group_buy_id and pt.is_paid = false;

  if v_names is null then return; end if;

  perform public.post_system_message(p_group_buy_id, '🔔 아직 입금 안 하신 분들 확인해주세요 — ' || v_names);
end $$;

-- 대파페이 잔액 결제 (#18). 검증→차감→입금 처리→내역 기록을 한 트랜잭션(RPC 1회 호출)
-- 안에서 원자적으로 처리한다. `for update` 로 잔액 행을 잠가 동시 결제 레이스를 막는다.
create or replace function public.pay_with_wallet(p_participation_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_group_buy_id bigint;
  v_user_id uuid;
  v_amount int;
  v_is_paid boolean;
  v_balance int;
  v_title text;
  v_nickname text;
begin
  select group_buy_id, user_id, amount_due, is_paid
    into v_group_buy_id, v_user_id, v_amount, v_is_paid
  from public.participations where id = p_participation_id;

  if v_group_buy_id is null then
    raise exception '참여 정보를 찾을 수 없습니다';
  end if;
  if v_user_id <> auth.uid() then
    raise exception '본인 결제만 처리할 수 있습니다';
  end if;
  if v_is_paid then
    raise exception '이미 입금 완료된 참여입니다';
  end if;
  if v_amount is null then
    raise exception '정산 총액이 아직 확정되지 않았습니다';
  end if;

  select balance into v_balance from public.wallets where user_id = v_user_id for update;
  if v_balance < v_amount then
    raise exception '잔액이 부족합니다';
  end if;

  update public.wallets set balance = balance - v_amount where user_id = v_user_id;
  update public.participations set is_paid = true, paid_at = now() where id = p_participation_id;

  select title into v_title from public.group_buys where id = v_group_buy_id;
  insert into public.wallet_transactions (user_id, kind, amount, group_buy_id, title)
  values (v_user_id, 'pay', -v_amount, v_group_buy_id, v_title || ' 정산');

  -- 문구는 lib/sys-messages.ts 의 sysText.paid(who, amount) 와 맞춘다.
  select nickname into v_nickname from public.profiles where id = v_user_id;
  perform public.post_system_message(v_group_buy_id,
    v_nickname || '님이 ' || to_char(v_amount, 'FM999,999,999') || '원 입금 완료 ✓ (대파페이)');

  perform public.complete_group_buy_if_all_paid(v_group_buy_id);
end $$;

-- 계좌·토스 셀프 체크 (#17·#18 — 대파페이가 아니라서 잔액 이동은 없다).
create or replace function public.confirm_self_paid(p_participation_id bigint, p_method text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_group_buy_id bigint;
  v_user_id uuid;
  v_amount int;
  v_is_paid boolean;
  v_label text;
  v_nickname text;
begin
  if p_method not in ('account', 'toss') then
    raise exception '잘못된 입금 수단입니다';
  end if;

  select group_buy_id, user_id, amount_due, is_paid
    into v_group_buy_id, v_user_id, v_amount, v_is_paid
  from public.participations where id = p_participation_id;

  if v_group_buy_id is null then
    raise exception '참여 정보를 찾을 수 없습니다';
  end if;
  if v_user_id <> auth.uid() then
    raise exception '본인 입금만 체크할 수 있습니다';
  end if;
  if v_is_paid then
    raise exception '이미 입금 완료된 참여입니다';
  end if;

  update public.participations set is_paid = true, paid_at = now() where id = p_participation_id;

  select nickname into v_nickname from public.profiles where id = v_user_id;
  v_label := case p_method when 'account' then '계좌 이체' else '토스 송금' end;
  perform public.post_system_message(v_group_buy_id,
    v_nickname || '님이 ' || to_char(v_amount, 'FM999,999,999') || '원 입금 완료 ✓ (' || v_label || ' · 셀프 체크)');

  perform public.complete_group_buy_if_all_paid(v_group_buy_id);
end $$;

-- 지갑 충전 (#14). wallets 는 authenticated 에 전체 권한이 열려 있어 RPC 없이도 되지만,
-- balance 증가·wallet_transactions 기록을 한 트랜잭션으로 묶어 원자적으로 처리한다.
create or replace function public.topup_wallet(p_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  if p_amount <= 0 then
    raise exception '충전 금액은 0보다 커야 합니다';
  end if;
  update public.wallets set balance = balance + p_amount where user_id = v_user_id;
  insert into public.wallet_transactions (user_id, kind, amount, title)
  values (v_user_id, 'charge', p_amount, '충전');
end $$;

-- 지갑 출금 (#14). `for update` 로 잔액 행을 잠가 동시 출금 레이스를 막는다.
create or replace function public.withdraw_wallet(p_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_balance int;
begin
  if p_amount <= 0 then
    raise exception '출금 금액은 0보다 커야 합니다';
  end if;
  select balance into v_balance from public.wallets where user_id = v_user_id for update;
  if v_balance < p_amount then
    raise exception '잔액이 부족합니다';
  end if;
  update public.wallets set balance = balance - p_amount where user_id = v_user_id;
  insert into public.wallet_transactions (user_id, kind, amount, title)
  values (v_user_id, 'withdraw', -p_amount, '출금');
end $$;

-- ─────────────────────────────────────────────
-- 2-2. 공구 취소 RPC (#29, 팀원 A)
-- ─────────────────────────────────────────────

-- 주최자 취소 (#29). 기획안 상태 머신의 "어느 단계에서든 주최자 취소 → canceled" 경로.
-- group_buys.status 는 컬럼 GRANT 로 클라이언트 UPDATE 가 막혀 있어 이 RPC 로만 canceled 가 된다.
-- 취소 시 부수효과: 채팅방 시스템 메시지 + 참여자 전원 알림(type='cancel').
create or replace function public.cancel_group_buy(p_group_buy_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_host_id uuid;
  v_status  text;
  v_title   text;
  v_refund  record;
begin
  select host_id, status, title into v_host_id, v_status, v_title
  from public.group_buys where id = p_group_buy_id for update;

  if v_host_id is null then
    raise exception '공구를 찾을 수 없습니다';
  end if;
  if v_host_id <> auth.uid() then
    raise exception '주최자만 공구를 취소할 수 있습니다';
  end if;
  if v_status not in ('recruiting', 'settling') then
    raise exception '이미 마감되었거나 취소된 공구입니다';
  end if;

  update public.group_buys set status = 'canceled' where id = p_group_buy_id;

  -- 문구는 lib/sys-messages.ts 의 sysText.canceled() 와 맞춘다.
  perform public.post_system_message(p_group_buy_id, '🚫 주최자가 공구를 취소했어요');

  -- 대파페이로 이미 낸 참여자 환불. pay_with_wallet 이 잔액만 깎았으니 그대로 되돌린다
  -- (계좌·토스로 낸 사람은 앱 밖 송금이라 주최자가 직접 돌려줘야 한다 — 아래 안내 메시지).
  for v_refund in
    select user_id, -amount as amt from public.wallet_transactions
    where group_buy_id = p_group_buy_id and kind = 'pay'
  loop
    update public.wallets set balance = balance + v_refund.amt where user_id = v_refund.user_id;
    insert into public.wallet_transactions (user_id, kind, amount, group_buy_id, title)
    values (v_refund.user_id, 'receive', v_refund.amt, p_group_buy_id, v_title || ' 취소 환불');

    insert into public.notifications (user_id, type, payload)
    values (v_refund.user_id, 'cancel',
            jsonb_build_object('text', v_title || ' 취소 · 대파페이 '
              || to_char(v_refund.amt, 'FM999,999,999') || '원 환불됐어요', 'dealId', p_group_buy_id));
  end loop;

  -- 앱 밖(계좌·토스)으로 낸 사람이 있으면 채팅방에 환불 안내를 남긴다.
  -- 문구는 lib/sys-messages.ts 의 sysText.cancelRefundOffApp() 와 맞춘다.
  if exists (
    select 1 from public.participations pt
    where pt.group_buy_id = p_group_buy_id and pt.is_paid
      and not exists (select 1 from public.wallet_transactions w
                      where w.group_buy_id = p_group_buy_id and w.kind = 'pay' and w.user_id = pt.user_id)
  ) then
    perform public.post_system_message(p_group_buy_id,
      '💸 계좌·토스로 입금한 분은 주최자가 직접 환불해 주세요');
  end if;

  -- 주최자 본인은 뺀다 (본인이 누른 행동이라 알림이 의미 없다).
  -- 환불 알림을 이미 받은 사람도 뺀다 — 같은 사실을 두 번 알리지 않는다.
  insert into public.notifications (user_id, type, payload)
  select pt.user_id, 'cancel',
         jsonb_build_object('text', v_title || ' 공구가 취소됐어요', 'dealId', p_group_buy_id)
  from public.participations pt
  where pt.group_buy_id = p_group_buy_id and pt.user_id <> v_host_id
    and not exists (select 1 from public.wallet_transactions w
                    where w.group_buy_id = p_group_buy_id and w.kind = 'pay' and w.user_id = pt.user_id);
end $$;

create or replace function public.delete_group_buy(p_group_buy_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_host_id uuid;
  v_status  text;
begin
  select host_id, status into v_host_id, v_status
  from public.group_buys where id = p_group_buy_id for update;

  if v_host_id is null then
    raise exception '공구를 찾을 수 없습니다';
  end if;
  if v_host_id <> auth.uid() then
    raise exception '주최자만 공구를 삭제할 수 있습니다';
  end if;
  if v_status <> 'recruiting' then
    raise exception '모집중인 공구만 삭제할 수 있습니다';
  end if;

  delete from public.group_buys where id = p_group_buy_id;
end $$;

-- ─────────────────────────────────────────────
-- 3. ⚠️ 설계 규약 — 상태 전이·타인 행 쓰기는 RPC로만
--
-- group_buys.status / joined / goal, 시스템 메시지(kind='sys'),
-- 남의 행(알림·지갑·amount_due·trust_score)은 아래 RLS + 컬럼 GRANT 로
-- 클라이언트에서 막혀 있다. 막히면 정책을 푸는 게 아니라
-- `security definer` RPC 를 하나 추가한다.
--
-- 이 파일(#1)은 테이블·RLS·GRANT까지만 담는다. 아래 RPC는 각 담당 이슈에서 추가한다:
--
--   #5  join_group_buy(id)      — ✅ 추가됨 (섹션 2-0). 선착순 정원 원자 처리.
--   #8  공구 생성 트리거         — ✅ 추가됨 (섹션 2, on_group_buy_created)
--   #9  시스템 메시지            — ✅ 추가됨 (섹션 2, post_system_message)
--   #12 금액 변경 / #13 알림
--   #15 confirm_settlement·finalize_settlement_vote — ✅ 추가됨 (섹션 2-1)
--   #16 adjust_participation_amount               — ✅ 추가됨 (섹션 2-1)
--   #17 complete_group_buy_if_all_paid·remind_unpaid — ✅ 추가됨 (섹션 2-1)
--   #18 pay_with_wallet·confirm_self_paid          — ✅ 추가됨 (섹션 2-1)
--   #29 cancel_group_buy(id)   주최자 취소 → canceled          — ✅ 추가됨 (섹션 2-2)
--
-- 참고 구현: 브랜치 `feat/#1-supabase-schema` 에 join_group_buy·공구 생성 트리거 원본이 있다.
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- 4. RLS — 읽기는 로그인 사용자 전체 공개, 쓰기는 본인/주최자만
-- ─────────────────────────────────────────────

alter table profiles            enable row level security;
alter table wallets             enable row level security;
alter table group_buys          enable row level security;
alter table participations      enable row level security;
alter table chat_rooms          enable row level security;
alter table messages            enable row level security;
alter table settlements         enable row level security;
alter table settlement_votes    enable row level security;
alter table wallet_transactions enable row level security;
alter table notifications       enable row level security;

create policy profiles_read      on profiles for select to authenticated using (true);
create policy profiles_own_write on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy wallets_own on wallets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy group_buys_read on group_buys for select to authenticated using (true);
create policy group_buys_host_insert on group_buys for insert to authenticated
  with check (host_id = auth.uid() and joined = 1 and status = 'recruiting');
-- 총 금액 변경은 주최자 + 모집중일 때만. 정산 진입 후 서버에서 거부된다.
-- deadline 이 지나면 DB status 는 그대로 recruiting 이지만 UI 상 '마감'이라 수정도 막는다.
create policy group_buys_host_update on group_buys for update to authenticated
  using (host_id = auth.uid() and status = 'recruiting' and deadline > now())
  with check (host_id = auth.uid());

create policy participations_read on participations for select to authenticated using (true);
-- INSERT 정책 없음 → 참여는 join_group_buy RPC 로만 가능 (동시 클릭 레이스 차단, 섹션 2-0)
create policy participations_own_update on participations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chat_rooms_read on chat_rooms for select to authenticated using (true);

create policy messages_read on messages for select to authenticated using (true);
-- 시스템 메시지(kind='sys')는 클라이언트가 직접 못 넣는다 — 서버 함수만
create policy messages_own_insert on messages for insert to authenticated
  with check (user_id = auth.uid() and kind in ('text','card'));

create policy settlements_read on settlements for select to authenticated using (true);
create policy settlements_host_write on settlements for all to authenticated
  using (exists (select 1 from group_buys g where g.id = group_buy_id and g.host_id = auth.uid()))
  with check (exists (select 1 from group_buys g where g.id = group_buy_id and g.host_id = auth.uid()));

create policy settlement_votes_read on settlement_votes for select to authenticated using (true);
create policy settlement_votes_own on settlement_votes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy wallet_tx_own on wallet_transactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_own on notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 5. GRANT — Data API 노출
--    2026-04 변경으로 새 public 테이블은 자동 노출되지 않는다.
--    GRANT 가 없으면 RLS 와 무관하게 클라이언트에서 테이블이 아예 안 보인다.
--    비로그인(anon)은 아무것도 못 한다 — 익명 로그인해도 역할은 authenticated 다.
-- ─────────────────────────────────────────────

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- 상태 머신·인원 카운터는 컬럼 단위로 UPDATE 권한을 뺀다 → security definer RPC 로만 변경 가능
-- total_amount 도 뺀다 — 알림·시스템 메시지와 한 트랜잭션이어야 해서 change_total_amount RPC 전용 (#12)
revoke update on group_buys from authenticated;
grant update (title, description, category, store_link,
              delivery_fee, deadline, place, image_url)
  on group_buys to authenticated;

-- amount_due 는 정산 RPC(#16)가 쓴다. 클라이언트는 본인 메모·입금 체크만.
revoke update on participations from authenticated;
grant update (note, is_paid, paid_at) on participations to authenticated;

-- trust_score 는 정산 완료 RPC(#17)가 쓴다.
revoke update on profiles from authenticated;
grant update (nickname, avatar_url, dong, bank_account, transfer_app,
              notify_deadline, notify_payment, auto_pay) on profiles to authenticated;

-- 트리거 함수는 /rest/v1/rpc/ 로 노출될 이유가 없다. EXECUTE 권한은 CREATE TRIGGER 시점에만
-- 검사되므로 전부 회수해도 트리거는 정상 동작한다.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.on_group_buy_created() from public, anon, authenticated;
revoke execute on function public.sync_chat_room_name() from public, anon, authenticated;
revoke execute on function public.post_system_message(bigint, text) from public, anon, authenticated;

-- 참여 RPC (#5) — 클라이언트(참여 버튼)에서 직접 호출한다
revoke execute on function public.join_group_buy(bigint) from public, anon;
grant  execute on function public.join_group_buy(bigint) to authenticated;

-- 정산·지갑 RPC (#15~18) — apply_settlement_split·complete_group_buy_if_all_paid 는
-- 다른 RPC 안에서만 쓰는 내부 함수라 authenticated 에도 안 연다.
revoke execute on function public.apply_settlement_split(bigint, int, int) from public, anon, authenticated;
revoke execute on function public.complete_group_buy_if_all_paid(bigint) from public, anon, authenticated;

revoke execute on function public.confirm_settlement(bigint, int, int, text) from public, anon;
grant  execute on function public.confirm_settlement(bigint, int, int, text) to authenticated;

revoke execute on function public.finalize_settlement_vote(bigint) from public, anon;
grant  execute on function public.finalize_settlement_vote(bigint) to authenticated;

revoke execute on function public.adjust_participation_amount(bigint, int) from public, anon;
grant  execute on function public.adjust_participation_amount(bigint, int) to authenticated;

revoke execute on function public.pay_with_wallet(bigint) from public, anon;
grant  execute on function public.pay_with_wallet(bigint) to authenticated;

revoke execute on function public.confirm_self_paid(bigint, text) from public, anon;
grant  execute on function public.confirm_self_paid(bigint, text) to authenticated;

revoke execute on function public.remind_unpaid(bigint) from public, anon;
grant  execute on function public.remind_unpaid(bigint) to authenticated;

revoke execute on function public.cancel_group_buy(bigint) from public, anon;
grant  execute on function public.cancel_group_buy(bigint) to authenticated;

revoke execute on function public.delete_group_buy(bigint) from public, anon;
grant  execute on function public.delete_group_buy(bigint) to authenticated;

revoke execute on function public.topup_wallet(int) from public, anon;
grant  execute on function public.topup_wallet(int) to authenticated;

revoke execute on function public.withdraw_wallet(int) from public, anon;
grant  execute on function public.withdraw_wallet(int) to authenticated;

-- ⚠️ 앞으로 security definer RPC 를 추가할 때마다 아래 두 줄을 같이 넣어라.
-- security definer 함수는 PUBLIC 에 EXECUTE 가 열리고, Supabase 기본 default privileges 가
-- anon 에게도 따로 EXECUTE 를 준다 → PUBLIC 회수만으로는 anon 이 안 막힌다. 둘 다 회수해야 함.
--   revoke execute on function public.<함수>(...) from public, anon;
--   grant  execute on function public.<함수>(...) to authenticated;

-- ─────────────────────────────────────────────
-- 6. Realtime 구독 대상
-- ─────────────────────────────────────────────

alter publication supabase_realtime add table group_buys;
alter publication supabase_realtime add table participations;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table wallets;
alter publication supabase_realtime add table wallet_transactions;

-- ─────────────────────────────────────────────
-- 7. Storage — 미사용
--    이미지 업로드는 Cloudflare R2 로 간다 (app/api/upload, lib/server/r2.ts).
--    아래 receipts 버킷은 쓰지 않지만, 이미 만들어진 프로젝트가 있어 그대로 둔다.
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true)
on conflict (id) do nothing;

create policy receipts_read   on storage.objects for select to authenticated
  using (bucket_id = 'receipts');
create policy receipts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');

-- ─────────────────────────────────────────────
-- 8. 시드 — 동네 라운지 (전체 공개 자유 채팅방)
-- ─────────────────────────────────────────────

-- 이름은 UI(components/views/chat.tsx)의 라운지 표기와 맞춘다.
insert into chat_rooms (type, name) values ('lounge', '역삼동 라운지');
