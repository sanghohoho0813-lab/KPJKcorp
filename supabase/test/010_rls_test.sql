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

/** 몇 행이 보이나. 권한 자체가 없으면 0 (안 보이는 것과 같다) */
create or replace function visible(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') x' into n;
  return n;
exception when insufficient_privilege then
  return 0::bigint;
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
insert into public.tasks(id, company_id, title) values ('tk_a1','co_a','내부 업무'), ('tk_b1','co_b','B사 업무'), ('tk_x',null,'회사 없는 내부 업무');
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
insert into public.notices(id, company_id, title, published_at, expires_at) values
  ('nc_all',   null,  '전체 공지',        now() - interval '1 day', null),
  ('nc_a',     'co_a','A사 공지',         now() - interval '1 day', null),
  ('nc_b',     'co_b','B사 공지',         now() - interval '1 day', null),
  ('nc_old',   'co_a','기한 지난 A사 공지', now() - interval '9 day', now() - interval '1 day'),
  ('nc_later', null,  '예약된 전체 공지',   now() + interval '2 day', null);
insert into storage.objects(bucket_id, name) values
  ('documents','co_a/dr_a1/f1__사업자등록증.pdf'),
  ('documents','co_b/dr_b1/f2__비밀자료.pdf'),
  ('vault','co_a/cf_a1__file.pdf'),
  ('vault','co_b/cf_b1__file.pdf');
-- 고객 관리 (내부 전용)
insert into public.company_vaults(id, company_id, slots) values
  ('co_a','co_a','{"jointCert":{"received":true,"note":"대표실 금고"}}'), ('co_b','co_b','{}');
insert into public.company_files(id, company_id, slot, file_name, storage_path) values
  ('cf_a1','co_a','ceoId','대표자 신분증.pdf','co_a/cf_a1__file.pdf'),
  ('cf_b1','co_b','bizReg','사업자등록증.pdf','co_b/cf_b1__file.pdf');
insert into public.journal_entries(id, company_id, type, content) values
  ('jn_a1','co_a','call','대표 통화 — 내부 메모'), ('jn_b1','co_b','note','B사 메모');
insert into public.opportunities(id, company_id, service_key, service_name, source, status, note, reason) values
  ('op_int',  'co_a', 'kpjk_가지급금', '가지급금', 'internal',       'contacted', '내부 메모: 대표 성향 보수적', null),
  ('op_rule', 'co_a', 'kpjk_인사노무', '인사노무', 'rule',           'interest',  null, '규칙 근거'),
  ('op_prop', 'co_a', 'kpjk_가업승계', '가업승계', 'proposal',       'proposed',  null, '고객에게 보이는 제안 이유'),
  ('op_req',  'co_a', 'kpjk_세무조사', '세무조사', 'portal_request', 'interest',  '고객 메모', null),
  ('op_bp',   'co_b', 'kpjk_법인전환', '법인전환', 'proposal',       'proposed',  null, 'B사 제안');
update public.opportunities set history = '[{"at":"2026-09-01","status":"contacted","by":"x","note":"내부: 대표 성향 보수적"}]'::jsonb where id = 'op_prop';
insert into public.payments(id, company_id, kind, label, amount) values
  ('pm_a1','co_a','deposit','계약금', 1000000), ('pm_b1','co_b','success','성공보수', 2000000);
insert into public.activities(id, type, company_id, actor_id, actor_role, message) values
  ('ac_a2','payment_received','co_a','00000000-0000-0000-0000-00000000a001','admin','입금 확인: 계약금'),
  ('ac_a3','journal_written','co_a','00000000-0000-0000-0000-00000000a001','admin','업무 일기: 통화'),
  ('ac_a4','document_uploaded','co_a','00000000-0000-0000-0000-00000000f001','client','자료 제출'),
  ('ac_a5','approval_requested','co_a','00000000-0000-0000-0000-00000000a001','admin','할인 15% 승인 요청'),
  ('ac_a6','quote_created','co_a','00000000-0000-0000-0000-00000000a001','admin','견적 초안 1,200만원'),
  ('ac_a7','company_updated','co_a','00000000-0000-0000-0000-00000000a001','admin','메모 수정');

-- =========================== 고객 A =========================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f001';

select chk('고객A: 기업 표는 직접 못 읽는다(내부 칸 보호)', (select count(*) from public.companies), 0::bigint);
select chk('고객A: 고객용 보기로 자기 회사만',   (select count(*) from public.client_companies), 1::bigint);
select chk('고객A: 고객용 보기에 메모 칸 없음',  (select count(*) from information_schema.columns where table_name='client_companies' and column_name in ('memo','lead_source','shareholders','custom_fields','docs')), 0::bigint);
select chk('고객A: 프로젝트 보기에 진행 메모 없음', (select count(*) from information_schema.columns where table_name='client_projects' and column_name in ('work_status','next_step','waiting_since')), 0::bigint);
select chk('고객A: 보이는 회사가 A다',          (select name from public.client_companies), '에이테스트(주)');
select chk('고객A: 프로젝트 표 직접 못 읽는다',    (select count(*) from public.projects), 0::bigint);
select chk('고객A: 공개·미보관 프로젝트만',      (select count(*) from public.client_projects), 1::bigint);
select chk('고객A: 그 프로젝트가 pj_a1',        (select id from public.client_projects), 'pj_a1');
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
select chk('고객A: 제안·내 요청만 보인다',          (select count(*) from public.client_opportunities), 2::bigint);
select chk('고객A: 매출기회 표 직접 못 읽는다',      (select count(*) from public.opportunities), 0::bigint);
select chk('고객A: 제안 이력에 담당자 메모 없음',    (select count(*) from public.client_opportunities o, jsonb_array_elements(o.history) h where h ? 'note'), 0::bigint);
select chk('고객A: 내부 등록 기회(내부 메모) 안 보인다', (select count(*) from public.client_opportunities where source in ('internal','rule')), 0::bigint);
select chk('고객A: B사 제안은 안 보인다',          (select count(*) from public.client_opportunities where id='op_bp'), 0::bigint);
select chk('고객A: 제안을 직접 못 만든다',
       denied($$insert into public.opportunities(id, company_id, service_key, service_name, source, status) values ('op_evil','co_a','kpjk_x','x','proposal','proposed')$$), true);
select chk('고객A: 제안 이유를 못 고친다',
       affected($$update public.opportunities set reason='변조' where id='op_prop'$$), 0::bigint);
select chk('고객A: 공지는 자기 회사 + 전체 공지만',  (select count(*) from public.notices), 2::bigint);
select chk('고객A: B사 공지는 안 보인다',       (select count(*) from public.notices where id='nc_b'), 0::bigint);
select chk('고객A: 게시 기한 지난 공지는 안 보인다', (select count(*) from public.notices where id='nc_old'), 0::bigint);
select chk('고객A: 게시 전 공지는 안 보인다',     (select count(*) from public.notices where id='nc_later'), 0::bigint);
-- 고객 관리 기록은 자기 회사 것이라도 전부 내부 전용
select chk('고객A: 서류함 상태 안 보인다(보관 메모 포함)', (select count(*) from public.company_vaults), 0::bigint);
select chk('고객A: 서류함 파일 목록 안 보인다',   (select count(*) from public.company_files), 0::bigint);
select chk('고객A: 업무 일기 안 보인다',          (select count(*) from public.journal_entries), 0::bigint);
select chk('고객A: 수금 안 보인다',               (select count(*) from public.payments), 0::bigint);
select chk('고객A: 수금·일기 기록은 안 보인다',
       (select count(*) from public.activities where type in ('payment_received','journal_written')), 0::bigint);
select chk('고객A: 일반 기록은 보인다(등록·자료 제출)', (select count(*) from public.activities), 2::bigint);
select chk('고객A: 승인·견적 초안·메모 수정 기록 안 보인다', (select count(*) from public.activities where type in ('approval_requested','quote_created','company_updated')), 0::bigint);
select chk('고객A: 서류함 보관함 파일 못 본다',  (select count(*) from storage.objects where bucket_id='vault'), 0::bigint);
select chk('고객A: 서류함 보관함에 못 올린다',
       denied($$insert into storage.objects(bucket_id, name) values ('vault','co_a/x__file.pdf')$$), true);
select chk('고객A: 수금을 못 만든다',
       denied($$insert into public.payments(id, company_id, kind, label) values ('pm_x','co_a','deposit','x')$$), true);
select chk('고객A: 입금 확인을 못 바꾼다',
       affected($$update public.payments set received_at=current_date where id='pm_a1'$$), 0::bigint);
select chk('고객A: 공지를 쓸 수 없다',
       denied($$insert into public.notices(id, title) values ('nc_x','고객이 쓴 공지')$$), true);
select chk('고객A: 공지를 고칠 수 없다',
       affected($$update public.notices set title='변조' where id='nc_a'$$), 0::bigint);
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
select chk('컨설턴트: 공지는 전부 보인다',        (select count(*) from public.notices), 5::bigint);
select chk('컨설턴트: 공지를 쓸 수 있다',
       affected($$insert into public.notices(id, title) values ('nc_c','컨설턴트 공지')$$), 1::bigint);
select chk('컨설턴트(전체): 서류함 두 곳 다 보인다', (select count(*) from public.company_vaults), 2::bigint);
select chk('컨설턴트(전체): 수금 두 건 보인다',   (select count(*) from public.payments), 2::bigint);
select chk('컨설턴트(전체): 서류함 보관함 파일 보인다', (select count(*) from storage.objects where bucket_id='vault'), 2::bigint);
select chk('컨설턴트: 업무 일기를 쓸 수 있다',
       affected($$insert into public.journal_entries(id, company_id, type, content) values ('jn_c','co_a','note','메모')$$), 1::bigint);
select chk('컨설턴트: 빈 일기는 거절된다',
       denied($$insert into public.journal_entries(id, company_id, type, content) values ('jn_e','co_a','note','   ')$$), true);
select chk('컨설턴트: 입금 확인을 할 수 있다',
       affected($$update public.payments set received_at=current_date where id='pm_a1'$$), 1::bigint);
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
select chk('컨설턴트(내담당): B사 수금 안 보인다',   (select count(*) from public.payments where company_id='co_b'), 0::bigint);
select chk('컨설턴트(내담당): B사 서류 파일 안 보인다', (select count(*) from public.company_files where company_id='co_b'), 0::bigint);
select chk('컨설턴트(내담당): B사 업무 안 보인다',  (select count(*) from public.tasks where company_id='co_b'), 0::bigint);
select chk('컨설턴트(내담당): 회사 없는 내부 업무는 보인다', (select count(*) from public.tasks where id='tk_x'), 1::bigint);
select chk('컨설턴트(내담당): B사 업무 못 바꾼다',
       affected($$update public.tasks set title='x' where id='tk_b1'$$), 0::bigint);
select chk('컨설턴트(내담당): B사 보관함 원본 못 연다',
       (select count(*) from storage.objects where bucket_id='vault' and name like 'co_b/%'), 0::bigint);
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

-- =========================== 고객 행동의 자동 후속 (트리거) ====================
-- 고객은 내부 업무·자동 기록·고객용 알림을 직접 쓸 수 없다. 대신 "제출·문의" 한 줄을 쓰면 서버가 후속을 만든다.
update public.projects set stage='doc_request' where id='pj_a1';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f001';   -- 고객 A
select chk('고객A: 내부 업무를 직접 못 만든다',
       denied($$insert into public.tasks(id, company_id, title) values ('tk_evil','co_a','가짜 업무')$$), true);
select chk('고객A: 작성자 없는 자동 기록(system)을 못 쓴다',
       denied($$insert into public.activities(id, type, company_id, actor_id, actor_role, message) values ('ac_evil','task_created','co_a',null,'system','가짜')$$), true);
select chk('고객A: 고객용 알림을 직접 못 만든다',
       denied($$insert into public.notifications(id, audience, company_id, title) values ('nt_evil','client','co_a','가짜')$$), true);
select chk('고객A: 담당자 알림은 보낼 수 있다',
       affected($$insert into public.notifications(id, audience, company_id, title) values ('nt_ok','internal','co_a','새 자료 도착')$$), 1::bigint);
select chk('고객A: 자료요청을 제출함으로 바꾼다',
       affected($$update public.document_requests set status='submitted', submitted_at=now() where id='dr_a1'$$), 1::bigint);
select chk('고객A: 제출 파일 기록',
       affected($$insert into public.document_files(id, request_id, file_name, size, uploaded_by, version) values ('df_t1','dr_a1','bizreg.pdf',1000,'00000000-0000-0000-0000-00000000f001',1)$$), 1::bigint);
select chk('고객A: 문의를 남긴다',
       affected($$insert into public.inquiries(id, company_id, title, created_by, status) values ('iq_t1','co_a','트리거 문의','00000000-0000-0000-0000-00000000f001','open')$$), 1::bigint);
reset role; reset request.jwt.claim.sub;

select chk('서버: 제출 → 검토 업무 자동 생성(담당 컨설턴트)',
       (select count(*) from public.tasks where source='auto' and title like '%사업자등록증 검토' and assignee_id='00000000-0000-0000-0000-00000000c001'), 1::bigint);
select chk('서버: 제출 → 고객 접수 알림',
       (select count(*) from public.notifications where audience='client' and company_id='co_a' and title='자료가 접수되었습니다'), 1::bigint);
select chk('서버: 제출 → 자동 기록(system)',
       (select count(*) from public.activities where type='task_created' and actor_id is null and actor_role='system' and company_id='co_a' and message like '%사업자등록증 검토%'), 1::bigint);
select chk('서버: 요청자료가 다 모이면 단계 → 자료접수',
       (select stage from public.projects where id='pj_a1'), 'doc_received');
select chk('서버: 고객 문의 → 답변 업무(담당 컨설턴트)',
       (select count(*) from public.tasks where source='auto' and title like '%문의 답변: 트리거 문의' and assignee_id='00000000-0000-0000-0000-00000000c001'), 1::bigint);
select chk('서버: 문의 담당자 자동 지정',
       (select assignee_id::text from public.inquiries where id='iq_t1'), '00000000-0000-0000-0000-00000000c001');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';   -- 컨설턴트
select chk('컨설턴트: 고객용 알림을 보낸다(자기는 못 읽어도)',
       affected($$insert into public.notifications(id, audience, company_id, title) values ('nt_c1','client','co_a','검토 완료')$$), 1::bigint);
select chk('컨설턴트: 자동 기록(system)을 남긴다',
       affected($$insert into public.activities(id, type, company_id, actor_id, actor_role, message) values ('ac_sys1','project_stage_changed','co_a',null,'system','자동')$$), 1::bigint);
select chk('컨설턴트: 남의 이름으로 기록 못 남긴다',
       denied($$insert into public.activities(id, type, company_id, actor_id, actor_role, message) values ('ac_fake','sign_in','co_a','00000000-0000-0000-0000-00000000a001','admin','가짜')$$), true);
select chk('컨설턴트: 답변',
       affected($$insert into public.inquiry_messages(id, inquiry_id, author_id, author_role, body) values ('m_c1','iq_t1','00000000-0000-0000-0000-00000000c001','consultant','답변')$$), 1::bigint);
update public.inquiries set status='answered' where id='iq_t1';
reset role; reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f001';   -- 고객 A 추가 질문
select chk('고객A: 문의 행을 직접 못 고친다',
       affected($$update public.inquiries set status='closed' where id='iq_t1'$$), 0::bigint);
select chk('고객A: 추가 질문',
       affected($$insert into public.inquiry_messages(id, inquiry_id, author_id, author_role, body) values ('m_f1','iq_t1','00000000-0000-0000-0000-00000000f001','client','추가 질문')$$), 1::bigint);
reset role; reset request.jwt.claim.sub;
select chk('서버: 고객 추가 질문 → 문의가 다시 답변 대기', (select status from public.inquiries where id='iq_t1'), 'open');

-- =========================== 지원사업 공고 · 가망고객 =========================
insert into public.support_programs(id, title, regions) values ('bz_t1', '시험 공고', '{경기}');
set role anon;
select chk('비로그인: 공고는 읽는다',            (select count(*) from public.support_programs), 1::bigint);
select chk('비로그인: 동의하면 상담 남김',
       affected($$insert into public.leads(id, company_name, contact_name, phone, consent) values ('ld_t1','가망(주)','홍','010-1234-5678', true)$$), 1::bigint);
select chk('비로그인: 동의 없으면 못 남김',
       denied($$insert into public.leads(id, company_name, contact_name, phone, consent) values ('ld_t2','가망(주)','홍','010-1234-5678', false)$$), true);
select chk('비로그인: 상태를 미리 정할 수 없다',
       denied($$insert into public.leads(id, company_name, contact_name, phone, consent, status) values ('ld_t3','가망(주)','홍','010-1234-5678', true, 'converted')$$), true);
select chk('비로그인: 가망고객 목록 못 본다',     visible($$select * from public.leads$$), 0::bigint);
select chk('비로그인: 공고를 못 만든다',
       denied($$insert into public.support_programs(id, title) values ('x','x')$$), true);
reset role;
select chk('서버: 가망고객 → 연락 업무 자동', (select count(*) from public.tasks where title like '가망(주) 가망고객 연락%'), 1::bigint);
select chk('서버: 가망고객 → 담당자 알림', (select count(*) from public.notifications where audience='internal' and title = '새 가망고객: 가망(주)'), 1::bigint);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f001';   -- 고객 A
select chk('고객A: 가망고객 목록 못 본다',      (select count(*) from public.leads), 0::bigint);
select chk('고객A: 공고는 읽는다',              (select count(*) from public.support_programs), 1::bigint);
select chk('고객A: 공고를 못 고친다',
       affected($$update public.support_programs set title='x' where id='bz_t1'$$), 0::bigint);
reset role; reset request.jwt.claim.sub;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000c001';   -- 컨설턴트
select chk('컨설턴트: 가망고객 본다',           (select count(*) from public.leads), 1::bigint);
select chk('컨설턴트: 공고 추가',
       affected($$insert into public.support_programs(id, title) values ('mp_t2','직접 추가 공고')$$), 1::bigint);
select chk('컨설턴트: 가망고객 상태 변경',
       affected($$update public.leads set status='contacted' where id='ld_t1'$$), 1::bigint);
reset role; reset request.jwt.claim.sub;

-- =========================== 지원사업 공고 매일 자동 갱신 (공고 저장 전용 열쇠) ==========
select public.kpjk_set_program_sync_key('rls-test-sync-key-0001');
set role anon;
select chk('비로그인: 자동 갱신 열쇠를 바꿀 수 없다',
       denied($$select public.kpjk_set_program_sync_key('attacker-key-000000000')$$), true);
select chk('비로그인: 열쇠 보관함을 못 읽는다',     denied($$select * from kpjk_private.secrets$$), true);
select chk('틀린 열쇠: 공고를 넣을 수 없다',
       denied($$select public.kpjk_sync_programs('wrong-key', '[{"id":"bz_t9","title":"가짜"}]'::jsonb)$$), true);
select chk('맞는 열쇠: 기업마당 공고(bz_)만 넣는다',
       (public.kpjk_sync_programs('rls-test-sync-key-0001', '[{"id":"bz_t9","title":"자동 공고"},{"id":"mp_x9","title":"가짜 직접 공고"}]'::jsonb)->>'added')::int, 1);
select chk('맞는 열쇠: 담당자가 직접 넣은 공고는 못 고친다',
       (public.kpjk_sync_programs('rls-test-sync-key-0001', '[{"id":"mp_t2","title":"바꿔치기"}]'::jsonb)->>'updated')::int, 0);
reset role;
select chk('알림 보낸 기록은 갱신에도 남는다',
       (select count(*) from public.support_programs where id = 'mp_t2' and title = '직접 추가 공고'), 1::bigint);

-- =========================== 결과 ===========================================
select n, case when pass then '통과' else '실패' end as 결과, label as 검증, detail as 비고
from _r order by n;
select count(*) filter (where pass) as 통과, count(*) filter (where not pass) as 실패 from _r;
