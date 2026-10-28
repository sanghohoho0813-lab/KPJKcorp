// 기술검증(이의신청) 영상용 화면 캡처 — 데모 모드 앱을 실제로 눌러 가며 PC(1440×900) · 휴대폰(390×844) 화면을 찍는다.
// 공고는 tools/acceptance/fixtures 의 실제 기업마당 공고 사본, 회사 · 사람은 데모 샘플.
// 사용: (앱을 데모 모드로 띄운 뒤) OUT=<폴더> node tools/video/appeal/capture.mjs
import fs from 'node:fs';
const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const B = process.env.APP_URL || 'http://localhost:3000';
const OUT = process.env.OUT || new URL('./cap', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const fx = JSON.parse(fs.readFileSync(new URL('../../acceptance/fixtures/bizinfo-open.json', import.meta.url), 'utf8'));
const SANDBOX = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync(SANDBOX) ? SANDBOX : undefined), env: { ...process.env, LANG: 'C.UTF-8' } });
// 같은 브라우저 저장소(데모)를 PC · 휴대폰이 함께 쓰도록 한 컨텍스트에서 화면 크기만 바꾼다
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ko-KR' });
await ctx.addInitScript(() => { try { localStorage.setItem('kpjk-test', '1'); } catch {} });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
await p.route('**/api/programs**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, items: fx.items, cachedAt: fx.savedAt }) }));
const META = {};
const PC = () => p.setViewportSize({ width: 1440, height: 900 });
const PHONE = () => p.setViewportSize({ width: 390, height: 844 });
const sleep = (ms) => p.waitForTimeout(ms);
const st = (fn, arg) => p.evaluate(fn, arg);
const dismiss = async () => {
  await p.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  await p.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
};
const login = async (id, pwd, to) => {
  await p.evaluate(() => window.__kpjkState?.().logout?.()).catch(() => {});
  await p.goto(B + '/login', { waitUntil: 'networkidle' }); await sleep(600);
  await p.getByLabel('아이디 (이메일)').fill(id); await p.locator('input[type=password]').first().fill(pwd);
  await p.getByRole('button', { name: '로그인' }).click(); await p.waitForURL(to, { timeout: 15000 }); await sleep(1200);
  await dismiss();
};
const go = async (u) => { await p.goto(B + u, { waitUntil: 'networkidle' }); await sleep(900); await dismiss(); };
const dlg = () => p.locator('[role=dialog]:visible').last();
/** 화면 한 장 + 표시할 요소 위치(화면 기준 CSS px) */
const shot = async (name, boxes = {}, opts = {}) => {
  await sleep(opts.wait ?? 700);
  const vp = p.viewportSize(); const bx = {};
  for (const [k, loc] of Object.entries(boxes)) {
    const r = await loc.boundingBox().catch(() => null);
    if (r) bx[k] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; else console.log('  위치 못 찾음', name, k);
  }
  await p.mouse.move(1, 1);   // 마우스가 올라간 버튼 강조가 찍히지 않게
  if (!opts.toast) await p.evaluate(() => { const t = document.querySelector('[data-testid=toasts]'); if (t) t.style.visibility = 'hidden'; });
  await p.screenshot({ path: `${OUT}/${name}.png` });
  await p.evaluate(() => { const t = document.querySelector('[data-testid=toasts]'); if (t) t.style.visibility = ''; });
  META[name] = { w: vp.width, h: vp.height, boxes: bx };
  fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(META, null, 1));
  console.log('shot', name, Object.keys(bx).join(','));
};
const center = async (loc) => { await loc.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {}); await sleep(350); };
const top = async (loc, y = 90) => { await loc.evaluate((e, y) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - y), y).catch(() => {}); await sleep(350); };

// ---------- 대표: 실제 공고 불러와 에이정밀에 추천 · 자료 요청 ----------
await PC();
await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/dashboard'); await shot('pc-dashboard');
await st((items) => { const s = window.__kpjkState(); s.upsertPrograms(items, s.session.userId); s.shareProgram(items[0].id, ['co_a'], s.session.userId); s.shareProgram(items[1].id, ['co_a'], s.session.userId); }, fx.items);
await go('/ax/clients/co_a?tab=docs');
await p.getByRole('button', { name: '자료 요청', exact: true }).first().click(); await sleep(600);
await dlg().getByLabel('자료명').fill('법인등기부등본');
await dlg().locator('textarea').first().fill('최근 3개월 이내 발급본 (말소사항 포함)');
await shot('pc-docreq', { dialog: dlg() });
await dlg().getByRole('button', { name: /요청 등록|고객에게 요청|요청 보내기|등록/ }).last().click(); await sleep(900);
const reqId = await st(() => window.__kpjkState().docRequests.find((r) => r.companyId === 'co_a' && r.name === '법인등기부등본')?.id);
console.log('자료 요청', reqId);

// ---------- 고객(휴대폰): 홈 · 자료 제출 ----------
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal'); await shot('ph-home');
await go('/portal/documents');
const docRow = () => p.locator('li, div').filter({ hasText: '법인등기부등본' }).filter({ has: p.getByRole('button', { name: /업로드|재제출/ }) }).last();
await center(docRow()); await shot('ph-docs-request', { row: docRow() });
await docRow().getByRole('button', { name: '업로드' }).click(); await sleep(600);
await dlg().locator('input[type=file]').first().setInputFiles({ name: '법인등기부등본_예시.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 예시 파일 — 실제 서류가 아닙니다') });
await sleep(500); await shot('ph-upload', { dialog: dlg() });
await dlg().getByRole('button', { name: /제출/ }).last().click(); await sleep(1300);
await go('/portal/documents');
const sentRow = p.locator('li, div').filter({ hasText: '법인등기부등본' }).filter({ hasText: /제출|검토/ }).last();
await center(sentRow); await shot('ph-docs-sent', { row: sentRow });

// ---------- 담당자(PC): 자동 생성된 검토 업무 → 보완 요청 ----------
await PC();
await login('park@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/tasks');
await p.getByRole('button', { name: '미완료', exact: true }).first().click().catch(() => {}); await sleep(500);
const taskRow = p.getByText(/법인등기부등본.*검토|검토.*법인등기부등본/).first();
await center(taskRow);
const taskBox = taskRow.locator('xpath=ancestor::*[self::li or self::tr or contains(@class,"card")][1]');
await shot('pc-tasks-auto', { task: (await taskBox.count()) ? taskBox : taskRow });
const autoTask = await st(() => window.__kpjkState().tasks.find((t) => /법인등기부등본/.test(t.title) && t.source === 'auto'));
console.log('자동 업무', autoTask?.title, autoTask?.assigneeId, autoTask?.source);
await go('/ax/clients/co_a?tab=docs');
await p.locator('table.tbl tbody tr').filter({ hasText: '법인등기부등본' }).first().click(); await sleep(700);
await dlg().locator('textarea').first().fill('말소사항 포함 발급본으로 다시 올려 주세요.').catch(() => {});
await shot('pc-review', { dialog: dlg(), btn: dlg().getByRole('button', { name: '보완 요청' }) });
await dlg().getByRole('button', { name: '보완 요청' }).click(); await sleep(900);

// ---------- 고객(휴대폰): 보완 필요 반영 → 다시 제출 ----------
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal/documents');
const revRow = p.locator('li, div').filter({ hasText: '법인등기부등본' }).filter({ has: p.getByRole('button', { name: '재제출' }) }).last();
await center(revRow); await shot('ph-docs-revision', { row: revRow });
await revRow.getByRole('button', { name: '재제출' }).click(); await sleep(600);
await dlg().locator('input[type=file]').first().setInputFiles({ name: '법인등기부등본_말소포함_예시.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 예시 파일 — 실제 서류가 아닙니다') });
await sleep(400); await dlg().getByRole('button', { name: /제출/ }).last().click(); await sleep(1200);

// ---------- 담당자(PC): 검토 완료 → 기록 · 단계 ----------
await PC();
await login('park@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await st(([id]) => { const s = window.__kpjkState(); s.reviewDocument(id, 'done', '확인했습니다.', s.session.userId); }, [reqId]);
await go('/ax/clients/co_a'); await p.getByRole('tab', { name: /History/ }).click(); await sleep(700); await shot('pc-history');
await go('/ax/projects/pj_a1'); await shot('pc-project');

// ---------- 고객(휴대폰): 진행 단계 · 성장과제 · 공고 · 스스로 준비하기 ----------
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal/projects'); await shot('ph-project');
await go('/portal');
const growth = p.getByText('다음으로 검토할 성장과제').first();
await top(growth, 70); await shot('ph-growth', { title: growth });
await go('/portal/programs'); await shot('ph-programs');
await go('/portal/self'); await shot('ph-self-hub');
await go('/portal/self/learn/lc_policy_basics'); await shot('ph-learn');
await go('/portal/self/program/' + encodeURIComponent(fx.items[0].id)); await shot('ph-prog-top');
await p.getByTestId('self-start').click(); await sleep(500);
for (const k of ['notice', 'eligibility', 'period']) await p.locator(`[data-check="${k}"]`).check();
await top(p.getByTestId('self-checks'), 120); await shot('ph-prog-checks', { checks: p.getByTestId('self-checks') });
const site = p.getByText('공식 사이트에서 직접 신청하기').first();
await top(site, 70); await shot('ph-prog-official', { title: site });
await p.locator('[data-status="applied"]').click(); await sleep(400);
await p.getByLabel('접수번호').fill('예시-2026-0001'); await p.getByRole('button', { name: '번호 저장' }).click(); await sleep(500);
await top(p.getByTestId('self-status'), 140); await shot('ph-prog-applied', { status: p.getByTestId('self-status'), ev: p.getByTestId('self-evidence') });
await p.locator('[data-status="selected"]').click(); await sleep(600);
await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300); await shot('ph-prog-next', { next: p.getByTestId('self-next') });
await go('/portal/self/growth/' + encodeURIComponent('기업부설연구소'));
await p.getByTestId('self-start').click().catch(() => {}); await sleep(400);
await p.locator('[data-status="done"]').click().catch(() => {}); await sleep(700);
await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
await shot('ph-growth-done', { follow: p.getByTestId('self-followups') });
await go('/portal/self'); await shot('ph-self-hub-after', { runs: p.getByTestId('self-programs') });

// ---------- 담당자(PC): 고객이 직접 진행한 일 · 근거 확인 ----------
await PC();
await login('park@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/clients/co_a?tab=portal');
const panel = p.getByTestId('client-self-runs');
await top(panel, 80);
await panel.getByRole('button', { name: '확인' }).first().click().catch(() => {}); await sleep(600);
await top(panel, 80); await shot('pc-self-runs', { panel });
await go('/ax/tasks');
await p.getByRole('button', { name: '미완료', exact: true }).first().click().catch(() => {}); await sleep(500);
const selfTask = p.getByText(/선정 — 근거 확인/).first();
await center(selfTask); await shot('pc-tasks-self', { task: selfTask });

console.log('page errors', errs.length ? errs.slice(0, 3) : '없음');
await b.close();
