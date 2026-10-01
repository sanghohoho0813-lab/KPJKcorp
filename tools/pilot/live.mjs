// 실시간: 고객 폰에서 올리면 대표 PC 에 몇 초 만에 뜨는가(새로고침·이동 없이) / 반대로 대표가 요청하면 고객 폰에 뜨는가
// 15초 자동 갱신보다 확실히 빨라야 한다(실시간 신호). + 휴대폰 업로드 창에 "사진 찍어 올리기"
import { launch, ctxFor, login, B, ACC, CO1, ok, sql, summary, FILES, L } from './lib.mjs';
const b = await launch();
const { p: ceo } = await ctxFor(b, 'pc');
const { p: cli } = await ctxFor(b, 'mobile');
const coId = sql(`select id from companies where name='${CO1}'`);
// 다른 시험과 섞이지 않게 이 시험용 요청을 따로 하나 만든다
const TAG = Date.now().toString().slice(-5);
const REQ = `실시간 확인 자료 ${TAG}`;
const pj = sql(`select id from projects where company_id='${coId}' order by created_at limit 1`);
sql(`insert into document_requests (id, company_id, project_id, name, description, due_date, status, assignee_id)
     select 'dr_live_${TAG}', '${coId}', '${pj}', '${REQ}', '실시간 시험', now() + interval '7 days', 'requested', consultant_id from companies where id='${coId}'`);
await login(ceo, ACC.ceo, /\/ax\//);
await login(cli, ACC.c1, /\/portal/);
await ceo.goto(`${B}/ax/clients/${coId}?tab=docs`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(3000);
await cli.goto(`${B}/portal/documents`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(3000);

// 1) 고객 업로드 → 대표 PC 팝업
const row = cli.locator('div').filter({ hasText: REQ }).filter({ has: cli.getByRole('button', { name: '업로드' }) }).last();
await row.getByRole('button', { name: '업로드' }).click(); await cli.waitForTimeout(600);
ok('휴대폰 업로드 창: 사진 찍어 올리기', await cli.getByTestId('camera-upload').isVisible());
ok('사진 입력은 카메라(뒤쪽)', (await cli.locator('[data-testid=camera-upload] input').getAttribute('capture')) === 'environment');
await cli.locator('[role=dialog] input[type=file]').first().setInputFiles(FILES + 'pilot-a1.txt');
await cli.getByRole('button', { name: '제출하기' }).click();
const t0 = Date.now();
let ms = -1;
for (let i = 0; i < 30; i++) { if (await ceo.getByTestId('live-popup').first().isVisible().catch(() => false)) { ms = Date.now() - t0; break; } await ceo.waitForTimeout(250); }
ok('대표 PC: 팝업이 뜸(이동·새로고침 없이)', ms >= 0, `${ms}ms`);
ok('대표 PC: 실시간(5초 안)', ms >= 0 && ms < 5000, `${ms}ms`);
const pop = ms >= 0 ? await ceo.getByTestId('live-popup').first().innerText() : '';
L('대표 PC 팝업 내용', pop.replace(/\n/g, ' / '));
ok('대표 PC: 팝업에 기업명·자료명', pop.includes(CO1) && pop.includes(REQ));
await ceo.screenshot({ path: process.env.SHOT ? `${process.env.SHOT}/live-ceo.png` : '/dev/null' }).catch(() => {});
ok('대표 PC: 목록도 바뀜(제출완료)', (await ceo.evaluate(() => document.body.innerText)).includes('제출완료'));
await ceo.getByTestId('live-popup').first().getByRole('button').first().click(); await ceo.waitForTimeout(1500);
ok('팝업 누르면 해당 화면으로', /\/ax\//.test(ceo.url()), ceo.url());

// 2) 대표가 서류함에서 요청 → 고객 폰 팝업
await cli.goto(`${B}/portal`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(3000);   // 고객은 홈을 보고 있다
await ceo.goto(`${B}/ax/clients/${coId}?tab=vault`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2000);
await ceo.locator('[data-slot=bizReg]').getByRole('button', { name: '고객에게 요청' }).click(); await ceo.waitForTimeout(400);
await ceo.locator('[role=dialog]:visible').last().getByRole('button', { name: '고객에게 요청' }).click();
const t1 = Date.now(); ms = -1;
for (let i = 0; i < 40; i++) { const t = await cli.getByTestId('live-popup').allInnerTexts().catch(() => []); if (t.some((x) => x.includes('자료 요청'))) { ms = Date.now() - t1; break; } await cli.waitForTimeout(250); }
ok('고객 폰: 새 자료 요청 팝업(5초 안)', ms >= 0 && ms < 5000, `${ms}ms`);
await cli.screenshot({ path: process.env.SHOT ? `${process.env.SHOT}/live-client.png` : '/dev/null' }).catch(() => {});
const errs = [...ceo.errs, ...cli.errs].filter((e) => !/ERR_CERT|ERR_NAME|fonts|Failed to load resource|WebSocket/.test(e));
ok('화면 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
const fails = summary(); await b.close(); process.exit(fails ? 1 : 0);
