// 자료 올리는 중 연결이 끊기거나 멈추면 — 고객이 무엇을 보고, 다시 올릴 수 있는가
//  1) 인터넷 끊김 → 창 안에 이유가 남음(토스트만이면 휴대폰에서 놓친다) · 고른 파일 그대로 · 버튼 "다시 올리기"
//     → 연결 복구 후 한 번 누르면 제출 완료(서버 파일·상태)
//  2) 응답 없음(멈춤) → 진행 막대 · "올리기 취소" → 취소되면 다시 제출 가능
//  3) 응답 없음이 30초 → 스스로 멈추고 이유 안내 (예전: "올리는 중…"에서 끝없이)
import { launch, ctxFor, login, B, ACC, CO1, ok, sql, summary, FILES } from './lib.mjs';

const TAG = Date.now().toString(36).slice(-5);
const co = sql(`select id from public.companies where name = '${CO1}' limit 1`);
const REQ = `dr_un_${TAG}`;
sql(`insert into public.document_requests(id, company_id, name, description, status, due_date) values ('${REQ}', '${co}', '끊김 시험 ${TAG}', '시험용 요청 (비식별)', 'requested', now() + interval '3 days')`);
const STORE = /\/storage\/v1\/object\/documents\//;

const b = await launch();
const { p } = await ctxFor(b, 'mobile');
await login(p, ACC.c1, /\/portal/);
await p.goto(B + '/portal/documents', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
const row = p.locator('div.px-4').filter({ hasText: `끊김 시험 ${TAG}` }).filter({ has: p.getByRole('button', { name: '업로드' }) }).last();
await row.getByRole('button', { name: '업로드' }).click(); await p.waitForTimeout(600);
const dlg = p.locator('[role=dialog]').last();
await dlg.locator('input[type=file]:not([capture])').setInputFiles(FILES + 'doc-photo-small.jpg');
await dlg.getByTestId('upload-size').waitFor({ timeout: 10000 });
const submitBtn = () => dlg.getByRole('button', { name: /제출하기|다시 올리기|올리는 중/ });

// 1) 끊김
await p.route(STORE, (r) => r.abort('internetdisconnected'));
await submitBtn().click();
await dlg.getByTestId('upload-error').waitFor({ timeout: 10000 }).catch(() => {});
const err1 = await dlg.getByTestId('upload-error').innerText().catch(() => '');
ok('1 끊김 → 창 안에 이유', /인터넷 연결/.test(err1), err1);
await p.waitForTimeout(5000); // 토스트가 사라진 뒤에도 남아 있는가
ok('1 5초 뒤에도 이유가 남아 있음', await dlg.getByTestId('upload-error').isVisible().catch(() => false));
ok('1 고른 파일 그대로', /doc-photo-small/.test(await dlg.innerText()));
ok('1 버튼 "다시 올리기"', (await submitBtn().innerText()).includes('다시 올리기'));
ok('1 서버에는 아직 제출 아님', sql(`select status from public.document_requests where id = '${REQ}'`) === 'requested');

// 2) 멈춤 → 취소
await p.unroute(STORE);
await p.route(STORE, () => { /* 응답 없음 */ });
await submitBtn().click(); await p.waitForTimeout(1500);
ok('2 올리는 중 진행 막대', await dlg.getByTestId('upload-progress').isVisible().catch(() => false));
ok('2 "올리기 취소" 버튼', await dlg.getByTestId('upload-cancel').isVisible().catch(() => false));
await dlg.getByTestId('upload-cancel').click(); await p.waitForTimeout(800);
ok('2 취소 → 진행 막대 사라짐', !(await dlg.getByTestId('upload-progress').isVisible().catch(() => false)));
ok('2 취소 → 다시 누를 수 있음', await submitBtn().isEnabled());
ok('2 창은 열린 채', await dlg.isVisible());

// 3) 30초 멈춤 → 스스로 멈춤
const t0 = Date.now();
await submitBtn().click();
await dlg.getByTestId('upload-error').waitFor({ timeout: 45000 }).catch(() => {});
const err3 = await dlg.getByTestId('upload-error').innerText().catch(() => '');
ok('3 응답 없음 → 스스로 멈추고 안내', /느리거나 끊겨/.test(err3), `${err3} (${Math.round((Date.now() - t0) / 1000)}초)`);
ok('3 다시 누를 수 있음', await submitBtn().isEnabled());

// 복구 → 한 번 더 누르면 제출
await p.unroute(STORE);
await submitBtn().click(); await p.waitForTimeout(4000);
ok('4 복구 후 제출 → 창 닫힘', !(await dlg.isVisible().catch(() => false)));
ok('4 서버 상태 제출', sql(`select status from public.document_requests where id = '${REQ}'`) === 'submitted');
ok('4 서버 보관함에 파일 1개', sql(`select count(*) from storage.objects where bucket_id = 'documents' and name like '${co}/${REQ}/%'`) === '1');
const realErrs = p.errs.filter((e) => !/Failed to load resource|favicon|ERR_CERT|\[storage\] upload/.test(e));
ok('페이지 오류 없음', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
await b.close();
process.exit(summary() ? 1 : 0);
