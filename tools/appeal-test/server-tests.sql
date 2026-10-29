-- =============================================================================
-- 기술시험 — 서버 규칙(트리거 · 권한 · 중복방지 · 단계)을 운영과 같은 setup.sql 위에서 실제로 실행한다.
--   실행: bash tools/appeal-test/run-server-tests.sh   (000_supabase_stub.sql → supabase/setup.sql → 이 파일)
--   시험용 데이터베이스(kpjk_appeal)만 새로 만든다. 운영 DB 에는 접속하지 않는다.
--   기업 · 사람은 전부 가상([가상] · *.test). 각 확인은 CHECK|시험|항목|기대|실제|결과 한 줄로 남긴다.
-- =============================================================================
\pset footer off
\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on
grant usage on schema public to anon, authenticated;
create table _t (n serial, test text, label text, expect text, actual text, pass boolean);
create table _m (test text, label text, ms numeric);
grant insert, select on _t, _m to authenticated, anon;
grant usage on sequence _t_n_seq to authenticated, anon;

-- 결과 기록(호출한 역할과 상관없이 기록만 한다)
create function ck(p_test text, p_label text, p_actual anyelement, p_expect anyelement) returns void
language plpgsql security definer as $$
begin
  insert into _t(test, label, expect, actual, pass)
  values (p_test, p_label, p_expect::text, coalesce(p_actual::text, 'null'), p_actual is not distinct from p_expect);
end $$;
-- 쓰기가 막히는가 — 호출한 역할 권한 그대로 실행(예외 또는 0행이면 막힌 것)
create function denied(p_sql text) returns boolean language plpgsql as $$
declare n bigint;
begin
  execute p_sql; get diagnostics n = row_count;
  return n = 0;
exception when insufficient_privilege or check_violation or unique_violation or foreign_key_violation then
  return true;
end $$;
-- 몇 행이 바뀌었는가 — 호출한 역할 권한 그대로 실행
create function affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;
-- 몇 행이 보이는가(권한이 없으면 0)
create function visible(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') x' into n; return n;
exception when insufficient_privilege then return 0;
end $$;
grant execute on function ck(text, text, anyelement, anyelement), denied(text), affected(text), visible(text) to authenticated, anon;

-- ---------------------------------------------------------------- 가상 데이터
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-0000000000a1','ceo@kpjk-appeal.test'),
  ('00000000-0000-0000-0000-0000000000c1','staff@kpjk-appeal.test'),
  ('00000000-0000-0000-0000-0000000000f1','client-a@kpjk-appeal.test'),
  ('00000000-0000-0000-0000-0000000000f2','client-b@kpjk-appeal.test');
insert into public.profiles(id, name, role, email) values
  ('00000000-0000-0000-0000-0000000000a1','[가상] 대표','admin','ceo@kpjk-appeal.test'),
  ('00000000-0000-0000-0000-0000000000c1','[가상] 박담당','consultant','staff@kpjk-appeal.test');
insert into public.companies(id, code, name, consultant_id, memo) values
  ('co_a','A','[가상] 에이테스트(주)','00000000-0000-0000-0000-0000000000c1','내부 메모 — 고객에게 보이면 안 됨'),
  ('co_b','B','[가상] 비테스트(주)','00000000-0000-0000-0000-0000000000c1','내부 메모 — 고객에게 보이면 안 됨');
insert into public.profiles(id, name, role, email, company_id) values
  ('00000000-0000-0000-0000-0000000000f1','[가상] A담당','client','client-a@kpjk-appeal.test','co_a'),
  ('00000000-0000-0000-0000-0000000000f2','[가상] B담당','client','client-b@kpjk-appeal.test','co_b');
insert into public.projects(id, company_id, name, client_visible, archived, stage) values
  ('pj_a1','co_a','[가상] A 정책자금 준비', true, false, 'doc_request'),
  ('pj_a2','co_a','[가상] A 내부 검토(고객 비공개)', false, false, 'review'),
  ('pj_b1','co_b','[가상] B 기업부설연구소', true, false, 'doc_request');
insert into public.document_requests(id, company_id, project_id, name, status) values
  ('dr_a1','co_a','pj_a1','법인등기부등본','requested'),
  ('dr_b1','co_b','pj_b1','사업자등록증','requested');
insert into public.consultations(id, company_id, consultant_id, notes) values ('cs_a1','co_a','00000000-0000-0000-0000-0000000000c1','내부 상담 기록 — 고객에게 보이면 안 됨');

-- ============================================================================
-- TEST 01. 고객 자료제출 → 서버 저장 → 담당자 검토업무 자동생성
-- ============================================================================
select 'STEP|TEST01|고객 A 계정으로 요청자료 제출 (상태 submitted · 파일 1건)';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
update public.document_requests set status = 'submitted', submitted_at = now() where id = 'dr_a1';
insert into public.document_files(id, request_id, file_name, size, uploaded_by, version)
  values ('df_a1','dr_a1','법인등기부등본_예시.pdf', 1000, '00000000-0000-0000-0000-0000000000f1', 1);
select ck('TEST01','고객 계정에서 본 내 제출 파일 수', (select count(*) from public.document_files where request_id = 'dr_a1'), 1::bigint);
select ck('TEST01','고객 계정에서 본 요청 상태', (select status from public.document_requests where id = 'dr_a1'), 'submitted'::text);
select ck('TEST01','고객 계정은 내부 업무(검토업무)를 볼 수 없다', visible($$select * from public.tasks$$), 0::bigint);
reset role; reset request.jwt.claim.sub;
-- 서버(트리거 kpjk_after_client_file)가 만든 것 — 서버 관리자 권한으로 직접 확인
select ck('TEST01','서버 저장: 파일 행 1건', (select count(*) from public.document_files where request_id = 'dr_a1'), 1::bigint);
select ck('TEST01','자동 생성 검토업무 수', (select count(*) from public.tasks where company_id = 'co_a' and source = 'auto' and title like '%법인등기부등본 검토'), 1::bigint);
select ck('TEST01','검토업무 제목', (select title from public.tasks where company_id = 'co_a' and source = 'auto' order by created_at limit 1), '[가상] 에이테스트(주) 법인등기부등본 검토'::text);
select ck('TEST01','검토업무 유형 · 상태', (select type || ' · ' || status from public.tasks where company_id = 'co_a' and source = 'auto' order by created_at limit 1), '자료검토 · todo'::text);
select ck('TEST01','검토업무 담당자 = 기업 담당 컨설턴트', (select p.name from public.tasks t join public.profiles p on p.id = t.assignee_id where t.company_id = 'co_a' and t.source = 'auto' order by t.created_at limit 1), '[가상] 박담당'::text);
select ck('TEST01','검토업무 기한 = 2영업일 뒤(kpjk_due(2))', (select (due_date = public.kpjk_due(2)) from public.tasks where company_id = 'co_a' and source = 'auto' order by created_at limit 1), true);
select ck('TEST01','자동 기록(활동) — 시스템이 남김', (select actor_role || ' · ' || message from public.activities where company_id = 'co_a' and type = 'task_created' order by at limit 1), 'system · 자동 생성: 법인등기부등본 검토 Task'::text);
select ck('TEST01','고객 알림 1건', (select count(*) from public.notifications where audience = 'client' and company_id = 'co_a' and title = '자료가 접수되었습니다'), 1::bigint);
select ck('TEST01','업무상태 변경: 프로젝트 단계 자료요청 → 자료접수', (select stage from public.projects where id = 'pj_a1'), 'doc_received'::text);
select ck('TEST01','단계 변경 자동 기록', (select count(*) from public.activities where project_id = 'pj_a1' and type = 'project_stage_changed' and actor_role = 'system'), 1::bigint);
select ck('TEST01','다른 기업(B)에는 업무 · 알림이 생기지 않음', (select count(*) from public.tasks where company_id = 'co_b') + (select count(*) from public.notifications where company_id = 'co_b'), 0::bigint);
-- 담당자 PC(담당자 계정)에서 확인
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select ck('TEST01','담당자 계정에서 보이는 자동 생성 검토업무', visible($$select * from public.tasks where company_id = 'co_a' and source = 'auto' and assignee_id = auth.uid()$$), 1::bigint);
select ck('TEST01','담당자 계정에서 보이는 제출 파일', visible($$select * from public.document_files where request_id = 'dr_a1'$$), 1::bigint);
-- 담당자가 대신 올린 파일은 고객 행동이 아니므로 검토업무를 만들지 않는다
insert into public.document_requests(id, company_id, project_id, name, status) values ('dr_a9','co_a','pj_a1','담당자 보관용 사본','submitted');
insert into public.document_files(id, request_id, file_name, size, uploaded_by, version) values ('df_a9','dr_a9','사본.pdf', 10, '00000000-0000-0000-0000-0000000000c1', 1);
reset role; reset request.jwt.claim.sub;
select ck('TEST01','담당자가 올린 파일은 검토업무를 만들지 않음', (select count(*) from public.tasks where title like '%담당자 보관용 사본%'), 0::bigint);

-- 처리시간: 고객 제출 1건(요청 상태 변경 + 파일 저장 → 트리거가 업무 · 기록 · 알림 · 단계 처리)을 30번, 서버 안에서 잰다
insert into public.projects(id, company_id, name, client_visible, archived, stage) values ('pj_a3','co_a','[가상] A 반복 측정', true, false, 'doc_request');
insert into public.document_requests(id, company_id, project_id, name, status)
  select 'dr_t' || g, 'co_a', 'pj_a3', '측정 자료 ' || g, 'requested' from generate_series(1, 30) g;
do $$
declare i int; t0 timestamptz; t1 timestamptz;
begin
  for i in 1..30 loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);
    t0 := clock_timestamp();
    update public.document_requests set status = 'submitted', submitted_at = now() where id = 'dr_t' || i;
    insert into public.document_files(id, request_id, file_name, size, uploaded_by, version)
      values ('df_t' || i, 'dr_t' || i, '측정_' || i || '.pdf', 1000, '00000000-0000-0000-0000-0000000000f1', 1);
    t1 := clock_timestamp();
    execute 'reset role';
    perform set_config('request.jwt.claim.sub', '', true);
    insert into _m values ('TEST01', '고객 제출 1건 서버 처리', extract(epoch from (t1 - t0)) * 1000);
  end loop;
end $$;
select ck('TEST01','반복 30건 → 자동 생성 검토업무 30건', (select count(*) from public.tasks where source = 'auto' and title like '%측정 자료 %검토'), 30::bigint);
select ck('TEST01','반복 30건 → 마지막 제출 때 단계 자료접수', (select stage from public.projects where id = 'pj_a3'), 'doc_received'::text);

-- ============================================================================
-- TEST 02. 검토 → 보완요청 → 고객 상태 → 재제출 → 검토 완료
-- ============================================================================
select 'STEP|TEST02|담당자 보완요청 → 고객 화면 상태 → 재제출 → 검토 완료';
create temp table _before as select (select count(*) from public.activities where company_id = 'co_a') a, (select count(*) from public.tasks where company_id = 'co_a' and title like '%법인등기부등본 검토') t;
grant select on _before to authenticated;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select ck('TEST02','담당자 보완요청(상태 변경 1행)', affected($$update public.document_requests set status = 'revision', review_note = '말소사항 포함 발급본으로 다시 올려 주세요.', reviewed_at = now() where id = 'dr_a1'$$), 1::bigint);
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select ck('TEST02','고객 계정에서 본 상태 · 사유', (select status || ' · ' || review_note from public.document_requests where id = 'dr_a1'), 'revision · 말소사항 포함 발급본으로 다시 올려 주세요.'::text);
update public.document_requests set status = 'submitted', submitted_at = now() where id = 'dr_a1';
insert into public.document_files(id, request_id, file_name, size, uploaded_by, version)
  values ('df_a2','dr_a1','법인등기부등본_말소포함_예시.pdf', 1000, '00000000-0000-0000-0000-0000000000f1', 2);
select ck('TEST02','재제출 뒤 고객 계정의 파일 수(1차 · 2차 모두 보존)', (select count(*) from public.document_files where request_id = 'dr_a1'), 2::bigint);
reset role; reset request.jwt.claim.sub;
select ck('TEST02','재제출 → 검토업무 1건 더(새 제출 = 새 검토)', (select count(*) from public.tasks where company_id = 'co_a' and source = 'auto' and title like '%법인등기부등본 검토') - (select t from _before), 1::bigint);
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select ck('TEST02','담당자 검토 완료(상태 변경 1행)', affected($$update public.document_requests set status = 'done', reviewed_at = now() where id = 'dr_a1'$$), 1::bigint);
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select ck('TEST02','고객 계정에서 본 최종 상태', (select status from public.document_requests where id = 'dr_a1'), 'done'::text);
select ck('TEST02','고객은 검토 완료된 자료를 되돌릴 수 없다(상태 변경 거절)', denied($$update public.document_requests set status = 'requested' where id = 'dr_a1'$$), true);
reset role; reset request.jwt.claim.sub;
select ck('TEST02','처리 전후 자동 기록 증가(재제출 검토업무 생성 1건)', (select count(*) from public.activities where company_id = 'co_a') - (select a from _before), 1::bigint);
select 'LOG|TEST02|' || to_char(at at time zone 'Asia/Seoul', 'HH24:MI:SS.MS') || ' KST' || '|' || type || '|' || actor_role || '|' || message from public.activities where company_id = 'co_a' and (project_id = 'pj_a1' or message like '%법인등기부등본%') order by at;

-- ============================================================================
-- TEST 03. 기업별 접근권한(RLS) — 고객 A 가 고객 B 정보 · 내부 정보에 접근 시도
-- ============================================================================
select 'STEP|TEST03|고객 A 계정으로 B 기업 · 내부 전용 정보 접근 시도';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select ck('TEST03','A → 고객용 기업 보기: 보이는 기업은 A 하나', (select string_agg(name, ',') from public.client_companies), '[가상] 에이테스트(주)'::text);
select ck('TEST03','A → B 기업 행 읽기', visible($$select * from public.client_companies where id = 'co_b'$$), 0::bigint);
select ck('TEST03','A → B 요청자료 읽기', visible($$select * from public.document_requests where company_id = 'co_b'$$), 0::bigint);
select ck('TEST03','A → B 프로젝트 읽기', visible($$select * from public.client_projects where company_id = 'co_b'$$), 0::bigint);
select ck('TEST03','A → B 요청 상태 바꾸기', denied($$update public.document_requests set status = 'submitted' where id = 'dr_b1'$$), true);
select ck('TEST03','A → B 요청에 파일 올리기', denied($$insert into public.document_files(id, request_id, file_name, uploaded_by) values ('df_x','dr_b1','x.pdf','00000000-0000-0000-0000-0000000000f1')$$), true);
select ck('TEST03','A → B 이름으로 요청 만들기', denied($$insert into public.document_requests(id, company_id, name, status) values ('dr_x','co_b','x','requested')$$), true);
select ck('TEST03','A → 기업 표 직접(내부 메모 칸)', visible($$select * from public.companies$$), 0::bigint);
select ck('TEST03','A → 고객용 보기에 내부 메모 칸 없음', (select count(*) from information_schema.columns where table_name = 'client_companies' and column_name = 'memo'), 0::bigint);
select ck('TEST03','A → 내부 업무(tasks)', visible($$select * from public.tasks$$), 0::bigint);
select ck('TEST03','A → 상담 기록(consultations)', visible($$select * from public.consultations$$), 0::bigint);
select ck('TEST03','A → 고객 비공개 프로젝트', visible($$select * from public.client_projects where id = 'pj_a2'$$), 0::bigint);
select ck('TEST03','A → 내부 알림', visible($$select * from public.notifications where audience = 'internal'$$), 0::bigint);
select ck('TEST03','A → 내 역할을 관리자로 바꾸기', denied($$update public.profiles set role = 'admin' where id = auth.uid()$$), true);
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select ck('TEST03','B → A 요청자료 · 파일', visible($$select * from public.document_requests where company_id = 'co_a'$$) + visible($$select * from public.document_files where request_id = 'dr_a1'$$), 0::bigint);
select ck('TEST03','B → A 고객 알림', visible($$select * from public.notifications where company_id = 'co_a'$$), 0::bigint);
select ck('TEST03','B → 자기 요청자료는 보인다', visible($$select * from public.document_requests where company_id = 'co_b'$$), 1::bigint);
reset role; reset request.jwt.claim.sub;
set role anon;
select ck('TEST03','로그인 안 한 사용자 → 기업 · 요청자료', visible($$select * from public.client_companies$$) + visible($$select * from public.document_requests$$), 0::bigint);
reset role;
select ck('TEST03','공개 스키마 표 전부 RLS 켜짐', (select count(*) filter (where not c.relrowsecurity) from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and c.relname not in ('_t','_m')), 0::bigint);
select 'INFO|TEST03|공개 스키마 표 ' || count(*) || '개 · 권한 정책 ' || (select count(*) from pg_policies where schemaname = 'public') || '개'
  from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and c.relname not in ('_t','_m');

-- ============================================================================
-- TEST 04. 후속업무 중복방지(rule_key) · 정상 신규 업무와 구분
-- ============================================================================
select 'STEP|TEST04|같은 rule_key 로 규칙 업무를 반복 생성 · 서버 규칙 반복 실행';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
insert into public.tasks(id, company_id, title, type, assignee_id, source, rule_key)
  values ('tk_r1','co_a','[가상] 에이테스트(주) 연락 공백 14일 — 연락','후속연락','00000000-0000-0000-0000-0000000000c1','auto','contact_gap:co_a:2026-10-29');
select ck('TEST04','같은 rule_key 두 번째 생성 → DB 가 거절', denied($$insert into public.tasks(id, company_id, title, type, source, rule_key) values ('tk_r2','co_a','중복','후속연락','auto','contact_gap:co_a:2026-10-29')$$), true);
select ck('TEST04','같은 rule_key 세 번째 생성 → DB 가 거절', denied($$insert into public.tasks(id, company_id, title, type, source, rule_key) values ('tk_r3','co_a','중복','후속연락','auto','contact_gap:co_a:2026-10-29')$$), true);
reset role; reset request.jwt.claim.sub;
select ck('TEST04','그 rule_key 업무 수', (select count(*) from public.tasks where rule_key = 'contact_gap:co_a:2026-10-29'), 1::bigint);
select ck('TEST04','다른 근거(다른 rule_key)는 새 업무로 만들어짐', denied($$insert into public.tasks(id, company_id, title, type, source, rule_key) values ('tk_r4','co_a','다른 근거','후속연락','auto','contact_gap:co_a:2026-11-12')$$), false);
-- 서버 규칙(kpjk_after_self_run)을 같은 조건으로 반복: 고객이 성장과제 완료 → 확인 업무, 상태를 바꿨다가 다시 완료해도 1건
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
insert into public.self_runs(id, company_id, kind, target_key, target_title, status, created_by)
  values ('sr_g1','co_a','growth','rnd_lab','기업부설연구소','preparing','00000000-0000-0000-0000-0000000000f1');
update public.self_runs set status = 'done', status_at = now() where id = 'sr_g1';
update public.self_runs set status = 'preparing', status_at = now() where id = 'sr_g1';
update public.self_runs set status = 'done', status_at = now() where id = 'sr_g1';
update public.self_runs set status = 'preparing', status_at = now() where id = 'sr_g1';
update public.self_runs set status = 'done', status_at = now() where id = 'sr_g1';
select ck('TEST04','같은 대상 실행 기록 두 번 만들기(두 기기 동시) → 한 줄만', denied($$insert into public.self_runs(id, company_id, kind, target_key, status, created_by) values ('sr_g2','co_a','growth','rnd_lab','preparing','00000000-0000-0000-0000-0000000000f1')$$), true);
reset role; reset request.jwt.claim.sub;
select ck('TEST04','완료를 3번 기록 → 확인 업무 1건(rule_key self_run:sr_g1:done)', (select count(*) from public.tasks where rule_key = 'self_run:sr_g1:done'), 1::bigint);
select ck('TEST04','완료를 3번 기록 → 담당자 알림은 기록마다(3건)', (select count(*) from public.notifications where audience = 'internal' and company_id = 'co_a' and title = '고객이 성장과제를 직접 완료했습니다'), 3::bigint);
-- 정상적인 신규 자료제출로 생기는 검토업무는 rule_key 가 없다 — 제출마다 새 업무(TEST 02 재제출: 2건)
select ck('TEST04','자료제출 검토업무는 rule_key 없음(제출마다 새로)', (select count(*) filter (where rule_key is null) || '/' || count(*) from public.tasks where company_id = 'co_a' and source = 'auto' and title like '%법인등기부등본 검토'), '2/2'::text);
select 'INFO|TEST04|rule_key 고유 색인: ' || indexdef from pg_indexes where indexname = 'tasks_rule_key_uidx';

-- ============================================================================
-- TEST 05. 내부 단계 변경 → 다른 계정(고객) 화면 데이터
-- ============================================================================
select 'STEP|TEST05|담당자가 내부 단계 변경 → 고객 계정이 같은 서버에서 읽는 단계';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select ck('TEST05','담당자: 단계 자료접수 → 진행(1행)', affected($$update public.projects set stage = 'in_progress', stage_changed_at = now() where id = 'pj_a1'$$), 1::bigint);
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select ck('TEST05','고객 계정이 읽는 단계(고객용 보기)', (select stage from public.client_projects where id = 'pj_a1'), 'in_progress'::text);
select ck('TEST05','고객 계정에 고객 비공개 프로젝트는 없음', (select count(*) from public.client_projects), 2::bigint);
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
update public.projects set stage = 'done', stage_changed_at = now() where id = 'pj_a1';
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select ck('TEST05','담당자가 완료로 바꾼 뒤 고객 계정이 읽는 단계', (select stage from public.client_projects where id = 'pj_a1'), 'done'::text);
select ck('TEST05','고객은 단계를 바꿀 수 없다', denied($$update public.projects set stage = 'review' where id = 'pj_a1'$$), true);
reset role; reset request.jwt.claim.sub;

-- ============================================================================
-- TEST 06. (후속 고도화 · 2026-10) 고객 자기주도 실행 기록 — 고객 입력과 담당자 확인 구분
-- ============================================================================
select 'STEP|TEST06|고객이 지원사업 직접 준비 → 신청 → 선정 기록 · 근거 · 담당자 확인';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
insert into public.self_runs(id, company_id, kind, target_key, target_title, status, created_by)
  values ('sr_p1','co_a','program','bz_TEST001','[가상] 시험용 공고','preparing','00000000-0000-0000-0000-0000000000f1');
update public.self_runs set status = 'applied', status_at = now(), note = '접수번호 TEST-0001(고객 입력)' where id = 'sr_p1';
update public.self_runs set status = 'selected', status_at = now(), evidence = '[{"name":"선정통지_예시.pdf","at":"2026-10-29"}]' where id = 'sr_p1';
select ck('TEST06','고객: 담당자 확인 표시를 스스로 넣기 → 거절', denied($$update public.self_runs set evidence = '[{"name":"선정통지_예시.pdf","at":"2026-10-29","confirmedAt":"2026-10-29"}]' where id = 'sr_p1'$$), true);
reset role; reset request.jwt.claim.sub;
select ck('TEST06','신청 · 선정 → 담당자 알림 2건', (select count(*) from public.notifications where audience = 'internal' and company_id = 'co_a' and title in ('고객이 지원사업을 직접 신청했습니다','고객이 지원사업 선정을 기록했습니다')), 2::bigint);
select ck('TEST06','선정 → 근거 확인 업무 1건(rule_key self_run:sr_p1:selected)', (select count(*) from public.tasks where rule_key = 'self_run:sr_p1:selected'), 1::bigint);
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select ck('TEST06','담당자: 고객이 남긴 상태를 바꾸기 → 거절', denied($$update public.self_runs set status = 'not_selected' where id = 'sr_p1'$$), true);
select ck('TEST06','담당자: 근거 확인 표시만 남기기 → 허용(1행)', affected($$update public.self_runs set evidence = '[{"name":"선정통지_예시.pdf","at":"2026-10-29","confirmedAt":"2026-10-29","confirmedBy":"[가상] 박담당"}]' where id = 'sr_p1'$$), 1::bigint);
reset role; reset request.jwt.claim.sub;
select ck('TEST06','기록 구분: 상태는 고객 입력 · 근거는 담당자 확인', (select status || ' · ' || (evidence->0->>'confirmedBy') from public.self_runs where id = 'sr_p1'), 'selected · [가상] 박담당'::text);
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select ck('TEST06','고객 B → A 의 실행 기록', visible($$select * from public.self_runs where company_id = 'co_a'$$), 0::bigint);
reset role; reset request.jwt.claim.sub;

-- ============================================================================
-- 과거 결함 — 원인을 지금 서버에서 그대로 재현하고, 고친 방식이 통하는지 확인
-- ============================================================================
select 'STEP|CASE|과거 결함 원인 재현 · 고친 방식 확인';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
-- 사례 1 (2026-09-30, 60322a8): 예전 앱은 고객 제출 때 검토업무를 앱이 직접 쓰려 했다 → 고객 권한이라 묶음째 거절
select ck('CASE1','(원인 재현) 고객 계정이 검토업무를 직접 쓰기 → 서버가 거절', denied($$insert into public.tasks(id, company_id, title, type, source) values ('tk_c1','co_a','검토','자료검토','auto')$$), true);
-- 사례 2 (2026-10-03, b234fe2): 프로젝트 없는 요청에 제출하면 활동 기록이 project_id = '' 로 갔다
select ck('CASE2','(원인 재현) 활동 기록 project_id = 빈 글자 → 외래키 위반으로 거절', denied($$insert into public.activities(id, type, company_id, project_id, actor_id, actor_role, at, message) values ('ac_c2a','document_uploaded','co_a','','00000000-0000-0000-0000-0000000000f1','client', now(),'제출')$$), true);
select ck('CASE2','(고친 방식) project_id = null → 저장', affected($$insert into public.activities(id, type, company_id, project_id, actor_id, actor_role, at, message) values ('ac_c2b','document_uploaded','co_a',null,'00000000-0000-0000-0000-0000000000f1','client', now(),'제출')$$), 1::bigint);
reset role; reset request.jwt.claim.sub;
-- 사례 4 (2026-10-03, c435ad6): 고객용 기업 보기에 대표자 생년월일이 있어 같은 회사의 다른 고객 계정(직원)에게도 보였다
select ck('CASE4','고객용 기업 보기에 대표자 생년월일(ceo_birth) 칸 없음', (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'client_companies' and column_name = 'ceo_birth'), 0::bigint);
select ck('CASE4','내부 기업 표에는 그대로 있음(담당자만)', (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'companies' and column_name = 'ceo_birth'), 1::bigint);

-- ============================================================================ 결과
select 'CHECK|' || test || '|' || n || '|' || label || '|' || expect || '|' || actual || '|' || case when pass then 'PASS' else 'FAIL' end from _t order by n;
select 'MEASURE|' || test || '|' || label || '|' || count(*) || '회|최소 ' || round(min(ms), 2) || 'ms|중앙값 ' || round((percentile_cont(0.5) within group (order by ms))::numeric, 2) || 'ms|최대 ' || round(max(ms), 2) || 'ms' from _m group by test, label;
select 'SUMMARY|' || test || '|' || count(*) filter (where pass) || '|' || count(*) filter (where not pass) from _t group by test order by test;
select 'TOTAL|' || count(*) filter (where pass) || '|' || count(*) filter (where not pass) from _t;
