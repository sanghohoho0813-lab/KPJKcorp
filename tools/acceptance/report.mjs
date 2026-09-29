// 1차 개발 완료 보고 · 최종검수 요청서 (계약 제12조③) — PDF
//
// run.mjs 가 남긴 out/results.json 과 캡처만으로 만든다. 문서 속 숫자와 통과 여부는 전부 그 파일에서 온다.
// 품질 수치(회귀 시험·서버 권한 시험)는 out/quality.json 이 있을 때만 싣고, 측정일을 함께 적는다.
//
// 실행: node tools/acceptance/run.mjs && node tools/acceptance/report.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME_PATH || (fs.existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || path.join(HERE, 'out');

const R = JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8'));
const Q = fs.existsSync(path.join(OUT, 'quality.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'quality.json'), 'utf8')) : null;
const PARTY = { gap: '주식회사 케이피제이케이코퍼레이션', eul: '미래 AI 랩' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const d = new Date(R.finishedAt);
const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const img = (rel) => `data:image/png;base64,${fs.readFileSync(path.join(OUT, rel)).toString('base64')}`;
const byCrit = (id, vp) => R.checks.filter((c) => c.criteria === id && c.viewport === vp);
const allOk = (id, vp) => { const cs = byCrit(id, vp); return cs.length > 0 && cs.every((c) => c.ok); };
const pass = R.checks.filter((c) => c.ok).length;
const shotOf = (vp, name) => R.checks.filter((c) => c.viewport === vp).flatMap((c) => c.shots).find((s) => s.includes(name));
const mark = (ok) => (ok ? '<b class="ok">충족</b>' : '<b class="bad">미충족</b>');

const HOW = {
  C1: '기업고객 등록 → 수정 → 검색 조회, 변경 이력 저장 확인 · 실증 기록 검색·엑셀 내보내기',
  C2: '대시보드 운영 현황 6개 상태 표시와 저장 데이터 일치 여부',
  C3: 'AI 브리핑 화면의 우선업무·누락자료·지연·후속연락 항목과 대표자용 요약',
  C4: 'Portal 진행현황·일정·공지·완료자료 화면, 자료 제출 → 내부 업무 자동생성 → 검토 → Portal 자동반영, 문의 → 내부 문의함',
  C5: '위 모든 흐름을 PC(1440px)와 휴대폰(390px) 화면에서 각각 같은 순서로 실행',
};

const MODULES = [
  ['통합 운영 대시보드', '진행 프로젝트, 기업고객, 요청자료, 일정, 지연건, 후속업무 등 핵심 상태를 한 화면에서 확인', '대시보드 — 운영 현황 6개 상태, 오늘 확인할 일, 대표자용 요약'],
  ['기업고객 통합관리', '기업 기본정보, 담당자, 상담이력, 계약, 프로젝트, 주요 메모와 관계이력을 기업카드 단위로 통합 관리', '기업고객 — 기업카드(기본정보·담당자·상담·계약·프로젝트·메모·활동 이력), 사업자등록증 읽기, 엑셀 일괄 등록'],
  ['상담·계약·프로젝트 진행관리', '상담 접수부터 계약, 수행, 자료검토, 완료까지 단계별 진행상태·담당자·산출물·일정을 관리', '상담·견적·계약 / 프로젝트 — 단계 보드, 담당자·마감·산출물, 단계 변경 이력'],
  ['자료요청·제출·검토 및 일정·후속관리', '기업별 요청자료, 제출여부, 검토·보완 상태와 미팅·마감·후속연락 일정을 체계화', '자료관리 / 일정·공지 / 업무함 — 제출·검토·보완 상태, 자동 규칙 5종(기준일 조정 가능)'],
  ['AI 업무 브리핑·우선순위 지원', '누락자료, 지연건, 후속연락, 오늘의 우선업무, 대표자용 요약을 제공', 'AI 브리핑 — 근거와 함께 순서 제시, 안내문 초안, 대표자용 요약(복사)'],
  ['기업고객 Portal', '프로젝트 진행현황, 요청자료 제출, 일정·공지, 완료자료 확인, 문의·소통', '고객 Portal — 홈·진행현황·자료제출·일정·공지·완료자료·문의, 휴대폰 하단 메뉴'],
];

const ART5 = [
  ['사용자 로그인 및 관리자·일반사용자·고객 권한 구분', '대표·컨설턴트·고객 3역할, 화면과 저장 동작 양쪽에서 권한 확인', allOk('C5', 'pc') && allOk('C5', 'mobile')],
  ['검색·필터·데이터 등록·수정·조회·이력저장', '기업·프로젝트·자료·일정·업무 등록·수정, 전역 검색, 실증 기록 필터', allOk('C1', 'pc') && allOk('C1', 'mobile')],
  ['PC·모바일 반응형 화면', 'PC 1440px · 휴대폰 390px 에서 전 항목 실행, 가로 넘침 없음', R.checks.every((c) => c.overflow === 0 || c.overflow === null)],
  ['기본 CSV·엑셀 파일 입력 또는 내보내기', '기업고객 엑셀·CSV 일괄 등록, 전체 데이터·실증 기록 엑셀/CSV 내보내기', allOk('C1', 'pc')],
  ['대시보드 및 대표자용 AI 브리핑·우선순위 결과 확인', '대시보드 운영 현황, AI 브리핑, 대표자용 요약', allOk('C2', 'pc') && allOk('C3', 'pc')],
  ['Portal 진행현황 → 자료제출 → 내부 반영 → 담당자 처리 → 상태 변경 → Portal 자동반영', '자동 검수에서 PC·휴대폰 각각 실제로 실행', R.checks.filter((c) => c.title.includes('자동반영')).every((c) => c.ok)],
];

const critRows = R.criteria.map((c) => {
  if (c.id === 'C6') {
    return `<tr><td class="n">${c.id.slice(1)}</td><td>${esc(c.text)}</td><td>본 보고서와 시험버전 주소를 전자문서·메신저로 전달</td><td colspan="2" class="c">전달로 충족<br><span class="small">전달일 ____________</span></td></tr>`;
  }
  const pc = allOk(c.id, 'pc'); const mo = allOk(c.id, 'mobile');
  const n = byCrit(c.id, 'pc').length + byCrit(c.id, 'mobile').length;
  return `<tr><td class="n">${c.id.slice(1)}</td><td>${esc(c.text)}</td><td>${esc(HOW[c.id])}<div class="small">자동 검수 ${n}개 항목</div></td><td class="c">${mark(pc)}</td><td class="c">${mark(mo)}</td></tr>`;
}).join('');

const detailRows = R.checks.map((c) => `<tr><td class="c">${c.viewport === 'pc' ? 'PC' : '휴대폰'}</td><td>${esc(c.title)}</td><td class="c">${c.ok ? '<b class="ok">통과</b>' : '<b class="bad">실패</b>'}</td><td class="small">${c.notes.map((x) => esc(x)).join('<br>')}</td></tr>`).join('');

const figure = (vp, name, cap) => { const s = shotOf(vp, name); return s ? `<figure class="${vp}"><img src="${img(s)}"><figcaption>${esc(cap)}</figcaption></figure>` : ''; };

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>1차 개발 완료 보고 · 최종검수 요청</title>
<style>
@page { size: A4; margin: 16mm 15mm 16mm; }
* { box-sizing: border-box; }
body { font-family: Pretendard, 'Pretendard Variable', 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #1a1d21; font-size: 10pt; line-height: 1.55; margin: 0; }
h1 { font-size: 19pt; margin: 0 0 4px; letter-spacing: -0.02em; }
h2 { font-size: 12.5pt; margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 1.5px solid #1a1d21; }
.sub { color: #5b6470; font-size: 9.5pt; }
.box { border: 1px solid #d5d9de; border-radius: 8px; padding: 12px 14px; margin: 14px 0; background: #f8f9fa; }
.box p { margin: 4px 0; }
table { width: 100%; border-collapse: collapse; margin: 6px 0; }
th, td { border: 1px solid #d5d9de; padding: 6px 7px; vertical-align: top; text-align: left; }
th { background: #f1f3f5; font-weight: 700; font-size: 9pt; }
td.n, td.c { text-align: center; white-space: nowrap; }
.small { color: #5b6470; font-size: 8.3pt; }
.ok { color: #1f7a4d; } .bad { color: #b3261e; }
.meta td { border: none; padding: 2px 8px 2px 0; }
.shots { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.shots.mobile { grid-template-columns: repeat(4, 1fr); }
figure { margin: 0; break-inside: avoid; }
figure img { width: 100%; border: 1px solid #d5d9de; border-radius: 6px; display: block; }
figcaption { font-size: 8.3pt; color: #5b6470; margin-top: 3px; }
.flow { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.sign td { height: 34px; }
.pb { break-before: page; }
ul { margin: 4px 0; padding-left: 18px; } li { margin: 2px 0; }
</style></head><body>

<h1>1차 개발 완료 보고 및 최종검수 요청</h1>
<div class="sub">경영컨설팅 AX 시스템 구축 및 사업화 지원 계약 제12조 제3항 · 별지 제1호 완료·검수 기준 대조</div>
<table class="meta" style="margin-top:10px"><tbody>
<tr><td><b>수신</b></td><td>${PARTY.gap} (갑)</td></tr>
<tr><td><b>발신</b></td><td>${PARTY.eul} (을)</td></tr>
<tr><td><b>작성일</b></td><td>${ymd}</td></tr>
<tr><td><b>시험버전 주소</b></td><td>________________________________________</td></tr>
</tbody></table>

<div class="box">
<p><b>요청 요지</b></p>
<p>계약 제2조의 1차 개발범위(별지 제1호 6개 핵심모듈)를 완료하였기에 보고드리며, 제12조 제3항에 따라 최종검수를 요청드립니다.</p>
<p>별지 제1호 「완료·검수 기준」 6개 항목을 PC와 휴대폰 화면에서 실제로 실행해 확인하였고, 그 결과는 <b>자동 검수 ${R.checks.length}개 항목 중 ${pass}개 통과</b>입니다(페이지 오류 ${R.pageErrors.length}건).</p>
<p>검토 후 미충족 또는 보완이 필요한 사항이 있으면 제12조 제2항에 따라 구체적으로 알려 주시기 바랍니다. 이상이 없으면 마지막 쪽의 확인란에 표시해 주시면 됩니다.</p>
</div>

<h2>1. 별지 제1호 완료·검수 기준 대조</h2>
<table><thead><tr><th style="width:26px">No</th><th style="width:30%">완료·검수 기준 (계약서 문구)</th><th>확인 방법</th><th style="width:52px">PC</th><th style="width:52px">휴대폰</th></tr></thead><tbody>${critRows}</tbody></table>
<p class="small">확인 일시: ${esc(new Date(R.startedAt).toLocaleString('ko-KR'))} ~ ${esc(new Date(R.finishedAt).toLocaleString('ko-KR'))} · 화면의 기업명·수치는 별지 제1호 개발형태 기준의 "합리적인 샘플 자료"이며 화면에 DEMO DATA 로 표시됩니다.</p>

<h2>2. 6개 핵심모듈 구현 대조</h2>
<table><thead><tr><th style="width:26px">No</th><th style="width:22%">핵심모듈</th><th style="width:38%">1차 구현범위 (별지 제1호)</th><th>구현 화면</th></tr></thead><tbody>
${MODULES.map((m, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(m[0])}</b></td><td>${esc(m[1])}</td><td>${esc(m[2])}</td></tr>`).join('')}
</tbody></table>

<h2>3. 제5조 기본 부가기능 및 1차 개발 완료기준</h2>
<table><thead><tr><th style="width:36%">제5조 항목</th><th>구현 내용</th><th style="width:52px">확인</th></tr></thead><tbody>
${ART5.map((a) => `<tr><td>${esc(a[0])}</td><td>${esc(a[1])}</td><td class="c">${mark(a[2])}</td></tr>`).join('')}
</tbody></table>

<h2 class="pb">4. 고객 Portal ↔ 내부 AX 실제 데이터 흐름</h2>
<p>별지 제1호 "고객 Portal과 내부 AX 사이 최소 1개의 실제 데이터 흐름"을 아래 순서로 실행했습니다. 사람이 중간에 데이터를 옮기지 않습니다.</p>
<div class="flow">
${figure('pc', 'portal-submit', '① 고객이 Portal 에서 자료 제출')}
${figure('pc', 'ax-task', '② 담당자 업무함에 검토 업무 자동 생성 → 담당자 검토 완료')}
${figure('pc', 'portal-reflected', '③ 고객 Portal 에 확인완료로 자동 반영')}
${figure('pc', 'evidence', '④ 제출·검토가 실증 기록에 남음')}
</div>
<div class="shots mobile" style="margin-top:10px">
${figure('mobile', 'portal-submit', '휴대폰 ① 자료 제출')}
${figure('mobile', 'ax-task', '휴대폰 ② 업무 자동 생성')}
${figure('mobile', 'portal-reflected', '휴대폰 ③ Portal 확인완료 반영')}
${figure('mobile', 'portal-inquiry', '휴대폰 문의 남기기')}
</div>

<h2 class="pb">5. 주요 화면 — PC</h2>
<div class="shots">
${figure('pc', 'dashboard', '통합 운영 대시보드')}
${figure('pc', 'brief', 'AI 브리핑 · 대표자용 요약')}
${figure('pc', 'company-detail', '기업카드 (등록 → 수정 직후)')}
${figure('pc', 'portal-home', '고객 Portal 홈 · 진행현황')}
${figure('pc', 'portal-schedule', 'Portal 일정 · 공지')}
${figure('pc', 'excel-import', '엑셀·CSV 기업고객 일괄 등록')}
</div>

<h2 class="pb">6. 주요 화면 — 휴대폰</h2>
<div class="shots mobile">
${figure('mobile', 'dashboard', '대시보드')}
${figure('mobile', 'brief', 'AI 브리핑')}
${figure('mobile', 'company-detail', '기업카드')}
${figure('mobile', 'portal-home', 'Portal 홈')}
${figure('mobile', 'portal-schedule', 'Portal 일정·공지')}
${figure('mobile', 'portal-results', 'Portal 완료자료')}
${figure('mobile', 'evidence', '실증 기록 검색')}
${figure('mobile', 'login', '로그인')}
</div>

<h2 class="pb">7. 자동 검수 세부 결과</h2>
<table><thead><tr><th style="width:48px">화면</th><th style="width:34%">항목</th><th style="width:44px">결과</th><th>확인 내용</th></tr></thead><tbody>${detailRows}</tbody></table>
${Q ? `<p style="margin-top:10px"><b>품질 확인 (${esc(Q.measuredAt)} 측정)</b></p><ul>${Q.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}

<h2>8. 1차 범위 밖이거나 이후에 이어지는 일</h2>
<ul>
<li><b>서버 실연결</b> — 갑 명의의 Supabase 프로젝트에 설치 SQL 을 실행하고 연결 정보 두 줄을 넣으면 여러 기기에서 같은 데이터를 씁니다. 설치 안내(supabase/README.md)와 설정 화면의 <b>연결 점검</b> 버튼을 제공합니다.</li>
<li><b>실제 고객 자료 적용</b> — 현재 화면은 샘플 자료입니다. 실제 고객 정보는 고객 동의와 갑의 내부 확인 후 적용합니다(제17조 제3항).</li>
<li><b>실제 운영 피드백 반영</b> — 별지 제1호에 따라 실제 운영 후 오류 수정·사용편의 개선·기존 범위 내 UI/UX·업무규칙·대시보드·실증지표 보완은 계약기간 1년 동안 이어서 반영합니다.</li>
<li><b>제6조 1차 제외 범위</b> — 금융·정책기관·ERP·회계·전자계약 실시간 자동연동(API), 대량 문자·카카오 발송, 앱스토어용 전용 앱, 전자결제, 완성형 전자계약·정산, 대량 기존자료 일괄 이전, 전용 AI 모델 학습은 포함하지 않습니다.</li>
<li>개선율·절감시간 같은 성과 수치는 도입 전 기준선과 실제 사용 기록이 쌓인 뒤에만 계산하며, 본 보고서에는 넣지 않았습니다.</li>
</ul>

<h2>9. 확인</h2>
<table class="sign"><tbody>
<tr><th style="width:18%">갑 확인</th><td colspan="3">□ 이상 없음 — 최종검수 완료 &nbsp;&nbsp;&nbsp; □ 보완 필요 (아래에 구체적으로 기재)</td></tr>
<tr><th>보완 사항</th><td colspan="3" style="height:70px"></td></tr>
<tr><th>갑</th><td>${PARTY.gap}</td><th style="width:12%">확인일</th><td style="width:22%"></td></tr>
<tr><th>확인자</th><td></td><th>서명</th><td></td></tr>
<tr><th>을</th><td>${PARTY.eul}</td><th>요청일</th><td>${ymd}</td></tr>
</tbody></table>
<p class="small">제12조 제3항: 최종검수 완료는 갑과 을의 상호 확인을 원칙으로 하며, 카카오톡·이메일 등 상호 확인 가능한 방식으로 요청합니다. 본 확인란 대신 메신저·이메일 회신으로 확인하셔도 됩니다.</p>
</body></html>`;

fs.writeFileSync(path.join(OUT, 'report.html'), html);
const browser = await pw.chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
// PNG 캡처를 JPEG 로 줄여 파일 크기를 낮춘다 (화면 그대로, 품질 85)
await page.evaluate(async () => {
  for (const im of Array.from(document.images)) {
    await im.decode().catch(() => {});
    const c = document.createElement('canvas');
    const scale = Math.min(1, 1100 / im.naturalWidth);
    c.width = Math.round(im.naturalWidth * scale); c.height = Math.round(im.naturalHeight * scale);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    im.src = c.toDataURL('image/jpeg', 0.85);
  }
});
await page.waitForTimeout(500);
const file = path.join(OUT, `KPJK_AX_1차완료보고_최종검수요청_${ymd}.pdf`);
await page.pdf({ path: file, format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' }, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="width:100%;font-size:8px;color:#8a929c;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
await browser.close();
console.log(file, (fs.statSync(file).size / 1024 / 1024).toFixed(1) + 'MB');
