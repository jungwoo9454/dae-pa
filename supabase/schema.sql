-- 대파(대용량 파티원) — Supabase 스키마
-- 적용: Supabase 대시보드 > SQL Editor에 전체 붙여넣고 실행 (처음 1회)
-- 사전 설정: Authentication > Providers 에서 Anonymous sign-in / Google / Kakao 활성화
--            (소셜 제공자별 Client ID·Secret 입력 + 리디렉트 URL 등록은 대시보드에서)

-- ─────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nickname      text not null,
  avatar_url    text,
  bank_account  text,
  transfer_app  text,
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
  total_amount  int  not null check (total_amount > 0),   -- 원 단위 정수
  delivery_fee  int  not null default 0 check (delivery_fee >= 0),
  goal          int  not null check (goal > 1),           -- 목표 인원 = 정원
  joined        int  not null default 1 check (joined >= 0),  -- 주최자 포함
  deadline      timestamptz not null,
  place         text,
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
-- 2. 트리거 — 가입 시 프로필·지갑, 공구 생성 시 채팅방·주최자 참여
-- ─────────────────────────────────────────────

-- 닉네임·아바타는 제공자마다 키가 다르다. 이메일 폼은 nickname 을 직접 넣지만
-- 구글은 full_name/name + avatar_url(picture), 카카오는 name/user_name + avatar_url 로 온다.
-- 하나라도 못 찾으면 기존처럼 '이웃abcd' 로 떨어진다.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(m->>'nickname', ''),        -- 이메일 회원가입 폼
      nullif(m->>'full_name', ''),       -- Google
      nullif(m->>'name', ''),            -- Google / Kakao
      nullif(m->>'user_name', ''),       -- Kakao
      '이웃' || left(new.id::text, 4)
    ),
    coalesce(nullif(m->>'avatar_url', ''), nullif(m->>'picture', ''))
  );
  insert into public.wallets (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.on_group_buy_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  insert into chat_rooms (type, group_buy_id, name)
  values ('group_buy', new.id, new.title)
  returning id into rid;

  insert into participations (group_buy_id, user_id) values (new.id, new.host_id);

  insert into messages (room_id, kind, content)
  values (rid, 'sys', '공구방이 열렸어요 · 목표 ' || new.goal || '명');

  return new;
end $$;

create trigger group_buy_created
  after insert on group_buys
  for each row execute function public.on_group_buy_created();

-- ─────────────────────────────────────────────
-- 3. 참여 RPC — 정원 초과를 서버에서 원자적으로 차단
--    (클라이언트 인원 체크만으로는 동시 클릭 레이스를 못 막음)
--
-- ⚠️ 설계 규약: group_buys.status / joined / goal 과 시스템 메시지(kind='sys'),
--    남의 행(알림·지갑·amount_due·trust_score)에 쓰는 작업은 클라이언트가 직접 못 한다.
--    RLS + 컬럼 GRANT 로 막아뒀으니, 그런 동작이 필요하면 RLS와 싸우지 말고
--    여기에 security definer RPC 를 하나 추가해라. (#12 금액변경, #16 분배,
--    #17 입금·마감, #18 자동결제가 각각 RPC 하나씩 필요하다)
-- ─────────────────────────────────────────────

create function public.join_group_buy(p_group_buy_id bigint)
returns group_buys
language plpgsql security definer set search_path = public as $$
declare
  g    group_buys;
  rid  bigint;
  nick text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  update group_buys
     set joined = joined + 1,
         status = case when joined + 1 >= goal then 'settling' else status end
   where group_buys.id = p_group_buy_id
     and group_buys.status = 'recruiting'
     and group_buys.deadline > now()
     and group_buys.joined < group_buys.goal
     and not exists (
       select 1 from participations p
        where p.group_buy_id = group_buys.id and p.user_id = auth.uid()
     )
  returning * into g;

  if not found then
    raise exception '참여할 수 없는 공구입니다 (마감·정원 초과·중복 참여)';
  end if;

  insert into participations (group_buy_id, user_id) values (g.id, auth.uid());

  select nickname into nick from profiles where id = auth.uid();
  select id into rid from chat_rooms where group_buy_id = g.id;

  insert into messages (room_id, kind, content)
  values (rid, 'sys', nick || '님이 참여했어요 (' || g.joined || '/' || g.goal || ')');

  -- 정원 도달 → 자동 정산 전환 + 전원 알림
  if g.status = 'settling' then
    insert into messages (room_id, kind, content)
    values (rid, 'sys', '목표 달성! 정산이 시작돼요 🎉');

    insert into notifications (user_id, type, payload)
    select p.user_id, 'settle_start',
           jsonb_build_object('group_buy_id', g.id, 'title', g.title)
      from participations p where p.group_buy_id = g.id;
  end if;

  return g;
end $$;

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
create policy group_buys_host_update on group_buys for update to authenticated
  using (host_id = auth.uid() and status = 'recruiting')
  with check (host_id = auth.uid());

create policy participations_read on participations for select to authenticated using (true);
-- INSERT 정책 없음 → 참여는 join_group_buy RPC로만 가능
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

-- 상태 머신·인원 카운터는 컬럼 단위로 UPDATE 권한을 뺀다 → join_group_buy 같은 RPC로만 변경 가능
revoke update on group_buys from authenticated;
grant update (title, description, category, store_link,
              total_amount, delivery_fee, deadline, place)
  on group_buys to authenticated;

-- amount_due 는 정산 RPC(#16)가 쓴다. 클라이언트는 본인 메모·입금 체크만.
revoke update on participations from authenticated;
grant update (note, is_paid, paid_at) on participations to authenticated;

-- trust_score 는 정산 완료 RPC(#17)가 쓴다.
revoke update on profiles from authenticated;
grant update (nickname, avatar_url, bank_account, transfer_app) on profiles to authenticated;

-- security definer 함수는 기본적으로 PUBLIC 에 EXECUTE 가 열린다 → 로그인 사용자로 제한
revoke execute on function public.join_group_buy(bigint) from public;
grant execute on function public.join_group_buy(bigint) to authenticated;

-- ─────────────────────────────────────────────
-- 6. Realtime 구독 대상
-- ─────────────────────────────────────────────

alter publication supabase_realtime add table group_buys;
alter publication supabase_realtime add table participations;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;

-- ─────────────────────────────────────────────
-- 7. Storage — 영수증 사진 버킷 (#15 증빙 첨부, 자동 인식은 없음)
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

insert into chat_rooms (type, name) values ('lounge', '동네 라운지');
