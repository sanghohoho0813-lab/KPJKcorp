// 16:9 렌더 — comp.html 의 render(t) 를 30fps 로 찍어 ffmpeg 로 MP4 (음성 합침)
//   node render.mjs frames <comp.html> <출력폴더> 3,30,60 [guide]
//   node render.mjs video  <comp.html> <voice.wav> <out.mp4>
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const SANDBOX = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const [mode, COMP, A, B, C] = process.argv.slice(2);
const FPS = 30;
const b = await pw.chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync(SANDBOX) ? SANDBOX : undefined), args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
const url = pathToFileURL(path.resolve(COMP)).href + (mode === 'frames' && C === 'guide' ? '?guide=1' : '');
await p.goto(url);
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))); });
await p.waitForTimeout(300);
const bad = await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
if (bad.length) console.log('이미지 없음', bad);
const fonts = await p.evaluate(() => [...document.fonts].filter((f) => f.status !== 'loaded').map((f) => f.family));
if (fonts.length) console.log('글꼴 못 읽음(사용 전일 수 있음)', [...new Set(fonts)]);
const DUR = await p.evaluate(() => window.DUR);
const shot = async (t) => { await p.evaluate((t) => window.render(t), t); return p.screenshot({ type: 'jpeg', quality: 92 }); };
if (mode === 'frames') {
  fs.mkdirSync(A, { recursive: true });
  for (const t of B.split(',').map(Number)) fs.writeFileSync(path.join(A, `f_${String(t.toFixed(1)).padStart(6, '0')}.jpg`), await shot(t));
} else {
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', A, '-filter_complex', `[1:a]apad,atrim=0:${DUR},afade=t=out:st=${DUR - 1.2}:d=1.2[a]`, '-map', '0:v', '-map', '[a]', '-t', String(DUR),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', B], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round(DUR * FPS);
  for (let i = 0; i < N; i++) {
    const buf = await shot(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 900 === 0) console.log(`frame ${i}/${N}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('done', B);
}
if (errs.length) console.log('page errors', errs.slice(0, 5));
await b.close();
