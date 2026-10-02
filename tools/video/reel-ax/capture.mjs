import { chromium } from 'playwright';
const B = 'http://localhost:3000';
const OUT = process.env.OUT || new URL('../out/reel-ax/shots', import.meta.url).pathname;
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
// 같은 브라우저 저장소(데모)를 PC·휴대폰이 함께 쓰도록 한 컨텍스트에서 화면 크기만 바꾼다
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, locale: 'ko-KR' });
const p = await ctx.newPage();
await p.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
const PC = async () => { await p.setViewportSize({ width: 1440, height: 1000 }); };
const PHONE = async () => { await p.setViewportSize({ width: 390, height: 844 }); };
const shot = async (name, opts = {}) => { await p.waitForTimeout(opts.wait ?? 900); await p.screenshot({ path: `${OUT}/${name}.png`, ...opts.clip ? { clip: opts.clip } : {} }); console.log('shot', name); };
const dismiss = async () => {
  await p.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 1500 }).catch(() => {});
  await p.getByRole('button', { name: '건너뛰기' }).click({ timeout: 1200 }).catch(() => {});
};
const login = async (id, pw, to) => {
  await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.includes('kpjk')); if (k) { const s = JSON.parse(localStorage.getItem(k)); s.state.session = null; s.state.settings = { ...s.state.settings, tutorialDoneAx: true, tutorialDonePortal: true }; localStorage.setItem(k, JSON.stringify(s)); } }).catch(() => {});
  await p.goto(B + '/login', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.getByLabel('아이디 (이메일)').fill(id); await p.locator('input[type=password]').first().fill(pw);
  await p.getByRole('button', { name: '로그인' }).click(); await p.waitForURL(to, { timeout: 15000 }); await p.waitForTimeout(1200);
  await dismiss();
};
const go = async (u) => { await p.goto(B + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(900); await dismiss(); };
const dlg = () => p.locator('[role=dialog]:visible').last();

// ---- 대표 PC
await p.goto(B + '/login', { waitUntil: 'networkidle' });
await PC();

// ---- 예시 자료 요청을 재무제표 · 법인등기부등본 · 주주명부 중심으로 바꾼다 (데모 브라우저 저장소만)
await p.goto(B + '/login', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
await p.evaluate(() => {
  const k = 'kpjk-ax-demo-v1'; let raw = localStorage.getItem(k);
  raw = raw.replaceAll('매출채권 연령표 보완 기한', '주주명부 제출 기한').replaceAll('보완 요청: 매출채권 연령표', '자료 요청: 주주명부')
    .replaceAll('거래처 단위 연령 구분이 필요합니다. 기한은 모레입니다.', '최신 주주명부를 올려 주세요. 기한은 모레입니다.')
    .replaceAll('매출채권 연령표 보완 필요', '주주명부 확인 필요').replaceAll('매출채권 연령표가 누락되어 보완 요청', '주주명부 추가 요청')
    .replaceAll('매출채권 자료는 경리 담당이 준비 중', '주주명부·등기부등본은 경리 담당이 준비 중')
    .replaceAll('매출채권 연령표', '주주명부');
  const v = JSON.parse(raw); const st = v.state;
  const a6 = st.docRequests.find((r) => r.id === 'dr_a6');
  Object.assign(a6, { name: '주주명부', description: '최신 주주명부 (주식 수 · 지분율 포함)', status: 'requested', files: [], reviewNote: undefined, submittedAt: undefined, reviewedAt: undefined });
  const due = new Date(Date.now() + 3 * 864e5).toISOString();
  st.docRequests.push({ ...a6, id: 'dr_a7', name: '법인등기부등본', description: '최근 3개월 이내 발급한 법인등기부등본 (말소사항 포함)', dueDate: due, requestedAt: new Date(Date.now() - 2 * 864e5).toISOString() });
  st.session = null;
  st.settings = { ...st.settings, tutorialDoneAx: true, tutorialDonePortal: true };
  localStorage.setItem(k, JSON.stringify(v));
});

// ---- 고객 휴대폰: 홈 · 요청자료 · 법인등기부등본 제출
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal'); await shot('phone-portal-home');
await p.evaluate(() => window.scrollTo(0, 900)); await shot('phone-portal-home-2');
await go('/portal/programs'); await shot('phone-programs');
await go('/portal/documents'); await shot('phone-docs-before');
await p.evaluate(() => window.scrollTo(0, 420)); await shot('phone-docs-list');
await p.evaluate(() => window.scrollTo(0, 0));
const row = p.locator('div.px-4').filter({ hasText: '법인등기부등본' }).filter({ has: p.getByRole('button', { name: '업로드' }) }).last();
await row.getByRole('button', { name: '업로드' }).click(); await p.waitForTimeout(600);
await dlg().locator('input[type=file]').first().setInputFiles({ name: '법인등기부등본_2026.pdf', mimeType: 'application/pdf', buffer: Buffer.from('example') });
await shot('phone-upload');
await dlg().getByRole('button', { name: '제출하기' }).click(); await p.waitForTimeout(1200);
await shot('phone-docs-after');

// ---- 대표 PC: 검토 업무 자동 생성 → 검토 완료
await PC();
await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/dashboard'); await shot('pc-dashboard');
await go('/ax/tasks'); await p.getByRole('button', { name: '미완료', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(500);
{ const r = p.getByText('법인등기부등본 검토').first(); await r.evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  const bb = await r.boundingBox(); console.log('TASKBOX', JSON.stringify(bb)); }
await shot('pc-tasks-new');
await go('/ax/clients/co_a?tab=docs'); await shot('pc-client-docs');
await p.locator('table.tbl tbody tr').filter({ hasText: '법인등기부등본' }).first().click(); await p.waitForTimeout(600);
await dlg().locator('textarea').first().fill('최근 발급본, 말소사항까지 확인했습니다.').catch(() => {});
await shot('pc-review');
await dlg().getByRole('button', { name: '검토 완료' }).click(); await p.waitForTimeout(1000);
await shot('pc-review-done');

// ---- 고객 휴대폰: 상태 반영
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal/documents'); await shot('phone-docs-done');
await p.getByText('법인등기부등본', { exact: true }).first().evaluate((e) => e.scrollIntoView({ block: 'center' })); await shot('phone-docs-done-2');
await b.close();
