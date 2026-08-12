-- #15 공구 대표 이미지 — schema.sql 은 단일 출처 "파일" 일 뿐이라, 이미 떠 있는
-- Supabase 프로젝트에는 이걸 따로 실행해야 반영된다 (SQL Editor 에 붙여넣기).
--
-- group_buys 는 상태 머신 보호를 위해 revoke update 후 컬럼 단위로 다시 주는 구조라,
-- 새 컬럼은 GRANT 목록에도 넣어야 클라이언트가 수정할 수 있다.
-- (select/insert/delete 는 테이블 단위 GRANT 라서 새 컬럼이 자동 포함된다.)

alter table group_buys add column if not exists image_url text;

grant update (title, description, category, store_link,
              delivery_fee, deadline, place, image_url)
  on group_buys to authenticated;
