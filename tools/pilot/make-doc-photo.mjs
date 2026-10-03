// 사진 업로드 시험(photoshrink.mjs)용 "서류 사진" 만들기 — 저장소에는 넣지 않는다(약 9MB)
// 작은 글씨 표가 빽빽한 가짜 재무제표 한 장을 휴대폰 카메라 해상도(4032x3024)로 찍은 것처럼.
// 사용: node tools/pilot/make-doc-photo.mjs   (ffmpeg 필요, 경로는 FFMPEG 환경변수로 바꿀 수 있음)
import { execFileSync } from 'node:child_process';
import { chromium } from './lib.mjs';
const FILES = new URL('./files/', import.meta.url).pathname;
const FF = process.env.FFMPEG || 'ffmpeg';
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 1344, height: 1008 }, deviceScaleFactor: 3 });
const rows = Array.from({ length: 26 }, (_, i) => `<tr><td>${2023 + (i % 3)}-${String(i + 1).padStart(2, '0')}</td><td>시험용 계정과목 ${i + 1}</td><td>${(1234567 * (i + 3)).toLocaleString()}</td><td>${(98765 * (i + 1)).toLocaleString()}</td><td>비고: 예시 숫자 (실제 아님)</td></tr>`).join('');
await p.setContent(`<html><body style="margin:0;background:#e9e6df;font-family:sans-serif"><div style="margin:20px auto;width:900px;background:#fff;padding:28px 36px;transform:rotate(-1.2deg);box-shadow:0 8px 30px rgba(0,0,0,.25)"><h2 style="margin:0 0 6px">재 무 상 태 표 (시험용 예시)</h2><div style="font-size:12px;color:#444">회사명: 시험 주식회사 · 단위: 원 · 이 문서는 시험용으로 만든 가짜 서류입니다</div><table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:10px" border="1" cellpadding="3">${rows}</table></div></body></html>`);
await p.waitForTimeout(400);
await p.screenshot({ path: FILES + 'doc-photo.png' });
await b.close();
execFileSync(FF, ['-y', '-loglevel', 'error', '-i', FILES + 'doc-photo.png', '-vf', 'noise=alls=10:allf=t,eq=brightness=0.02', '-q:v', '2', FILES + 'doc-photo.jpg']);
execFileSync(FF, ['-y', '-loglevel', 'error', '-i', FILES + 'doc-photo.png', '-vf', 'scale=800:-1', '-q:v', '4', FILES + 'doc-photo-small.jpg']);
console.log('만듦:', FILES + 'doc-photo.jpg', FILES + 'doc-photo-small.jpg');
