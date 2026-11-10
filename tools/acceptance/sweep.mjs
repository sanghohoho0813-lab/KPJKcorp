// 전 화면 훑기 (데모 모드) — 역할 × 화면 크기마다 모든 화면을 한 번씩 열어 본다.
//  찾는 것: 페이지 오류(스크립트 예외) · 오류 안내 화면 · 빈 화면 · 뜻밖의 로그인 화면 · 가로 넘침
//  범위: 대표 · 컨설턴트(내부 화면 전부 + 기업 상세 탭 · 창 · 인쇄 화면) · 고객(Portal 전부) · 로그인 없는 화면,
//        그리고 샘플 기업을 지운 빈 상태(대표)
//  크기: PC 1440 · 휴대폰 390 · 좁은 휴대폰 360   (QUICK=1 이면 360 은 건너뛴다 · WIDTHS=1100,1280 이면 그 PC 폭만)
// 실행: npm run build && npm start (데모 모드) → node tools/acceptance/sweep.mjs
// 새 화면을 만들면 아래 목록에 주소를 한 줄 더한다. 시험 데이터는 샘플 기업뿐이다(실제 고객 정보 없음).
import fs from 'fs';

const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME_PATH || (fs.existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);
const B = process.env.APP_URL || 'http://localhost:3000';
const QUICK = !!process.env.QUICK;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// WIDTHS=1100,1280 처럼 주면 그 PC 폭만 따로 본다(작은 노트북 창)
const WIDTHS = (process.env.WIDTHS ?? '').split(',').map((x) => Number(x.trim())).filter((n) => n >= 700);
const SIZES = WIDTHS.length ? WIDTHS.map((w) => ({ key: `pc${w}`, viewport: { width: w, height: 800 } })) : [
  { key: 'pc1440', viewport: { width: 1440, height: 900 } },
  { key: 'm390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ...(QUICK ? [] : [{ key: 'm360', viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }]),
];
const CLIENT_TABS = ['overview', 'work', 'vault', 'docs', 'contract', 'consult', 'schedule', 'portal', 'journal', 'history'];
const AX = [
  '/ax/dashboard', '/ax/brief', '/ax/opportunities', '/ax/opportunities?tab=pipeline', '/ax/tasks', '/ax/inquiries',
  '/ax/clients', ...CLIENT_TABS.map((t) => `/ax/clients/co_a?tab=${t}`), '/ax/clients/co_e',
  '/ax/consultations', '/ax/consultations?tab=quote', '/ax/consultations?tab=contract',
  '/ax/projects', '/ax/projects/pj_a1', '/ax/documents', '/ax/results',
  '/ax/programs', '/ax/programs?tab=leads', '/ax/growth', '/ax/roadmap',
  '/ax/schedule', '/ax/reports', '/ax/coach', '/ax/baseline', '/ax/survey',
  '/ax/howto', '/ax/video', '/ax/why', '/ax/supplement', '/ax/settings',
  // 주소로 바로 열리는 창
  '/ax/clients/co_c?renew=ct_c1', '/ax/clients/co_a?report=1',
];
const PRINT = ['/print/evidence', '/print/baseline', '/print/renewal/ct_a1'];
const PORTAL = [
  '/portal', '/portal/projects', '/portal/documents', '/portal/schedule', '/portal/results', '/portal/inquiries',
  '/portal/notifications', '/portal/me', '/portal/company', '/portal/services', '/portal/programs', '/portal/self',
  `/portal/self/growth/${encodeURIComponent('인사노무')}`,
];
const PUBLIC = ['/login', '/match', '/learn'];
// 샘플을 지운 빈 상태에서 다시 여는 화면
const EMPTY = ['/ax/dashboard', '/ax/brief', '/ax/opportunities', '/ax/tasks', '/ax/clients', '/ax/consultations', '/ax/consultations?tab=quote', '/ax/consultations?tab=contract', '/ax/projects', '/ax/documents', '/ax/programs', '/ax/growth', '/ax/schedule', '/ax/reports', '/ax/results', '/ax/settings'];

const browser = await pw.chromium.launch({ executablePath: CHROME, env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
const fails = [];
let pages = 0;

async function open(size) {
  const ctx = await browser.newContext({ viewport: size.viewport, isMobile: size.isMobile, hasTouch: size.hasTouch, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kpjk-test', '1'); } catch {} });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CERT|net::ERR/.test(m.text())) page.errs.push(m.text()); });
  await page.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
  return page;
}
async function login(page, id, pwd, to) {
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill(id);
  await page.locator('input[type=password]').first().fill(pwd);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(to); await sleep(1200);
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
}
/** 한 화면 — 열고, 잠깐 기다리고, 다섯 가지를 본다 */
async function visit(page, who, size, path, { area, noOverflow = false } = {}) {
  page.errs.length = 0;
  let note = '';
  try {
    await page.goto(B + path, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(450);
    const got = new URL(page.url()).pathname;
    const where = area ?? path.split('?')[0];
    if (!got.startsWith(where.split('/').slice(0, 2).join('/'))) note = `다른 화면으로 넘어감(${got})`;
    else if (await page.locator('[data-testid="error-screen"]:visible').count()) note = '오류 안내 화면';
    else if (((await page.locator('body').innerText()).trim().length) < 20) note = '빈 화면';
    else if (page.errs.length) note = `페이지 오류: ${page.errs[0].slice(0, 160)}`;
    else if (!noOverflow) {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) note = `가로 넘침 ${over}px`;
    }
  } catch (e) { note = `열지 못함: ${String(e).slice(0, 120)}`; }
  pages++;
  if (note) { fails.push(`${who} · ${size.key} · ${path} — ${note}`); console.log(`FAIL ${who} ${size.key} ${path} — ${note}`); }
}

async function internal(who, id, size) {
  const page = await open(size);
  await login(page, id, 'kpjk2026!', '**/ax/**');
  for (const p of AX) await visit(page, who, size, p);
  // 인쇄 화면은 A4 한 장이라 좁은 화면에서는 가로로 넘는 것이 정상 — PC 에서만 넘침을 본다
  const quote = await page.evaluate(() => window.__kpjkState().quotes[0]?.id);
  for (const p of [...PRINT, ...(quote ? [`/print/quote/${quote}`] : [])]) await visit(page, who, size, p, { noOverflow: !!size.isMobile });
  await page.context().close();
}
async function client(size) {
  const page = await open(size);
  await login(page, 'ceo@a-precision.demo', 'client2026!', '**/portal**');
  for (const p of PORTAL) await visit(page, '고객', size, p);
  // 고객이 내부 화면 주소를 직접 쳐도 내부 화면이 열리면 안 된다
  page.errs.length = 0;
  await page.goto(B + '/ax/dashboard', { waitUntil: 'networkidle' }); await sleep(600);
  pages++;
  if (new URL(page.url()).pathname.startsWith('/ax')) { fails.push(`고객 · ${size.key} · /ax/dashboard — 고객 계정에 내부 화면이 열림`); console.log(`FAIL 고객 ${size.key} /ax/dashboard 내부 화면이 열림`); }
  // 내부용 인쇄 화면(갱신 상담용 기록 · 실증 리포트)도 고객 계정에는 그려지지 않는다
  for (const p of ['/print/renewal/ct_a1', '/print/evidence']) {
    await page.goto(B + p, { waitUntil: 'networkidle' }); await sleep(700); pages++;
    if (await page.locator('.print-sheet:visible').count()) { fails.push(`고객 · ${size.key} · ${p} — 고객 계정에 내부 인쇄 화면이 열림`); console.log(`FAIL 고객 ${size.key} ${p} 내부 인쇄 화면이 열림`); }
  }
  await page.context().close();
}
async function anon(size) {
  const page = await open(size);
  for (const p of PUBLIC) await visit(page, '로그인 없음', size, p);
  // 로그인 없이 내부 · 고객 화면 주소 → 로그인 화면으로
  for (const p of ['/ax/dashboard', '/portal']) {
    await page.goto(B + p, { waitUntil: 'networkidle' }); await sleep(600); pages++;
    if (!new URL(page.url()).pathname.startsWith('/login')) { fails.push(`로그인 없음 · ${size.key} · ${p} — 로그인 화면으로 가지 않음`); console.log(`FAIL 로그인 없음 ${size.key} ${p}`); }
  }
  await page.context().close();
}
async function empty(size) {
  const page = await open(size);
  await login(page, 'ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
  // 기업고객 목록 위 띠의 '샘플 N개 지우기' (설정 화면은 휴대폰에서 접혀 있다)
  await page.goto(B + '/ax/clients', { waitUntil: 'networkidle' }); await sleep(500);
  await page.getByRole('button', { name: /샘플 \d+개 지우기/ }).first().click();
  await page.locator('[role=dialog]:visible').last().getByRole('button', { name: '샘플 지우기' }).click(); await sleep(800);
  const left = await page.evaluate(() => window.__kpjkState().companies.length);
  pages++;
  if (left !== 0) { fails.push(`빈 상태 · ${size.key} — 샘플을 지웠는데 기업이 ${left}곳 남음`); console.log(`FAIL 빈 상태 ${size.key} 기업 ${left}곳 남음`); }
  for (const p of EMPTY) await visit(page, '대표(빈 상태)', size, p);
  await page.context().close();
}

const t0 = Date.now();
for (const size of SIZES) {
  // 역할 넷을 함께 — 브라우저마다 저장소가 따로라 서로 영향이 없다
  await Promise.all([internal('대표', 'ceo@kpjk.co.kr', size), internal('컨설턴트', 'park@kpjk.co.kr', size), client(size), anon(size), empty(size)]);
  console.log(`-- ${size.key} 끝 (누적 ${pages}화면 · 실패 ${fails.length})`);
}
await browser.close();
console.log(`\n== 전 화면 훑기: ${pages}화면 · 실패 ${fails.length} · ${Math.round((Date.now() - t0) / 1000)}초`);
for (const f of fails) console.log('  ' + f);
process.exit(fails.length ? 1 : 0);
