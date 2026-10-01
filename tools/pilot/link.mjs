// 대표 화면 ↔ 고객 화면 연결 (실서버 · PC 대표 + 휴대폰 고객, 별도 브라우저)
//   서류함 칸 "고객에게 요청" → 고객 알림·요청자료 → 고객 업로드 → 대표 서류함 칸에 "고객이 올렸습니다" → 확인 → 칸 받음
//   진행 단계 클릭 → 고객 진행률 / 일정 한 번 클릭 공개 → 고객 일정 / 제안 → 고객 "함께 검토" → 고객 상담 요청 → 대표 업무
// 사용: node link.mjs   (setup.mjs 다음)
import { launch, ctxFor, login, B, ACC, CO1, L, ok, sql, body, summary, FILES } from './lib.mjs';
const b = await launch();
const { p: ceo } = await ctxFor(b, 'pc');       // 실사 현장 PC
const { p: cli } = await ctxFor(b, 'mobile');   // 고객 휴대폰 (완전히 별도 세션)
const dialog = (p) => p.locator('[role=dialog]:visible').last();
const coId = sql(`select id from companies where name='${CO1}'`);
const pjId = sql(`select id from projects where company_id='${coId}' order by created_at limit 1`);
L('대상', `${coId} / ${pjId}`);
// 서버 → 다른 기기 화면까지 (15초 주기 + 포커스). 기다리며 확인한다.
const waitFor = async (p, fn, ms = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return Date.now() - t0; await p.waitForTimeout(1000); } return -1; };

await login(ceo, ACC.ceo, /\/ax\//);
await login(cli, ACC.c1, /\/portal/);

// 1) 서류함 칸 → 고객에게 요청
await ceo.goto(`${B}/ax/clients/${coId}?tab=vault`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
const slot = ceo.locator('[data-slot=corpReg]');
await slot.getByRole('button', { name: '고객에게 요청' }).click(); await ceo.waitForTimeout(500);
await dialog(ceo).getByRole('button', { name: '고객에게 요청' }).click(); await ceo.waitForTimeout(3000);
const reqId = sql(`select id from document_requests where company_id='${coId}' and name='법인등기부등본'`);
ok('서버: 요청자료 저장', !!reqId, reqId);
ok('서버: 고객 알림 저장', sql(`select count(*) from notifications where audience='client' and company_id='${coId}' and title like '%자료 요청%'`) !== '0');
await cli.goto(`${B}/portal/documents`, { waitUntil: 'domcontentloaded' });
let ms = await waitFor(cli, async () => (await body(cli)).includes('법인등기부등본'));
ok('고객 휴대폰: 요청자료에 도착', ms >= 0, `${ms}ms`);
ok('고객 휴대폰: 카톡 안내 문구', (await body(cli)).includes('카카오톡'));

// 2) 진행 단계 (고객 4단계) — 자료 요청 단계에서 서류를 클릭으로 담아 한 번에 요청 + 메시지
await ceo.goto(`${B}/ax/clients/${coId}?tab=work`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
const stepper = ceo.locator(`[data-stepper="${pjId}"]`);
ok('대표 PC: 고객 단계 4칸', (await stepper.getByRole('radio').count()) === 4);
await stepper.getByRole('radio', { name: '1단계 자료 요청' }).click(); await ceo.waitForTimeout(600);
const picker = dialog(ceo);
ok('대표 PC: 분야별 자주 받는 서류', (await picker.innerText()).includes('기업부설연구소에서 자주 받는 서류'));
await picker.getByRole('button', { name: /연구인력 학위·경력증명서/ }).click();
await picker.getByRole('button', { name: '전체 목록에서 고르기' }).click();
await picker.getByRole('button', { name: /^주식등변동상황명세서/ }).click();
await picker.getByLabel('서류 직접 입력').fill('연구개발 과제 계획서');
await picker.getByRole('button', { name: '추가', exact: true }).click();
ok('대표 PC: 담은 서류 3건', (await picker.locator('[data-picked] > span').count()) === 3);
await picker.getByRole('button', { name: /준비가 어려운 자료는/ }).click();
await picker.getByRole('button', { name: /보내기 \(자료 3건\)/ }).click(); await ceo.waitForTimeout(3500);
ok('서버: 서류 3건 한 번에 요청', sql(`select count(*) from document_requests where company_id='${coId}' and name in ('연구인력 학위·경력증명서','주식등변동상황명세서','연구개발 과제 계획서') and status='requested'`) === '3');
ok('서버: 알림 1건(묶음)', sql(`select count(*) from notifications where audience='client' and company_id='${coId}' and title='자료 3건을 요청드립니다'`) === '1');
await cli.goto(`${B}/portal/documents`, { waitUntil: 'domcontentloaded' });
ms = await waitFor(cli, async () => { const t = await body(cli); return t.includes('주식등변동상황명세서') && t.includes('연구개발 과제 계획서'); });
ok('고객 휴대폰: 요청 서류 3건 도착', ms >= 0, `${ms}ms`);
await cli.goto(`${B}/portal/notifications`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1500);
ok('고객 휴대폰: 메시지 도착', (await body(cli)).includes('준비가 어려운 자료는'));

await stepper.getByRole('radio', { name: '2단계 자료 검토 중' }).click(); await ceo.waitForTimeout(600);
ok('대표 PC: 검토 단계엔 서류 고르기 없음', (await dialog(ceo).locator('[data-doc-picker]').count()) === 0);
await dialog(ceo).getByRole('button', { name: '단계 바꾸고 보내기' }).click(); await ceo.waitForTimeout(3000);
ok('서버: 프로젝트 단계 review', sql(`select stage from projects where id='${pjId}'`) === 'review');
await cli.goto(`${B}/portal`, { waitUntil: 'domcontentloaded' });
ms = await waitFor(cli, async () => /자료 검토 중 단계/.test(await body(cli)));
ok('고객 휴대폰: "자료 검토 중" · 50%', ms >= 0 && (await body(cli)).includes('50%'), `${ms}ms`);
await stepper.getByRole('radio', { name: '3단계 진행 중' }).click(); await ceo.waitForTimeout(500);
await dialog(ceo).getByRole('button', { name: /곧 결과를 정리해/ }).click();
await dialog(ceo).getByRole('button', { name: '단계 바꾸고 보내기' }).click(); await ceo.waitForTimeout(500);
ms = await waitFor(cli, async () => /진행 중 단계/.test(await body(cli)));
ok('고객 휴대폰: 새로고침 없이 "진행 중" · 75%', ms >= 0 && (await body(cli)).includes('75%'), `${ms}ms`);
ok('서버: 진행 중 메시지 알림', sql(`select count(*) from notifications where audience='client' and company_id='${coId}' and body like '%곧 결과를 정리해%'`) === '1');

// 3) 일정: 내부로 → 한 번 눌러 공개
await ceo.goto(`${B}/ax/clients/${coId}?tab=schedule`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
await ceo.getByRole('button', { name: '일정 등록' }).click(); await ceo.waitForTimeout(500);
await dialog(ceo).getByLabel('제목').fill('실사 현장 대표 미팅');
await dialog(ceo).getByLabel('고객 Portal에 표시').uncheck();
await dialog(ceo).getByRole('button', { name: '등록', exact: true }).click(); await ceo.waitForTimeout(3000);
ok('서버: 일정 내부로 저장', sql(`select visible_to_client from schedules where company_id='${coId}' and title='실사 현장 대표 미팅'`) === 'f');
await cli.goto(`${B}/portal/schedule`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2500);
ok('고객 휴대폰: 내부 일정은 안 보임', !(await body(cli)).includes('실사 현장 대표 미팅'));
await ceo.locator('[data-portal-toggle="실사 현장 대표 미팅"]').click(); await ceo.waitForTimeout(3000);
ok('서버: 일정 공개', sql(`select visible_to_client from schedules where company_id='${coId}' and title='실사 현장 대표 미팅'`) === 't');
ms = await waitFor(cli, async () => (await body(cli)).includes('실사 현장 대표 미팅'));
ok('고객 휴대폰: 새로고침 없이 일정 도착', ms >= 0, `${ms}ms`);

// 4) 제안
await ceo.goto(`${B}/ax/clients/${coId}?tab=portal`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
const REASON = '재무제표상 대표이사 대여금 계정이 있어 정리 방법을 미리 함께 보시면 좋겠습니다.';
await ceo.locator('#proposal-panel').getByRole('button', { name: '가지급금', exact: true }).click(); await ceo.waitForTimeout(400);
await dialog(ceo).locator('textarea').fill(REASON);
await dialog(ceo).getByRole('button', { name: '고객 화면에 올리기' }).click(); await ceo.waitForTimeout(3000);
ok('서버: 제안 저장', sql(`select source||'|'||status from opportunities where company_id='${coId}' and service_name='가지급금'`) === 'proposal|proposed');
await cli.goto(`${B}/portal/services`, { waitUntil: 'domcontentloaded' });
ms = await waitFor(cli, async () => (await body(cli)).includes(REASON));
ok('고객 휴대폰: 제안·이유 도착', ms >= 0, `${ms}ms`);
const t = await body(cli);
ok('고객 휴대폰: 정책자금·벤처 없음', !/정책자금|벤처기업확인|고용지원금/.test(t));
await cli.locator('[data-proposal="가지급금"]').getByRole('button', { name: '상담 요청' }).click(); await cli.waitForTimeout(400);
await dialog(cli).getByRole('button', { name: '상담 요청' }).click(); await cli.waitForTimeout(3500);
ok('서버: 고객 상담 요청 저장', sql(`select count(*) from opportunities where company_id='${coId}' and service_name='가지급금' and source='portal_request'`) === '1');
ok('서버: 담당 업무 자동 생성', sql(`select count(*) from tasks where company_id='${coId}' and title like '%가지급금%'`) !== '0');

// 5) 고객 업로드 → 대표 서류함 칸
await cli.goto(`${B}/portal/documents`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2000);
const row = cli.locator('div').filter({ hasText: '법인등기부등본' }).filter({ has: cli.getByRole('button', { name: '업로드' }) }).last();
await row.getByRole('button', { name: '업로드' }).click(); await cli.waitForTimeout(700);
await cli.locator('[role=dialog] input[type=file]').setInputFiles(FILES + 'pilot-a1.txt');
await cli.getByRole('button', { name: '제출하기' }).click(); await cli.waitForTimeout(3500);
ok('서버: 고객 제출', sql(`select status from document_requests where id='${reqId}'`) === 'submitted');
await ceo.goto(`${B}/ax/clients/${coId}?tab=vault`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1000);
ms = await waitFor(ceo, async () => (await slot.innerText().catch(() => '')).includes('고객이 Portal 로 올렸습니다'));
ok('대표 PC: 서류함 칸 "고객이 올렸습니다"', ms >= 0, `${ms}ms`);
const bell = await body(ceo);
ok('대표 PC: 알림/업무에 검토 도착', sql(`select count(*) from tasks where company_id='${coId}' and title like '%법인등기부등본%'`) !== '0', bell.match(/\d+/)?.[0] ?? '');
await slot.getByRole('button', { name: '확인하기' }).click(); await ceo.waitForTimeout(800);
await dialog(ceo).getByRole('button', { name: '검토 완료' }).click(); await ceo.waitForTimeout(3500);
ok('서버: 검토 완료', sql(`select status from document_requests where id='${reqId}'`) === 'done');
ok('서버: 서류함 칸 받음', sql(`select slots->'corpReg'->>'received' from company_vaults where company_id='${coId}'`) === 'true');
await cli.goto(`${B}/portal/documents`, { waitUntil: 'domcontentloaded' });
ms = await waitFor(cli, async () => /확인완료/.test(await body(cli)));
ok('고객 휴대폰: "확인완료"', ms >= 0, `${ms}ms`);

// 6) 고객 화면에 내부 정보 없음
for (const path of ['/portal', '/portal/projects', '/portal/documents', '/portal/schedule', '/portal/services', '/portal/notifications']) {
  await cli.goto(B + path, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1200);
  const tt = await body(cli);
  const hit = tt.match(/(?<![가미])수금|업무 일기|상담 기록|계약금|성공보수|내부 메모|DEMO DATA/);
  ok(`고객 휴대폰 ${path}: 내부 정보 없음`, !hit, hit?.[0] ?? '');
}
await cli.screenshot({ path: process.env.SHOT ? `${process.env.SHOT}/srv-link-client.png` : '/dev/null' }).catch(() => {});
const errs = [...ceo.errs, ...cli.errs].filter((e) => !/ERR_CERT|ERR_NAME|fonts|Failed to load resource/.test(e));
ok('화면 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
const fails = summary(); await b.close(); process.exit(fails ? 1 : 0);
