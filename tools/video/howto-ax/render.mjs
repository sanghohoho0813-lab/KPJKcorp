// node render.mjs frames 3,30,60 [guide]  → test/f_<t>.jpg
// node render.mjs video                  → KPJK_AX_사용방법.mp4
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const FF = process.env.FFMPEG || 'ffmpeg';
// shots/ · voice.wav · knots.json · subs.json · 결과물이 있는 폴더 (저장소에는 넣지 않는다)
const A = path.resolve(process.env.ASSETS || path.join(DIR, '..', 'out', 'howto-ax'));
const FPS = 30, DUR = 223.6, OFFSET = 0.5;
const [mode, arg, guide] = process.argv.slice(2);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.addInitScript(([d, k, o, s]) => { window.SHOT_DIR = d; window.KNOTS = k; window.OFFSET = o; window.SUBS = s; },
  ['file://' + path.join(A, 'shots') + '/', JSON.parse(readFileSync(path.join(A, 'knots.json'))), OFFSET, JSON.parse(readFileSync(path.join(A, 'subs.json')))]);
await p.goto('file://' + path.join(DIR, 'comp.html') + (guide ? '?guide=1' : ''));
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); });
const bad = await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
if (bad.length) console.log('이미지 없음', bad);
const shot = async (t) => { await p.evaluate((t) => window.render(t), t); return p.screenshot({ type: 'jpeg', quality: 92 }); };
if (mode === 'frames') {
  mkdirSync(path.join(A, 'test'), { recursive: true });
  for (const t of arg.split(',').map(Number)) writeFileSync(path.join(A, 'test', `f_${t.toFixed(1).padStart(6, '0')}.jpg`), await shot(t));
} else {
  const out = path.join(A, 'KPJK_AX_사용방법.mp4');
  const ff = spawn(FF, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', path.join(A, 'voice.wav'),
    '-filter_complex', `[1:a]adelay=${OFFSET * 1000}|${OFFSET * 1000},apad,afade=t=out:st=${DUR - 1.0}:d=1.0[a]`,
    '-map', '0:v', '-map', '[a]', '-t', String(DUR), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const N = Math.round(DUR * FPS);
  for (let i = 0; i < N; i++) {
    const buf = await shot(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 600 === 0) console.log(`frame ${i}/${N}`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); console.log('done', out);
}
if (errs.length) console.log('page errors', errs);
await b.close();
