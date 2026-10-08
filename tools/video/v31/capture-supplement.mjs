// 보완 설명 영상(실사 이후) 캡처 — 9월 17일 이후 개선된 화면만 f- 접두어로 찍는다. capture.mjs 와 같은 cap/ · meta.json 에 더한다.
// 실행: 앱을 데모 모드로 띄운 뒤 OUT=$PWD/cap node capture-supplement.mjs
import fs from 'node:fs';
import { chromium } from 'playwright';
const B = 'http://localhost:3000';
const OUT = process.env.OUT || new URL('./cap', import.meta.url).pathname;
const META = fs.existsSync(`${OUT}/meta.json`) ? JSON.parse(fs.readFileSync(`${OUT}/meta.json`, 'utf8')) : {};
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
// 같은 브라우저 저장소(데모)를 PC·휴대폰이 함께 쓰도록 한 컨텍스트에서 화면 크기만 바꾼다
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, locale: 'ko-KR' });
const p = await ctx.newPage();
await p.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
const PC = async () => { await p.setViewportSize({ width: 1440, height: 1000 }); };
const PHONE = async () => { await p.setViewportSize({ width: 390, height: 879 }); };
const shot = async (name, opts = {}) => { await p.waitForTimeout(opts.wait ?? 900); await p.screenshot({ path: `${OUT}/${name}.png`, ...opts.clip ? { clip: opts.clip } : {} }); console.log('shot', name); };
const dismiss = async () => {
  await p.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 1500 }).catch(() => {});
  await p.getByRole('button', { name: '건너뛰기' }).click({ timeout: 1200 }).catch(() => {});
};
const login = async (id, pw, to) => {
  await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.includes('kpjk')); if (k) { const s = JSON.parse(localStorage.getItem(k)); s.state.session = null; s.state.settings = { ...s.state.settings, tutorialDoneAx: true, tutorialDonePortal: true }; localStorage.setItem(k, JSON.stringify(s)); } }).catch(() => {});
  await p.goto(B + '/login', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.getByLabel('아이디 (이메일)').fill(id); await p.locator('input[type=password]').first().fill(pw);
  await p.getByRole('button', { name: '로그인' }).click(); await p.waitForURL(to, { timeout: 15000 }); await p.waitForTimeout(1200);
  await dismiss();
};
const go = async (u) => { await p.goto(B + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(900); await dismiss(); };
const dlg = () => p.locator('[role=dialog]:visible').last();

await p.goto(B + '/login', { waitUntil: 'networkidle' });
await PC();
const near = async (text) => { const r = p.getByText(text).first(); await r.evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300); const bb = await r.boundingBox(); console.log('BOX', text, JSON.stringify(bb)); };
// ---- 예시 자료 요청: 매출채권 연령표 → 주주명부 (데모 브라우저 저장소만)
await p.goto(B + '/login', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
await p.evaluate(() => {
  const k = 'kpjk-ax-demo-v1'; let raw = localStorage.getItem(k);
  raw = raw.replaceAll('매출채권 연령표 보완 기한', '주주명부 제출 기한').replaceAll('보완 요청: 매출채권 연령표', '자료 요청: 주주명부')
    .replaceAll('거래처 단위 연령 구분이 필요합니다. 기한은 모레입니다.', '최신 주주명부를 올려 주세요. 기한은 모레입니다.')
    .replaceAll('매출채권 연령표 보완 필요', '주주명부 확인 필요').replaceAll('매출채권 연령표가 누락되어 보완 요청', '주주명부 추가 요청')
    .replaceAll('매출채권 자료는 경리 담당이 준비 중', '주주명부·등기부등본은 경리 담당이 준비 중').replaceAll('매출채권 연령표', '주주명부');
  const v = JSON.parse(raw); const st = v.state;
  Object.assign(st.docRequests.find((r) => r.id === 'dr_a6'), { name: '주주명부', description: '최신 주주명부 (주식 수 · 지분율 포함)', status: 'requested', files: [], reviewNote: undefined, submittedAt: undefined, reviewedAt: undefined });
  st.session = null; st.settings = { ...st.settings, tutorialDoneAx: true, tutorialDonePortal: true };
  localStorage.setItem(k, JSON.stringify(v));
});

// ---- 대표 PC

// V3.1 — 실제 스크롤용 긴 화면: 고정된 위·아래 막대는 따로(프레임 캡처에서 잘라 덮는다), 본문은 끝까지 한 장으로
const long = async (name, keys = []) => {
  await p.waitForTimeout(900);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${name}-frame.png` });
  const info = await p.evaluate((keys) => {
    const fixed = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && el.offsetHeight > 0 && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 200) {
        const r = el.getBoundingClientRect(); fixed.push({ top: r.top, h: r.height, pos: cs.position, tag: el.tagName });
        el.setAttribute('data-v31-hide', '1'); el.style.visibility = 'hidden';
      }
    }
    const marks = {};
    for (const k of keys) {
      const el = [...document.querySelectorAll('h1,h2,h3,[data-testid],section,b,span,div')].find((e) => e.childElementCount < 6 && (e.textContent || '').trim().startsWith(k));
      if (el) marks[k] = Math.round(el.getBoundingClientRect().top + window.scrollY);
    }
    return { fixed, marks, H: document.documentElement.scrollHeight, W: window.innerWidth, VH: window.innerHeight };
  }, keys);
  await p.screenshot({ path: `${OUT}/${name}-long.png`, fullPage: true });
  await p.evaluate(() => document.querySelectorAll('[data-v31-hide]').forEach((e) => { e.style.visibility = ''; e.removeAttribute('data-v31-hide'); }));
  META[name] = info; fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(META, null, 1));
  console.log('long', name, JSON.stringify(info));
};

// ===== 실사 보완 영상 (f-) — 9월 17일 이후 개선된 화면 =====
await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/baseline'); await shot('f-pc-baseline'); await long('f-pc-baseline', ['도입 전', '비교', '7일차', '14일차']);
await go('/ax/tasks'); await shot('f-pc-tasks');
// 지원사업 예시 공고 (데모 브라우저 저장소에만, '예시 공고' 표기)
await go('/ax/programs');
await p.getByRole('button', { name: '공고 직접 추가' }).first().click(); await p.waitForTimeout(400);
await p.getByLabel('공고명').fill('[경기] 2026 제조기업 스마트공장 구축 지원 (예시 공고)');
await p.getByLabel('기관').fill('예시 기관');
await p.getByRole('group', { name: '대상 지역' }).getByRole('button', { name: '경기', exact: true }).click();
await p.getByLabel('접수 마감일').fill(new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10));
await p.getByLabel('지원 대상').fill('경기도 소재 제조 중소기업');
await p.getByRole('button', { name: '추가', exact: true }).click(); await p.waitForTimeout(800);
await shot('f-pc-programs');
await p.getByRole('button', { name: /맞는 고객 \d+곳에 알림/ }).first().click().catch(() => {}); await p.waitForTimeout(600);
// 자료 요청 (실제로 등록)
await go('/ax/clients/co_a?tab=docs');
await p.getByRole('button', { name: '자료 요청', exact: true }).last().click(); await p.waitForTimeout(600);
await dlg().getByLabel('자료명').fill('법인등기부등본');
await dlg().locator('textarea').first().fill('최근 3개월 이내 발급한 법인등기부등본 (말소사항 포함)');
await dlg().getByRole('button', { name: /요청 등록|고객에게 요청/ }).click(); await p.waitForTimeout(1000);

// ---- 고객 휴대폰
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal'); await shot('f-phone-home'); await long('f-phone-home', ['우리 회사 한눈에', '인증 현황', '성장 체크리스트', '지금 해야 할 일', '우리 회사 성장 여정', '다음으로 검토할 성장과제']);
await go('/portal/documents');
const row = p.locator('div.px-4').filter({ hasText: '법인등기부등본' }).filter({ has: p.getByRole('button', { name: '업로드' }) }).last();
await row.evaluate((e) => e.scrollIntoView({ block: 'center' })); await shot('f-phone-docs');
await row.getByRole('button', { name: '업로드' }).click(); await p.waitForTimeout(600);
await dlg().locator('input[type=file]').first().setInputFiles({ name: '법인등기부등본_2026.pdf', mimeType: 'application/pdf', buffer: Buffer.from('example') });
await shot('f-phone-upload');
await dlg().getByRole('button', { name: '제출하기' }).click(); await p.waitForTimeout(1200);
await go('/portal/programs'); await shot('f-phone-programs'); await long('f-phone-programs', ['담당 컨설턴트가 보낸', '[경기]']);
const ask = p.getByTestId('programs-sent').getByRole('button', { name: '담당 컨설턴트에게 물어보기' }).first();
await ask.evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300); await shot('f-phone-programs-card');
await ask.click(); await p.waitForTimeout(500);
await dlg().getByRole('textbox').fill('저희 회사도 신청 가능할까요?');
await shot('f-phone-ask');
await dlg().getByRole('button', { name: '보내기' }).click(); await p.waitForTimeout(1200);

// ---- 대표 PC: 자동으로 생긴 업무
await PC();
await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/tasks'); await p.getByRole('button', { name: '미완료', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(500);
await p.getByLabel('업무 검색').fill('법인등기부등본'); await p.waitForTimeout(500);
await shot('f-pc-task-doc'); await near('법인등기부등본 검토');
await p.getByLabel('업무 검색').fill('지원사업'); await p.waitForTimeout(500);
await shot('f-pc-task-prog'); await near('지원사업');
await b.close();
