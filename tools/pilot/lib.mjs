// 파일럿 검증 공통 — 실제 서버(Supabase)에 붙은 앱을 대표·컨설턴트·고객 실제 계정으로 조작한다.
// 확인은 두 곳에서 한다: 화면(브라우저) + 서버 DB(psql). 화면만 보고 "됐다"고 하지 않는다.
import fs from 'fs';
import { execFileSync } from 'child_process';

const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
export const { chromium, devices } = pw;
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME_PATH || (fs.existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);

export const B = process.env.APP_URL || 'http://localhost:3000';
export const SB = (process.env.SUPABASE_URL || (() => {
  try { return fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() || ''; } catch { return ''; }
})()).replace(/\/$/, '');
if (!SB) throw new Error('서버 주소가 없습니다. .env.local 의 NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_URL 을 넣으세요.');
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SB);
// 서버 DB 직접 확인용 연결 문자열 (로컬 Supabase 기본값). 실제 프로젝트는 PILOT_DB_URL 로.
export const DB = process.env.PILOT_DB_URL || (LOCAL ? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' : '');
if (!DB) throw new Error('PILOT_DB_URL 이 필요합니다 (Supabase → Project Settings → Database → Connection string).');

// 비밀번호는 코드에 두지 않는다. 로컬 시험 서버에서만 기본값을 쓴다.
const pwOf = (k, local) => process.env[k] || (LOCAL ? local : (() => { throw new Error(`${k} 가 필요합니다`); })());
export const ACC = {
  ceo: { id: process.env.PILOT_CEO_ID || 'ceo@pilot.test', pw: pwOf('PILOT_CEO_PW', 'PilotCeo!2026') },
  con: { id: process.env.PILOT_CON_ID || 'consultant@pilot.test', pw: pwOf('PILOT_CON_PW', 'PilotCon!2026'), name: '파일럿 컨설턴트' },
  c1: { id: process.env.PILOT_C1_ID || 'client1@pilot.test', pw: pwOf('PILOT_C1_PW', 'PilotCli1!2026'), name: '고객 담당자 1' },
  c2: { id: process.env.PILOT_C2_ID || 'client2@pilot.test', pw: pwOf('PILOT_C2_PW', 'PilotCli2!2026'), name: '고객 담당자 2' },
};
export const CO1 = 'Pilot 검증기업 A (비식별)';
export const CO2 = 'Pilot 검증기업 B (비식별)';
export const FILES = new URL('./files/', import.meta.url).pathname;

let fails = 0, oks = 0;
export const L = (k, v) => { const s = String(v); if (/^FAIL/.test(s)) fails++; else if (/^OK/.test(s)) oks++; console.log(`${k}: ${s}`); };
export const ok = (k, cond, extra = '') => L(k, (cond ? 'OK' : 'FAIL') + (extra ? ` ${extra}` : ''));
export const summary = () => { console.log(`\n== OK ${oks} / FAIL ${fails}`); return fails; };
export const sql = (q) => execFileSync('psql', [DB, '-tA', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();

export async function launch() {
  return chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), env: { ...process.env, LANG: 'C.UTF-8' } });
}
export async function ctxFor(b, kind = 'pc') {
  const opts = kind === 'mobile' ? { ...devices['iPhone 13'], locale: 'ko-KR' } : { viewport: { width: 1440, height: 950 }, locale: 'ko-KR' };
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') p.errs.push('console: ' + m.text().slice(0, 200)); });
  return { ctx, p };
}
export async function closeTut(p) {
  await p.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 2000 }).catch(() => {});
  await p.getByRole('button', { name: '건너뛰기' }).click({ timeout: 1500 }).catch(() => {});
}
export async function login(p, a, expect = /\/(ax|portal)/) {
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.getByLabel('아이디 (이메일)').fill(a.id);
  await p.locator('input[type=password]').first().fill(a.pw);
  await p.getByRole('button', { name: '로그인', exact: true }).click();
  await p.waitForURL(expect, { timeout: 20000 });
  await p.waitForTimeout(1500);
  await closeTut(p);
}
export async function logout(p) {
  const btn = p.getByRole('button', { name: '로그아웃' }).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
  else await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /로그아웃/.test(x.getAttribute('aria-label') || x.innerText)); b?.click(); });
  await p.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(800);
}
export const body = (p) => p.evaluate(() => document.body.innerText);
export const toasts = (p) => p.evaluate(() => [...document.querySelectorAll('[role=status],[role=alert]')].map((e) => e.innerText).join(' | '));
export const state = (p) => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); return k ? JSON.parse(localStorage.getItem(k)).state : null; });
