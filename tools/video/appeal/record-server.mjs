// 영상 ① 장면 — 운영 서버 연속 녹화. 고객 휴대폰 창과 담당자 PC 창을 서로 다른 로그인으로 동시에 띄워 한 번에 끊지 않고 녹화한다.
// 두 창은 같은 운영 서버(Supabase)에만 연결된다 — 한쪽에서 한 일이 다른 쪽에 나타나는 것은 서버 저장 · 실시간 반영 그대로(새로고침 없음).
// 덧그리는 것은 누른 자리 원 · PC 마우스 화살표뿐. 계정 정보는 환경변수로만 받고 파일 · 로그 어디에도 남기지 않는다.
//
//   STAFF_ID=… STAFF_PW=… CLIENT_ID=… CLIENT_PW=… OUT=<폴더> node record-server.mjs check   # 안전 점검만 (서버에 쓰지 않음)
//   STAFF_ID=… STAFF_PW=… CLIENT_ID=… CLIENT_PW=… OUT=<폴더> CUES=<cues.json> node record-server.mjs   # 자료 요청 1건을 만들고 녹화
//   CUES: build.py <W> --cues 가 만든 나레이션 큐 — 사람이 대본에 맞춰 누르듯 조작 시작 시각만 맞춘다(서버 반응은 기다리기만)
//
// 안전 점검(두 모드 공통) — 하나라도 걸리면 녹화하지 않는다. 화면이 아니라 서버가 이 계정에 내준 데이터 전체로 본다
//   · 두 창 모두 서버 모드인가 (데모 · 브라우저 저장이 아님)
//   · 담당자 계정이 받은 기업이 "[가상]" 기업 한 곳뿐인가 (실제 고객사가 화면에 나올 수 없게)
//   · 담당자 계정이 받은 미완료 업무가 모두 그 가상 기업 것인가
//   · 고객 계정이 그 가상 기업 소속인가
//   · 처음 비밀번호 안내(바꿔 주세요) 띠가 두 화면 어디에도 없는가
import fs from 'node:fs';
const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const B = (process.env.APP_URL || 'https://kpj-kcorp.vercel.app').replace(/\/$/, '');
const OUT = process.env.OUT || new URL('./rec-server', import.meta.url).pathname;
const CHECK = process.argv[2] === 'check';
const DOC = process.env.DOC || '법인등기부등본';
const DESC = process.env.DESC || '최근 3개월 이내 발급본 (말소사항 포함)';
const REASON = process.env.REASON || '말소사항 포함 발급본으로 다시 올려 주세요.';
const FPS = 30;
// 나레이션 큐(build.py --cues) — 앞 조작 묶음이 시작된 때부터 다음 묶음까지 기다릴 간격(초, 첫 기준은 고객이 업로드를 누른 때). 없으면 사람 속도 기본값
const CUE = process.env.CUES ? JSON.parse(fs.readFileSync(process.env.CUES, 'utf-8')) : {};
const need = ['STAFF_ID', 'STAFF_PW', 'CLIENT_ID', 'CLIENT_PW'].filter((k) => !process.env[k]);
if (need.length) { console.error('계정 환경변수가 없습니다:', need.join(', ')); process.exit(2); }
const fail = (m) => { console.error('멈춤 —', m); process.exitCode = 1; throw new Error(m); };

const SANDBOX = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync(SANDBOX) ? SANDBOX : undefined), env: { ...process.env, LANG: 'C.UTF-8' } });
// 누른 자리 · 마우스 화살표 (녹화 표시) — 앱 화면 위에 덧그리기만 한다 (record-loop.mjs 와 같은 모양)
const overlay = () => addEventListener('DOMContentLoaded', () => {
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
async function screen(name, width, height) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kpjk-test', '1'); } catch {} });   // 앱 상태 읽기만 허용(시험 도구용 표시)
  await ctx.addInitScript(overlay);
  const p = await ctx.newPage();
  const s = { name, ctx, p, mx: width / 2, my: height / 2, errs: [] };
  p.on('pageerror', (e) => s.errs.push(String(e)));
  return s;
}
const PC = await screen('pc', 1440, 900);
const PH = await screen('phone', 390, 844);
const sleep = (ms) => PC.p.waitForTimeout(ms);
const dlg = (s) => s.p.locator('[role=dialog]:visible').last();
const dismiss = async (s) => {
  await s.p.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  await s.p.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
};
async function login(s, id, pwd, to) {
  await s.p.goto(B + '/login', { waitUntil: 'networkidle' });
  await s.p.getByLabel('아이디 (이메일)').fill(id); await s.p.locator('input[type=password]').first().fill(pwd);
  await s.p.getByRole('button', { name: '로그인' }).click();
  await s.p.waitForURL(to, { timeout: 20000 }).catch(() => fail(`${s.name} 로그인 실패 — 아이디 · 비밀번호 · 이메일 확인 여부를 확인해 주세요`));
  await sleep(1500); await dismiss(s);
}
const go = async (s, u) => { await s.p.goto(B + u, { waitUntil: 'networkidle' }); await sleep(900); await dismiss(s); };
const nudge = async (s) => (await s.p.getByTestId('password-nudge').count()) > 0;

// 사람 속도 조작 — PC 는 화살표가 미끄러져 가서 누르고, 휴대폰은 누른 자리만
async function glide(s, x, y, ms = 420) {
  const n = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { const k = i / n, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; await s.p.mouse.move(s.mx + (x - s.mx) * e, s.my + (y - s.my) * e); await sleep(16); }
  s.mx = x; s.my = y;
}
async function click(s, loc, { ms = 420, pause = 160 } = {}) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const r = await loc.boundingBox(); if (!r) fail(`${s.name}: 누를 곳이 보이지 않음`);
  await glide(s, r.x + r.width / 2, r.y + r.height / 2, ms); await sleep(pause);
  await s.p.mouse.down(); await sleep(70); await s.p.mouse.up();
}
async function tap(s, loc, pause = 150) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const r = await loc.boundingBox(); if (!r) fail(`${s.name}: 누를 곳이 보이지 않음`);
  await s.p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await sleep(pause);
  await s.p.mouse.down(); await sleep(80); await s.p.mouse.up();
}
const smooth = async (loc) => { await loc.evaluate((e) => e.scrollIntoView({ behavior: 'smooth', block: 'center' })).catch(() => {}); await sleep(700); };
const boxOf = async (loc) => { const r = await loc.boundingBox().catch(() => null); return r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
/** 조건이 화면에 나타날 때까지 기다린다 — 새로고침하지 않는다(서버 · 실시간 반영만으로 바뀌어야 한다) */
async function until(s, what, fn, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn().catch(() => false)) return (Date.now() - t0) / 1000; await sleep(120); }
  fail(`${s.name}: ${ms / 1000}초 안에 "${what}" 이(가) 화면에 나타나지 않음 (새로고침 없이)`);
}
const phRow = (re) => PH.p.locator('li, div').filter({ hasText: DOC }).filter({ has: PH.p.getByRole('button', { name: re }) }).last();
const pcDocRow = () => PC.p.locator('table.tbl tbody tr').filter({ hasText: DOC }).filter({ hasText: /미제출|제출완료|검토중|보완필요/ }).first();   // 이번 요청 (지난 촬영 행은 '완료')
const pcTask = () => PC.p.locator('main span.font-semibold').filter({ hasText: `${DOC} 검토` });   // 업무함 제목
const pcTaskRow = (t) => t.locator('xpath=ancestor::div[contains(@class,"py-3")][1]');
const state = (s) => s.p.evaluate(() => { const g = window.__kpjkState?.(); return g && { server: !!g.serverMode, companies: g.companies.map((c) => ({ id: c.id, name: c.name })),
  open: g.tasks.filter((t) => t.status !== 'done').map((t) => ({ c: t.companyId || '', title: t.title })),
  projects: g.projects.filter((x) => !['done', 'aftercare'].includes(x.stage)).map((x) => x.companyId),
  reqs: g.docRequests.map((r) => ({ id: r.id, c: r.companyId, name: r.name, status: r.status })) }; });
/** 서버가 이 창에 내준 요청 하나의 상태 — 화면과 같은 저장소라 바뀌는 순간 화면도 함께 바뀐다 */
const reqStatus = (s, id) => s.p.evaluate((id) => window.__kpjkState?.().docRequests.find((r) => r.id === id)?.status, id);
const openTasks = (s, co) => s.p.evaluate(([co, doc]) => window.__kpjkState?.().tasks.filter((t) => t.companyId === co && t.status !== 'done' && t.title.includes(`${doc} 검토`)).length, [co, DOC]);
/** 조건을 바로 지켜보기 시작해, 처음 참이 된 시각을 돌려준다(다른 조작과 함께 돌린다 — 늦게 확인해 시간이 부풀지 않게) */
function watch(s, what, fn, ms = 30000) {
  return (async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await fn().catch(() => false)) return Date.now() / 1000; await new Promise((r) => setTimeout(r, 100)); }
    fail(`${s.name}: ${ms / 1000}초 안에 "${what}" 이(가) 나타나지 않음 (새로고침 없이)`);
  })();
}

try {
  // ---------- 1. 로그인 · 안전 점검 (쓰지 않음) ----------
  await login(PC, process.env.STAFF_ID, process.env.STAFF_PW, '**/ax/**');
  await login(PH, process.env.CLIENT_ID, process.env.CLIENT_PW, '**/portal**');
  if (await nudge(PC) || await nudge(PH)) fail('처음 비밀번호를 아직 바꾸지 않은 계정이 있습니다 — 화면에 안내 띠가 나옵니다. 각 계정으로 로그인해 비밀번호를 바꿔 주세요');
  const sp = await state(PC), sc = await state(PH);
  if (!sp || !sc) fail('앱 상태를 읽지 못했습니다');
  if (!sp.server || !sc.server) fail('서버 모드가 아닙니다 — 운영 주소(APP_URL)와 서버 계정으로 로그인했는지 확인해 주세요');
  const real = sp.companies.filter((c) => !c.name.includes('[가상]'));
  const fake = sp.companies.filter((c) => c.name.includes('[가상]'));
  if (real.length) fail(`담당자 계정이 "[가상]" 이 아닌 기업 ${real.length}곳을 받습니다 — 설정 → 데이터 → 컨설턴트 열람 범위를 "내 담당만"으로 바꾸고, 이 계정을 실제 기업 담당에서 빼 주세요`);
  if (fake.length !== 1) fail(`담당자 계정의 "[가상]" 기업이 ${fake.length}곳입니다 — 한 곳만 담당으로 두어 주세요`);
  const CO = `/ax/clients/${fake[0].id}`, coName = fake[0].name;
  const foreign = sp.open.filter((t) => t.c !== fake[0].id).length;
  if (!sp.projects.includes(fake[0].id)) fail('가상 기업에 진행 중인 프로젝트가 없습니다 — 기업 상세 → 프로젝트 등록(단계 "자료요청")을 해 주세요');
  if (foreign) fail(`담당자 업무함에 가상 기업이 아닌 업무 ${foreign}건이 있습니다 — 업무함에 나오지 않게 정리해 주세요`);
  if (sc.companies.length !== 1 || sc.companies[0].id !== fake[0].id) fail('고객 계정의 소속 기업이 담당자의 가상 기업과 다릅니다');
  console.log(`안전 점검 통과 — 서버 모드 · 가상 기업 1곳(${coName}) · 다른 기업 0곳 · 다른 업무 0건 · 안내 띠 없음`);
  if (CHECK) { await b.close(); process.exit(0); }

  // ---------- 2. 준비 (녹화 전): 지난 촬영의 '… 검토' 업무 완료 처리 → 담당자가 자료 요청 1건 ----------
  const coId = fake[0].id;
  await go(PC, '/ax/tasks'); await PC.p.getByRole('button', { name: '미완료', exact: true }).first().click(); await sleep(600);
  for (let i = 0; i < 6 && (await openTasks(PC, coId)) > 0; i++) {
    await pcTaskRow(pcTask().first()).getByRole('button', { name: '완료', exact: true }).click(); await sleep(1200);
  }
  if (await openTasks(PC, coId)) fail(`업무함의 지난 촬영 "${DOC} 검토" 업무를 정리하지 못했습니다`);
  const before = new Set((await state(PC)).reqs.map((r) => r.id));
  await go(PC, `${CO}?tab=docs`);
  await PC.p.getByRole('button', { name: '자료 요청', exact: true }).first().click(); await sleep(600);
  await dlg(PC).getByLabel('자료명').fill(DOC);
  await dlg(PC).locator('textarea').first().fill(DESC);
  await dlg(PC).getByRole('button', { name: '요청 등록' }).click(); await sleep(1500);
  const made = (await state(PC)).reqs.filter((r) => !before.has(r.id) && r.c === coId && r.name === DOC);
  if (made.length !== 1) fail(`새 자료 요청을 찾지 못했습니다 (${made.length}건)`);
  const RID = made[0].id;
  await go(PH, '/portal/documents');
  await until(PH, `${DOC} 업로드`, async () => (await reqStatus(PH, RID)) === 'requested' && (await phRow(/^업로드$/).count()) > 0, 30000);
  await smooth(phRow(/^업로드$/));
  await go(PC, '/ax/tasks');
  await PC.p.getByRole('button', { name: '미완료', exact: true }).first().click(); await sleep(600);
  const n0 = await openTasks(PC, coId);   // 0 — 위에서 정리했다
  await PC.p.evaluate(() => { window.__showCursor = true; });
  await PC.p.mouse.move(PC.mx, PC.my);

  // ---------- 3. 녹화 — 두 창을 같은 시계로 ----------
  const casts = [];
  for (const s of [PC, PH]) {
    const cdp = await s.ctx.newCDPSession(s.p); const frames = [];
    cdp.on('Page.screencastFrame', (f) => { frames.push({ t: f.metadata.timestamp, d: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 86, everyNthFrame: 1 });
    casts.push({ s, cdp, frames });
  }
  const ev = {}, boxes = { pc: {}, phone: {} };
  const mark = (k) => { ev[k] = Date.now() / 1000; };
  let lastCue = null;   // 앞 묶음이 실제로 시작된 때 — 늦게 시작했으면 뒤도 그만큼 밀린다
  const cue = async (k) => {
    lastCue ??= ev.ph_open;
    if (CUE[k] != null) { const w = lastCue + CUE[k] - Date.now() / 1000; if (w > 0) await sleep(w * 1000); }
    lastCue = Date.now() / 1000;
  };
  const box = async (s, k, loc) => { boxes[s.name][k] = await boxOf(loc); };
  await sleep(1500);
  // 고객: 요청자료 제출
  await box(PH, 'row', phRow(/^업로드$/));
  await tap(PH, phRow(/^업로드$/).getByRole('button', { name: '업로드' })); mark('ph_open'); await sleep(900);
  await dlg(PH).locator('input[type=file]').first().setInputFiles({ name: `${DOC}_예시.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 예시 파일 — 실제 서류가 아닙니다') });
  mark('ph_file'); await sleep(1100);
  await tap(PH, dlg(PH).getByRole('button', { name: /제출/ }).last()); mark('ph_submit');
  // 담당자 PC: 새로고침 없이 자동 생성 업무가 나타난다
  ev.pc_task = await watch(PC, `${DOC} 검토 업무`, async () => (await openTasks(PC, coId)) > n0 && (await pcTask().count()) > 0);
  const task = pcTaskRow(pcTask().first());
  await sleep(500); await task.scrollIntoViewIfNeeded().catch(() => {}); await box(PC, 'task', task); await sleep(900);
  await cue('G2'); const r = await task.boundingBox(); await glide(PC, r.x + 60, r.y + 14, 500); mark('pc_point'); await sleep(900);
  await cue('G3');
  // 담당자: 기업 → 요청자료 → 보완 요청
  await click(PC, task.locator(`a[href^="${CO}"]`).first(), { ms: 380, pause: 120 }); await PC.p.waitForURL(`**${CO}**`); mark('pc_client'); await sleep(600);   // 안내 창은 준비 때 닫았다(녹화 중 기다림 없음)
  await click(PC, PC.p.getByRole('tab', { name: /요청자료/ }), { ms: 360, pause: 100 }); await sleep(600);
  await click(PC, pcDocRow(), { ms: 360, pause: 100 }); mark('pc_open'); await sleep(700);
  await box(PC, 'dialog', dlg(PC));
  await cue('G4'); await click(PC, dlg(PC).locator('textarea').first(), { ms: 300, pause: 80 });
  await PC.p.keyboard.type(REASON, { delay: 55 }); mark('pc_typed'); await sleep(400);
  await box(PC, 'btn', dlg(PC).getByRole('button', { name: '보완 요청' }));
  await click(PC, dlg(PC).getByRole('button', { name: '보완 요청' }), { ms: 320, pause: 100 }); mark('pc_revision');
  // 고객 휴대폰: 새로고침 없이 보완 필요가 나타난다
  ev.ph_shown = await watch(PH, `${DOC} 보완필요`, async () => (await reqStatus(PH, RID)) === 'revision');
  await until(PH, `${DOC} 재제출 버튼`, async () => (await phRow(/^재제출$/).count()) > 0, 5000);
  await smooth(phRow(/^재제출$/)); await box(PH, 'row2', phRow(/^재제출$/)); await sleep(1300);
  // 고객: 재제출
  await cue('G5'); await tap(PH, phRow(/^재제출$/).getByRole('button', { name: '재제출' })); mark('ph_reopen'); await sleep(800);
  await dlg(PH).locator('input[type=file]').first().setInputFiles({ name: `${DOC}_말소포함_예시.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 예시 파일 — 실제 서류가 아닙니다') });
  await sleep(800); await tap(PH, dlg(PH).getByRole('button', { name: /제출/ }).last()); mark('ph_resubmit');
  // 담당자 PC: 새로고침 없이 재제출이 나타난다 → 검토 완료 → 이력
  ev.pc_resub = await watch(PC, `${DOC} 재제출`, async () => ['submitted', 'reviewing'].includes(await reqStatus(PC, RID)));
  await sleep(700); await cue('G6');
  await click(PC, pcDocRow(), { ms: 340, pause: 100 }); await sleep(700);
  await click(PC, dlg(PC).getByRole('button', { name: '검토 완료' }), { ms: 320, pause: 100 }); mark('pc_done');
  const phDone = watch(PH, `${DOC} 확인완료`, async () => (await reqStatus(PH, RID)) === 'done');   // 지금부터 지켜본다
  await sleep(800);
  await cue('G7'); await click(PC, PC.p.getByRole('tab', { name: /History/ }), { ms: 360, pause: 100 }); mark('pc_history'); await sleep(700);
  const hist = PC.p.getByText('전체 이력').first().locator('xpath=ancestor::*[contains(@class,"card")][1]');
  await box(PC, 'list', hist);
  // 고객 휴대폰: 새로고침 없이 확인완료
  ev.ph_done = await phDone;
  await sleep(1500); await cue('END');
  for (const c of casts) { await c.cdp.send('Page.stopScreencast'); await c.cdp.detach(); }

  // ---------- 4. 저장 — 두 창을 같은 30fps 시각축에 ----------
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  // 먼저 시작한 화면부터 — 아직 첫 프레임이 없는 화면은 첫 프레임을 그대로 둔다(바뀐 게 없으면 Chrome 은 프레임을 보내지 않는다)
  const start = Math.min(...casts.map((c) => c.frames[0].t)), end = Math.max(...casts.map((c) => c.frames[c.frames.length - 1].t)) + .3;
  const N = Math.round((end - start) * FPS);
  const scr = {};
  for (const { s, frames } of casts) {
    const dir = `${OUT}/${s.name}`; fs.mkdirSync(dir); const idx = []; let j = 0; const written = new Map();
    for (let i = 0; i < N; i++) {
      const T = start + i / FPS;
      while (j + 1 < frames.length && frames[j + 1].t <= T) j++;
      if (!written.has(j)) { const f = `${String(written.size).padStart(4, '0')}.jpg`; fs.writeFileSync(`${dir}/${f}`, Buffer.from(frames[j].d, 'base64')); written.set(j, f); }
      idx.push(written.get(j));
    }
    const vp = s.p.viewportSize(); scr[s.name] = { w: vp.width, h: vp.height, frames: idx, received: frames.length };
  }
  const events = Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, +(v - start).toFixed(2)]));
  const lat = (a, b) => +(ev[b] - ev[a]).toFixed(1);
  const history = (await hist.innerText()).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 24);
  const meta = { mode: 'server', app: new URL(B).host, recordedAt: new Date().toISOString(), company: coName, fps: FPS, dur: +(N / FPS).toFixed(2),
    screens: scr, events, boxes, history,
    latency: { task: lat('ph_submit', 'pc_task'), shown: lat('pc_revision', 'ph_shown'), resub: lat('ph_resubmit', 'pc_resub'), done: lat('pc_done', 'ph_done') },
    pageErrors: { pc: PC.errs.length, phone: PH.errs.length } };
  fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta));
  console.log('녹화', meta.dur + 's', '· 서버 반영(새로고침 없음):', JSON.stringify(meta.latency), '· 화면 오류', JSON.stringify(meta.pageErrors));
} catch (e) {
  for (const s of [PC, PH]) await s.p.screenshot({ path: `${OUT.replace(/\/$/, '')}-${s.name}-멈춤.png` }).catch(() => {});
  if (!process.exitCode) { console.error('멈춤 —', e.message); process.exitCode = 1; }
} finally {
  await b.close();
}
