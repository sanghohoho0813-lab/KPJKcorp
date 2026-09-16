-- =============================================================================
-- 로컬 검증 전용 — Supabase 가 기본으로 깔아두는 것들을 흉내 낸다.
-- 실제 Supabase 에서는 절대 실행하지 않는다. 001~003 을 붙여넣기 전에
-- 문법과 권한 정책이 정말 의도대로 도는지 노트북/CI에서 확인하기 위한 것이다.
-- =============================================================================
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;

create schema if not exists auth;
grant usage on schema auth to authenticated, anon;
create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique not null
);

-- 실제 Supabase 는 JWT 의 sub 클레임을 읽는다. 테스트에서는 세션 변수로 사람을 바꾼다.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to authenticated, anon;

create schema if not exists storage;
grant usage on schema storage to authenticated, anon;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

-- Supabase 의 실제 구현과 같다: 마지막 칸(파일명)을 뺀 경로 조각들
create or replace function storage.foldername(name text) returns text[]
language plpgsql as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts,1)-1];
end $$;
grant execute on function storage.foldername(text) to authenticated;
