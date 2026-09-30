// 화면 녹화 엔진 — Chrome 화면 프레임(CDP screencast) → JPEG → ffmpeg(H.264)
// 자막·커서·강조 표시는 녹화 중인 페이지에 주입한 오버레이로 그린다. 앱 코드는 건드리지 않는다.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

// 실행 환경마다 경로가 달라 환경변수로 덮어쓸 수 있게 한다 (README 참고)
const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const { chromium } = pw;
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME_PATH || (fs.existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);
export const B = process.env.APP_URL || 'http://localhost:3000';
/**
 * 서버(Supabase)에 붙은 앱을 녹화할 때 — 녹화 브라우저는 앱 밖 주소를 막으므로 서버 주소만 열어 준다.
 * SUPABASE_URL 이 없으면 저장소의 .env.local 에서 읽는다. 없으면 데모 모드 녹화다.
 */
export const SERVER_URL = (process.env.SUPABASE_URL || (() => {
  try {
    const env = fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
    return env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() || '';
  } catch { return ''; }
})()).replace(/\/$/, '');
export const FF = process.env.FFMPEG || (() => {
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return 'ffmpeg'; }
})();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------------------- */
/* 오버레이 (모든 페이지 로드 때마다 다시 설치된다)                               */
/* -------------------------------------------------------------------------- */
function OVERLAY() {
  if (window.top !== window) return;           // iframe 안에는 설치하지 않는다 (휴대폰 목업)
  if (window.__recInstalled) return; window.__recInstalled = true;
  const FONT = '"Pretendard Variable", Pretendard, sans-serif';
  const css = `
    #__cap{position:fixed;left:0;right:0;margin:0 auto;width:max-content;bottom:38px;transform:translateY(10px);opacity:0;max-width:min(1200px,calc(100vw - 96px));
      background:rgba(18,21,26,.93);color:#fff;border-radius:16px;padding:15px 30px 17px;text-align:center;font-family:${FONT};
      box-shadow:0 14px 44px rgba(0,0,0,.30);transition:opacity .38s ease,transform .38s ease;z-index:2147483646;pointer-events:none}
    #__cap.on{opacity:1;transform:none}
    #__cap.top{top:12px;bottom:auto;transform:translateY(-10px)}
    #__cap.top.on{transform:none}
    #__cap .eb{display:inline-block;font-size:13.5px;font-weight:700;letter-spacing:.01em;color:#1b1f24;background:#eab99a;border-radius:999px;padding:3px 12px 4px;margin-bottom:7px}
    #__cap .tx{font-size:27px;font-weight:650;line-height:1.42;letter-spacing:-.012em;word-break:keep-all}
    #__cap .tx b{color:#f2c3a3;font-weight:750}
    #__tag{position:fixed;right:16px;bottom:12px;font:600 12.5px/1 ${FONT};color:rgba(255,255,255,.95);background:rgba(18,21,26,.66);
      padding:6px 11px 7px;border-radius:999px;z-index:2147483645;pointer-events:none;opacity:0;transition:opacity .3s}
    #__tag.on{opacity:1}
    #__cur{position:fixed;left:-80px;top:-80px;width:28px;height:28px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
    .__rip{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid #d47a4a;z-index:2147483646;
      pointer-events:none;animation:__rip .5s ease-out forwards}
    @keyframes __rip{from{transform:scale(.25);opacity:1}to{transform:scale(1.35);opacity:0}}
    #__hl{position:fixed;border:3px solid #e0955f;border-radius:14px;opacity:0;pointer-events:none;z-index:2147483644;transition:opacity .3s ease}
    #__hl.on{opacity:1;animation:__pulse 1.4s ease-in-out infinite}
    @keyframes __pulse{0%,100%{box-shadow:0 0 0 5px rgba(212,122,74,.14),0 0 22px rgba(212,122,74,.30)}50%{box-shadow:0 0 0 10px rgba(212,122,74,.10),0 0 34px rgba(212,122,74,.45)}}
    div.pointer-events-none.fixed.inset-x-0[class*="z-[100]"]{bottom:150px !important}
    /* 목록 맨 아래 항목도 자막 위로 끌어올릴 수 있게 여백만 더한다 (내용은 그대로) */
    main{padding-bottom:260px !important}
  `;
  const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } };
  const render = (cap, eb, tx) => { cap.innerHTML = (eb ? '<div class="eb">' + eb + '</div>' : '') + '<div class="tx">' + tx + '</div>'; };
  const boot = () => {
    const st = document.createElement('style'); st.textContent = css; document.documentElement.appendChild(st);
    const mk = (id) => { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); return d; };
    const cap = mk('__cap'), tag = mk('__tag'), hl = mk('__hl'), cur = mk('__cur');
    cur.innerHTML = '<svg viewBox="0 0 28 28" width="28" height="28"><path d="M4 2.5 L4 22 L9.2 17.3 L12.6 25 L16 23.5 L12.7 15.9 L19.8 15.9 Z" fill="#fff" stroke="#15181c" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    const place = (x, y) => { cur.style.left = (x - 4) + 'px'; cur.style.top = (y - 2.5) + 'px'; };
    const cx = ss('__cx'), cy = ss('__cy'); if (cx && cy) place(+cx, +cy);
    window.addEventListener('mousemove', (e) => { place(e.clientX, e.clientY); ss('__cx', String(e.clientX)); ss('__cy', String(e.clientY)); }, true);
    window.addEventListener('mousedown', (e) => {
      const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 600);
    }, true);
    window.__setCap = (eb, tx, instant, pos) => {
      ss('__capEb', eb || ''); ss('__capTx', tx || '');
      const show = () => { if (!tx) { cap.classList.remove('on'); return; } render(cap, eb, tx); cap.classList.toggle('top', pos === 'top'); requestAnimationFrame(() => cap.classList.add('on')); };
      if (instant || !cap.classList.contains('on')) { show(); return; }
      cap.classList.remove('on'); setTimeout(show, 260);
    };
    window.__setTag = (t) => { ss('__tag', t || ''); if (t) { tag.textContent = t; tag.classList.add('on'); } else tag.classList.remove('on'); };
    window.__hl = (r) => {
      if (!r) { hl.classList.remove('on'); return; }
      const pad = r.pad == null ? 8 : r.pad;
      Object.assign(hl.style, { left: (r.x - pad) + 'px', top: (r.y - pad) + 'px', width: (r.w + pad * 2) + 'px', height: (r.h + pad * 2) + 'px', borderRadius: (r.radius == null ? 14 : r.radius) + 'px' });
      hl.classList.add('on');
    };
    window.__cursor = (on) => { cur.style.opacity = on ? '1' : '0'; };
    const eb = ss('__capEb'), tx = ss('__capTx'); if (tx) { render(cap, eb, tx); cap.classList.add('on'); }
    const t = ss('__tag'); if (t) { tag.textContent = t; tag.classList.add('on'); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}

/* -------------------------------------------------------------------------- */
/* 세션                                                                         */
/* -------------------------------------------------------------------------- */
export async function launch() {
  return chromium.launch(CHROME ? { executablePath: CHROME } : {});
}

export async function session(browser, { w = 1440, h = 810, dpr = 4 / 3, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  await page.route('**/*', (r) => {
    const u = r.request().url();
    return u.startsWith(B) || (SERVER_URL && u.startsWith(SERVER_URL)) || u.startsWith('data:') || u.startsWith('about:') ? r.continue() : r.abort();
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  return { ctx, page, errs, mouse: new Mouse(page) };
}

/** 앱과 같은 출처(localhost:3000)의 가짜 주소로 카드 HTML 을 띄운다 — iframe 이 같은 로그인 상태를 쓰게 */
export async function sameOriginCard(ctx, html) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 1440, height: 810 });
  await p.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
  await p.route(B + '/__card', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await p.goto(B + '/__card', { waitUntil: 'load' });
  return p;
}

/** 로그인 — 녹화 밖에서 쓴다. 튜토리얼 팝업까지 닫는다 */
export async function login(page, id, pwd, to) {
  await page.bringToFront();
  // 계정 전환: 화면 세션을 비우고, 서버 모드라면 서버 로그인 토큰(kpjk-auth)도 지운다 —
  // 남아 있으면 로그인 화면이 앞 사람으로 다시 붙는다.
  await page.evaluate(() => { localStorage.removeItem('kpjk-auth'); const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); if (k) { const s = JSON.parse(localStorage.getItem(k)); s.state.session = null; localStorage.setItem(k, JSON.stringify(s)); } }).catch(() => {});
  await page.goto(B + '/login', { waitUntil: 'networkidle' }); await sleep(700);
  await page.getByLabel('아이디 (이메일)').fill(id);
  await page.locator('input[type=password]').first().fill(pwd);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(to, { timeout: 15000 }); await sleep(1500);
  await dismissPopups(page);
}

export async function dismissPopups(page) {
  await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 1800 }).catch(() => {});
  await page.getByRole('button', { name: '건너뛰기' }).click({ timeout: 1200 }).catch(() => {});
  await sleep(300);
}

export async function go(page, url, wait = 900) {
  await page.bringToFront();
  await page.goto(B + url, { waitUntil: 'networkidle' });
  await sleep(wait);
  await dismissPopups(page);
}

/* 오버레이 조작 */
export const cap = (page, eb, tx, instant, pos) => page.evaluate(([a, b, c, d]) => window.__setCap && window.__setCap(a, b, c, d), [eb, tx, !!instant, pos || 'bottom']);
export const tag = (page, t) => page.evaluate((x) => window.__setTag && window.__setTag(x), t);
export const cursor = (page, on) => page.evaluate((x) => window.__cursor && window.__cursor(x), on);
export async function hl(page, locOrNull, opt = {}) {
  if (!locOrNull) return page.evaluate(() => window.__hl && window.__hl(null));
  const b = await locOrNull.boundingBox();
  if (!b) return;
  return page.evaluate((r) => window.__hl && window.__hl(r), { x: b.x, y: b.y, w: b.width, h: b.height, ...opt });
}

/** 여러 요소를 한 상자로 묶어 강조 — widthOf 를 주면 그 요소의 가로 폭에 맞춘다 */
export async function hlUnion(page, locs, { widthOf, pad = 6, radius = 12 } = {}) {
  const bs = (await Promise.all(locs.map((l) => l.boundingBox()))).filter(Boolean);
  if (!bs.length) return;
  let x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  let r = Math.max(...bs.map((b) => b.x + b.width)), btm = Math.max(...bs.map((b) => b.y + b.height));
  if (widthOf) { const w = await widthOf.boundingBox(); if (w) { x = w.x + 12; r = w.x + w.width - 12; } }
  return page.evaluate((q) => window.__hl && window.__hl(q), { x, y, w: r - x, h: btm - y, pad, radius });
}

/* 마우스 — 사람이 움직이듯 가속·감속하며 이동 */
export class Mouse {
  constructor(page) { this.p = page; this.x = 760; this.y = 470; }
  async to(x, y, ms = 560) {
    const sx = this.x, sy = this.y; const n = Math.max(10, Math.round(ms / 16));
    for (let i = 1; i <= n; i++) {
      const t = i / n; const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await this.p.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
      await sleep(ms / n);
    }
    this.x = x; this.y = y;
  }
  async over(loc, ms = 560, dx = 0, dy = 0) {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Error('보이지 않는 요소: ' + loc);
    await this.to(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, ms);
    return b;
  }
  async click(loc, { ms = 560, pause = 200, after = 150, dx = 0, dy = 0 } = {}) {
    const b = await this.over(loc, ms, dx, dy);
    await sleep(pause);
    await this.p.mouse.down(); await sleep(80); await this.p.mouse.up();
    await sleep(after);
    return b;
  }
  /** 화면을 부드럽게 굴린다 (현재 커서 위치의 영역) */
  async scroll(dy, ms = 900) {
    const n = Math.max(12, Math.round(ms / 16));
    for (let i = 0; i < n; i++) { await this.p.mouse.wheel(0, dy / n); await sleep(ms / n); }
  }
}

/** 글자를 사람이 치듯 입력 */
export async function typeInto(mouse, loc, text, delay = 55) {
  await mouse.click(loc);
  await loc.pressSequentially(text, { delay });
}

/* -------------------------------------------------------------------------- */
/* 녹화                                                                         */
/* -------------------------------------------------------------------------- */
export class Recorder {
  constructor(outDir) {
    this.out = outDir; this.clips = []; this.cdps = new Map();
    fs.mkdirSync(path.join(outDir, 'clips'), { recursive: true });
  }
  async cdp(page) {
    if (!this.cdps.has(page)) this.cdps.set(page, await page.context().newCDPSession(page));
    return this.cdps.get(page);
  }
  /**
   * 한 장면을 녹화한다. fn 이 끝날 때까지의 실제 시간이 장면 길이가 된다.
   * minMs 를 주면 fn 이 일찍 끝나도 그 길이까지 화면을 더 담는다.
   */
  async shot(page, name, fn, { minMs = 0 } = {}) {
    // 뒤쪽 탭은 Chrome 이 애니메이션을 멈춰 두어 화면이 중간 상태(반투명)로 찍힌다 — 반드시 앞으로
    await page.bringToFront();
    await sleep(350);
    const cdp = await this.cdp(page);
    const dir = path.join(this.out, 'frames', name);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const frames = [];
    const onFrame = (f) => {
      const file = path.join(dir, String(frames.length).padStart(5, '0') + '.jpg');
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push({ file, ts: f.metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    };
    cdp.on('Page.screencastFrame', onFrame);
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1920, everyNthFrame: 1 });
    const t0 = Date.now();
    await fn();
    const rest = minMs - (Date.now() - t0);
    if (rest > 0) await sleep(rest);
    // 정지 화면에서는 프레임이 오지 않는다 — 마지막 순간까지 담기 위해 끝 시각을 기록해 둔다
    const tEnd = Date.now() / 1000;
    await cdp.send('Page.stopScreencast');
    cdp.off('Page.screencastFrame', onFrame);
    if (!frames.length) throw new Error(`${name}: 프레임이 하나도 없습니다`);

    const lines = ['ffconcat version 1.0'];
    for (let i = 0; i < frames.length; i++) {
      const d = (i + 1 < frames.length ? frames[i + 1].ts : tEnd) - frames[i].ts;
      lines.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, d).toFixed(4)}`);
    }
    lines.push(`file '${frames[frames.length - 1].file}'`);
    const list = path.join(dir, 'list.txt'); fs.writeFileSync(list, lines.join('\n'));
    const clip = path.join(this.out, 'clips', name + '.mp4');
    execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', 'fps=30,scale=1920:-2:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', clip]);
    fs.rmSync(dir, { recursive: true, force: true });
    const dur = probeDur(clip);
    this.clips.push({ name, file: clip, dur });
    console.log(`  ● ${name.padEnd(18)} ${dur.toFixed(2)}s  (${frames.length} frames)`);
    return dur;
  }
}

export function probeDur(file) {
  try { execFileSync(FF, ['-i', file], { stdio: 'pipe' }); } catch (e) {
    const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
  return 0;
}

/**
 * 장면들을 이어 붙인다 — 장면 사이 교차 전환, 처음·끝 페이드, 무음 오디오 트랙(메신저·플레이어 호환용).
 */
export function assemble(clips, out, { xf = 0.35, fadeIn = 0.45, fadeOut = 0.7 } = {}) {
  const args = ['-y', '-loglevel', 'error'];
  for (const c of clips) args.push('-i', c.file);
  args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
  const f = [];
  let last = '[0:v]', len = clips[0].dur;
  for (let i = 1; i < clips.length; i++) {
    const off = (len - xf).toFixed(3);
    const lab = `[x${i}]`;
    f.push(`${last}[${i}:v]xfade=transition=fade:duration=${xf}:offset=${off}${lab}`);
    last = lab; len = len + clips[i].dur - xf;
  }
  f.push(`${last}fade=t=in:st=0:d=${fadeIn},fade=t=out:st=${(len - fadeOut).toFixed(3)}:d=${fadeOut},format=yuv420p[v]`);
  args.push('-filter_complex', f.join(';'), '-map', '[v]', '-map', `${clips.length}:a`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-r', '30',
    '-c:a', 'aac', '-b:a', '96k', '-t', len.toFixed(3), '-movflags', '+faststart', out);
  execFileSync(FF, args, { stdio: 'inherit' });
  return len;
}

/** 확인용 정지 화면 뽑기 */
export function stills(file, outPrefix, times) {
  times.forEach((t, i) => {
    execFileSync(FF, ['-y', '-loglevel', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=960:-2', `${outPrefix}-${String(i).padStart(2, '0')}.jpg`]);
  });
}
