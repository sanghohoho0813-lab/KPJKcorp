import { chromium } from 'playwright';
const B = 'http://localhost:3000';
const OUT = process.env.OUT || new URL('../out/ax-intro/shots', import.meta.url).pathname;
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
// 같은 브라우저 저장소(데모)를 PC·휴대폰이 함께 쓰도록 한 컨텍스트에서 화면 크기만 바꾼다
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ko-KR' });
const p = await ctx.newPage();
await p.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
const PC = async () => { await p.setViewportSize({ width: 1440, height: 900 }); };
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
await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/dashboard'); await shot('pc-dashboard');
await go('/ax/clients'); await shot('pc-clients');
await go('/ax/clients/co_a?tab=work'); await shot('pc-client-work');
await go('/ax/documents'); await shot('pc-documents');
await go('/ax/tasks'); await shot('pc-tasks');
await go('/ax/brief'); await shot('pc-brief');
await go('/ax/settings');
await p.getByText('Permission Matrix').first().scrollIntoViewIfNeeded().catch(() => {});
await p.evaluate(() => window.scrollBy(0, -120));
await shot('pc-permissions');
// 지원사업 — 예시 공고 하나(직접 추가) 후 맞는 고객에 알림
await go('/ax/programs');
await p.getByRole('button', { name: '공고 직접 추가' }).first().click(); await p.waitForTimeout(400);
const end = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
await p.getByLabel('공고명').fill('[경기] 2026 제조기업 스마트공장 구축 지원 (예시 공고)');
await p.getByLabel('기관').fill('예시 기관');
await p.getByRole('group', { name: '대상 지역' }).getByRole('button', { name: '경기', exact: true }).click();
await p.getByLabel('접수 마감일').fill(end);
await p.getByLabel('지원 대상').fill('경기도 소재 제조 중소기업');
await p.getByRole('button', { name: '추가', exact: true }).click(); await p.waitForTimeout(800);
await shot('pc-programs');
await p.getByRole('button', { name: /맞는 고객 \d+곳에 알림/ }).first().click().catch(() => {}); await p.waitForTimeout(600);

// ---- 고객 휴대폰: 홈 → 보완 자료 재제출
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal'); await shot('phone-portal-home');
await p.evaluate(() => window.scrollTo(0, 900)); await shot('phone-portal-home-2');
await go('/portal/programs'); await shot('phone-programs');
await go('/portal/documents'); await shot('phone-docs-before');
await p.getByRole('button', { name: '재제출' }).first().click(); await p.waitForTimeout(600);
await dlg().locator('input[type=file]').first().setInputFiles({ name: '매출채권_연령표_거래처별.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('example') });
await shot('phone-upload');
await dlg().getByRole('button', { name: '제출하기' }).click(); await p.waitForTimeout(1200);
await shot('phone-docs-after');

// ---- 대표 PC: 검토 업무 자동 생성 → 검토 완료
await PC();
await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/tasks'); await shot('pc-tasks-new');
await go('/ax/clients/co_a?tab=docs'); await shot('pc-client-docs');
await p.locator('table.tbl tbody tr').filter({ hasText: '매출채권' }).first().click(); await p.waitForTimeout(600);
await shot('pc-review');
await dlg().getByRole('button', { name: '검토 시작' }).click().catch(() => {}); await p.waitForTimeout(400);
await dlg().getByRole('button', { name: '검토 완료' }).click().catch(() => {}); await p.waitForTimeout(1000);
await shot('pc-review-done');

// ---- 고객 휴대폰: 상태 반영
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal/documents'); await shot('phone-docs-done');
// ---- 고객 PC 홈
await PC();
await go('/portal'); await shot('pc-portal-home');
await p.evaluate(() => window.scrollTo(0, 560)); await shot('pc-portal-home-2');
await b.close();
