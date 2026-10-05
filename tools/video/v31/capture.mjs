import { chromium } from 'playwright';

const B = 'http://localhost:3000';
const OUT = process.env.OUT || new URL('./cap', import.meta.url).pathname;
import fs from 'node:fs';
const META = {};
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
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

// ---- 대표 PC
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
await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/dashboard'); await shot('pc-dashboard'); await long('pc-dashboard', ['오늘', '이번 주', '대표자']);
await go('/ax/clients'); await shot('pc-clients');
await p.getByRole('button', { name: '기업고객 등록' }).first().click(); await p.waitForTimeout(700); await shot('pc-client-new');
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await go('/ax/clients/co_a'); await shot('pc-client-overview'); await long('pc-client-overview', ['회사 기본 정보', '재무 · 계약 현황', '현재 진행 프로젝트']);
await go('/ax/clients/co_a?tab=work'); await shot('pc-client-work');
await go('/ax/tasks'); await shot('pc-tasks');
// 지원사업 예시 공고
await go('/ax/programs');
await p.getByRole('button', { name: '공고 직접 추가' }).first().click(); await p.waitForTimeout(400);
await p.getByLabel('공고명').fill('[경기] 2026 제조기업 스마트공장 구축 지원 (예시 공고)');
await p.getByLabel('기관').fill('예시 기관');
await p.getByRole('group', { name: '대상 지역' }).getByRole('button', { name: '경기', exact: true }).click();
await p.getByLabel('접수 마감일').fill(new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10));
await p.getByLabel('지원 대상').fill('경기도 소재 제조 중소기업');
await p.getByRole('button', { name: '추가', exact: true }).click(); await p.waitForTimeout(800);
await p.getByRole('button', { name: /맞는 고객 \d+곳에 알림/ }).first().click().catch(() => {}); await p.waitForTimeout(600);
// 자료 요청 (실제로 등록)
await go('/ax/clients/co_a?tab=docs');
await p.getByRole('button', { name: '자료 요청', exact: true }).first().click(); await p.waitForTimeout(600);
await dlg().getByLabel('자료명').fill('법인등기부등본');
await dlg().locator('textarea').first().fill('최근 3개월 이내 발급한 법인등기부등본 (말소사항 포함)');
await shot('pc-docreq');
await dlg().getByRole('button', { name: /요청 등록|고객에게 요청/ }).click(); await p.waitForTimeout(1000);
await shot('pc-docreq-done');

// ---- 고객 휴대폰
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal'); await shot('phone-portal-home'); await long('phone-portal-home', ['우리 회사 한눈에', '성장 체크리스트', '지금 할 일', '최근 안내', '성장 여정', '우리 회사에 맞는', '다음으로 검토', '완료 이력']);
await p.evaluate(() => window.scrollTo(0, 900)); await shot('phone-portal-home-2');
await go('/portal/programs'); await shot('phone-programs'); await long('phone-programs', ['담당 컨설턴트가 보낸', '맞는 공고', '[경기]']);
await go('/portal/documents'); await shot('phone-docs-before'); await long('phone-docs-before', ['법인등기부등본', '주주명부', '제출 완료']);
await p.getByText('법인등기부등본', { exact: true }).first().evaluate((e) => e.scrollIntoView({ block: 'center' })); await shot('phone-docs-list');
await p.evaluate(() => window.scrollTo(0, 0));
const row = p.locator('div.px-4').filter({ hasText: '법인등기부등본' }).filter({ has: p.getByRole('button', { name: '업로드' }) }).last();
await row.getByRole('button', { name: '업로드' }).click(); await p.waitForTimeout(600);
await shot('phone-upload-empty');
await dlg().locator('input[type=file]').first().setInputFiles({ name: '법인등기부등본_2026.pdf', mimeType: 'application/pdf', buffer: Buffer.from('example') });
await shot('phone-upload');
await dlg().getByRole('button', { name: '제출하기' }).click(); await p.waitForTimeout(1200);
await shot('phone-docs-after');
// 다음으로 검토할 과제 → 상담 요청
await go('/portal/services'); await shot('phone-services'); await long('phone-services', ['담당자 제안', '다음으로 검토', '상담 요청']);
const reqBtn = p.getByRole('button', { name: '상담 요청', exact: true }).first();
await reqBtn.evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300); await shot('phone-services-card');
await reqBtn.click(); await p.waitForTimeout(600);
await dlg().locator('textarea').first().fill('다음 달 미팅 때 같이 이야기 나누고 싶습니다.').catch(() => {});
await shot('phone-request');
await dlg().getByRole('button', { name: '상담 요청', exact: true }).click(); await p.waitForTimeout(1200);
await shot('phone-request-done');

// ---- 대표 PC: 자동 생성된 업무 → 검토
await PC();
await login('ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**');
await go('/ax/tasks'); await p.getByRole('button', { name: '미완료', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(500);
await near('법인등기부등본 검토'); await shot('pc-tasks-new');
await go('/ax/dashboard'); await shot('pc-dashboard-after');
await go('/ax/opportunities'); await shot('pc-opps');
await go('/ax/clients/co_a?tab=docs');
await p.locator('table.tbl tbody tr').filter({ hasText: '법인등기부등본' }).first().click(); await p.waitForTimeout(600);
await dlg().locator('textarea').first().fill('최근 발급본, 말소사항까지 확인했습니다.').catch(() => {});
await shot('pc-review');
await dlg().getByRole('button', { name: '검토 완료' }).click(); await p.waitForTimeout(1000);
await shot('pc-review-done');

// ---- 고객 휴대폰: 반영
await PHONE();
await login('ceo@a-precision.demo', 'client2026!', '**/portal**');
await go('/portal/documents');
await shot('phone-docs-done'); await long('phone-docs-done', ['법인등기부등본', '주주명부', '제출 완료']);
await p.getByText('법인등기부등본', { exact: true }).first().evaluate((e) => e.scrollIntoView({ block: 'center' })); await shot('phone-docs-done-2');
await b.close();
