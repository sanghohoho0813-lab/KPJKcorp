// 사용: node render.mjs frames 3,30,60  → test/f_<t>.jpg
//       node render.mjs video            → out.mp4 (30fps, voice.wav 를 OFFSET 만큼 뒤로)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const FF = process.env.FFMPEG || 'ffmpeg';
// 화면 캡처(shots/)·음성(voice.wav)·결과물이 있는 곳 — 저장소에는 넣지 않는다
const ASSETS = path.resolve(process.env.ASSETS || path.join(DIR, '..', 'out', 'ax-intro'));
const FPS = 30, DUR = 121.0, OFFSET_MS = 1200;
const [mode, arg] = process.argv.slice(2);

const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.addInitScript((d) => { window.SHOT_DIR = d; }, 'file://' + path.join(ASSETS, 'shots') + '/');
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('file://' + path.join(DIR, 'comp.html'));
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); });
const bad = await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
if (bad.length) console.log('이미지 없음', bad);
const shot = async (t) => { await p.evaluate((t) => window.render(t), t); return p.screenshot({ type: 'jpeg', quality: 92 }); };

if (mode === 'frames') {
  mkdirSync(path.join(ASSETS, 'test'), { recursive: true });
  for (const t of arg.split(',').map(Number)) writeFileSync(path.join(ASSETS, 'test', `f_${String(t).padStart(6, '0')}.jpg`), await shot(t));
} else {
  const out = path.join(ASSETS, 'KPJK_AX_실사_안내.mp4');
  const ff = spawn(FF, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', path.join(ASSETS, 'voice.wav'),
    '-filter_complex', `[1:a]adelay=${OFFSET_MS}|${OFFSET_MS},apad,afade=t=out:st=${DUR - 1.2}:d=1.2[a]`,
    '-map', '0:v', '-map', '[a]', '-t', String(DUR),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const N = Math.round(DUR * FPS);
  for (let i = 0; i < N; i++) {
    const buf = await shot(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`frame ${i}/${N}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('done', out);
}
if (errs.length) console.log('page errors', errs);
await b.close();
