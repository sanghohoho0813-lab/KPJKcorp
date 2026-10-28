// 영상 ① 장면용 실제 화면 녹화 — 데모 모드 앱을 사람 속도로 조작하며 Chrome 화면 프레임(CDP screencast)을 그대로 받는다.
// 고객 휴대폰 제출 → 담당자 업무함(자동 생성된 검토 업무) → 보완 요청 → 고객 화면 보완 필요 → 재제출 → 검토 완료 · 이력
// 화면에 덧그리는 것은 누른 자리 표시(원)와 PC 마우스 화살표뿐 — 앱 동작은 바꾸지 않는다.
// 사용: (앱을 데모 모드로 띄운 뒤) OUT=<폴더> node tools/video/appeal/record-loop.mjs
import fs from 'node:fs';
const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const B = process.env.APP_URL || 'http://localhost:3000';
const OUT = process.env.OUT || new URL('./rec', import.meta.url).pathname;
const FPS = 30;
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const SANDBOX = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync(SANDBOX) ? SANDBOX : undefined), env: { ...process.env, LANG: 'C.UTF-8' } });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ko-KR' });
await ctx.addInitScript(() => {
  try { localStorage.setItem('kpjk-test', '1'); } catch {}
  // 누른 자리 · 마우스 화살표 (녹화 표시) — 앱 화면 위에 덧그리기만 한다
  addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = `.__rip{position:fixed;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;border:4px solid #d47a4a;background:rgba(212,122,74,.18);z-index:2147483647;pointer-events:none;animation:__r .6s ease-out forwards}
      @keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
      #__cur{position:fixed;left:-60px;top:-60px;width:26px;height:26px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}`;
    document.head.appendChild(st);
    const cur = document.createElement('div'); cur.id = '__cur';
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    addEventListener('mousemove', (e) => { if (window.__showCursor) { cur.style.left = e.clientX - 3 + 'px'; cur.style.top = e.clientY - 2 + 'px'; } }, true);
    addEventListener('pointerdown', (e) => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
  });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
const sleep = (ms) => p.waitForTimeout(ms);
const META = { fps: FPS, clips: {} };
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
const PC = async () => { await p.setViewportSize({ width: 1440, height: 900 }); await p.evaluate(() => { window.__showCursor = true; }).catch(() => {}); };
const PHONE = async () => { await p.setViewportSize({ width: 390, height: 844 }); };

/** 사람 속도로 마우스를 옮겨 누른다 (PC) */
let mx = 720, my = 450;
const glide = async (x, y, ms = 420) => {
  const n = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { const k = i / n, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; await p.mouse.move(mx + (x - mx) * e, my + (y - my) * e); await sleep(16); }
  mx = x; my = y;
};
const click = async (loc, { ms = 420, pause = 160 } = {}) => {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const r = await loc.boundingBox(); if (!r) throw new Error('누를 곳 없음');
  await glide(r.x + r.width / 2, r.y + r.height / 2, ms); await sleep(pause);
  await p.mouse.down(); await sleep(70); await p.mouse.up();
};
const tap = async (loc, pause = 150) => {     // 휴대폰: 화살표 없이 누른 자리만
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const r = await loc.boundingBox(); if (!r) throw new Error('누를 곳 없음');
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await sleep(pause);
  await p.mouse.down(); await sleep(80); await p.mouse.up();
};
const smooth = async (loc, block = 'center') => { await loc.evaluate((e, block) => e.scrollIntoView({ behavior: 'smooth', block }), block).catch(() => {}); await sleep(700); };
const boxOf = async (loc) => { const r = await loc.boundingBox().catch(() => null); return r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };

/** 한 장면 녹화: 받은 프레임을 시각대로 30fps 칸에 놓는다(바뀐 게 없으면 앞 프레임 유지) */
async function record(name, fn) {
  const cdp = await ctx.newCDPSession(p);
  const frames = []; const events = {}; const boxes = {};
  cdp.on('Page.screencastFrame', async (f) => { frames.push({ t: f.metadata.timestamp, d: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 86, everyNthFrame: 1 });
  await sleep(250);
  const t0 = frames.length ? frames[0].t : Date.now() / 1000;
  const mark = (k) => { events[k] = +(Date.now() / 1000 - t0).toFixed(2); };
  await fn({ mark, box: async (k, loc) => { boxes[k] = await boxOf(loc); } });
  await sleep(300);
  await cdp.send('Page.stopScreencast'); await cdp.detach();
  const dir = `${OUT}/${name}`; fs.mkdirSync(dir, { recursive: true });
  const start = frames[0].t, end = frames[frames.length - 1].t + .3;
  const N = Math.round((end - start) * FPS); const idx = []; let j = 0; const written = new Map();
  for (let i = 0; i < N; i++) {
    const T = start + i / FPS;
    while (j + 1 < frames.length && frames[j + 1].t <= T) j++;
    if (!written.has(j)) { const fnm = `${String(written.size).padStart(4, '0')}.jpg`; fs.writeFileSync(`${dir}/${fnm}`, Buffer.from(frames[j].d, 'base64')); written.set(j, fnm); }
    idx.push(written.get(j));
  }
  const vp = p.viewportSize();
  META.clips[name] = { w: vp.width, h: vp.height, dur: +(N / FPS).toFixed(2), frames: idx, events, boxes, received: frames.length };
  fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(META));
  console.log('rec', name, `${(N / FPS).toFixed(1)}s`, `${frames.length} frames`, JSON.stringify(events));
}

// ---------- 준비(녹화 밖): 대표가 자료 요청 ----------
await PC();
await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/clients/co_a?tab=docs');
await p.getByRole('button', { name: '자료 요청', exact: true }).first().click(); await sleep(600);
await dlg().getByLabel('자료명').fill('법인등기부등본');
await dlg().locator('textarea').first().fill('최근 3개월 이내 발급본 (말소사항 포함)');
await dlg().getByRole('button', { name: '요청 등록' }).click(); await sleep(900);

// ---------- A. 고객 휴대폰: 자료 제출 ----------
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal/documents');
const row = () => p.locator('li, div').filter({ hasText: '법인등기부등본' }).filter({ has: p.getByRole('button', { name: /업로드|재제출/ }) }).last();
await row().evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(500);
await record('a-submit', async ({ mark, box }) => {
  await sleep(500); await box('row', row());
  await tap(row().getByRole('button', { name: '업로드' })); mark('open'); await sleep(900);
  await dlg().locator('input[type=file]').first().setInputFiles({ name: '법인등기부등본_예시.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 예시 파일 — 실제 서류가 아닙니다') });
  mark('file'); await sleep(1100);
  await tap(dlg().getByRole('button', { name: /제출/ }).last()); mark('submit'); await sleep(1500);
  const sent = p.locator('li, div').filter({ hasText: '법인등기부등본' }).filter({ hasText: /제출완료|검토/ }).last();
  await box('sent', sent); mark('sent'); await sleep(600);
});

// ---------- B. 담당자 PC: 업무함에 자동 생성된 검토 업무 ----------
await PC();
await login('park@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/dashboard');
await record('b-task', async ({ mark, box }) => {
  await sleep(250);
  await click(p.locator('aside a[href="/ax/tasks"], nav a[href="/ax/tasks"]').first(), { ms: 360, pause: 100 }); mark('nav');
  await p.waitForURL('**/ax/tasks'); await sleep(650);
  await click(p.getByRole('button', { name: '미완료', exact: true }).first(), { ms: 300, pause: 90 }); await sleep(350);
  const t = p.getByText(/법인등기부등본 검토/).first();
  await smooth(t); const tr = t.locator('xpath=ancestor::*[self::li or contains(@class,"card") or contains(@class,"rounded")][1]');
  await glide((await t.boundingBox()).x + 40, (await t.boundingBox()).y + 10, 300); mark('task');
  await box('task', (await tr.count()) ? tr : t); await sleep(1300);
});

// ---------- C. 담당자 PC: 검토 → 보완 요청 ----------
await go('/ax/clients/co_a?tab=docs');
await record('c-revision', async ({ mark, box }) => {
  await sleep(200);
  await click(p.locator('table.tbl tbody tr').filter({ hasText: '법인등기부등본' }).first(), { ms: 360, pause: 100 }); mark('open'); await sleep(620);
  await box('dialog', dlg());
  await click(dlg().locator('textarea').first(), { ms: 300, pause: 80 }); await sleep(100);
  await p.keyboard.type('말소사항 포함 발급본으로 다시 올려 주세요.', { delay: 20 }); mark('typed'); await sleep(250);
  await box('btn', dlg().getByRole('button', { name: '보완 요청' }));
  await click(dlg().getByRole('button', { name: '보완 요청' }), { ms: 320, pause: 100 }); mark('revision'); await sleep(1200);
});

// ---------- D. 고객 휴대폰: 보완 필요 반영 ----------
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal');
await record('d-status', async ({ mark, box }) => {
  await sleep(450);
  await tap(p.locator('nav a[href="/portal/documents"]').last()); mark('nav');
  await p.waitForURL('**/portal/documents'); await sleep(900);
  const rv = p.locator('li, div').filter({ hasText: '법인등기부등본' }).filter({ has: p.getByRole('button', { name: '재제출' }) }).last();
  await smooth(rv); mark('shown'); await box('row', rv); await sleep(1500);
});

// ---------- E. 고객 휴대폰: 재제출 ----------
await record('e-resubmit', async ({ mark, box }) => {
  await sleep(300);
  const rv = p.locator('li, div').filter({ hasText: '법인등기부등본' }).filter({ has: p.getByRole('button', { name: '재제출' }) }).last();
  await tap(rv.getByRole('button', { name: '재제출' })); mark('open'); await sleep(800);
  await dlg().locator('input[type=file]').first().setInputFiles({ name: '법인등기부등본_말소포함_예시.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 예시 파일 — 실제 서류가 아닙니다') });
  await sleep(800); await tap(dlg().getByRole('button', { name: /제출/ }).last()); mark('submit'); await sleep(1300);
});

// ---------- F. 담당자 PC: 검토 완료 → 이력 ----------
await PC();
await login('park@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/clients/co_a?tab=docs');
await record('f-done', async ({ mark, box }) => {
  await sleep(200);
  await click(p.locator('table.tbl tbody tr').filter({ hasText: '법인등기부등본' }).first(), { ms: 340, pause: 100 }); await sleep(600);
  await click(dlg().getByRole('button', { name: '검토 완료' }), { ms: 320, pause: 100 }); mark('done'); await sleep(700);
  await click(p.getByRole('tab', { name: /History/ }), { ms: 360, pause: 100 }); mark('history'); await sleep(600);
  await box('list', p.getByText('전체 이력').first().locator('xpath=ancestor::*[contains(@class,"card")][1]'));
  await sleep(1300);
});

const st = await p.evaluate(() => { const s = window.__kpjkState(); return s.tasks.filter((t) => /법인등기부등본 검토/.test(t.title)).map((t) => ({ title: t.title, source: t.source, a: t.assigneeId })); });
console.log('자동 업무', JSON.stringify(st));
console.log('page errors', errs.length ? errs.slice(0, 3) : '없음');
await b.close();
