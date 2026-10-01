import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'fs';
const B = 'http://localhost:3000', NM = '/home/user/KPJKcorp/node_modules/';
const truth = JSON.parse(fs.readFileSync('/var/tmp/ocrbench/truth.json', 'utf8'));
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.route(/cdn\.jsdelivr\.net\/npm\/(tesseract|@tesseract)/, async (r) => {
  const u = r.request().url(); let f;
  if (/tesseract\.js@[^/]+\/dist\/(.+)$/.test(u)) f = NM + 'tesseract.js/dist/' + u.match(/dist\/(.+)$/)[1];
  else if (/tesseract\.js-core@[^/]+\/(.+)$/.test(u)) f = NM + 'tesseract.js-core/' + u.match(/tesseract\.js-core@[^/]+\/(.+)$/)[1];
  else if (/(kor|eng)\.traineddata\.gz/.test(u)) f = '/var/tmp/ocr/' + u.match(/(kor|eng)\.traineddata\.gz/)[0];
  return f && fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f), headers: { 'access-control-allow-origin': '*', 'content-type': f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' } }) : r.abort();
});
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => (/jsdelivr\.net\/npm\/(tesseract|@tesseract)/.test(r.request().url()) ? r.fallback() : r.abort()));
const p = await ctx.newPage();
await p.goto(B + '/login'); await p.waitForTimeout(1200);
await p.getByLabel('아이디 (이메일)').fill('ceo@kpjk.co.kr'); await p.locator('input[type=password]').first().fill('kpjk2026!');
await p.getByRole('button', { name: '로그인', exact: true }).click(); await p.waitForURL('**/ax/**'); await p.waitForTimeout(1500);
await p.getByLabel(/튜토리얼 닫기/).click({ timeout: 2000 }).catch(() => {});
const FIELDS = ['name', 'ceo', 'bizNo', 'corpNo', 'establishedAt', 'ceoBirth', 'address', 'bizCategory', 'bizItem', 'bizItemsExtra'];
const score = Object.fromEntries(FIELDS.map((k) => [k, [0, 0]]));
const misses = [];
for (const t of truth) {
  if (only && !only.test(t.file)) continue;
  await p.goto(B + '/ax/clients'); await p.waitForTimeout(1000);
  await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kpjk-draft:')).forEach((k) => localStorage.removeItem(k)));
  await p.getByRole('button', { name: '기업고객 등록' }).first().click(); await p.waitForTimeout(600);
  const t0 = Date.now();
  await p.locator('[role=dialog] input[type=file]').first().setInputFiles('/var/tmp/ocrbench/docs/' + t.file);
  await p.waitForFunction(() => /서류에서 읽어 채웠습니다|못했|읽을 수 없/.test(document.body.innerText), null, { timeout: 180000 }).catch(() => {});
  const sec = Math.round((Date.now() - t0) / 1000);
  const v = await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]'); const val = (sel) => d.querySelector(sel)?.value ?? '';
    const byLabel = (txt) => { for (const lab of d.querySelectorAll('label')) { const s = lab.querySelector('span'); if (s && s.innerText.split('\n')[0].trim() === txt) return lab.querySelector('input')?.value ?? ''; } return ''; };
    const extra = [...d.querySelectorAll('input[aria-label$="번째 업태"]')].map((el, i) => `${el.value} — ${d.querySelector(`input[aria-label="${i + 2}번째 종목"]`)?.value ?? ''}`).join('\n');
    return { name: byLabel('기업명'), ceo: byLabel('대표자'), bizNo: byLabel('사업자등록번호'), corpNo: byLabel('법인등록번호'), establishedAt: byLabel('설립일') || byLabel('개업일'), ceoBirth: byLabel('대표자 생년월일'), address: byLabel('주소'), bizCategory: val('input[aria-label="주업태"]'), bizItem: val('input[aria-label="주종목"]'), bizItemsExtra: extra };
  });
  const norm = (x) => String(x ?? '').replace(/\s+/g, '');
  const bad = [];
  for (const k of FIELDS) {
    if (t[k] === undefined) continue;
    score[k][1]++;
    if (norm(v[k]) === norm(t[k])) score[k][0]++; else bad.push(`${k}: ${v[k] || '(빈칸)'} ≠ ${t[k]}`);
  }

  console.log(`${t.file.padEnd(32)} ${sec}s ${bad.length ? 'X ' + bad.join(' | ') : 'ALL OK'}`);
  if (bad.length) misses.push(t.file);
  await p.locator('[role=dialog]').getByRole('button', { name: '취소' }).click().catch(() => {});
  await p.waitForTimeout(300);
}
console.log('\n필드별 정확도 (띄어쓰기 무시)');
let a = 0, n = 0;
for (const k of FIELDS) { const [c, t] = score[k]; if (!t) continue; a += c; n += t; console.log(`  ${k.padEnd(14)} ${c}/${t}`); }
console.log(`  전체 ${a}/${n} = ${(a / n * 100).toFixed(1)}%`);
await b.close();
