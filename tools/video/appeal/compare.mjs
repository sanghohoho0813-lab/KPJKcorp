// 전후 비교 영상 — 수정한 구간만, 화면을 반으로 갈라 왼쪽 수정 전 · 오른쪽 수정 후 (음성은 수정 후 · 나레이션은 같다)
//   node compare.mjs <before.mp4> <after.mp4> <out.mp4> <fonts 폴더>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const [BEFORE, AFTER, OUT, FONTS] = process.argv.slice(2);
const SEGS = [
  { a: 62.0, b: 91.3, no: '①', time: '01:02 – 01:30', title: '실제 기술 작동 증빙 강화',
    before: '정지 화면 · 코드 장면', after: '실제 화면 녹화(데모 환경) + 서버 트리거 실제 실행 결과' },
  { a: 122.3, b: 133.0, no: '②', time: '02:03 – 02:12', title: '기존 CRM 대비 기술적 차별성',
    before: '구현 위치 카드 3장', after: '일반 CRM 기능 ↔ 컨설팅 업무 통합 처리구조 비교' },
  { a: 155.9, b: 180.8, no: '③', time: '02:36 – 03:00', title: '신규 고도화 기능의 시점 명확화',
    before: '‘신규’ 표시만', after: '「기존 신청기술 기반 추가 고도화 | 2026년 10월」 · 핵심 구조 유지 표기' },
];
const TMP = fs.mkdtempSync('/tmp/claude-0/cmp-');
const SANDBOX = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync(SANDBOX) ? SANDBOX : undefined) });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
for (const [i, s] of SEGS.entries()) {
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family:'P'; font-weight:45 920; src:url('file://${path.resolve(FONTS)}/PretendardVariable.ttf'); }
    html,body{margin:0;width:1920px;height:1080px;background:transparent;font-family:'P',sans-serif;color:#f4f1ec;word-break:keep-all}
    .eb{position:absolute;left:80px;top:62px;font-size:20px;font-weight:700;letter-spacing:.3em;color:#e8b89a}
    .h{position:absolute;left:80px;top:100px;font-size:46px;font-weight:800;letter-spacing:-.02em}
    .h b{color:#e8b89a;font-weight:800;margin-right:16px}
    .h span{font-size:26px;font-weight:600;color:rgba(244,241,236,.55);margin-left:18px;letter-spacing:0}
    .lb{position:absolute;top:226px;font-size:24px;font-weight:800;letter-spacing:.08em;display:flex;align-items:center;gap:12px}
    .lb i{display:inline-block;width:12px;height:12px;border-radius:50%}
    .lb small{font-size:20px;font-weight:600;letter-spacing:0;color:rgba(244,241,236,.6)}
    .div{position:absolute;left:958px;top:270px;width:4px;height:540px;background:#d47a4a}
    .fr{position:absolute;top:270px;width:960px;height:540px;box-sizing:border-box;border:1px solid rgba(255,255,255,.14)}
    .ds{position:absolute;top:838px;width:900px;font-size:22px;font-weight:600;line-height:1.45;color:rgba(244,241,236,.78)}
    .ds b{display:block;font-size:17px;font-weight:800;letter-spacing:.12em;margin-bottom:6px}
    .ft{position:absolute;left:80px;right:80px;bottom:38px;font-size:17px;font-weight:500;color:rgba(244,241,236,.45)}
  </style></head><body>
    <div class="eb">전후 비교 · 수정한 부분만 ${i + 1} / ${SEGS.length}</div>
    <div class="h"><b>${s.no}</b>${esc(s.title)}<span>${esc(s.time)}</span></div>
    <div class="lb" style="left:30px"><i style="background:rgba(244,241,236,.5)"></i>BEFORE<small>수정 전</small></div>
    <div class="lb" style="left:990px;color:#e8b89a"><i style="background:#d47a4a"></i>AFTER<small>수정 후</small></div>
    <div class="fr" style="left:0"></div><div class="fr" style="left:960px;border-color:rgba(232,184,154,.5)"></div><div class="div"></div>
    <div class="ds" style="left:30px"><b style="color:rgba(244,241,236,.5)">수정 전</b>${esc(s.before)}</div>
    <div class="ds" style="left:990px"><b style="color:#e8b89a">수정 후</b>${esc(s.after)}</div>
    <div class="ft">KPJK 기술검증 이의신청 영상 · 같은 시각의 화면을 나란히 놓았습니다 · 소리는 수정 후 영상(나레이션은 같음)</div>
  </body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${TMP}/ov${i}.png`, omitBackground: true });
}
await b.close();
const FF = process.env.FFMPEG || 'ffmpeg';
// 구간마다 따로 만든 뒤 이어 붙인다(한 번에 하면 앞 구간을 만드는 동안 뒤 구간 프레임이 메모리에 쌓인다)
const parts = [];
SEGS.forEach((s, i) => {
  const len = (s.b - s.a).toFixed(3), out = `${TMP}/seg${i}.mp4`;
  const f = [`[0:v]setpts=PTS-STARTPTS,scale=960:540:flags=lanczos[b]`, `[1:v]setpts=PTS-STARTPTS,scale=960:540:flags=lanczos[a]`,
    `color=c=0x0f1216:s=1920x1080:r=30:d=${len}[bg]`, `[bg][b]overlay=0:270[x]`, `[x][a]overlay=960:270[y]`,
    `[y][2:v]overlay=0:0,fade=t=in:st=0:d=0.4,fade=t=out:st=${(s.b - s.a - 0.4).toFixed(3)}:d=0.4,format=yuv420p[v]`,
    `[1:a]asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.3,afade=t=out:st=${(s.b - s.a - 0.4).toFixed(3)}:d=0.4[s]`];
  execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(s.a), '-t', len, '-i', BEFORE, '-ss', String(s.a), '-t', len, '-i', AFTER, '-i', `${TMP}/ov${i}.png`,
    '-filter_complex', f.join(';'), '-map', '[v]', '-map', '[s]', '-t', len, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', out], { stdio: 'inherit' });
  parts.push(out);
});
fs.writeFileSync(`${TMP}/list.txt`, parts.map((x) => `file '${x}'`).join('\n'));
execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${TMP}/list.txt`, '-c', 'copy', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
fs.rmSync(TMP, { recursive: true, force: true });
console.log('done', OUT, SEGS.reduce((t, s) => t + s.b - s.a, 0).toFixed(1) + 's');
