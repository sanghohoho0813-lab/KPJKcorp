// 기업성장 관리 닫힌 고리 (실서버 · 고객 휴대폰 + 대표 PC)
// 기업 상태 → 근거 있는 성장과제 → 고객 "검토하고 싶어요" → 내부 기회·업무·알림 → 담당자 연락·진행 업무로 시작
// → 고객 홈 "진행 중" → 완료 → "완료한 과제"·이력 + 이어지는 다음 과제. setup.mjs 다음에 돌린다.
import { launch, ctxFor, login, B, ACC, CO1, ok, sql, body, summary } from './lib.mjs';
const b = await launch();
const { p: cli } = await ctxFor(b, 'mobile');
const { p: ceo } = await ctxFor(b, 'pc');
const dlg = (p) => p.locator('[role=dialog]:visible').last();
const waitFor = async (p, fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn().catch(() => false)) return Date.now() - t0; await p.waitForTimeout(500); } return -1; };
const coId = sql(`select id from companies where name='${CO1}'`);
// 기업정보: 설립 2012년 법인 · 임직원 12명 (상담 때 담당자가 넣은 값이라고 본다)
sql(`update companies set entity_type='corporation', established_at='2012-03-02', employees=12 where id='${coId}'`);
const shot = (p, n) => p.screenshot({ path: process.env.SHOT ? `${process.env.SHOT}/${n}.png` : '/dev/null', fullPage: true }).catch(() => {});

await login(cli, ACC.c1, /\/portal/);
await login(ceo, ACC.ceo, /\/ax\//);
await cli.goto(B + '/portal', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2500);
let t = await body(cli);
ok('1 홈: 우리 회사 현재 상태', t.includes(`${CO1} 현재 상태`) && t.includes('업력 14년') && t.includes('법인'));
ok('1 홈: 지금 할 일(요청자료)', (await cli.getByTestId('now-actions').innerText()).includes('파일럿 제출자료 A-1'));
ok('1 홈: 진행 중 성장과제(기업부설연구소)', await cli.locator('[data-growth-active="기업부설연구소"]').count() === 1);
const next = await cli.locator('#portal-next-growth').innerText();
ok('1 홈: 근거 있는 다음 과제 — 가업승계(업력)', next.includes('가업승계') && next.includes('근거 · 기업정보: 업력 14년'));
ok('1 홈: 진행 이력으로 고른 과제 — 특허자본', next.includes('특허자본') && next.includes('진행이력: 기업부설연구소 진행 중'));
ok('1 홈: 정책자금·벤처 없음', !/정책자금|벤처기업확인/.test(next));
await shot(cli, 'growth-1-client-home');

// 2) 고객이 "검토하고 싶어요" → 내부 기회·업무·알림 → 대표 PC 카드
await ceo.goto(`${B}/ax/clients/${coId}?tab=portal`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2500);
await cli.locator('[data-growth-next="가업승계"]').getByRole('button', { name: '검토하고 싶어요' }).click(); await cli.waitForTimeout(400);
await dlg(cli).locator('textarea').fill('지분 정리를 언제부터 준비해야 하는지 궁금합니다.');
await dlg(cli).getByRole('button', { name: '검토 요청' }).click();
let ms = await waitFor(ceo, async () => (await ceo.getByTestId('live-popup').allInnerTexts()).some((x) => x.includes('가업승계')), 15000);
ok('2 대표 PC 카드(가업승계 관심)', ms >= 0, `${ms}ms`);
ok('2 서버: 기회·상담 연락 업무', sql(`select count(*) from opportunities where company_id='${coId}' and service_name='가업승계' and source='portal_interest'`) === '1' && sql(`select count(*) from tasks where company_id='${coId}' and title like '%가업승계%'`) !== '0');
ok('2 고객이 본 근거가 기회에 남음', sql(`select reason from opportunities where company_id='${coId}' and service_name='가업승계'`).includes('업력'));
ms = await waitFor(cli, async () => (await cli.locator('[data-growth-next="가업승계"]').getAttribute('data-growth-state')) === 'review');
ok('2 고객 홈: 가업승계 → 검토 중(접수됨)', ms >= 0 && (await cli.locator('[data-growth-next="가업승계"]').innerText()).includes('접수됨'));

// 3) 대표: 고객 성장과제 → 연락함 → 진행 업무로 시작
await ceo.goto(`${B}/ax/clients/${coId}?tab=portal`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2000);
const row = ceo.locator('[data-growth-request="가업승계"]');
ok('3 대표: 고객 요청과 메모·근거가 보임', (await row.innerText()).includes('지분 정리를') && (await row.innerText()).includes('업력'));
await shot(ceo, 'growth-3-ceo-requests');
await row.getByRole('button', { name: '연락함' }).click(); await ceo.waitForTimeout(2500);
ms = await waitFor(cli, async () => (await cli.locator('[data-growth-next="가업승계"]').innerText()).includes('담당자 확인 중'));
ok('3 고객 홈: 담당자 확인 중', ms >= 0, `${ms}ms`);
await ceo.locator('[data-growth-request="가업승계"]').getByRole('button', { name: '진행 업무로 시작' }).click(); await ceo.waitForTimeout(3000);
const pj = sql(`select id from projects where company_id='${coId}' and type='가업승계'`);
ok('3 서버: 가업승계 프로젝트(고객 공개) · 기회 진행 확정', !!pj && sql(`select status from opportunities where company_id='${coId}' and service_name='가업승계'`) === 'won');
ms = await waitFor(cli, async () => (await cli.locator('[data-growth-active="가업승계"]').count()) === 1);
ok('3 고객 홈: 진행 중인 성장과제로 이동', ms >= 0, `${ms}ms`);
ok('3 고객 홈: 다음 과제 목록에서 빠짐', (await cli.locator('[data-growth-next="가업승계"]').count()) === 0);

// 4) 완료 → 완료한 과제 · 이력 · 이어지는 과제
await ceo.goto(`${B}/ax/clients/${coId}?tab=work`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2000);
await ceo.locator(`[data-stepper="${pj}"]`).getByRole('radio', { name: '4단계 완료' }).click(); await ceo.waitForTimeout(500);
await dlg(ceo).getByRole('button', { name: '단계 바꾸고 보내기' }).click(); await ceo.waitForTimeout(3000);
ms = await waitFor(cli, async () => (await cli.locator('[data-growth-done="가업승계"]').count()) === 1);
ok('4 고객 홈: 완료한 성장과제', ms >= 0, `${ms}ms`);
t = await body(cli);
ok('4 고객 홈: 이력(진행 단계: 완료)', t.includes('진행 단계: 완료'));
ok('4 고객 홈: 이어지는 과제 — 상속증여(가업승계 완료)', (await cli.locator('#portal-next-growth').innerText()).includes('진행이력: 가업승계 완료'));
const tiles = await cli.getByTestId('growth-tiles').innerText();
ok('4 고객 홈: 완료한 과제 1', /완료한 과제\s*1/.test(tiles), tiles.replace(/\n/g, ' '));
await shot(cli, 'growth-4-client-home-after');
ok('5 실증 기록: 요청→확정→프로젝트→완료', ['opportunity_created', 'opportunity_status_changed', 'project_created', 'project_stage_changed'].every((x) => sql(`select count(*) from activities where company_id='${coId}' and type='${x}'`) !== '0'));
const errs = [...ceo.errs, ...cli.errs].filter((e) => !/ERR_CERT|ERR_NAME|fonts|Failed to load resource|WebSocket/.test(e));
ok('화면 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
const fails = summary(); await b.close(); process.exit(fails ? 1 : 0);
