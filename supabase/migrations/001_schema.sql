-- =============================================================================
-- KPJK CORPORATION — Consulting Operations AX  ·  01. 스키마
-- =============================================================================
-- 실행 위치: Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run
-- 실행 순서: 001 → 002 → 003 → 004
--
-- 설계 원칙
--  1) 기본키는 앱이 만드는 문자열 ID(co_xxx, pj_xxx …)를 그대로 쓴다.
--     새 레코드를 만들 때 서버 왕복 없이 화면이 먼저 반응해야 하기 때문이다.
--     사람 계정(profiles)만 예외로 Supabase Auth의 UUID를 쓴다 — 로그인 주체이기 때문이다.
--  2) 동시에 여러 사람이 덧붙이는 것(문의 메시지, 제출 파일)은 별도 테이블로 뺀다.
--     JSONB 배열에 넣으면 두 사람이 같은 순간에 쓸 때 한쪽이 사라진다.
--  3) 그 외 중첩 구조(상담 요약, 견적 항목, 진행 이력)는 JSONB. 한 사람이 통째로 저장한다.
--  4) 기록(activities)은 추가만 한다. 수정·삭제 권한을 아무에게도 주지 않는다.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. 사람 (Supabase Auth 사용자 1명 = profiles 1행)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  role          text not null check (role in ('admin','consultant','client')),
  title         text not null default '',
  email         text not null unique,
  phone         text,
  company_id    text,                              -- client 계정만 채워진다
  active        boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);
comment on table public.profiles is '로그인 계정의 업무상 정보. 비밀번호는 auth.users가 보관하며 이 테이블에는 없다.';

-- -----------------------------------------------------------------------------
-- 2. 기업고객
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id                 text primary key,
  code               text not null,
  name               text not null,
  ceo                text not null default '',
  industry           text not null default '',
  biz_no             text not null default '',
  contact_name       text not null default '',
  contact_title      text not null default '',
  contact_phone      text not null default '',
  contact_email      text not null default '',
  address            text not null default '',
  employees          integer not null default 0,
  revenue            text not null default '',
  first_consult_date timestamptz not null default now(),
  consultant_id      uuid,
  memo               text not null default '',
  archived           boolean not null default false,
  archived_at        timestamptz,
  -- 확장 정보 (서류에서 읽거나 클릭으로 고른 값)
  entity_type        text check (entity_type in ('corporation','sole','other')),
  corp_no            text,
  established_at     date,
  biz_category       text,
  biz_item           text,
  ceo_birth          date,          -- 주민등록번호 뒷자리는 저장하지 않는다
  capital            bigint,
  region             text,
  employee_band      text,
  revenue_band       text,
  company_phone      text,
  website            text,
  interests          text[] not null default '{}',
  lead_source        text,
  docs               jsonb,         -- 어떤 서류를 언제 어떻게 읽었는지 (파일 자체는 저장하지 않음)
  sample             boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists companies_consultant_idx on public.companies(consultant_id);
create index if not exists companies_archived_idx   on public.companies(archived);

-- 순환 참조라 테이블 생성 후에 건다
alter table public.profiles  drop constraint if exists profiles_company_fk;
alter table public.profiles  add  constraint profiles_company_fk
  foreign key (company_id) references public.companies(id) on delete set null;
alter table public.companies drop constraint if exists companies_consultant_fk;
alter table public.companies add  constraint companies_consultant_fk
  foreign key (consultant_id) references public.profiles(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 3. 프로젝트
-- -----------------------------------------------------------------------------
create table if not exists public.projects (
  id               text primary key,
  company_id       text not null references public.companies(id) on delete cascade,
  name             text not null,
  type             text not null default '기타',
  consultant_id    uuid references public.profiles(id) on delete set null,
  start_date       timestamptz not null default now(),
  due_date         timestamptz not null default now(),
  stage            text not null default 'consult',
  description      text not null default '',
  stage_changed_at timestamptz not null default now(),
  client_visible   boolean not null default true,
  archived         boolean not null default false,
  archived_at      timestamptz,
  next_milestone   jsonb,          -- { label, date } — 담당자가 직접 적은 것만
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists projects_company_idx on public.projects(company_id);

-- -----------------------------------------------------------------------------
-- 4. 상담기록
-- -----------------------------------------------------------------------------
create table if not exists public.consultations (
  id            text primary key,
  company_id    text not null references public.companies(id) on delete cascade,
  project_id    text references public.projects(id) on delete set null,
  date          timestamptz not null default now(),
  consultant_id uuid references public.profiles(id) on delete set null,
  type          text not null default '초기상담',
  channel       text not null default '방문',
  notes         text not null default '',
  summary       jsonb not null default '{}'::jsonb,   -- core/requirements/promises/documents/nextAction
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists consultations_company_idx on public.consultations(company_id);

-- -----------------------------------------------------------------------------
-- 5. 계약
-- -----------------------------------------------------------------------------
create table if not exists public.contracts (
  id         text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  title      text not null,
  status     text not null default 'draft' check (status in ('draft','sent','signed')),
  sent_at    timestamptz,
  signed_at  timestamptz,
  period     text not null default '',
  scope      text not null default '',
  end_date   timestamptz,
  amount     bigint,
  source     text check (source in ('quote','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contracts_company_idx on public.contracts(company_id);

-- -----------------------------------------------------------------------------
-- 6. 자료요청 + 제출 파일
-- -----------------------------------------------------------------------------
create table if not exists public.document_requests (
  id           text primary key,
  company_id   text not null references public.companies(id) on delete cascade,
  project_id   text references public.projects(id) on delete set null,
  name         text not null,
  description  text not null default '',
  requested_at timestamptz not null default now(),
  due_date     timestamptz not null default now(),
  status       text not null default 'planned'
               check (status in ('planned','requested','submitted','reviewing','revision','done')),
  assignee_id  uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at  timestamptz,
  review_note  text,
  memo         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists doc_requests_company_idx on public.document_requests(company_id);

-- 고객이 여러 번 올리고 담당자가 반려하면 또 올린다 — 행으로 쌓아야 한 건도 안 잃는다
create table if not exists public.document_files (
  id           text primary key,
  request_id   text not null references public.document_requests(id) on delete cascade,
  file_name    text not null,
  size         bigint not null default 0,
  uploaded_at  timestamptz not null default now(),
  uploaded_by  uuid references public.profiles(id) on delete set null,
  version      integer not null default 1,
  storage_path text                                  -- documents 버킷 내 경로
);
create index if not exists document_files_request_idx on public.document_files(request_id);

-- -----------------------------------------------------------------------------
-- 7. 일정
-- -----------------------------------------------------------------------------
create table if not exists public.schedules (
  id                text primary key,
  company_id        text references public.companies(id) on delete cascade,
  project_id        text references public.projects(id) on delete set null,
  title             text not null,
  type              text not null default 'meeting',
  start_at          timestamptz not null,
  end_at            timestamptz,
  location          text,
  assignee_id       uuid references public.profiles(id) on delete set null,
  visible_to_client boolean not null default true,
  memo              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists schedules_start_idx on public.schedules(start_at);

-- -----------------------------------------------------------------------------
-- 8. 업무
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id           text primary key,
  company_id   text references public.companies(id) on delete cascade,
  project_id   text references public.projects(id) on delete set null,
  title        text not null,
  type         text not null default '기타',
  due_date     timestamptz not null default now(),
  assignee_id  uuid references public.profiles(id) on delete set null,
  status       text not null default 'todo' check (status in ('todo','doing','done','hold')),
  priority     text not null default 'normal' check (priority in ('urgent','normal','low')),
  memo         text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  source       text check (source in ('manual','auto')),
  rule_key     text,
  updated_at   timestamptz not null default now()
);
create index if not exists tasks_assignee_idx on public.tasks(assignee_id, status);
-- 같은 규칙이 같은 대상에 업무를 두 번 만들지 못하게 DB가 막는다
create unique index if not exists tasks_rule_key_uidx on public.tasks(rule_key) where rule_key is not null;

-- -----------------------------------------------------------------------------
-- 9. 문의 + 메시지
-- -----------------------------------------------------------------------------
create table if not exists public.inquiries (
  id          text primary key,
  company_id  text not null references public.companies(id) on delete cascade,
  project_id  text references public.projects(id) on delete set null,
  title       text not null,
  category    text not null default '기타',
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null,
  status      text not null default 'open' check (status in ('open','answered','closed')),
  assignee_id uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists inquiries_company_idx on public.inquiries(company_id, status);

create table if not exists public.inquiry_messages (
  id          text primary key,
  inquiry_id  text not null references public.inquiries(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  author_role text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists inquiry_messages_inquiry_idx on public.inquiry_messages(inquiry_id, created_at);

-- -----------------------------------------------------------------------------
-- 10. 결과자료
-- -----------------------------------------------------------------------------
create table if not exists public.results (
  id           text primary key,
  company_id   text not null references public.companies(id) on delete cascade,
  project_id   text references public.projects(id) on delete set null,
  name         text not null,
  kind         text not null default '기타',
  shared_at    timestamptz not null default now(),
  shared_by    uuid references public.profiles(id) on delete set null,
  size         bigint not null default 0,
  description  text not null default '',
  storage_path text                                  -- results 버킷 내 경로
);
create index if not exists results_company_idx on public.results(company_id);

-- -----------------------------------------------------------------------------
-- 11. 매출기회
-- -----------------------------------------------------------------------------
create table if not exists public.opportunities (
  id           text primary key,
  company_id   text not null references public.companies(id) on delete cascade,
  service_key  text not null,
  service_name text not null,
  source       text not null default 'internal',
  status       text not null default 'interest',
  assignee_id  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id) on delete set null,
  updated_at   timestamptz not null default now(),
  note         text,
  reason       text,
  history      jsonb not null default '[]'::jsonb
);
create index if not exists opportunities_company_idx on public.opportunities(company_id, status);

-- -----------------------------------------------------------------------------
-- 12. 견적
-- -----------------------------------------------------------------------------
create table if not exists public.quotes (
  id             text primary key,
  company_id     text not null references public.companies(id) on delete cascade,
  project_id     text references public.projects(id) on delete set null,
  opportunity_id text references public.opportunities(id) on delete set null,
  title          text not null,
  scope          text not null default '',
  period         text not null default '',
  items          jsonb not null default '[]'::jsonb,
  discount_pct   numeric not null default 0,
  valid_until    timestamptz not null default now(),
  status         text not null default 'draft',
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz,
  responded_at   timestamptz,
  client_note    text,
  approval_id    text,
  contract_id    text,
  updated_at     timestamptz not null default now()
);
create index if not exists quotes_company_idx on public.quotes(company_id, status);

-- -----------------------------------------------------------------------------
-- 13. 대표 승인
-- -----------------------------------------------------------------------------
create table if not exists public.approvals (
  id             text primary key,
  kind           text not null check (kind in ('opportunity','discount','promise')),
  title          text not null,
  summary        text not null default '',
  company_id     text references public.companies(id) on delete cascade,
  project_id     text references public.projects(id) on delete set null,
  opportunity_id text references public.opportunities(id) on delete set null,
  quote_id       text references public.quotes(id) on delete set null,
  base_amount    bigint,
  discount_pct   numeric,
  requested_by   uuid references public.profiles(id) on delete set null,
  requested_at   timestamptz not null default now(),
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by     uuid references public.profiles(id) on delete set null,
  decided_at     timestamptz,
  decision_note  text
);
create index if not exists approvals_status_idx on public.approvals(status, requested_at);

-- -----------------------------------------------------------------------------
-- 14. 활동 기록 (append-only — 실증 리포트의 근거)
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id         text primary key,
  type       text not null,
  company_id text references public.companies(id) on delete set null,
  project_id text references public.projects(id) on delete set null,
  actor_id   uuid,
  actor_role text not null,
  at         timestamptz not null default now(),
  message    text not null,
  meta       jsonb
);
create index if not exists activities_at_idx      on public.activities(at desc);
create index if not exists activities_company_idx on public.activities(company_id, at desc);
comment on table public.activities is '추가만 하는 기록. 수정·삭제 정책을 만들지 않는다 — 실증 리포트가 이 테이블을 근거로 삼는다.';

-- -----------------------------------------------------------------------------
-- 15. 알림
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id         text primary key,
  audience   text not null check (audience in ('internal','client')),
  company_id text references public.companies(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  at         timestamptz not null default now(),
  read       boolean not null default false,
  href       text not null default '/'
);
create index if not exists notifications_audience_idx on public.notifications(audience, at desc);

-- -----------------------------------------------------------------------------
-- 16. AX 고도화 설문
-- -----------------------------------------------------------------------------
create table if not exists public.surveys (
  id             text primary key,
  survey_version text not null,
  stage          text not null,
  user_id        uuid references public.profiles(id) on delete set null,
  user_name      text not null default '',
  role           text not null,
  answers        jsonb not null default '{}'::jsonb,
  free_text      text,
  submitted_at   timestamptz not null default now(),
  duration_sec   integer
);

-- -----------------------------------------------------------------------------
-- 17. 조직 설정 (한 행만 쓴다)
-- -----------------------------------------------------------------------------
-- 테마·글자크기 같은 개인 취향은 여기 넣지 않는다. 기기마다 다른 게 맞으므로 브라우저에 남긴다.
create table if not exists public.app_settings (
  id                integer primary key default 1 check (id = 1),
  org               jsonb,                          -- 인쇄물 상단 회사 정보
  baseline          jsonb,                          -- 도입 전 기준선 (대표 입력값)
  sprint_started_at timestamptz,
  auto_rules        jsonb,
  consultant_scope  text not null default 'all' check (consultant_scope in ('all','own')),
  updated_at        timestamptz not null default now()
);
comment on column public.app_settings.consultant_scope is
  'all = 컨설턴트가 전 기업을 본다(현재). own = 자기 담당만 본다. 이 값 하나로 RLS 전체가 바뀐다.';

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 18. updated_at 자동 갱신
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'companies','projects','consultations','contracts','document_requests',
    'schedules','tasks','inquiries','opportunities','quotes','app_settings'
  ] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 19. 접근 권한 1차 관문
-- -----------------------------------------------------------------------------
-- Supabase 는 public 스키마에 만든 테이블을 authenticated 에게 자동으로 열어준다.
-- 의존하지 않고 명시한다. 실제 차단은 002 의 RLS 가 한다 — 이건 바깥 문일 뿐이다.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- 기록은 바깥 문에서부터 수정·삭제를 막는다. RLS 정책 실수로도 지워지지 않게.
revoke update, delete on public.activities from authenticated;
revoke update, delete on public.inquiry_messages from authenticated;
revoke insert, update, delete on public.app_settings from authenticated;
grant  update on public.app_settings to authenticated;   -- 대표만 통과(RLS)
