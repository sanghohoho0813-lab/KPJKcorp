-- =============================================================================
--  KPJK CORPORATION — 컨설팅 운영 AX  ·  서버 설치 (전체)
-- =============================================================================
--
--  이 파일 하나만 실행하면 서버 준비가 끝납니다.
--
--  실행 방법
--    Supabase 대시보드 → SQL Editor → New query
--    편집기 안을 클릭 → Ctrl+A (전체 선택) → Ctrl+V (붙여넣기) → Run
--
--    ※ Ctrl+A 를 꼭 먼저 누르세요.
--      그냥 붙여넣으면 편집기에 있던 글자가 맨 아래에 남아
--      "syntax error at or near ..." 오류가 납니다.
--      그럴 때는 맨 아랫줄의 남은 글자만 지우고 다시 Run 하면 됩니다.
--      (오류가 나면 아무것도 만들어지지 않으니 안심하고 다시 실행하세요)
--
--  권장 순서
--    1) 먼저 Authentication → Users → "Add user" 로 대표님 로그인 계정을 만드세요.
--       (Email, Password 입력 + "Auto Confirm User" 켜기)
--    2) 그다음 이 파일을 실행하면 그 계정이 자동으로 대표 권한을 받습니다.
--    순서가 바뀌어도 괜찮습니다 — 계정을 만든 뒤 이 파일을 한 번 더 실행하면 됩니다.
--
--  안전합니다
--    - 여러 번 실행해도 됩니다. 이미 있는 것은 건너뛰고, 데이터를 지우지 않습니다.
--    - 중간에 노란 NOTICE 가 여러 줄 나오는 것은 정상입니다. 오류가 아닙니다.
--    - 맨 마지막에 설치 결과 표가 한 줄 나옵니다. 그것으로 성공을 확인하세요.
--
--  이 파일이 만드는 것
--    1부. 표 19개          — 기업·프로젝트·상담·계약·자료·일정·업무·문의·견적·기록
--    2부. 접근 권한        — 누가 무엇을 볼 수 있는지. 데이터베이스가 직접 막습니다
--    3부. 파일 보관함 2개  — 고객 제출자료 / 결과자료
--    4부. 대표 계정 연결
--
--  설치가 끝나면 Project Settings → API 의 두 값을 앱의 .env.local 에 넣으세요.
--  자세한 내용은 supabase/README.md 를 보시면 됩니다.
--
-- =============================================================================


-- =============================================================================
--  1부. 표 만들기
-- =============================================================================
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
-- =============================================================================
--  2부. 접근 권한 (Row Level Security)
-- =============================================================================
-- 지금까지 권한은 화면에서 버튼을 숨기는 수준이었다(업무 규칙). 여기서부터는
-- 데이터베이스가 직접 거절한다. 브라우저 개발자도구로 요청을 조작해도 남의
-- 회사 데이터는 나오지 않는다. 이것이 서버를 붙이는 진짜 이유다.
--
-- 규칙 요약
--   대표(admin)       : 전부
--   컨설턴트(consultant): app_settings.consultant_scope 에 따라 전체 또는 내 담당만
--   고객(client)      : 자기 회사 것만, 그중에서도 공개된 것만. 쓰기는 정해진 것만
--   비로그인(anon)    : 아무것도 없음
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 판단 함수
-- -----------------------------------------------------------------------------
-- security definer 로 두는 이유: profiles 를 조회하는 정책이 다시 profiles 정책을
-- 부르면 무한 재귀가 난다. definer 함수는 RLS를 우회하므로 그 고리를 끊는다.

create or replace function public.kpjk_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.kpjk_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.kpjk_role() = 'admin', false)
$$;

create or replace function public.kpjk_is_internal() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.kpjk_role() in ('admin','consultant'), false)
$$;

create or replace function public.kpjk_is_client() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.kpjk_role() = 'client', false)
$$;

/** 로그인한 고객의 소속 기업. 내부 계정이면 null */
create or replace function public.kpjk_my_company() returns text
language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid() and active and role = 'client'
$$;

/**
 * 이 기업을 볼 수 있는가 — 모든 테이블 정책이 결국 이 함수 하나로 모인다.
 * 컨설턴트 범위를 '전체'에서 '내 담당만'으로 바꾸려면 app_settings 한 줄만 고치면 된다.
 * 정책을 다시 쓰지 않는다.
 */
create or replace function public.kpjk_can_see_company(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.kpjk_role()
    when 'admin' then true
    when 'consultant' then
      case when (select consultant_scope from public.app_settings where id = 1) = 'own'
        then exists (select 1 from public.companies c where c.id = cid and c.consultant_id = auth.uid())
        else true
      end
    when 'client' then cid is not null and cid = public.kpjk_my_company()
    else false
  end
$$;

/** 로그인 시각 기록 — profiles 를 직접 수정하게 열어주면 role 을 스스로 admin 으로 바꿀 수 있다 */
create or replace function public.kpjk_touch_login() returns void
language sql volatile security definer set search_path = public as $$
  update public.profiles set last_login_at = now() where id = auth.uid()
$$;

grant execute on function
  public.kpjk_role, public.kpjk_is_admin, public.kpjk_is_internal, public.kpjk_is_client,
  public.kpjk_my_company, public.kpjk_can_see_company, public.kpjk_touch_login
  to authenticated;

-- -----------------------------------------------------------------------------
-- 2. 전 테이블 RLS 켜기 — 정책이 없으면 아무도 못 읽는다(기본 거절)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','companies','projects','consultations','contracts','document_requests',
    'document_files','schedules','tasks','inquiries','inquiry_messages','results',
    'opportunities','quotes','approvals','activities','notifications','surveys','app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 3. profiles
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  -- 고객은 자기 자신과 내부 담당자만 본다. 다른 고객사 담당자는 보이지 않는다.
  using (public.kpjk_is_internal() or id = auth.uid() or (role <> 'client' and active));

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.kpjk_is_admin()) with check (public.kpjk_is_admin());
-- 본인이 자기 role 을 바꾸지 못하도록 자기 수정 정책은 일부러 만들지 않는다.
-- 이름·직책 변경도 대표를 통한다. 로그인 시각만 kpjk_touch_login() 이 처리한다.

-- -----------------------------------------------------------------------------
-- 4. 기업 · 프로젝트
-- -----------------------------------------------------------------------------
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (public.kpjk_can_see_company(id));

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies for insert to authenticated
  with check (public.kpjk_is_internal());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (public.kpjk_is_internal() and public.kpjk_can_see_company(id))
  with check (public.kpjk_is_internal());
-- 삭제 정책 없음 — 기업은 지우지 않고 보관한다(archived). 지우면 하위 기록이 전부 고아가 된다.

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (public.kpjk_can_see_company(company_id)
         and (public.kpjk_is_internal() or (client_visible and not archived)));

drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for all to authenticated
  using (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id))
  with check (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id));

-- -----------------------------------------------------------------------------
-- 5. 내부 전용 (고객은 존재 자체를 모른다)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['consultations','opportunities','approvals'] loop
    execute format('drop policy if exists %1$s_internal on public.%1$s', t);
    execute format(
      'create policy %1$s_internal on public.%1$s for all to authenticated
         using (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id))
         with check (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id))', t);
  end loop;
end $$;

-- 승인은 company_id 가 비어 있을 수 있다(회사와 무관한 내부 승인)
drop policy if exists approvals_internal on public.approvals;
create policy approvals_internal on public.approvals for all to authenticated
  using (public.kpjk_is_internal() and (company_id is null or public.kpjk_can_see_company(company_id)))
  with check (public.kpjk_is_internal() and (company_id is null or public.kpjk_can_see_company(company_id)));

-- 고객이 Portal 에서 "관심 있습니다" 를 누르는 경로만 예외로 연다
drop policy if exists opportunities_client_insert on public.opportunities;
create policy opportunities_client_insert on public.opportunities for insert to authenticated
  with check (
    public.kpjk_is_client()
    and company_id = public.kpjk_my_company()
    and status = 'interest'
    and source in ('portal_interest','portal_request')
  );

drop policy if exists opportunities_client_select on public.opportunities;
create policy opportunities_client_select on public.opportunities for select to authenticated
  using (public.kpjk_is_client() and company_id = public.kpjk_my_company());

-- -----------------------------------------------------------------------------
-- 6. 계약 — 고객은 읽기만
-- -----------------------------------------------------------------------------
drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts for select to authenticated
  using (public.kpjk_can_see_company(company_id)
         and (public.kpjk_is_internal() or status <> 'draft'));

drop policy if exists contracts_write on public.contracts;
create policy contracts_write on public.contracts for all to authenticated
  using (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id))
  with check (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id));

-- -----------------------------------------------------------------------------
-- 7. 자료요청 — 고객이 제출한다
-- -----------------------------------------------------------------------------
drop policy if exists doc_requests_select on public.document_requests;
create policy doc_requests_select on public.document_requests for select to authenticated
  using (public.kpjk_can_see_company(company_id)
         and (public.kpjk_is_internal() or status <> 'planned'));

drop policy if exists doc_requests_internal on public.document_requests;
create policy doc_requests_internal on public.document_requests for all to authenticated
  using (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id))
  with check (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id));

-- 고객은 "제출했음" 으로만 바꿀 수 있다. 검토 완료(done)로 건너뛸 수 없다.
drop policy if exists doc_requests_client_submit on public.document_requests;
create policy doc_requests_client_submit on public.document_requests for update to authenticated
  using (public.kpjk_is_client() and company_id = public.kpjk_my_company()
         and status in ('requested','revision'))
  with check (status = 'submitted');

drop policy if exists document_files_select on public.document_files;
create policy document_files_select on public.document_files for select to authenticated
  using (exists (select 1 from public.document_requests r
                 where r.id = request_id and public.kpjk_can_see_company(r.company_id)));

drop policy if exists document_files_insert on public.document_files;
create policy document_files_insert on public.document_files for insert to authenticated
  with check (uploaded_by = auth.uid()
              and exists (select 1 from public.document_requests r
                          where r.id = request_id and public.kpjk_can_see_company(r.company_id)));

drop policy if exists document_files_internal on public.document_files;
create policy document_files_internal on public.document_files for delete to authenticated
  using (public.kpjk_is_internal()
         and exists (select 1 from public.document_requests r
                     where r.id = request_id and public.kpjk_can_see_company(r.company_id)));

-- -----------------------------------------------------------------------------
-- 8. 일정 · 업무
-- -----------------------------------------------------------------------------
drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules for select to authenticated
  using (public.kpjk_is_internal()
         or (visible_to_client and company_id is not null and company_id = public.kpjk_my_company()));

drop policy if exists schedules_write on public.schedules;
create policy schedules_write on public.schedules for all to authenticated
  using (public.kpjk_is_internal()) with check (public.kpjk_is_internal());

-- 업무는 내부 전용이다. 고객에게는 존재하지 않는 개념이다.
drop policy if exists tasks_internal on public.tasks;
create policy tasks_internal on public.tasks for all to authenticated
  using (public.kpjk_is_internal()) with check (public.kpjk_is_internal());

-- -----------------------------------------------------------------------------
-- 9. 문의 — 고객이 만들고, 양쪽이 답한다
-- -----------------------------------------------------------------------------
drop policy if exists inquiries_select on public.inquiries;
create policy inquiries_select on public.inquiries for select to authenticated
  using (public.kpjk_can_see_company(company_id));

drop policy if exists inquiries_internal on public.inquiries;
create policy inquiries_internal on public.inquiries for all to authenticated
  using (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id))
  with check (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id));

drop policy if exists inquiries_client_create on public.inquiries;
create policy inquiries_client_create on public.inquiries for insert to authenticated
  with check (public.kpjk_is_client() and company_id = public.kpjk_my_company()
              and created_by = auth.uid() and status = 'open');

drop policy if exists inquiry_messages_select on public.inquiry_messages;
create policy inquiry_messages_select on public.inquiry_messages for select to authenticated
  using (exists (select 1 from public.inquiries i
                 where i.id = inquiry_id and public.kpjk_can_see_company(i.company_id)));

drop policy if exists inquiry_messages_insert on public.inquiry_messages;
create policy inquiry_messages_insert on public.inquiry_messages for insert to authenticated
  with check (author_id = auth.uid()
              and exists (select 1 from public.inquiries i
                          where i.id = inquiry_id and public.kpjk_can_see_company(i.company_id)));
-- 수정·삭제 정책 없음: 주고받은 말은 고치지 않는다.

-- -----------------------------------------------------------------------------
-- 10. 결과자료 — 담당자가 공유하고 고객이 내려받는다
-- -----------------------------------------------------------------------------
drop policy if exists results_select on public.results;
create policy results_select on public.results for select to authenticated
  using (public.kpjk_can_see_company(company_id));

drop policy if exists results_write on public.results;
create policy results_write on public.results for all to authenticated
  using (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id))
  with check (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id));

-- -----------------------------------------------------------------------------
-- 11. 견적 — 고객은 발송된 것만 보고, 수락·거절만 한다
-- -----------------------------------------------------------------------------
drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes for select to authenticated
  using (public.kpjk_can_see_company(company_id)
         and (public.kpjk_is_internal()
              or status in ('sent','accepted','declined','converted')));

drop policy if exists quotes_internal on public.quotes;
create policy quotes_internal on public.quotes for all to authenticated
  using (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id))
  with check (public.kpjk_is_internal() and public.kpjk_can_see_company(company_id));

-- 금액·항목을 고객이 고칠 수 없게 상태만 바꾸도록 좁힌다
drop policy if exists quotes_client_respond on public.quotes;
create policy quotes_client_respond on public.quotes for update to authenticated
  using (public.kpjk_is_client() and company_id = public.kpjk_my_company() and status = 'sent')
  with check (status in ('accepted','declined'));

-- -----------------------------------------------------------------------------
-- 12. 활동 기록 — 추가만 (수정·삭제 정책을 아무에게도 주지 않는다)
-- -----------------------------------------------------------------------------
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities for select to authenticated
  using (public.kpjk_is_internal()
         or (company_id is not null and company_id = public.kpjk_my_company()));

drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities for insert to authenticated
  with check (actor_id = auth.uid()
              and (company_id is null or public.kpjk_can_see_company(company_id)));

-- -----------------------------------------------------------------------------
-- 13. 알림 · 설문 · 설정
-- -----------------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using ((audience = 'internal' and public.kpjk_is_internal())
         or (audience = 'client' and company_id is not null and company_id = public.kpjk_my_company()));

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.kpjk_is_internal()
              or (audience = 'internal' and company_id = public.kpjk_my_company()));

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using ((audience = 'internal' and public.kpjk_is_internal())
         or (audience = 'client' and company_id = public.kpjk_my_company()));

drop policy if exists surveys_insert on public.surveys;
create policy surveys_insert on public.surveys for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists surveys_select on public.surveys;
create policy surveys_select on public.surveys for select to authenticated
  using (public.kpjk_is_internal() or user_id = auth.uid());

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated using (true);

drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings for update to authenticated
  using (public.kpjk_is_admin()) with check (public.kpjk_is_admin());
-- =============================================================================
--  3부. 파일 보관함 (Storage)
-- =============================================================================
-- 버킷 두 개. 둘 다 비공개 — 링크를 아는 것만으로는 열리지 않고, 로그인한
-- 사람의 권한을 매번 확인한다.
--
--   documents : 고객이 제출하는 자료 (사업자등록증·재무제표 등)
--   results   : 담당자가 고객에게 전달하는 결과물 (보고서·제안서)
--
-- 경로 규칙 — 첫 칸이 반드시 기업 ID 다. 권한 판단이 이 한 칸에서 나온다.
--   documents/{company_id}/{request_id}/{file_id}__{원본파일명}
--   results/{company_id}/{result_id}__{원본파일명}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 52428800, null),
  ('results',   'results',   false, 52428800, null)
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit;

-- -----------------------------------------------------------------------------
-- documents — 고객도 올릴 수 있다
-- -----------------------------------------------------------------------------
drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and public.kpjk_can_see_company((storage.foldername(name))[1]));

drop policy if exists documents_upload on storage.objects;
create policy documents_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
              and public.kpjk_can_see_company((storage.foldername(name))[1]));

-- 올린 파일을 지우는 건 내부만. 고객이 제출 후 지우면 검토 기록이 어긋난다.
drop policy if exists documents_delete on storage.objects;
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents'
         and public.kpjk_is_internal()
         and public.kpjk_can_see_company((storage.foldername(name))[1]));

-- -----------------------------------------------------------------------------
-- results — 담당자만 올리고, 고객은 내려받기만
-- -----------------------------------------------------------------------------
drop policy if exists results_read on storage.objects;
create policy results_read on storage.objects for select to authenticated
  using (bucket_id = 'results'
         and public.kpjk_can_see_company((storage.foldername(name))[1]));

drop policy if exists results_write on storage.objects;
create policy results_write on storage.objects for insert to authenticated
  with check (bucket_id = 'results'
              and public.kpjk_is_internal()
              and public.kpjk_can_see_company((storage.foldername(name))[1]));

drop policy if exists results_remove on storage.objects;
create policy results_remove on storage.objects for delete to authenticated
  using (bucket_id = 'results'
         and public.kpjk_is_internal()
         and public.kpjk_can_see_company((storage.foldername(name))[1]));


-- =============================================================================
--  4부. 대표 계정 연결
-- =============================================================================
--  Supabase Auth 에 만들어 둔 로그인 계정에 "대표" 권한을 붙입니다.
--  비밀번호는 Supabase 가 보관하며 이 데이터베이스에는 저장되지 않습니다.
-- =============================================================================

create or replace function public.kpjk_bootstrap_admin(
  p_email text, p_name text default null, p_title text default '대표이사'
) returns text
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    return '이미 대표 계정이 있습니다. 추가 계정은 앱의 설정 → 사용자 관리에서 만드세요.';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then
    return format('로그인 계정 %s 를 찾을 수 없습니다. Authentication → Users 에서 먼저 만들어 주세요.', p_email);
  end if;

  insert into public.profiles (id, name, role, title, email, active)
  values (v_uid, coalesce(nullif(trim(p_name), ''), split_part(p_email, '@', 1)), 'admin', p_title, lower(p_email), true)
  on conflict (id) do update set role = 'admin', active = true, name = excluded.name;

  return format('대표 계정 연결 완료: %s', p_email);
end $$;

-- 로그인 계정이 딱 하나면 그 사람을 대표로 자동 연결한다.
-- 대표님 혼자 처음 설치하는 상황이 거의 전부이므로, 이메일을 손으로 고칠 일을 없앤다.
do $$
declare v_uid uuid; v_email text; v_count int;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise notice '[대표 계정] 이미 연결돼 있습니다. 추가 계정은 앱의 설정 → 사용자 관리에서 만드세요.';
    return;
  end if;

  select count(*) into v_count from auth.users;

  if v_count = 0 then
    raise notice '[대표 계정] 아직 로그인 계정이 없습니다.';
    raise notice '            Authentication → Users → Add user 로 계정을 만든 뒤, 이 파일을 한 번 더 실행하세요.';
    return;
  end if;

  if v_count > 1 then
    raise notice '[대표 계정] 로그인 계정이 %개라 누구를 대표로 할지 알 수 없습니다.', v_count;
    raise notice '            아래 한 줄에서 이메일만 바꿔 따로 실행해 주세요:';
    raise notice '            select public.kpjk_bootstrap_admin(''대표님이메일@example.com'', ''김상호'');';
    return;
  end if;

  select id, email into v_uid, v_email from auth.users limit 1;
  insert into public.profiles (id, name, role, title, email, active)
  values (v_uid, split_part(v_email, '@', 1), 'admin', '대표이사', lower(v_email), true)
  on conflict (id) do update set role = 'admin', active = true;
  raise notice '[대표 계정] 연결 완료: % — 이제 앱에서 이 이메일로 로그인하세요.', v_email;
  raise notice '            표시 이름은 로그인 후 설정 → 사용자 관리에서 바꿀 수 있습니다.';
end $$;


-- =============================================================================
--  설치 결과 — 아래 한 줄로 확인하세요
-- =============================================================================
--  표 19 · 권한정책 48 · 파일보관함 2 가 나오면 설치는 끝난 것입니다.
--  "다음 할 일" 칸에 적힌 대로 하시면 됩니다.

select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE')                as "표",
  (select count(*) from pg_policies where schemaname in ('public', 'storage'))  as "권한정책",
  (select count(*) from storage.buckets where id in ('documents', 'results'))   as "파일보관함",
  (select coalesce(string_agg(email, ', '), '아직 없음')
     from public.profiles where role = 'admin')                                 as "대표계정",
  case
    when exists (select 1 from public.profiles where role = 'admin')
      then '설치 완료. Project Settings → API 에서 Project URL 과 anon public 두 값을 앱의 .env.local 에 넣으세요.'
    when (select count(*) from auth.users) = 0
      then 'Authentication → Users → Add user 로 대표님 로그인 계정을 만든 뒤(Auto Confirm User 켜기), 이 파일을 한 번 더 실행하세요.'
    else '로그인 계정이 여러 개라 대표를 고를 수 없습니다. 이 한 줄만 따로 실행하세요 → select public.kpjk_bootstrap_admin(''대표님이메일@example.com'', ''김상호'');'
  end                                                                            as "다음 할 일";
