-- =============================================================================
-- 권한(RLS) 동작 검증 — 정책이 "설정돼 있다"가 아니라 "실제로 막는다"를 확인한다.
-- 로컬 Postgres 에서 000_stub → 001 → 002 → 003 을 올린 뒤 실행한다.
-- =============================================================================
create table if not exists _r (n serial, label text, pass boolean, detail text);
truncate _r;
grant usage on schema public to anon, authenticated;

-- security definer: 결과 기록은 postgres 로 한다. 인자(검증값)는 호출하는 쪽,
-- 즉 검사 대상 역할로 이미 평가된 뒤 넘어오므로 권한 검증에는 영향이 없다.
create or replace function chk(p_label text, p_actual anyelement, p_expect anyelement) returns void
language plpgsql security definer as $$
begin
  insert into _r(label, pass, detail)
  values (p_label, p_actual is not distinct from p_expect,
          case when p_actual is not distinct from p_expect then ''
               else format('기대 %s / 실제 %s', p_expect, p_actual) end);
end $$;

-- 쓰기가 거절되는지 확인. definer 로 만들면 안 된다 — 호출자 권한 그대로 실행돼야 한다.
--   RLS 가 막는 방법은 두 가지다:
--     with check 위반 → 예외
--     using 에 안 걸림  → 조용히 0행
--   둘 다 "막혔다"로 본다.
create or replace function denied(p_sql text) returns boolean
language plpgsql as $$
begin
  execute p_sql;
  return false;                 -- 통과해 버렸다 = 못 막았다
exception when insufficient_privilege or check_violation then
  return true;
end $$;

/** 실제로 몇 행이 바뀌었나. 정책 예외로 막히면 -1 */
create or replace function affected(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege or check_violation then
  return -1::bigint;
end $$;

-- ---------- 사람과 데이터 심기 (postgres 는 RLS 를 통과하므로 그대로 꽂힌다) ----
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000a001','ceo@kpjk.test'),
  ('00000000-0000-0000-0000-00000000c001','park@kpjk.test'),
  ('00000000-0000-0000-0000-00000000c002','lee@kpjk.test'),
  ('00000000-0000-0000-0000-00000000f001','a@clientA.test'),
  ('00000000-0000-0000-0000-00000000f002','b@clientB.test');

-- profiles ↔ companies 는 서로를 참조한다. 실제 운영 순서와 같게 심는다:
-- 내부 계정 → 기업 → 그 기업의 고객 계정.
insert into public.profiles(id, name, role, email) values
  ('00000000-0000-0000-0000-00000000a001','대표','admin','ceo@kpjk.test'),
  ('00000000-0000-0000-0000-00000000c001','박컨설턴트','consultant','park@kpjk.test'),
  ('00000000-0000-0000-0000-00000000c002','이컨설턴트','consultant','lee@kpjk.test');

insert into public.companies(id, code, name, consultant_id) values
  ('co_a','A','에이테스트(주)','00000000-0000-0000-0000-00000000c001'),
  ('co_b','B','비테스트(주)',  '00000000-0000-0000-0000-00000000c002');

insert into public.profiles(id, name, role, email, company_id) values
  ('00000000-0000-0000-0000-00000000f001','A담당','client','a@clientA.test','co_a'),
  ('00000000-0000-0000-0000-00000000f002','B담당','client','b@clientB.test','co_b');

insert into public.projects(id, company_id, name, client_visible, archived) values
  ('pj_a1','co_a','A 공개 프로젝트', true,  false),
  ('pj_a2','co_a','A 비공개 프로젝트', false, false),
  ('pj_a3','co_a','A 보관 프로젝트', true,  true),
  ('pj_b1','co_b','B 공개 프로젝트', true,  false);

insert into public.consultations(id, company_id, notes) values ('cs_a1','co_a','상담 메모');
insert into public.tasks(id, company_id, title) values ('tk_a1','co_a','내부 업무');
insert into public.quotes(id, company_id, title, status) values
  ('qt_a1','co_a','A 초안 견적','draft'),
  ('qt_a2','co_a','A 발송 견적','sent');
insert into public.document_requests(id, company_id, project_id, name, status) values
  ('dr_a1','co_a','pj_a1','사업자등록증','requested'),
  ('dr_a2','co_a','pj_a1','미발송 요청','planned');
insert into public.inquiries(id, company_id, title) values
  ('iq_a1','co_a','A 문의'), ('iq_b1','co_b','B 문의');
insert into public.activities(id, type, company_id, actor_id, actor_role, message) values
  ('ac_a1','company_created','co_a','00000000-0000-0000-0000-00000000a001','admin','기업 등록');
insert into storage.objects(bucket_id, name) values
  ('documents','co_a/dr_a1/f1__사업자등록증.pdf'),
  ('documents','co_b/dr_b1/f2__비밀자료.pdf');

-- =========================== 고객 A =========================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f001';

select chk('고객A: 자기 회사만 보인다',        (select count(*) from public.companies), 1::bigint);
select chk('고객A: 보이는 회사가 A다',          (select name from public.companies), '에이테스트(주)');
select chk('고객A: 공개·미보관 프로젝트만',      (select count(*) from public.projects), 1::bigint);
select chk('고객A: 그 프로젝트가 pj_a1',        (select id from public.projects), 'pj_a1');
select chk('고객A: 상담기록은 안 보인다',        (select count(*) from public.consultations), 0::bigint);
select chk('고객A: 업무는 안 보인다',            (select count(*) from public.tasks), 0::bigint);
select chk('고객A: 발송된 견적만 보인다',        (select count(*) from public.quotes), 1::bigint);
select chk('고객A: 초안 견적은 안 보인다',       (select count(*) from public.quotes where status='draft'), 0::bigint);
select chk('고객A: 미발송 자료요청은 안 보인다', (select count(*) from public.document_requests), 1::bigint);
select chk('고객A: B사 문의는 안 보인다',        (select count(*) from public.inquiries), 1::bigint);
select chk('고객A: 다른 고객 계정은 안 보인다',
       (select count(*) from public.profiles where role='client'), 1::bigint);
select chk('고객A: 내부 담당자는 보인다',
       (select count(*) from public.profiles where role<>'client'), 3::bigint);
select chk('고객A: 파일도 자기 회사 것만',       (select count(*) from storage.objects), 1::bigint);

-- 고객이 넘어서는 안 되는 선
select chk('고객A: 견적을 계약전환으로 못 바꾼다',
       denied($$update public.quotes set status='converted' where id='qt_a2'$$), true);
select chk('고객A: 자료요청을 검토완료로 못 바꾼다',
       denied($$update public.document_requests set status='done' where id='dr_a1'$$), true);
select chk('고객A: B사 기업정보를 못 고친다',
       affected($$update public.companies set memo='침입' where id='co_b'$$), 0::bigint);
select chk('고객A: 기록을 못 지운다',
       denied($$delete from public.activities where id='ac_a1'$$), true);
select chk('고객A: 스스로 대표가 못 된다',
       affected($$update public.profiles set role='admin' where id=auth.uid()$$), 0::bigint);

-- 고객이 해도 되는 것
select chk('고객A: 자료 제출은 된다',
       affected($$update public.document_requests set status='submitted' where id='dr_a1'$$), 1::bigint);
select chk('고객A: 견적 수락은 된다',
       affected($$update public.quotes set status='accepted' where id='qt_a2'$$), 1::bigint);

reset role; reset request.jwt.claim.sub;
update public.document_requests set status='requested' where id='dr_a1';
update public.quotes set status='sent' where id='qt_a2';

-- =========================== 컨설턴트 (전체 공유) =============================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';
select chk('컨설턴트(전체): 두 기업 다 보인다',   (select count(*) from public.companies), 2::bigint);
select chk('컨설턴트(전체): 비공개 프로젝트도 보인다', (select count(*) from public.projects), 4::bigint);
select chk('컨설턴트(전체): 상담기록 보인다',     (select count(*) from public.consultations), 1::bigint);
select chk('컨설턴트: 스스로 대표가 못 된다',
       affected($$update public.profiles set role='admin' where id=auth.uid()$$), 0::bigint);
select chk('컨설턴트: 남의 계정을 못 만든다',
       denied($$insert into public.profiles(id,name,role,email)
                values('00000000-0000-0000-0000-0000000000ff','가짜','admin','x@x.test')$$), true);
select chk('컨설턴트: 기록을 못 고친다',
       denied($$update public.activities set message='조작' where id='ac_a1'$$), true);
reset role; reset request.jwt.claim.sub;

-- =========================== 스위치를 '내 담당만' 으로 =========================
update public.app_settings set consultant_scope='own' where id=1;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';   -- co_a 담당
select chk('컨설턴트(내담당): 담당 기업만 보인다', (select count(*) from public.companies), 1::bigint);
select chk('컨설턴트(내담당): 그게 co_a 다',       (select id from public.companies), 'co_a');
select chk('컨설턴트(내담당): B사 프로젝트 안 보인다',
       (select count(*) from public.projects where company_id='co_b'), 0::bigint);
reset role; reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a001';   -- 대표
select chk('대표: 스위치와 무관하게 전부 보인다', (select count(*) from public.companies), 2::bigint);
reset role; reset request.jwt.claim.sub;

update public.app_settings set consultant_scope='all' where id=1;

-- =========================== 비활성 계정 · 비로그인 ===========================
update public.profiles set active=false where id='00000000-0000-0000-0000-00000000c002';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c002';
select chk('중지된 계정: 아무것도 못 본다', (select count(*) from public.companies), 0::bigint);
reset role; reset request.jwt.claim.sub;
update public.profiles set active=true where id='00000000-0000-0000-0000-00000000c002';

set role anon;
select chk('비로그인: 기업 목록 접근 불가', denied($$select count(*) from public.companies$$), true);
reset role;

-- =========================== 결과 ===========================================
select n, case when pass then '통과' else '실패' end as 결과, label as 검증, detail as 비고
from _r order by n;
select count(*) filter (where pass) as 통과, count(*) filter (where not pass) as 실패 from _r;
