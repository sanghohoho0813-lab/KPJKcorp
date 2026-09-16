-- =============================================================================
-- KPJK — 04. 첫 대표 계정 연결
-- =============================================================================
-- 순서
--   1) Supabase 대시보드 → Authentication → Users → "Add user"
--      Email: 대표님 이메일 / Password: 쓰실 비밀번호
--      "Auto Confirm User" 를 켜 두세요 (확인 메일 없이 바로 로그인됩니다)
--   2) 아래 마지막 줄의 이메일·이름·직책을 고쳐서 이 파일 전체를 실행
--
-- 이 함수는 대표 계정이 하나도 없을 때만 동작합니다. 두 번째 대표부터는
-- 앱의 설정 → 사용자 관리에서 만듭니다.
-- =============================================================================

create or replace function public.kpjk_bootstrap_admin(
  p_email text, p_name text, p_title text default '대표이사'
) returns text
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    return '이미 대표 계정이 있습니다. 추가 계정은 앱의 설정 → 사용자 관리에서 만드세요.';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then
    return format('auth 사용자 %s 를 찾을 수 없습니다. 대시보드 Authentication → Users 에서 먼저 만들어 주세요.', p_email);
  end if;

  insert into public.profiles (id, name, role, title, email, active)
  values (v_uid, p_name, 'admin', p_title, lower(p_email), true)
  on conflict (id) do update set role = 'admin', active = true, name = excluded.name;

  return format('대표 계정 연결 완료: %s (%s). 이제 앱에서 이 이메일로 로그인하세요.', p_name, p_email);
end $$;

-- ↓↓↓ 이 줄만 대표님 정보로 고쳐서 실행하세요 ↓↓↓
select public.kpjk_bootstrap_admin('ceo@kpjk.co.kr', '김영돈', '대표이사');
