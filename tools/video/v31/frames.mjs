//  node frames.mjs comp.html outdir t1 t2 ...  — 지정 시각 프레임을 PNG 로 (guide=1)
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const [,, COMP, OUT, ...ts] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(pathToFileURL(COMP).href + (process.env.GUIDE ? '?guide=1' : ''));
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
for (const t of ts) { await p.evaluate((t) => window.render(t), +t); await p.screenshot({ path: `${OUT}/f_${(+t).toFixed(2).padStart(7, '0')}.png`, type: 'png' }); }
console.log('errors', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
