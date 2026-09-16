-- =============================================================================
-- KPJK — 03. 파일 보관함 (Storage)
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
