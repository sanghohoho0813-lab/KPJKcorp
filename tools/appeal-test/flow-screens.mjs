// 기술시험 — 화면 흐름(데모 모드 · 샘플 기업) 확인 · 증빙 화면.
//   고객 휴대폰 제출 → 담당자 PC 자동 생성 업무 → 보완 요청 → 고객 화면 보완필요 → 재제출 → 검토 완료 · 이력 → 고객 확인완료
//   + (TEST 05) 담당자가 단계 변경 → 고객 진행현황 / (TEST 04) 앱의 자동 업무 규칙을 같은 조건으로 5번 실행
// 데모 모드는 한 브라우저 안 저장소라 휴대폰 · PC 를 한 창에서 로그인을 바꿔 가며 연다(서로 다른 기기 동기화 시험이 아니다).
//   실행: (앱을 데모 모드로 띄운 뒤) OUT=<폴더> node tools/appeal-test/flow-screens.mjs
import fs from 'node:fs';
const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const B = process.env.APP_URL || 'http://localhost:3000';
const OUT = process.env.OUT || new URL('./out', import.meta.url).pathname;
const DOC = '법인등기부등본';
fs.mkdirSync(`${OUT}/screens`, { recursive: true });
const SANDBOX = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync(SANDBOX) ? SANDBOX : undefined) });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
await ctx.addInitScript(() => { try { localStorage.setItem('kpjk-test', '1'); } catch {} });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
const sleep = (ms) => p.waitForTimeout(ms);
const R = { startedAt: new Date().toISOString(), app: B, checks: [], screens: [], ruleRuns: [] };
const kst = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
const ok = (id, label, pass, detail = '') => { R.checks.push({ id, label, pass: !!pass, detail, at: kst() }); console.log(`${pass ? 'OK  ' : 'FAIL'} ${id} ${label}${detail ? ' — ' + detail : ''}`); };
const shot = async (name, what, loc) => {
  const file = `screens/${name}.png`;
  if (loc) await loc.screenshot({ path: `${OUT}/${file}` }); else await p.screenshot({ path: `${OUT}/${file}` });
  R.screens.push({ file, what, at: kst(), url: p.url().replace(B, '') }); console.log('   화면', file, '—', what);
};
const dismiss = async () => {
  await p.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  await p.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
};
const login = async (id, pwd, to) => {
  await p.evaluate(() => window.__kpjkState?.().logout?.()).catch(() => {});
  await p.goto(B + '/login', { waitUntil: 'networkidle' });
  await p.getByLabel('아이디 (이메일)').fill(id); await p.locator('input[type=password]').first().fill(pwd);
  await p.getByRole('button', { name: '로그인' }).click(); await p.waitForURL(to, { timeout: 15000 }); await sleep(1200); await dismiss();
};
const go = async (u) => { await p.goto(B + u, { waitUntil: 'networkidle' }); await sleep(900); await dismiss(); };
const dlg = () => p.locator('[role=dialog]:visible').last();
const PC = () => p.setViewportSize({ width: 1440, height: 900 });
const PHONE = () => p.setViewportSize({ width: 390, height: 844 });
const S = () => p.evaluate(() => { const g = window.__kpjkState(); return { tasks: g.tasks.map((t) => ({ id: t.id, title: t.title, source: t.source, ruleKey: t.ruleKey, status: t.status, assigneeId: t.assigneeId, companyId: t.companyId })), reqs: g.docRequests.map((r) => ({ id: r.id, name: r.name, status: r.status, companyId: r.companyId, files: r.files.length, reviewNote: r.reviewNote })), acts: g.activities.length, users: g.users.map((u) => ({ id: u.id, name: u.name })) }; });
const phRow = (re) => p.locator('li, div').filter({ hasText: DOC }).filter({ has: p.getByRole('button', { name: re }) }).last();
const pcDocRow = () => p.locator('table.tbl tbody tr').filter({ hasText: DOC }).filter({ hasText: /미제출|제출완료|검토중|보완필요/ }).first();
const file = (n) => ({ name: n, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 예시 파일 — 실제 서류가 아닙니다') });

try {
  // F1 담당자: 자료 요청
  await PC(); await login('park@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
  await go('/ax/clients/co_a?tab=docs');
  await p.getByRole('button', { name: '자료 요청', exact: true }).first().click(); await sleep(600);
  await dlg().getByLabel('자료명').fill(DOC); await dlg().locator('textarea').first().fill('최근 3개월 이내 발급본 (말소사항 포함)');
  await dlg().getByRole('button', { name: '요청 등록' }).click(); await sleep(1000);
  const s1 = await S(); const RQ = s1.reqs.filter((r) => r.name === DOC && r.companyId === 'co_a' && r.status === 'requested');
  ok('F1', '담당자 자료 요청 → 요청 1건(미제출)', RQ.length === 1, RQ[0]?.id);
  const RID = RQ[0]?.id;
  const autoBefore = s1.tasks.filter((t) => t.title.includes(`${DOC} 검토`)).length;

  // F2 고객 휴대폰: 제출
  await PHONE(); await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
  await go('/portal/documents');
  await phRow(/^업로드$/).evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(400);
  await phRow(/^업로드$/).getByRole('button', { name: '업로드' }).click(); await sleep(700);
  await dlg().locator('input[type=file]').first().setInputFiles(file(`${DOC}_예시.pdf`)); await sleep(700);
  await shot('01_phone_upload', '고객 휴대폰 — 요청자료 올리기 창(예시 파일)');
  await dlg().getByRole('button', { name: /제출/ }).last().click(); await sleep(1200);
  await shot('02_phone_submitted', '고객 휴대폰 — 제출 직후(담당 컨설턴트에게 전달 안내)');
  const s2 = await S(); const r2 = s2.reqs.find((r) => r.id === RID);
  ok('F2', '고객 제출 → 요청 상태 제출완료 · 파일 1건', r2?.status === 'submitted' && r2?.files === 1, `${r2?.status} · 파일 ${r2?.files}`);
  const auto = s2.tasks.filter((t) => t.title.includes(`${DOC} 검토`));
  const park = s2.users.find((u) => u.id === auto.at(-1)?.assigneeId)?.name;
  ok('F3', '자동 생성 검토업무 1건(자동 · 담당 컨설턴트)', auto.length - autoBefore === 1 && auto.at(-1)?.source === 'auto', `${auto.at(-1)?.title} · ${park}`);

  // F3 담당자 PC: 업무함
  await PC(); await login('park@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
  await go('/ax/tasks'); await p.getByRole('button', { name: '미완료', exact: true }).first().click(); await sleep(600);
  const title = p.locator('main span.font-semibold').filter({ hasText: `${DOC} 검토` }).first();
  const row = title.locator('xpath=ancestor::div[contains(@class,"py-3")][1]');
  await row.scrollIntoViewIfNeeded(); await sleep(300);
  ok('F3b', '담당자 업무함에 자동 생성 업무가 "자동" 표시로 보인다', (await row.innerText()).includes('자동'), (await row.innerText()).replace(/\s+/g, ' ').slice(0, 80));
  await shot('03_pc_tasks', '담당자 PC — 업무함(자동 생성된 검토업무)');
  await shot('03b_pc_task_row', '담당자 PC — 자동 생성된 검토업무 한 줄', row);

  // F4 담당자: 보완 요청
  await go('/ax/clients/co_a?tab=docs');
  await pcDocRow().click(); await sleep(700);
  await dlg().locator('textarea').first().click(); await p.keyboard.type('말소사항 포함 발급본으로 다시 올려 주세요.', { delay: 15 });
  await shot('04_pc_revision', '담당자 PC — 자료 검토 · 보완 요청 사유 입력');
  await dlg().getByRole('button', { name: '보완 요청' }).click(); await sleep(900);
  const s4 = await S(); ok('F4', '보완 요청 → 상태 보완필요 · 사유 저장', s4.reqs.find((r) => r.id === RID)?.status === 'revision', s4.reqs.find((r) => r.id === RID)?.reviewNote);

  // F5 고객: 보완필요 확인 → 재제출
  await PHONE(); await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
  await go('/portal/documents');
  await phRow(/^재제출$/).evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(400);
  // 사유 상자는 버튼이 있는 줄 옆(같은 카드)에 있다 — 자료 이름 · 사유 · 재제출 버튼을 모두 가진 가장 안쪽 칸
  const card = p.locator('li, div').filter({ hasText: DOC }).filter({ hasText: '보완 요청:' }).filter({ has: p.getByRole('button', { name: /^재제출$/ }) }).last();
  const rv = (await card.innerText()).replace(/\s+/g, ' ');
  ok('F5', '고객 화면에 보완필요 · 사유가 보인다', /보완/.test(rv) && rv.includes('말소사항'), rv.slice(0, 90));
  await shot('05_phone_revision', '고객 휴대폰 — 보완필요 · 담당자 사유');
  await phRow(/^재제출$/).getByRole('button', { name: '재제출' }).click(); await sleep(700);
  await dlg().locator('input[type=file]').first().setInputFiles(file(`${DOC}_말소포함_예시.pdf`)); await sleep(700);
  await dlg().getByRole('button', { name: /제출/ }).last().click(); await sleep(1200);
  const s5 = await S(); const r5 = s5.reqs.find((r) => r.id === RID);
  ok('F6', '재제출 → 제출완료 · 파일 2건(1차 보존) · 검토업무 1건 더', r5?.status === 'submitted' && r5?.files === 2 && s5.tasks.filter((t) => t.title.includes(`${DOC} 검토`)).length - autoBefore === 2, `${r5?.status} · 파일 ${r5?.files}`);

  // F7 담당자: 검토 완료 → 이력
  await PC(); await login('park@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
  await go('/ax/clients/co_a?tab=docs');
  await pcDocRow().click(); await sleep(700);
  await dlg().getByRole('button', { name: '검토 완료' }).click(); await sleep(900);
  await p.getByRole('tab', { name: /History/ }).click(); await sleep(800);
  const hist = p.getByText('전체 이력').first().locator('xpath=ancestor::*[contains(@class,"card")][1]');
  const ht = await hist.innerText();
  const autoLines = (ht.match(new RegExp(`자동 생성: ${DOC} 검토 Task`, 'g')) || []).length;
  ok('F7', '기업 이력: 자동 생성 기록 2건 · 보완 요청 · 검토 완료가 남는다', autoLines === 2 && /보완/.test(ht) && /검토 완료/.test(ht), `자동 생성 ${autoLines}건`);
  await shot('06_pc_history', '담당자 PC — 기업 이력(자동 생성 · 보완 요청 · 재제출 · 검토 완료)');
  R.history = ht.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 40);

  // F8 고객: 확인완료
  await PHONE(); await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
  await go('/portal/documents');
  const done = p.locator('li, div').filter({ hasText: DOC }).filter({ hasText: '확인완료' }).last();
  await done.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {}); await sleep(400);
  const s8 = await S();
  ok('F8', '고객 화면 확인완료(상태 done)', s8.reqs.find((r) => r.id === RID)?.status === 'done' && (await done.count()) > 0);
  await shot('07_phone_done', '고객 휴대폰 — 확인완료');

  // TEST 05: 담당자가 내부 단계 변경 → 고객 진행현황
  await go('/portal/projects');
  const before = (await p.getByText(/현재 단계:/).first().innerText().catch(() => '')).trim();
  await PC(); await login('park@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
  await go('/ax/projects/pj_a1');
  await p.getByRole('button', { name: '단계 변경' }).click(); await sleep(500);
  await shot('08_pc_stage', '담당자 PC — 프로젝트 내부 단계 변경(11단계)');
  await dlg().locator('button', { hasText: /^\s*7\s*진행/ }).first().click(); await sleep(800);   // 단계 단추 글자 = 번호 + 단계 이름(+ 현재 · 다음 표시)
  await PHONE(); await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
  await go('/portal/projects');
  const after = (await p.getByText(/현재 단계:/).first().innerText().catch(() => '')).trim();
  ok('F9', '내부 단계 검토 → 진행 변경 → 고객 진행현황 "자료 검토 중" → "진행 중"', /자료 검토 중/.test(before) && /진행 중/.test(after), `${before} → ${after}`);
  await shot('09_phone_progress', '고객 휴대폰 — 진행현황(고객용 4단계)');

  // TEST 04: 앱의 자동 업무 규칙을 같은 조건으로 5번
  await PC(); await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
  for (let i = 1; i <= 5; i++) {
    const r = await p.evaluate(() => { const g = window.__kpjkState(); const made = g.syncRuleTasks(); const keys = window.__kpjkState().tasks.filter((t) => t.ruleKey).map((t) => t.ruleKey); return { made, ruleTasks: keys.length, distinct: new Set(keys).size }; });
    R.ruleRuns.push({ run: i, ...r }); console.log(`   규칙 실행 ${i}회 — 새로 만든 업무 ${r.made} · 규칙 업무 ${r.ruleTasks} · 서로 다른 rule_key ${r.distinct}`);
  }
  const rr = R.ruleRuns;
  ok('F10', '자동 업무 규칙 5회 반복 — 2회째부터 새 업무 0 · rule_key 중복 0', rr.slice(1).every((x) => x.made === 0) && rr.every((x) => x.ruleTasks === x.distinct), rr.map((x) => x.made).join('·'));
  ok('F11', '화면 오류(페이지 오류) 0건', errs.length === 0, errs.slice(0, 2).join(' / '));
} catch (e) {
  ok('ERR', '시험 중단', false, String(e).slice(0, 200));
  await p.screenshot({ path: `${OUT}/screens/zz_error.png` }).catch(() => {});
} finally {
  R.endedAt = new Date().toISOString();
  R.summary = { pass: R.checks.filter((c) => c.pass).length, fail: R.checks.filter((c) => !c.pass).length };
  fs.writeFileSync(`${OUT}/flow.json`, JSON.stringify(R, null, 1));
  console.log(`통과 ${R.summary.pass} · 실패 ${R.summary.fail}`);
  await b.close();
  process.exitCode = R.summary.fail ? 1 : 0;
}
