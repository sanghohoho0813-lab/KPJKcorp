-- 영상 ① 장면의 '서버 처리' 근거 — 운영과 같은 setup.sql 을 올린 로컬 시험 DB 에서 고객 행동 → 서버 후속을 실제로 실행한다.
-- 실행: bash tools/video/appeal/server-loop.sh  (supabase/test 의 000_supabase_stub.sql → setup.sql → 이 파일)
-- 시험용 가상 데이터만 쓴다(에이테스트(주) · 박컨설턴트). 운영 DB 에는 손대지 않는다.
\pset footer off
\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on
grant usage on schema public to anon, authenticated;
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000a001','ceo@kpjk.test'), ('00000000-0000-0000-0000-00000000c001','park@kpjk.test'),
  ('00000000-0000-0000-0000-00000000f001','a@clientA.test');
insert into public.profiles(id, name, role, email) values
  ('00000000-0000-0000-0000-00000000a001','대표','admin','ceo@kpjk.test'),
  ('00000000-0000-0000-0000-00000000c001','박컨설턴트','consultant','park@kpjk.test');
insert into public.companies(id, code, name, consultant_id) values ('co_a','A','에이테스트(주)','00000000-0000-0000-0000-00000000c001');
insert into public.profiles(id, name, role, email, company_id) values ('00000000-0000-0000-0000-00000000f001','A담당','client','a@clientA.test','co_a');
insert into public.projects(id, company_id, name, client_visible, archived, stage) values ('pj_a1','co_a','A 공개 프로젝트', true, false, 'doc_request');
insert into public.document_requests(id, company_id, project_id, name, status) values ('dr_v1','co_a','pj_a1','법인등기부등본','requested');

-- ① 고객 계정: 휴대폰에서 파일 제출
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f001';
update public.document_requests set status = 'submitted', submitted_at = now() where id = 'dr_v1';
insert into public.document_files(id, request_id, file_name, size, uploaded_by, version)
  values ('df_v1','dr_v1','법인등기부등본_예시.pdf', 1000, '00000000-0000-0000-0000-00000000f001', 1);
select 'STEP1|' || public.kpjk_role() || '|' || count(*) from public.document_files where request_id = 'dr_v1';
reset role; reset request.jwt.claim.sub;

-- ② 서버(트리거 kpjk_after_client_file)가 만든 것
select 'TASK|' || t.title || '|' || t.source || '|' || p.name || '|' || t.type from public.tasks t join public.profiles p on p.id = t.assignee_id where t.source = 'auto' order by t.created_at desc limit 1;
select 'NOTI|' || title from public.notifications where audience = 'client' and company_id = 'co_a' order by at desc limit 1;
select 'ACT|' || message || '|' || actor_role from public.activities where type = 'task_created' and company_id = 'co_a' order by at desc limit 1;
select 'STAGE|' || stage from public.projects where id = 'pj_a1';

-- ③ 담당자 계정: 보완 요청
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';
with u as (update public.document_requests set status = 'revision', review_note = '말소사항 포함 발급본으로 다시 올려 주세요.', reviewed_at = now() where id = 'dr_v1' returning 1)
select 'STEP3|' || public.kpjk_role() || '|' || count(*) from u;
reset role; reset request.jwt.claim.sub;

-- ④ 고객 계정이 읽는 상태
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f001';
select 'CLIENT|' || public.kpjk_role() || '|' || name || '|' || status || '|' || coalesce(review_note, '') from public.document_requests where id = 'dr_v1';
-- ⑤ 고객 재제출
update public.document_requests set status = 'submitted', submitted_at = now() where id = 'dr_v1';
insert into public.document_files(id, request_id, file_name, size, uploaded_by, version)
  values ('df_v2','dr_v1','법인등기부등본_말소포함_예시.pdf', 1000, '00000000-0000-0000-0000-00000000f001', 2);
reset role; reset request.jwt.claim.sub;
select 'RETASK|' || count(*) from public.tasks where source = 'auto' and title like '%법인등기부등본 검토';
-- ⑥ 담당자 검토 완료
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';
with u as (update public.document_requests set status = 'done', reviewed_at = now() where id = 'dr_v1' returning 1) select 'DONE|' || count(*) from u;
reset role; reset request.jwt.claim.sub;
select 'LOG|' || count(*) from public.activities where company_id = 'co_a';
