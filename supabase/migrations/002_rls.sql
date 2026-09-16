-- =============================================================================
-- KPJK — 02. 접근 권한 (Row Level Security)
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
