// 고객 휴대폰 사진 업로드 — 큰 사진은 서류가 읽히는 크기로 줄여서 올라가는가
//  1) 담당자가 요청한 자료(비식별 시험 요청) → 고객 휴대폰 "사진 찍어 올리기"로 4032x3024 · 약 9MB 서류 사진
//  2) 화면: "사진을 줄여서 올립니다 · 원래 → 줄인 크기" · 제출
//  3) 서버 보관함: JPEG · 1.5MB 미만 · 긴 변 2400px (내려받아 크기 확인, 사진은 out/ 에 남겨 눈으로 판독 확인)
//  4) 작은 사진(1.5MB 이하)·문서 파일은 그대로
// 시험 사진: tools/pilot/files/doc-photo.jpg 가 없으면 시험을 건너뛴다 (만드는 법은 README)
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { launch, ctxFor, login, B, ACC, CO1, ok, sql, summary, SB, FILES } from './lib.mjs';

const BIG = FILES + 'doc-photo.jpg';
if (!existsSync(BIG)) { console.log('SKIP: 시험 사진이 없습니다 —', BIG); process.exit(0); }
const TAG = Date.now().toString(36).slice(-5);
const co = sql(`select id from public.companies where name = '${CO1}' limit 1`);
const REQ = `dr_ps_${TAG}`, REQ2 = `dr_ps2_${TAG}`;
sql(`insert into public.document_requests(id, company_id, name, description, status, due_date) values
  ('${REQ}', '${co}', '사진 업로드 시험 ${TAG}', '시험용 요청 (비식별)', 'requested', now() + interval '3 days'),
  ('${REQ2}', '${co}', '작은 사진 시험 ${TAG}', '시험용 요청 (비식별)', 'requested', now() + interval '3 days')`);

const b = await launch();
const { p } = await ctxFor(b, 'mobile');
await login(p, ACC.c1, /\/portal/);
const openUpload = async (name) => {
  await p.goto(B + '/portal/documents', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  const row = p.locator('div.px-4').filter({ hasText: name }).filter({ has: p.getByRole('button', { name: '업로드' }) }).last();
  await row.getByRole('button', { name: '업로드' }).click(); await p.waitForTimeout(600);
};
await openUpload(`사진 업로드 시험 ${TAG}`);
const dlg = p.locator('[role=dialog]').last();
await dlg.locator('[data-testid=camera-upload] input[type=file]').setInputFiles(BIG);
await dlg.getByTestId('upload-size').waitFor({ timeout: 20000 });
const shown = await dlg.getByTestId('upload-size').innerText();
ok('2 화면: 줄여서 올린다는 안내', /사진을 줄여서 올립니다/.test(shown), shown);
await dlg.getByRole('button', { name: '제출하기' }).click(); await p.waitForTimeout(4000);
const obj = sql(`select name || '|' || (metadata->>'size') || '|' || (metadata->>'mimetype') from storage.objects where bucket_id = 'documents' and name like '${co}/${REQ}/%' order by created_at desc limit 1`);
const [path, size, mime] = obj.split('|');
ok('3 서버에 저장됨', !!path, obj);
ok('3 JPEG 로 저장', mime === 'image/jpeg', mime);
ok('3 1.5MB 미만으로 줄어듦 (원래 약 9MB)', +size > 50_000 && +size < 1.5 * 1024 * 1024, `${Math.round(size / 1024)}KB`);
// 내려받아 실제 크기 확인 (서버 관리 키는 로컬 시험 서버에서만)
const SR = readFileSync('/var/tmp/sbpilot/.sr', 'utf8').trim();
const res = await fetch(`${SB}/storage/v1/object/documents/${path}`, { headers: { Authorization: `Bearer ${SR}`, apikey: SR } });
const buf = Buffer.from(await res.arrayBuffer());
const dims = (() => { for (let i = 2; i < buf.length - 9;) { if (buf[i] !== 0xff) return null; const m = buf[i + 1], len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + len; } return null; })();
ok('3 긴 변 2400px', !!dims && Math.max(...dims) === 2400, dims ? dims.join('x') : 'unknown');
const OUT = new URL('./out/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + 'photoshrink-stored.jpg', buf);
ok('3 서버 제출 기록 (상태 제출)', sql(`select status from public.document_requests where id = '${REQ}'`) === 'submitted');
// 4) 작은 사진은 그대로
await openUpload(`작은 사진 시험 ${TAG}`);
const dlg2 = p.locator('[role=dialog]').last();
await dlg2.locator('input[type=file]:not([capture])').setInputFiles(FILES + 'doc-photo-small.jpg');
await dlg2.getByTestId('upload-size').waitFor({ timeout: 10000 });
ok('4 작은 사진: 줄이지 않음', !/줄여서/.test(await dlg2.getByTestId('upload-size').innerText()));
await dlg2.getByRole('button', { name: '취소' }).click();
const realErrs = p.errs.filter((e) => !/Failed to load resource|favicon/.test(e));
ok('페이지 오류 없음', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
await b.close();
process.exit(summary() ? 1 : 0);
