//  node render.mjs comp.html voice.wav out.mp4 <DUR초> 600 [부분시작초] [부분끝초]   (환경변수 FFMPEG = ffmpeg 경로)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const [,, COMP, AUDIO, OUT, DUR_S, OFFSET_MS = '0', FROM_S = '0', TO_S = ''] = process.argv
const FPS = 30
const DUR = Number(DUR_S)
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const from = Math.round(Number(FROM_S) * FPS)
const to = TO_S ? Math.round(Number(TO_S) * FPS) : Math.round(DUR * FPS)

const b = await chromium.launch({ executablePath: process.env.CHROME || undefined })
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
await p.goto(pathToFileURL(COMP).href)
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(400)

const args = ['-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-']
if (AUDIO) args.push('-i', AUDIO)
args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS))
if (AUDIO) {
  const sec = from / FPS
  const len = (to - from) / FPS
  //  음성 앞 여백(OFFSET)만큼 늦추고, 뒤는 무음으로 채워(apad) 영상 길이에 맞춥니다.
  //  ⚠ -shortest 를 쓰면 음성 끝에서 영상이 잘려 마지막 로고 장면과 페이드가 사라집니다.
  args.push('-filter_complex', `[1:a]adelay=${OFFSET_MS}|${OFFSET_MS},apad,atrim=start=${sec}:end=${sec + len},asetpts=PTS-STARTPTS,afade=t=out:st=${Math.max(0, len - 1)}:d=1[a]`,
    '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2')
}
args.push('-movflags', '+faststart', '-t', String((to - from) / FPS), OUT)
const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] })

for (let i = from; i < to; i++) {
  await p.evaluate((t) => window.render(t), i / FPS)
  const buf = await p.screenshot({ type: 'jpeg', quality: 92 })
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
  if ((i - from) % 300 === 0) console.log(`frame ${i}/${to}`)
}
ff.stdin.end()
await new Promise((r) => ff.on('close', r))
await b.close()
