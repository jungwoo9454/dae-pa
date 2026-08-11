-- 대파(대용량 파티원) — Supabase 스키마
-- 적용: Supabase 대시보드 > SQL Editor에 전체 붙여넣고 실행 (처음 1회)
-- 사전 설정: Authentication > Providers 에서 Email / Google / Kakao 활성화
--            (소셜 제공자별 Client ID·Secret 입력 + 리디렉트 URL 등록은 대시보드에서)
--            데모 편의상 Email > "Confirm email" 은 끈다 (켜두면 가입 직후 세션이 안 나옴)
--            URL Configuration > Redirect URLs 에 http://localhost:3000/auth/callback 등록

-- ─────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────

-- 이미 스키마를 돌린 프로젝트는 이 파일 전체 대신 아래 한 줄만 실행한다 (#2 동네 컬럼 추가)
--   alter table profiles add column if not exists dong text;
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nickname      text not null,
  avatar_url    text,
  dong          text,          -- 회원가입 동네 인증 결과 (예: '역삼동')
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
-- 2. 가입 트리거 — auth.users 생성 시 프로필·지갑 자동 생성 (#2)
-- ─────────────────────────────────────────────

-- 닉네임·아바타는 제공자마다 키가 다르다. 이메일 폼은 nickname 을 직접 넣지만
-- 구글은 full_name/name + avatar_url(picture), 카카오는 name/user_name + avatar_url 로 온다.
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
      nullif(m->>'name', ''),            -- Google / Kakao
      nullif(m->>'user_name', ''),       -- Kakao
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
--   #5  join_group_buy(id)      선착순 정원 원자 처리 (UPDATE ... WHERE joined < goal
--                               AND status='recruiting' RETURNING). 정원 도달 시 settling 전환.
--                               ⚠️ participations 에 INSERT 정책이 없으므로 이 RPC 없이는 참여 불가.
--   #8  공구 생성 트리거         chat_rooms 자동 생성 + 주최자 participations 삽입.
--                               chat_rooms 에도 INSERT 정책이 없다.
--   #9  시스템 메시지            kind='sys' 는 클라이언트 INSERT 가 막혀 있어 RPC/트리거로만 기록.
--   #12 금액 변경 / #13 알림 / #16 분배 / #17 입금·마감 / #18 자동결제
--   #29 cancel_group_buy(id)   주최자 취소 → canceled. 현재 canceled 로 가는 경로가 없다.
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
-- INSERT 정책 없음 → 참여는 #5 에서 추가할 join_group_buy RPC 로만 가능 (동시 클릭 레이스 차단)
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
revoke update on group_buys from authenticated;
grant update (title, description, category, store_link,
              total_amount, delivery_fee, deadline, place)
  on group_buys to authenticated;

-- amount_due 는 정산 RPC(#16)가 쓴다. 클라이언트는 본인 메모·입금 체크만.
revoke update on participations from authenticated;
grant update (note, is_paid, paid_at) on participations to authenticated;

-- trust_score 는 정산 완료 RPC(#17)가 쓴다.
revoke update on profiles from authenticated;
grant update (nickname, avatar_url, dong, bank_account, transfer_app) on profiles to authenticated;

-- 트리거 함수는 /rest/v1/rpc/ 로 노출될 이유가 없다. EXECUTE 권한은 CREATE TRIGGER 시점에만
-- 검사되므로 전부 회수해도 트리거는 정상 동작한다.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.on_group_buy_created() from public, anon, authenticated;
revoke execute on function public.sync_chat_room_name() from public, anon, authenticated;

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

-- 이름은 UI(components/views/chat.tsx)의 라운지 표기와 맞춘다.
insert into chat_rooms (type, name) values ('lounge', '역삼동 라운지');
