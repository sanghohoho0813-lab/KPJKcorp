// 매일 쓰는 흐름 시험 — 컨설턴트가 실제로 하루에 여러 번 하는 일을 순서대로 눌러 본다 (데모 모드)
//  1) 대시보드에서 업무 한 줄 등록(기업·유형 자동 인식) → 체크로 완료 → 되돌리기
//  2) 업무함: 검색 · 기한 묶음 · 보류 → 다시 시작
//  3) 기업 상세: '지금 할 일'이 회사 정보보다 먼저 · 빠른 작업(업무 추가) → 할 일 목록에 바로
//  4) 같은 기업 중복 등록 막기 (이름 표기 차이 · 사업자번호)
//  5) 휴대폰: 기업 상세 첫 화면에 할 일이 보이는지 · 가로 넘침 · 페이지 오류
//  8) 정책자금 준비 서류: 묶음 요청(알림 한 번) → 고객 홈 한 줄 → 파일 여러 개 제출 → 검토 발급일 → 서류함·고객 준비됨
//  9) 공고 신청 묶음: 서류함 파일 → 신청일 기준 상태 → 공고문 서류 더하기 → zip(번호·서류명 + 서류목록) → 모자란 서류 요청(기한은 신청일 앞)
// 10) 경과 보고: 기업 상세 빠른 작업 → 기간 · 줄 고르기 · 한마디 → 미리 보기 · 카톡용 복사 → 고객에게 보내기(공지 · 홈 맨 위) → 고객 화면
// 11) 앱 안에서 넘어올 때 주소의 탭 · 창 열기(?tab= · ?kit= · ?report=1 · 지원사업 ?tab=leads) — 새로 고침 없이도 맞는 화면
// 12) 경과 보고 미확인 → 확인 연락 업무(규칙) → 대표가 보면 업무 자동 완료
// 13) 휴대폰 화면 정리: 프로젝트 단계 칩(첫 화면에 프로젝트) · 승인 막대 접기 · 회사 정보 접기 · 막 등록한 고객의 빈 화면
// 14) 휴대폰 더보기 = 메뉴판(맨 위 그림 칸 · 숫자 · 누르면 이동) · 대시보드 첫 화면에 숫자 칸(실증 안내는 한 줄)
// 15) 휴대폰 3차 정리: 내부 머리글 압축(설명 두 줄 · AI 짧은 이름 · 주 버튼 먼저) · 숫자 칸 한 줄 · 작은 터치 영역 없음 ·
//     알림 종 펼침이 화면 안(고객 · 내부) · 고객 알림 날짜 묶음 · 우리 회사 끝낸 항목 · 회사 정보 접기
// 16) PC 정리(계약 4단계 문구 — 대시보드 · 업무규칙 · 리포트 · 실증 기록): 첫 화면에 운영 현황 6개 상태 · 실증 안내 한 줄 ·
//     리포트 첫 탭으로 돌아오기 · 기준선 상태는 실제 조사 기록대로 · 업무함 → 자동 규칙 · 실증 기록 날짜 묶음
// 17) 스스로 준비하기(지시서 TEST 01~10): 실제 공고 사본으로 매칭 → 관련 교육 · 공식 링크 → 직접 준비 저장 · 재접속 복원 →
//     신청 완료 이력 → 결과 변경 후 다음 행동 · 담당자 확인 업무 → 중복 없음 → 회사 간 분리 → 비회원은 공개 학습만 →
//     직접 진행 · 전문가 문의 경로 분리 → 새 화면 오류 · 넘침 없음 (회사는 전부 샘플 기업, 공고는 tools/acceptance/fixtures 사본)
// 실행: npm run build && npm start (데모 모드) → node tools/acceptance/daily.mjs
import fs from 'fs';
import { execFileSync } from 'child_process';

const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME_PATH || (fs.existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);
const B = process.env.APP_URL || 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let okN = 0, failN = 0;
const ok = (name, cond, info = '') => { console.log(`${name}: ${cond ? 'OK' : 'FAIL'}${info ? ' ' + info : ''}`); cond ? okN++ : failN++; };

// 한글 파일 이름(내려받기·올리기)은 브라우저가 UTF-8 언어 설정일 때만 그대로 나온다 — 아니면 'download'로 바뀐다
const browser = await pw.chromium.launch({ executablePath: CHROME, env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
async function session(kind, who = ['park@kpjk.co.kr', 'kpjk2026!']) {
  const mobile = kind === 'mobile';
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kpjk-test', '1'); } catch {} });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CERT/.test(m.text())) page.errs.push(m.text()); });
  await page.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill(who[0]);
  await page.locator('input[type=password]').first().fill(who[1]);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('**/ax/**'); await sleep(1200);
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  return page;
}
const dump = (page) => page.evaluate(() => window.__kpjkState());
const go = async (page, path) => { await page.goto(B + path, { waitUntil: 'networkidle' }); await sleep(700); };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---------- PC ----------
{
  const page = await session('pc');
  await go(page, '/ax/dashboard');
  const card = page.locator('#today-tasks');
  ok('1 대시보드에 오늘 할 업무', await card.isVisible());
  const kpiToday = Number((await page.locator('#kpi-today').innerText()).match(/\d+/)?.[0]);
  const listToday = Number((await card.innerText()).match(/오늘 할 업무\s*(\d+)건/)?.[1]);
  ok('1 대시보드 첫 칸 "오늘 할 업무" 숫자 = 목록 건수', kpiToday === listToday && kpiToday > 0, `${kpiToday} / ${listToday}`);
  ok('1 오늘 할 업무가 첫 화면(900px) 안', (await card.evaluate((e) => e.getBoundingClientRect().top)) < 900);
  const before = (await dump(page)).tasks.length;
  const input = card.getByLabel('새 업무 제목');
  await input.fill('에이정밀 대표님께 결과보고 일정 전화');
  await sleep(200);
  const guess = await card.getByTestId('quick-task-guess').innerText();
  ok('1 입력 중 기업·유형 미리 보임', /에이정밀\(주\)/.test(guess) && /후속연락/.test(guess), guess.replace(/\n/g, ' '));
  await input.press('Enter'); await sleep(500);
  let st = await dump(page);
  const t = st.tasks.find((x) => x.title === '에이정밀 대표님께 결과보고 일정 전화');
  ok('1 Enter 한 번으로 등록 (기업·유형·담당·기한)', st.tasks.length === before + 1 && t?.companyId === 'co_a' && t?.type === '후속연락' && t?.assigneeId === 'u_park' && new Date(t.dueDate).getHours() === 18, JSON.stringify(t && { c: t.companyId, ty: t.type }));
  ok('1 입력칸 비워지고 계속 입력 가능', (await input.inputValue()) === '' && (await input.evaluate((el) => el === document.activeElement)));
  ok('1 목록에 바로 보임', await card.getByText('에이정밀 대표님께 결과보고 일정 전화').isVisible());
  // 빈 칸 Enter — 아무것도 만들지 않음
  await input.press('Enter'); await sleep(300);
  ok('1 빈 칸 Enter는 등록 안 함', (await dump(page)).tasks.length === before + 1);
  // 완료 → 되돌리기
  await card.getByRole('button', { name: '에이정밀 대표님께 결과보고 일정 전화 완료' }).click(); await sleep(400);
  st = await dump(page);
  ok('1 체크하면 완료', st.tasks.find((x) => x.id === t.id)?.status === 'done' && !(await card.getByText('에이정밀 대표님께 결과보고 일정 전화').isVisible().catch(() => false)));
  await page.getByTestId('toast-action').getByRole('button', { name: '되돌리기' }).click(); await sleep(400);
  st = await dump(page);
  ok('1 되돌리기 → 원래 상태', st.tasks.find((x) => x.id === t.id)?.status === 'todo' && await card.getByText('에이정밀 대표님께 결과보고 일정 전화').isVisible());
  // 기업 연결 빼기
  await input.fill('씨엠푸드 말고 내부 회의 자료 정리'); await sleep(200);
  await card.getByRole('button', { name: '기업 연결 빼기' }).click(); await sleep(150);
  await input.press('Enter'); await sleep(400);
  st = await dump(page);
  ok('1 자동 연결을 빼면 내부 업무로', st.tasks.find((x) => x.title === '씨엠푸드 말고 내부 회의 자료 정리')?.companyId === undefined);

  // ---------- 업무함 ----------
  await go(page, '/ax/tasks');
  await page.getByRole('button', { name: '미완료', exact: true }).click(); await sleep(300);
  const groups = await page.locator('[data-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')));
  ok('2 미완료는 기한으로 묶임', groups.length >= 1 && groups[0] !== 'done', groups.join(','));
  await page.getByLabel('업무 검색').fill('씨엠푸드'); await sleep(300);
  const titles = await page.locator('[data-group] .font-semibold').allInnerTexts();
  const rowsText = (await page.locator('[data-group]').allInnerTexts()).join('\n');
  ok('2 검색: 기업명으로 찾기', /씨엠푸드/.test(rowsText) && !/에이정밀 대표님께/.test(rowsText), String(titles.length));
  await page.getByLabel('업무 검색').fill('없는검색어zz'); await sleep(300);
  ok('2 검색 결과 없음 안내', await page.getByText(/‘없는검색어zz’에 맞는 업무가 없습니다/).isVisible());
  await page.getByLabel('업무 검색').fill('에이정밀 대표님께'); await sleep(300);
  await page.locator('[data-group]').getByRole('button', { name: '보류' }).first().click(); await sleep(400);
  ok('2 보류 필터가 생김', await page.getByRole('button', { name: /^보류 \d+$/ }).isVisible());
  await page.getByRole('button', { name: /^보류 \d+$/ }).click(); await sleep(300);
  await page.getByRole('button', { name: '다시 시작' }).first().click(); await sleep(400);
  st = await dump(page);
  ok('2 보류 → 다시 시작', st.tasks.find((x) => x.id === t.id)?.status === 'todo');

  // ---------- 기업 상세 ----------
  await go(page, '/ax/clients/co_a');
  const order = await page.evaluate(() => {
    const a = document.getElementById('client-todo'); const b = document.getElementById('client-profile');
    return a && b ? a.getBoundingClientRect().top < b.getBoundingClientRect().top : null;
  });
  ok('3 지금 할 일이 회사 정보보다 위', order === true);
  const todo = page.locator('#client-todo');
  ok('3 오늘 업무가 할 일에 모임', await todo.getByText('업무: 대표님께 결과보고 일정 전화').isVisible());
  await page.getByTestId('client-quick-actions').getByRole('button', { name: '업무 추가' }).click(); await sleep(400);
  const dlg = page.getByRole('dialog');
  ok('3 업무 추가 창에 기업 선택칸 없음(이 기업으로 고정)', (await dlg.getByText('기업', { exact: true }).count()) === 0);
  await dlg.getByPlaceholder(/비앤테크 미제출/).fill('인건비 상세내역 2차 검토');
  await dlg.getByRole('button', { name: '오늘', exact: true }).click();
  await dlg.getByPlaceholder(/비앤테크 미제출/).press('Enter'); await sleep(500);
  st = await dump(page);
  const t2 = st.tasks.find((x) => x.title === '인건비 상세내역 2차 검토');
  ok('3 빠른 작업 → 이 기업 업무 · 유형 자동(자료검토) · 오늘', t2?.companyId === 'co_a' && t2?.type === '자료검토' && new Date(t2.dueDate).toDateString() === new Date().toDateString());
  ok('3 등록하자마자 할 일 목록에', await todo.getByText('업무: 인건비 상세내역 2차 검토').isVisible());
  for (const name of ['상담 기록', '자료 요청', '일정 등록']) {
    await page.getByTestId('client-quick-actions').getByRole('button', { name }).click(); await sleep(400);
    const open = await page.getByRole('dialog').isVisible();
    // 입력칸이 있는 창은 ESC로 닫히지 않는다(쓰던 내용 보호) — 취소 / X로 닫는다
    const d = page.getByRole('dialog');
    if (await d.getByRole('button', { name: '취소', exact: true }).count()) await d.getByRole('button', { name: '취소', exact: true }).last().click();
    else await d.getByRole('button', { name: /닫기/ }).first().click();
    await sleep(300);
    ok(`3 빠른 작업 '${name}' 창 열림`, open);
  }

  // ---------- 중복 등록 ----------
  await go(page, '/ax/clients');
  await page.getByRole('button', { name: '기업고객 등록' }).first().click(); await sleep(500);
  await page.getByPlaceholder('예: 주식회사 대한정밀').fill('주식회사 에이정밀');
  await page.getByPlaceholder('성명').first().fill('홍길동');
  await page.getByPlaceholder('000-00-00000').fill('0008100002');
  await page.getByRole('dialog').getByRole('button', { name: /^등록/ }).last().click(); await sleep(500);
  const dtext = await page.getByRole('dialog').innerText();
  ok('4 법인 표기만 다른 같은 이름 막음', /같은 이름의 기업이 이미 있습니다 — 에이정밀\(주\)/.test(dtext));
  ok('4 같은 사업자번호 막음', /같은 사업자번호로 이미 등록된 기업이 있습니다 — 비앤테크\(주\)/.test(dtext));
  ok('4 등록되지 않음', (await dump(page)).companies.filter((c) => /에이정밀/.test(c.name)).length === 1);
  await page.getByRole('dialog').getByRole('button', { name: /닫기/ }).first().click().catch(() => {}); await sleep(300);

  // ---------- 상담 기록 → 후속 업무 · 자료 요청 ----------
  await go(page, '/ax/clients/co_a');
  await page.getByTestId('client-quick-actions').getByRole('button', { name: '상담 기록' }).click(); await sleep(400);
  const cd = page.getByRole('dialog');
  await cd.getByPlaceholder(/김민석 대표와 원가구조/).fill('중간보고 뒤 절세 방향 논의');
  const lists = cd.getByPlaceholder('한 줄씩 입력 후 Enter');
  await lists.nth(2).click(); await page.keyboard.type('다음 주 화요일까지 절세 시뮬레이션 전달'); await page.keyboard.press('Enter');
  await lists.nth(3).click(); await page.keyboard.type('주주명부'); await page.keyboard.press('Enter');
  await cd.getByPlaceholder('예: 제안서 송부 및 계약 협의').fill('제안서 송부 후 대표님께 전화');
  await sleep(200);
  const fb = cd.getByTestId('consult-followups');
  const chk = async (k) => fb.locator(`input[data-follow=${k}]`).first().isChecked();
  ok('6 저장 전에 만들 것 미리 보임 (다음 Action · 약속 · 자료)', (await fb.locator('input[data-follow]').count()) === 3, await fb.innerText().then((t) => t.replace(/\n/g, ' ').slice(0, 120)));
  ok('6 기본: 업무 켜짐 · 고객 자료 요청 꺼짐', (await chk('next')) && (await chk('promise')) && !(await chk('doc')));
  await fb.locator('input[data-follow=doc]').check();
  let s0 = await dump(page);
  const tasks0 = s0.tasks.length, docs0 = s0.docRequests.length;
  await cd.getByRole('button', { name: '저장', exact: true }).click(); await sleep(600);
  let s1 = await dump(page);
  const csT = s1.tasks.filter((x) => x.ruleKey?.startsWith('cs:'));
  const nextT = csT.find((x) => x.title.includes('제안서 송부 후 대표님께 전화'));
  const promT = csT.find((x) => x.title.includes('약속: 다음 주 화요일까지 절세 시뮬레이션 전달'));
  ok('6 저장 한 번 → 업무 2건 (다음 Action · 약속)', s1.tasks.length === tasks0 + 2 && !!nextT && !!promT);
  ok('6 업무: 이 기업 · 담당 컨설턴트 · 유형 자동 · 기한 3일 뒤', nextT?.companyId === 'co_a' && nextT?.assigneeId === 'u_park' && nextT?.type === '후속연락' && new Date(nextT.dueDate).toDateString() === new Date(Date.now() + 3 * 864e5).toDateString(), JSON.stringify(nextT && { t: nextT.type, a: nextT.assigneeId }));
  ok('6 업무 메모에 어느 상담에서 나왔는지', /상담에서 정한 다음 Action/.test(nextT?.memo ?? '') && /상담에서 약속한 것/.test(promT?.memo ?? ''));
  const dr = s1.docRequests.find((d) => d.companyId === 'co_a' && d.name === '주주명부');
  ok('6 고객 자료 요청 1건 + 고객 알림', s1.docRequests.length === docs0 + 1 && dr?.status === 'requested' && s1.notifications.some((n) => n.audience === 'client' && n.companyId === 'co_a' && /주주명부/.test(n.body)));
  ok('6 한글 목록 입력이 잘리지 않음', s1.consultations[0]?.summary.promises[0] === '다음 주 화요일까지 절세 시뮬레이션 전달' && s1.consultations[0]?.summary.documents[0] === '주주명부');
  // 수정해서 다시 저장 — 이미 만든 것은 다시 안 만들고, 새로 적은 약속만
  await go(page, '/ax/consultations');
  await page.getByRole('button', { name: '상담기록 수정' }).first().click(); await sleep(400);
  const ed = page.getByRole('dialog');
  ok('6 수정 창이 방금 기록', (await ed.locator('textarea').first().inputValue()) === '중간보고 뒤 절세 방향 논의');
  const efb = ed.getByTestId('consult-followups');
  ok('6 이미 만든 항목은 표시되고 잠김', (await efb.locator('input[data-follow]:disabled').count()) === 3 && /이미 등록됨/.test(await efb.innerText()) && /이미 요청 중/.test(await efb.innerText()));
  await ed.getByPlaceholder('한 줄씩 입력 후 Enter').nth(2).click(); await page.keyboard.type('계약서 초안 공유'); await page.keyboard.press('Enter');
  await ed.getByRole('button', { name: '저장', exact: true }).click(); await sleep(600);
  const s2 = await dump(page);
  ok('6 다시 저장해도 중복 없음 · 새 약속만 1건', s2.tasks.length === s1.tasks.length + 1 && s2.tasks.some((x) => x.title.includes('약속: 계약서 초안 공유')) && s2.docRequests.length === s1.docRequests.length);
  await go(page, '/ax/tasks');
  await page.getByRole('button', { name: '미완료', exact: true }).click(); await page.getByLabel('업무 검색').fill('제안서 송부 후'); await sleep(300);
  ok('6 업무함에 상담 후속 표시', await page.locator('[data-group]').getByText('상담 후속').first().isVisible());

  for (const p of ['/ax/dashboard', '/ax/tasks', '/ax/clients/co_a', '/ax/documents']) { await go(page, p); ok(`5 PC 가로 넘침 없음 ${p}`, (await overflow(page)) <= 0); }
  ok('5 PC 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 휴대폰 ----------
{
  const page = await session('mobile');
  await go(page, '/ax/clients/co_a');
  const top = await page.locator('#client-todo').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  ok('5 휴대폰: 기업 상세 첫 1.5화면 안에 지금 할 일', top < 844 * 1.5, `${Math.round(top)}px`);
  ok('5 휴대폰: 연락처 줄은 접혀 있음', !(await page.getByTestId('client-contact').isVisible()));
  await page.getByRole('button', { name: /연락처 · 번호 · 주소 보기/ }).click(); await sleep(200);
  ok('5 휴대폰: 펼치면 연락처 보임', await page.getByTestId('client-contact').isVisible());
  ok('5 휴대폰: 전화 바로 걸기', (await page.getByTestId('client-quick-actions').getByRole('link', { name: '전화' }).getAttribute('href'))?.startsWith('tel:010'));
  await go(page, '/ax/dashboard');
  const qt = page.locator('#today-tasks').getByLabel('새 업무 제목');
  await qt.fill('비앤테크 연구소 서류 검토'); await qt.press('Enter'); await sleep(400);
  const st = await dump(page);
  ok('5 휴대폰: 한 줄 등록', st.tasks.some((x) => x.title === '비앤테크 연구소 서류 검토' && x.companyId === 'co_b' && x.type === '자료검토'));
  for (const p of ['/ax/dashboard', '/ax/tasks', '/ax/clients/co_a', '/ax/clients/co_e', '/ax/documents']) { await go(page, p); ok(`5 휴대폰 가로 넘침 없음 ${p}`, (await overflow(page)) <= 0); }
  ok('5 휴대폰 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 고객 연락 공백 (대표 · PC) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  // 샘플 기업은 모두 이미 열린 후속연락 업무가 있어 규칙이 건너뛴다(정상). 에프물류의 열린 업무를 보류해 '연락 공백'을 만든다
  await go(page, '/ax/tasks');
  await page.getByRole('button', { name: '미완료', exact: true }).click();
  await page.getByLabel('업무 검색').fill('에프물류'); await sleep(300);
  for (let i = 0; i < 6; i++) {
    const hold = page.locator('[data-group]').getByRole('button', { name: '보류', exact: true });
    if (!(await hold.count())) break;
    await hold.first().click(); await sleep(250);
  }
  ok('7 준비: 에프물류 열린 업무 없음', !(await dump(page)).tasks.some((t) => t.companyId === 'co_f' && (t.status === 'todo' || t.status === 'doing')));
  await go(page, '/ax/settings');
  const grp = page.getByRole('group', { name: '연락 규칙 기준일' });
  ok('7 설정에 연락 공백 규칙 · 기본 21일', (await grp.getByRole('button', { name: '21일 · 기본' }).getAttribute('aria-pressed')) === 'true');
  await grp.getByRole('button', { name: '7일', exact: true }).click(); await sleep(300);
  await page.getByRole('button', { name: '지금 확인' }).click(); await sleep(500);
  let st = await dump(page);
  const nc = st.tasks.filter((t) => t.ruleKey?.startsWith('no_contact:'));
  ok('7 기준 7일 → 연락 공백 업무 생성', nc.length >= 1, nc.map((t) => t.title).join(' / '));
  ok('7 업무: 담당 컨설턴트 · 후속연락 · 마지막 연락 근거', nc.every((t) => t.type === '후속연락' && t.assigneeId === st.companies.find((c) => c.id === t.companyId)?.consultantId && /마지막 연락: .+\(.+\)/.test(t.memo ?? '')));
  const perCo = new Set(nc.map((t) => t.companyId));
  ok('7 기업마다 한 건 · 이미 후속연락이 잡힌 기업은 건너뜀', perCo.size === nc.length && nc.every((t) => st.tasks.filter((x) => x.companyId === t.companyId && x.type === '후속연락' && (x.status === 'todo' || x.status === 'doing')).length === 1));
  await page.getByRole('button', { name: '지금 확인' }).click(); await sleep(400);
  ok('7 다시 확인해도 중복 없음', (await dump(page)).tasks.filter((t) => t.ruleKey?.startsWith('no_contact:')).length === nc.length);

  await go(page, '/ax/clients');
  const lbl = await page.getByRole('button', { name: /^연락 필요/ }).innerText();
  await page.getByRole('button', { name: /^연락 필요/ }).click(); await sleep(400);
  const cards = page.locator('a[href^="/ax/clients/co_"]');
  const n0 = await cards.count();
  ok('7 기업고객 "연락 필요" 필터', n0 >= 1 && lbl.includes(String(n0)), `${lbl} / ${n0}`);
  await go(page, '/ax/dashboard');
  const kpiContact = Number((await page.locator('#kpi-contact').innerText()).match(/\d+/)?.[0]);
  ok('7 대시보드 "연락 필요" 숫자 = 목록', kpiContact === n0, `${kpiContact} / ${n0}`);
  const target = nc[0].companyId;
  await go(page, `/ax/clients/${target}`);
  ok('7 기업 상세에 연락 공백 표시', /연락 \d+일 없음/.test(await page.getByTestId('contact-line').first().innerText()));
  await page.getByTestId('client-quick-actions').getByRole('button', { name: '연락함' }).click(); await sleep(300);
  const d = page.getByRole('dialog');
  await d.getByRole('radio', { name: '카톡·문자' }).click();
  await d.getByPlaceholder(/중간보고 일정 안내/).fill('진행 상황 공유, 다음 주 통화 약속');
  await d.getByRole('button', { name: '기록', exact: true }).click(); await sleep(500);
  st = await dump(page);
  const j = st.journal.find((x) => x.companyId === target && x.type === 'call');
  ok('7 연락함 → 업무 일기 통화 기록', j?.content === '[카톡·문자] 진행 상황 공유, 다음 주 통화 약속');
  ok('7 열려 있던 연락 업무가 완료로', st.tasks.find((t) => t.id === nc[0].id)?.status === 'done');
  ok('7 마지막 연락이 오늘로', /마지막 연락 오늘/.test(await page.getByTestId('contact-line').first().innerText()));
  await go(page, '/ax/clients?filter=contact');
  ok('7 연락 필요에서 빠짐', (await page.locator(`a[href="/ax/clients/${target}"]`).count()) === 0);
  await go(page, '/ax/settings');
  await page.getByRole('button', { name: '지금 확인' }).click(); await sleep(400);
  ok('7 연락한 기업엔 새 업무 안 생김', (await dump(page)).tasks.filter((t) => t.ruleKey?.startsWith(`no_contact:${target}:`)).length === 1);
  ok('7 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 정책자금 준비 서류 (대표 PC → 고객 → 대표 검토 · 발급일 → 고객 준비됨) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  const storeKey = () => page.evaluate(() => Object.keys(localStorage).find((k) => { try { return !!JSON.parse(localStorage.getItem(k) ?? 'null')?.state; } catch { return false; } }));
  const relogin = async (id, pwd, to) => {
    const k = await storeKey();
    await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); s.state.session = null; localStorage.setItem(key, JSON.stringify(s)); }, k);
    await page.goto(B + '/login', { waitUntil: 'networkidle' });
    await page.getByLabel('아이디 (이메일)').fill(id);
    await page.locator('input[type=password]').first().fill(pwd);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(to); await sleep(1200);
    await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
    await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  };
  const dlg = () => page.locator('[role=dialog]:visible').last();
  await go(page, '/ax/clients/co_a');
  ok('8 기업 상세 빠른 작업에 정책자금 서류', await page.getByTestId('client-quick-actions').getByRole('button', { name: '정책자금 서류' }).isVisible());
  await go(page, '/ax/clients/co_a?tab=vault');
  const badge0 = await page.getByTestId('policy-ready').innerText();
  await page.locator('#vault-tab').getByRole('button', { name: '정책자금 서류', exact: true }).click(); await sleep(400);
  const plan = dlg().getByTestId('policy-plan');
  ok('8 요청 창: 서류 목록', (await plan.locator('[data-policy]').count()) >= 8, badge0);
  ok('8 신청 직전 서류(납세증명)는 기본 꺼짐', !(await plan.locator('[data-policy=taxCert] input').isChecked()));
  const s0 = await dump(page);
  const btn = dlg().getByRole('button', { name: /개 요청$/ });
  const n = Number((await btn.innerText()).match(/(\d+)개/)?.[1] ?? 0);
  await btn.click(); await sleep(600);
  const s1 = await dump(page);
  const added = s1.docRequests.filter((d) => !s0.docRequests.some((x) => x.id === d.id));
  const notes = s1.notifications.filter((x) => !s0.notifications.some((y) => y.id === x.id) && x.audience === 'client');
  ok('8 요청 N건 · 모두 정책자금 준비 표시', n >= 3 && added.length === n && added.every((d) => d.companyId === 'co_a' && d.description.startsWith('정책자금 준비 서류 — ')), `${n}건`);
  ok('8 고객 알림은 한 번', notes.length === 1 && notes[0].title === `정책자금 준비 서류 ${n}개를 요청드렸습니다` && notes[0].href.endsWith('#policy-docs'));
  const vault1 = s1.companyVaults.find((v) => v.companyId === 'co_a');
  ok('8 서류함에 없던 칸은 만듦', added.every((d) => [...['사업자등록증', '법인등기부등본', '대표자 신분증 사본', '공동인증서', '중소기업 확인서', '대표자 건강보험 자격득실확인서'], ...(vault1?.customSlots ?? []).map((c) => c.label)].includes(d.name)));
  await page.locator('#vault-tab').getByRole('button', { name: '정책자금 서류', exact: true }).click(); await sleep(400);
  ok('8 다시 열면 요청한 서류는 잠김', (await dlg().getByTestId('policy-plan').locator('input:disabled').count()) >= n);
  await dlg().getByRole('button', { name: '취소' }).click(); await sleep(300);

  // 고객: 홈에 한 줄 → 자료제출 카드 → 파일 두 개를 한 번에
  await relogin('ceo@a-precision.demo', 'client2026!', /\/portal/);
  await go(page, '/portal');
  const na = await page.getByTestId('now-actions').innerText();
  ok('8 고객 홈: 준비 서류는 한 줄', na.includes(`정책자금 서류 ${n}개 올리기`) && !added.some((d) => na.includes(`${d.name} 올리기`)), na.replace(/\n/g, ' / ').slice(0, 160));
  await page.getByTestId('now-actions').getByText(`정책자금 서류 ${n}개 올리기`).click(); await sleep(1200);
  ok('8 누르면 자료제출의 준비 서류 카드로', /\/portal\/documents#policy-docs/.test(page.url()) && await page.locator('#policy-docs').isVisible());
  ok('8 준비 0/N', (await page.getByTestId('policy-count').innerText()) === `준비 0/${n}`);
  const fin = page.locator('[data-policy-doc=finStmt]');
  ok('8 발급처 안내가 보임', /홈택스 › 민원증명 › 표준재무제표증명/.test(await fin.innerText()));
  await fin.getByRole('button', { name: '올리기' }).click(); await sleep(400);
  await dlg().getByRole('button', { name: '데모용 샘플 파일 사용' }).click();
  await dlg().getByRole('button', { name: '데모용 샘플 파일 사용' }).click(); await sleep(200);
  await dlg().getByRole('button', { name: '2개 제출하기' }).click(); await sleep(700);
  let st = await dump(page);
  const finReq = st.docRequests.find((d) => d.id === added.find((x) => x.name.startsWith('표준재무제표증명'))?.id);
  ok('8 파일 두 개를 한 번에 제출', finReq?.status === 'submitted' && finReq.files.length === 2 && finReq.files.map((f) => f.version).join() === '1,2');
  ok('8 담당자 검토 업무는 한 건', st.tasks.filter((t) => t.title.includes('표준재무제표증명') && t.source === 'auto').length === 1);
  await page.locator('[data-policy-doc=insList]').getByRole('button', { name: '올리기' }).click(); await sleep(400);
  await dlg().getByRole('button', { name: '데모용 샘플 파일 사용' }).click(); await sleep(200);
  await dlg().getByRole('button', { name: '제출하기', exact: true }).click(); await sleep(700);
  ok('8 제출하면 확인 중', (await page.locator('[data-policy-doc=insList]').getAttribute('data-state')) === 'checking');

  // 대표: 검토 — 유효기간 있는 서류는 발급일을 넣는다 → 서류함 칸에 발급일
  await relogin('ceo@kpjk.co.kr', 'kpjk2026!', /\/ax\//);
  await go(page, '/ax/documents');
  const issued = new Date(Date.now() - 6 * 864e5); const ymd = `${issued.getFullYear()}-${String(issued.getMonth() + 1).padStart(2, '0')}-${String(issued.getDate()).padStart(2, '0')}`;
  await page.locator('[data-doc-row]').filter({ hasText: '4대보험 사업장 가입자 명부' }).first().click(); await sleep(400);
  ok('8 유효기간 있는 서류 검토: 발급일 칸', await dlg().getByTestId('review-issued').isVisible());
  await dlg().getByTestId('review-issued').fill(ymd);
  await dlg().getByRole('button', { name: '검토 완료' }).click(); await sleep(500);
  await page.locator('[data-doc-row]').filter({ hasText: '표준재무제표증명' }).first().click(); await sleep(400);
  ok('8 유효기간 없는 서류는 발급일 칸 없음', (await dlg().getByTestId('review-issued').count()) === 0);
  await dlg().getByRole('button', { name: '검토 완료' }).click(); await sleep(500);
  st = await dump(page);
  const v2 = st.companyVaults.find((v) => v.companyId === 'co_a');
  const insSlot = v2.customSlots.find((c) => c.label === '4대보험 사업장 가입자 명부');
  ok('8 서류함: 받음 · 발급일 · 유효 1개월', !!insSlot && v2.slots[insSlot.key]?.received === true && v2.slots[insSlot.key]?.issuedAt === ymd && insSlot.validMonths === 1);
  await go(page, '/ax/clients/co_a?tab=vault');
  const badge1 = await page.getByTestId('policy-ready').innerText();
  ok('8 서류함 정책자금 준비 숫자가 늘어남', Number(badge1.match(/(\d+)\//)[1]) === Number(badge0.match(/(\d+)\//)[1]) + 2, `${badge0} → ${badge1}`);

  // 고객: 준비됨 2 · 휴대폰 가로 넘침 없음
  await relogin('ceo@a-precision.demo', 'client2026!', /\/portal/);
  await go(page, '/portal/documents');
  ok('8 고객 화면 준비 2/N', (await page.getByTestId('policy-count').innerText()) === `준비 2/${n}`);
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(500);
  ok('8 휴대폰 자료제출 가로 넘침 없음', (await overflow(page)) <= 0);
  ok('8 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 공고 신청 묶음 (대표 PC: 서류함 파일 → 신청일 기준 점검 → zip → 모자란 서류 요청) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  const dlg = () => page.locator('[role=dialog]:visible').last();
  const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const applyOn = ymdOf(new Date(Date.now() + 20 * 864e5));
  await go(page, '/ax/clients/co_a?tab=vault');
  // 서류함 사업자등록증 칸에 파일 하나
  await page.getByRole('button', { name: '사업자등록증 파일 올리기' }).click(); await sleep(400);
  await dlg().getByLabel('서류 파일').setInputFiles({ name: '사업자등록증.txt', mimeType: 'text/plain', buffer: Buffer.from('사업자등록증 시험 파일 KIT-OK') });
  await dlg().getByRole('button', { name: /고른 것 전부 올리기 \(1\)/ }).click({ timeout: 8000 }); await sleep(900);
  let st = await dump(page);
  ok('9 서류함에 파일 올림', st.companyFiles.some((f) => f.companyId === 'co_a' && f.slot === 'bizReg' && f.fileName === '사업자등록증.txt'));

  await page.locator('#vault-tab').getByRole('button', { name: '정책자금 서류', exact: true }).click(); await sleep(400);
  await dlg().getByTestId('policy-mode').getByRole('button', { name: '공고 신청 묶음' }).click(); await sleep(300);
  ok('9 공고 신청 묶음 열림', await dlg().getByTestId('apply-kit').isVisible());
  await dlg().getByLabel('공고', { exact: true }).selectOption('__manual');
  await dlg().getByLabel('공고명').fill('시험용 공고(자동 검수)');
  await dlg().getByLabel('신청 예정일').fill(applyOn); await sleep(300);
  const state = (k) => dlg().locator(`[data-kit="${k}"]`).getAttribute('data-state');
  ok('9 사업자등록증: 파일 있음', (await state('bizReg')) === 'ready');
  ok('9 신청 직전 서류(납세증명): 20일 뒤 신청이면 지금 요청 체크', (await state('taxCert')) === 'justBefore' && await dlg().getByLabel('납세증명서 요청', { exact: true }).isChecked());
  await dlg().getByLabel('더할 서류 이름').fill('수출실적증명서');
  await dlg().getByRole('button', { name: '더하기' }).click(); await sleep(300);
  ok('9 공고문 서류 더하기', (await state('x:수출실적증명서')) === 'missing');
  ok('9 요약판: 파일 준비 1개 이상', /파일 준비/.test(await dlg().getByTestId('kit-summary').innerText()));

  // zip 내려받기 → 열어 본다
  const [dl] = await Promise.all([page.waitForEvent('download'), dlg().getByRole('button', { name: /내려받기$/ }).click()]);
  const zpath = await dl.path();
  const inside = JSON.parse(execFileSync('python3', ['-I', '-c', 'import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n: z.read(n)[:40].decode("utf-8","replace") for n in z.namelist()}))', zpath]).toString());
  const names = Object.keys(inside);
  ok('9 zip 이름: 기업_공고_날짜', /^에이정밀\(주\)_시험용공고\(자동검수\)_\d{8}\.zip$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  ok('9 zip 안: 서류목록 + 번호·서류명 파일(내용 그대로)', names[0] === '00_서류목록.xlsx' && inside['01_사업자등록증.txt']?.includes('KIT-OK'), names.join(', '));
  st = await dump(page);
  ok('9 내려받은 기록(내부 전용)', st.activities.some((a) => a.type === 'vault_updated' && a.companyId === 'co_a' && a.text.includes('신청 서류 묶음 내려받음: 시험용 공고(자동 검수)')));

  // 모자란 서류 요청 — 기한은 신청일 앞, 알림 한 번(공고명)
  const s0 = st;
  const reqBtn = dlg().getByRole('button', { name: /모자란 서류 \d+개 요청/ });
  const n = Number((await reqBtn.innerText()).match(/(\d+)개/)?.[1] ?? 0);
  await reqBtn.click(); await sleep(600);
  st = await dump(page);
  const added = st.docRequests.filter((d) => !s0.docRequests.some((x) => x.id === d.id));
  const notes = st.notifications.filter((x) => !s0.notifications.some((y) => y.id === x.id) && x.audience === 'client');
  ok('9 요청 N건 · 기한은 모두 신청일 이전', n >= 2 && added.length === n && added.every((d) => d.companyId === 'co_a' && d.dueDate.slice(0, 10) <= applyOn), `${n}건`);
  ok('9 더한 서류 요청 문구에 공고명', added.some((d) => d.name === '수출실적증명서' && d.description.includes('시험용 공고(자동 검수)')));
  ok('9 고객 알림 한 번 · 공고명', notes.length === 1 && notes[0].title.includes('시험용 공고(자동 검수)'), notes[0]?.title);
  ok('9 요청한 서류는 요청 중으로', (await state('x:수출실적증명서')) === 'open');

  // 지원사업 매칭의 '서류 묶음' 링크(?kit=)로 들어오면 바로 신청 묶음이 열린다
  await go(page, '/ax/clients/co_a?tab=vault&kit=none');
  ok('9 ?kit= 로 들어오면 신청 묶음으로 열림', await dlg().getByTestId('apply-kit').isVisible());
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(500);
  ok('9 휴대폰 신청 묶음 가로 넘침 없음', (await overflow(page)) <= 0);
  ok('9 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 경과 보고 (대표 PC → 고객 화면) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: B });
  const dlg = () => page.locator('[role=dialog]:visible').last();
  await go(page, '/ax/tasks');
  let st = await dump(page);
  const ruleTask = st.tasks.find((t) => t.companyId === 'co_a' && t.ruleKey?.startsWith('progress_report:') && t.status === 'todo');
  ok('10 규칙 업무: 경과 보고 공백 → 보내기 업무가 있음', !!ruleTask && ruleTask.type === '보고서' && ruleTask.source === 'auto', ruleTask?.title);
  await page.getByRole('button', { name: '미완료', exact: true }).click(); await sleep(400);
  const write = page.locator('a[href="/ax/clients/co_a?report=1"]:visible').first();
  ok('10 업무함: 경과 보고 업무에 보고 쓰기', await write.isVisible());
  await write.click(); await page.waitForURL(/\/ax\/clients\/co_a\?report=1/); await sleep(900);
  const qa = page.getByTestId('client-quick-actions').getByRole('button', { name: '경과 보고' });
  ok('10 보고 쓰기 → 그 기업 보고 창이 바로 열림 · 빠른 작업에도 경과 보고', await dlg().getByTestId('report-lines').isVisible() && await qa.isVisible());
  const lines = dlg().getByTestId('report-lines');
  const sections = await lines.locator('[data-report-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-report-section')));
  ok('10 진행 상황 · 한 일 · 부탁드릴 것 묶음이 채워짐', sections.includes('now') && sections.includes('done') && sections.includes('ask'), sections.join(','));
  const openReqs = st.docRequests.filter((d) => d.companyId === 'co_a' && (d.status === 'requested' || d.status === 'revision'));
  const askN = await lines.locator('[data-report-section=ask] [data-line]').count();
  ok('10 부탁드릴 것 = 남은 요청자료', askN === Math.min(openReqs.length, 5) + (openReqs.length > 5 ? 1 : 0), `${askN} / ${openReqs.length}`);
  const first = lines.locator('[data-report-section=done] [data-line]').first();
  const offText = (await first.innerText()).trim();
  await first.locator('input').uncheck();
  await dlg().getByLabel('담당자 한마디').fill('시험용 한마디 REPORT-OK');
  await dlg().getByTestId('report-view').getByRole('button', { name: '고객 화면 미리 보기' }).click(); await sleep(300);
  const pv = await dlg().getByTestId('report-preview').innerText();
  ok('10 미리 보기: 제목 · 한마디 · 뺀 줄 없음', /경과 보고 · \d+\/\d+ ~ \d+\/\d+/.test(pv) && pv.includes('REPORT-OK') && !pv.includes(offText), offText);
  await dlg().getByRole('button', { name: '카톡용 복사' }).click(); await sleep(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok('10 카톡용 복사: 제목 · 본문 · 고객 화면 주소', clip.startsWith('경과 보고 ·') && clip.includes('REPORT-OK') && clip.includes('/portal/schedule#notices'));
  const s0 = await dump(page);
  await dlg().getByRole('button', { name: '고객에게 보내기' }).click(); await sleep(600);
  st = await dump(page);
  const sent = st.notices.filter((n) => !s0.notices.some((x) => x.id === n.id));
  const r1 = sent[0];
  ok('10 공지 한 건 · 이 기업 · 홈 고정', sent.length === 1 && r1.companyId === 'co_a' && r1.pinned === true && r1.title.startsWith('경과 보고 ·'));
  ok('10 본문: 묶음 제목 · 한마디 · 서명 · 뺀 줄 없음', r1.body.includes('■ 지금 진행 상황') && r1.body.includes('■ 담당자 한마디\n시험용 한마디 REPORT-OK') && /\n— 담당 /.test(r1.body) && !r1.body.includes(offText));
  const hidden = [
    ...st.schedules.filter((x) => x.companyId === 'co_a' && !x.visibleToClient).map((x) => x.title),
    ...st.tasks.filter((x) => x.companyId === 'co_a').map((x) => x.title),
    ...(st.journal ?? []).filter((x) => x.companyId === 'co_a').map((x) => x.body ?? x.text ?? '').filter((t) => t.length > 8).map((t) => t.slice(0, 30)),
  ];
  ok('10 내부 일정 · 업무 · 업무 일기는 본문에 없음', hidden.length > 0 && hidden.every((t) => !r1.body.includes(t)), `${hidden.length}건 확인`);
  const notes = st.notifications.filter((x) => !s0.notifications.some((y) => y.id === x.id));
  ok('10 고객 알림 한 번', notes.length === 1 && notes[0].audience === 'client' && notes[0].companyId === 'co_a');
  ok('10 보내면 규칙 업무는 끝남', st.tasks.find((t) => t.id === ruleTask?.id)?.status === 'done');
  // 다시 열면 '지난 보고 이후'가 기본 · 두 번째로 보내면 앞 보고 고정은 풀림
  await qa.click(); await sleep(500);
  ok('10 다시 열면 지난 보고 이후', /지난 보고 \d+\/\d+ \(0일 전\)/.test(await dlg().getByTestId('report-range').innerText()));
  await dlg().getByRole('button', { name: '고객에게 보내기' }).click(); await sleep(600);
  st = await dump(page);
  const reports = st.notices.filter((n) => n.companyId === 'co_a' && n.title.startsWith('경과 보고'));
  ok('10 홈 고정은 가장 최근 보고 하나', reports.length === 2 && reports.filter((n) => n.pinned).length === 1 && !st.notices.find((n) => n.id === r1.id).pinned);
  await go(page, '/ax/tasks'); st = await dump(page);
  ok('10 보낸 뒤에는 규칙 업무를 다시 만들지 않음', st.tasks.filter((t) => t.companyId === 'co_a' && t.ruleKey?.startsWith('progress_report:') && t.status !== 'done').length === 0);
  const latestId = st.notices.find((n) => n.companyId === 'co_a' && n.pinned && n.title.startsWith('경과 보고'))?.id;
  // 담당자가 '고객 화면 보기'로 본 것은 고객 확인이 아니다
  await go(page, '/ax/clients/co_a');
  // 위 머리줄의 같은 이름 버튼은 기업 고르기 창을 연다 — 기업 카드의 버튼(마지막)을 누른다
  await page.locator('button:visible', { hasText: '고객 화면 보기' }).last().click(); await page.waitForURL(/\/portal/); await sleep(800);
  await go(page, '/portal/schedule'); await sleep(2000);
  st = await dump(page);
  ok('10 담당자 미리 보기는 고객 확인으로 안 셈', !!latestId && !st.activities.some((a) => a.type === 'notice_read'));

  // 고객: 홈 고정 띠 → 일정 · 공지에서 제목 · 목록으로 보임
  const storeKey = await page.evaluate(() => Object.keys(localStorage).find((k) => { try { return !!JSON.parse(localStorage.getItem(k) ?? 'null')?.state; } catch { return false; } }));
  await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); s.state.session = null; localStorage.setItem(key, JSON.stringify(s)); }, storeKey);
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill('ceo@a-precision.demo');
  await page.locator('input[type=password]').first().fill('client2026!');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/portal/); await sleep(1200);
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  await go(page, '/portal');
  const strip = page.getByTestId('pinned-strip');
  ok('10 고객 홈 맨 위: 담당자 경과 보고', /담당자 경과 보고/.test(await strip.innerText()) && /경과 보고 ·/.test(await strip.innerText()));
  await strip.click(); await sleep(1200);
  ok('10 고객 화면: 지난 보고는 접힌 묶음(제목만)', /지난 경과 보고 1건/.test(await page.getByTestId('older-reports').innerText()) && (await page.locator('#notices [data-notice-body]').filter({ hasText: 'REPORT-OK' }).count()) === 0);
  await page.getByTestId('older-reports').getByRole('button', { name: /지난 경과 보고 1건/ }).click(); await sleep(300);
  await page.getByTestId('older-reports').getByRole('button', { name: /경과 보고 ·/ }).first().click(); await sleep(300);
  const body = page.locator('#notices [data-notice-body]').filter({ hasText: 'REPORT-OK' }).first();
  ok('10 고객 화면: 펼치면 첫 보고 본문(한마디 포함)', await body.isVisible());
  const latest = page.locator('#notices [data-notice-body]').first();
  ok('10 고객 화면: 묶음 제목은 굵은 제목 · 줄은 목록', (await latest.locator('div.font-bold').filter({ hasText: '지금 진행 상황' }).count()) === 1 && (await latest.locator('div.flex.gap-2').count()) >= 2);
  await sleep(1500);
  st = await dump(page);
  const seen = st.activities.filter((a) => a.type === 'notice_read' && a.meta?.noticeId === latestId);
  ok('10 고객이 끝까지 본 경과 보고는 기록(고객 본인 · 이 기업)', seen.length === 1 && seen[0].actorRole === 'client' && seen[0].companyId === 'co_a');
  await go(page, '/portal/schedule'); await sleep(1800);
  st = await dump(page);
  ok('10 같은 보고는 한 번만 기록', st.activities.filter((a) => a.type === 'notice_read' && a.meta?.noticeId === latestId).length === 1);
  // 담당자 화면: 고객 플랫폼 탭 · 보고 창에 '고객 확인'
  await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); s.state.session = null; localStorage.setItem(key, JSON.stringify(s)); }, storeKey);
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill('ceo@kpjk.co.kr');
  await page.locator('input[type=password]').first().fill('kpjk2026!');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/ax\//); await sleep(1200);
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  await go(page, '/ax/clients/co_a?tab=portal');
  ok('10 고객 플랫폼 탭: 최근 경과 보고 · 고객 확인', /고객 확인 \d+\/\d+/.test(await page.getByTestId('report-seen').innerText()));
  await page.getByTestId('client-quick-actions').getByRole('button', { name: '경과 보고' }).click(); await sleep(500);
  ok('10 보고 창: 지난 보고 · 고객 확인', /지난 보고 .* · 고객 확인 \d+\/\d+/.test(await dlg().getByTestId('report-range').innerText()));
  await go(page, '/ax/schedule?tab=notice');
  ok('10 공지 관리: 경과 보고마다 고객 확인 / 확인 전', (await page.getByText(/^고객 확인 \d+\/\d+$/).count()) >= 1 && (await page.getByText('고객 확인 전', { exact: true }).count()) >= 1);
  await page.getByTestId('notice-kind').getByRole('button', { name: /^경과 보고 \d+$/ }).click(); await sleep(300);
  ok('10 공지 관리: 경과 보고만 거르기', (await page.getByText('중간 보고 전 확인 부탁드립니다').count()) === 0 && (await page.getByText(/^경과 보고 · \d+\/\d+( ~ \d+\/\d+)?$/).count()) === 2);
  await go(page, '/portal/schedule');
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(500);
  ok('10 휴대폰 일정 · 공지 가로 넘침 없음', (await overflow(page)) <= 0);
  ok('10 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 앱 안 이동: 주소의 탭 · 창 (새로 고침 없이) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  const push = async (u) => { await page.evaluate((x) => window.next.router.push(x), u); await sleep(1500); };
  await go(page, '/ax/dashboard');
  await push('/ax/clients/co_a?tab=vault');
  ok('11 ?tab=vault → 서류함 탭', await page.locator('#vault-tab').isVisible());
  await go(page, '/ax/dashboard');
  await push('/ax/clients/co_a?tab=vault&kit=none');
  ok('11 ?kit= → 공고 신청 묶음 창', await page.getByTestId('apply-kit').isVisible());
  await go(page, '/ax/dashboard');
  await push('/ax/programs?tab=leads');
  ok('11 지원사업 ?tab=leads → 가망고객 탭', (await page.getByRole('tab', { name: /가망고객/ }).getAttribute('aria-selected')) === 'true');
  ok('11 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 경과 보고 미확인 → 확인 연락 (보낸 지 4일 → 업무 → 대표가 보면 자동 완료) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  const dlg = () => page.locator('[role=dialog]:visible').last();
  const storeKey = await page.evaluate(() => Object.keys(localStorage).find((k) => { try { return !!JSON.parse(localStorage.getItem(k) ?? 'null')?.state; } catch { return false; } }));
  // 앱의 로그아웃 동작으로 나간다 — 저장된 값만 지우면 화면에 남은 세션이 다시 저장되어(부하가 클 때) 로그인 화면이 안 뜬다
  const relogin = async (id, pwd, to) => {
    await page.evaluate(() => window.__kpjkState().logout());
    await page.goto(B + '/login', { waitUntil: 'networkidle' });
    await page.getByLabel('아이디 (이메일)').fill(id);
    await page.locator('input[type=password]').first().fill(pwd);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(to); await sleep(1200);
    await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
    await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  };
  await go(page, '/ax/clients/co_a');
  await page.getByTestId('client-quick-actions').getByRole('button', { name: '경과 보고' }).click(); await sleep(500);
  await dlg().getByRole('button', { name: '고객에게 보내기' }).click(); await sleep(600);
  let st = await dump(page);
  const rep = st.notices.filter((n) => n.companyId === 'co_a' && n.title.startsWith('경과 보고')).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  await go(page, '/ax/tasks'); await sleep(2200);
  st = await dump(page);
  ok('12 보낸 날에는 확인 연락 업무 없음', !st.tasks.some((t) => t.ruleKey === `report_unseen:${rep.id}`));
  // 4일 전에 보낸 것으로 — 저장된 상태의 게시 시각만 당긴다
  await page.evaluate(([key, id]) => { const s = JSON.parse(localStorage.getItem(key)); const n = s.state.notices.find((x) => x.id === id); n.publishedAt = new Date(Date.now() - 4 * 864e5).toISOString(); localStorage.setItem(key, JSON.stringify(s)); }, [storeKey, rep.id]);
  await go(page, '/ax/tasks'); await sleep(2500);
  st = await dump(page);
  const task = st.tasks.find((t) => t.ruleKey === `report_unseen:${rep.id}`);
  ok('12 4일 미확인 → 담당자 확인 연락 업무', task?.status === 'todo' && task.type === '후속연락' && task.assigneeId === 'u_park' && /경과 보고 4일 미확인 — 확인 연락/.test(task.title), task?.title);
  await page.getByRole('button', { name: '미완료', exact: true }).click(); await sleep(400);
  ok('12 업무함(미완료)에 규칙 배지 · 보고 확인', await page.locator('div', { hasText: task?.title ?? '-' }).getByText('규칙 · 보고 확인').first().isVisible().catch(() => false));
  // 대표(고객)가 본다 → 담당자 화면에서 업무가 저절로 끝남
  await relogin('ceo@a-precision.demo', 'client2026!', /\/portal/);
  await go(page, '/portal/schedule');
  // 4일 전 보고는 다른 고정 공지 아래에 있다 — 대표가 내려서 끝까지 읽는다
  await page.locator('#notices [data-seen-mark]').first().scrollIntoViewIfNeeded(); await sleep(2000);
  ok('12 고객이 내려 읽으면 확인 기록', (await dump(page)).activities.some((a) => a.type === 'notice_read' && a.meta?.noticeId === rep.id));
  await relogin('ceo@kpjk.co.kr', 'kpjk2026!', /\/ax\//);
  await go(page, '/ax/tasks'); await sleep(2500);
  st = await dump(page);
  const after = st.tasks.filter((t) => t.ruleKey === `report_unseen:${rep.id}`);
  ok('12 대표가 보면 확인 연락 업무 자동 완료 · 다시 안 만듦', after.length === 1 && after[0].status === 'done' && st.activities.some((a) => a.type === 'task_completed' && a.text.includes('대표가 경과 보고 확인')));
  ok('12 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 휴대폰 화면 정리 (대표 휴대폰 → 막 등록한 고객) ----------
{
  const page = await session('mobile', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  await go(page, '/ax/projects');
  ok('13 프로젝트: 단계는 칩 한 줄', await page.getByTestId('stage-chips').isVisible() && (await page.getByTestId('stage-chips').getByRole('button').count()) === 9);
  const firstCard = page.locator('a[href^="/ax/projects/"]').first();
  ok('13 프로젝트: 첫 화면에 프로젝트 카드', (await firstCard.boundingBox())?.y < 844);
  await page.getByTestId('stage-chips').getByRole('button', { name: /^완료/ }).click(); await sleep(300);
  ok('13 프로젝트: 칩으로 거르기', (await page.locator('a[href^="/ax/projects/"]').filter({ hasText: '완료' }).count()) >= 1 && (await page.getByTestId('stage-chips').getByRole('button', { name: /^완료/ }).getAttribute('aria-pressed')) === 'true');
  const bar = page.getByTestId('quick-approve-bar');
  ok('13 승인 막대가 떠 있으면 아래 여백을 더 둔다', await bar.isVisible() && await page.evaluate(() => document.documentElement.classList.contains('qa-bar')));
  await bar.getByRole('button', { name: /승인 알림 접기/ }).click(); await sleep(300);
  ok('13 승인 막대 접기 → 사라지고 여백도 원래대로', (await page.getByTestId('quick-approve-bar').count()) === 0 && !(await page.evaluate(() => document.documentElement.classList.contains('qa-bar'))));
  await go(page, '/ax/dashboard');
  ok('13 접은 승인 막대는 이 세션 동안 다시 안 뜸', (await page.getByTestId('quick-approve-bar').count()) === 0);
  await go(page, '/ax/clients/co_a');
  const toggle = page.getByTestId('profile-toggle');
  const firstRow = page.locator('#profile-card section').first();
  ok('13 기업 상세: 회사 정보는 접힌 한 줄', await toggle.isVisible() && !(await firstRow.isVisible()));
  await toggle.click(); await sleep(300);
  ok('13 기업 상세: 누르면 회사 정보 펼침', await firstRow.isVisible());
  ok('13 휴대폰 가로 넘침 없음', (await overflow(page)) <= 0);

  // 막 등록한 고객 — 프로젝트·자료·일정이 하나도 없는 기업과 그 담당자 계정
  const storeKey = await page.evaluate(() => Object.keys(localStorage).find((k) => { try { return !!JSON.parse(localStorage.getItem(k) ?? 'null')?.state; } catch { return false; } }));
  const { createHash } = await import('crypto');
  const h = createHash('sha256').update('kpjk-ax::v1::new@new.demo::client2026!').digest('hex');
  await page.evaluate(([key, hash]) => { const s = JSON.parse(localStorage.getItem(key));
    s.state.companies.push({ id: 'co_new', code: 'Z', name: '새로운테크(주)', ceo: '시험대표', industry: '소프트웨어', bizNo: '000-81-99999', contactName: '시험대표', contactTitle: '대표이사', contactPhone: '', contactEmail: 'new@new.demo', address: '서울', employees: 5, revenue: '', firstConsultDate: new Date().toISOString().slice(0, 10), consultantId: 'u_park', memo: '' });
    s.state.users.push({ id: 'c_new', name: '시험대표', role: 'client', title: '대표이사', email: 'new@new.demo', companyId: 'co_new', passwordHash: hash, active: true });
    localStorage.setItem(key, JSON.stringify(s)); }, [storeKey, h]);
  // 기업고객 '포털 미사용': 막 등록해 아직 안 들어온 기업 → 접속 전, 누르면 고객 플랫폼 탭으로
  await go(page, '/ax/clients');
  await page.getByRole('button', { name: /^포털 미사용 \d+$/ }).click(); await sleep(400);
  const newCard = page.locator('a[href="/ax/clients/co_new?tab=portal"]');
  ok('13 기업고객 포털 미사용: 막 등록한 기업은 접속 전 · 고객 플랫폼 탭으로', await newCard.isVisible() && /포털 접속 전/.test(await newCard.innerText()));
  ok('13 기업고객 포털 미사용: 최근 접속한 에이정밀은 빠짐', (await page.locator('a[href="/ax/clients/co_a?tab=portal"]').count()) === 0);
  await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); s.state.session = null; localStorage.setItem(key, JSON.stringify(s)); }, storeKey);
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill('new@new.demo');
  await page.locator('input[type=password]').first().fill('client2026!');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/portal/); await sleep(1200);
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  await go(page, '/portal/projects');
  ok('13 막 등록한 고객: 진행현황은 안내 + 문의하기', await page.getByText('아직 시작한 프로젝트가 없습니다').isVisible() && await page.getByRole('link', { name: '문의하기' }).first().isVisible());
  for (const u of ['/portal', '/portal/documents', '/portal/schedule', '/portal/results', '/portal/company']) { await go(page, u); }
  ok('13 막 등록한 고객: 고객 화면 전부 오류 없음 · 넘침 없음', page.errs.length === 0 && (await overflow(page)) <= 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 휴대폰 더보기 메뉴판 · 대시보드 첫 화면 (컨설턴트 휴대폰) ----------
{
  const page = await session('mobile');
  await go(page, '/ax/dashboard');
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  const coach = page.getByTestId('coach-start');
  ok('14 대시보드: 실증 안내는 제목 · 시작만(설명 · 왜는 PC)', await coach.getByRole('button', { name: '실증 시작' }).isVisible() && !(await coach.getByText('하루 1~3개 미션').isVisible()) && !(await coach.getByText('왜 핵심인가요?').isVisible()), `높이 ${Math.round((await coach.boundingBox())?.height ?? 0)}px`);
  const kpiY = (await page.locator('#tut-kpi').boundingBox())?.y ?? -1;
  ok('14 대시보드: 첫 화면에 숫자 칸(화면 위로 지나가 있지 않게)', kpiY >= 0 && kpiY < 700, `${Math.round(kpiY)}px`);
  await page.getByRole('button', { name: '더보기' }).click(); await sleep(500);
  const menu = page.getByTestId('more-menu');
  const box = await menu.boundingBox();
  ok('14 더보기: 메뉴판이 맨 위(시트 첫 화면)', !!box && box.y < 400);
  ok('14 더보기: 아래 탭에 없는 메뉴만 · 업무함 숫자', (await menu.locator('[data-menu-tile]').count()) >= 8 && (await menu.locator('[data-menu-tile="/ax/dashboard"]').count()) === 0 && /\d+/.test(await menu.locator('[data-menu-tile="/ax/tasks"]').innerText()));
  await menu.locator('[data-menu-tile="/ax/schedule"]').click(); await page.waitForURL(/\/ax\/schedule/); await sleep(500);
  ok('14 더보기: 메뉴를 누르면 그 화면으로 · 시트 닫힘', /\/ax\/schedule/.test(page.url()) && (await page.getByTestId('more-menu').count()) === 0);
  ok('14 페이지 오류 없음 · 넘침 없음', page.errs.length === 0 && (await overflow(page)) <= 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 휴대폰 3차 정리 (컨설턴트 휴대폰 → 고객 휴대폰) ----------
{
  // 44px 미만으로 보이는 눌리는 것(글 속 링크 · 눌리는 범위를 넓힌 것은 뺀다)
  const tiny = (page) => page.evaluate(() => [...document.querySelectorAll('main button, main a, main [role=tab], main select')].filter((e) => {
    const b = e.getBoundingClientRect(); if (!b.width || !b.height) return false;
    if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') return false;
    const a = getComputedStyle(e, '::after'); return !(a.content !== 'none' && a.position === 'absolute') && b.height < 36;
  }).map((e) => (e.getAttribute('aria-label') || e.innerText || e.tagName).replace(/\s+/g, ' ').slice(0, 16)));
  const bellBox = (page) => page.evaluate(() => { const el = document.querySelector('[data-testid=bell-panel]'); if (!el) return null; const b = el.getBoundingClientRect(); const t = el.querySelector('a .font-bold, a .font-medium'); return { l: b.left, r: b.right, vw: innerWidth, color: t ? getComputedStyle(t).color : '' }; });

  const page = await session('mobile');
  await go(page, '/ax/tasks');
  const ph = page.locator('main .page-header').first();
  const phBox = await ph.boundingBox();
  ok('15 업무함 머리글: 휴대폰에서 낮게(≤ 180px)', !!phBox && phBox.height <= 180, `${Math.round(phBox?.height ?? 0)}px`);
  ok('15 머리글 설명은 두 줄까지', await ph.locator('.ph-desc').evaluate((e) => getComputedStyle(e).webkitLineClamp === '2'));
  ok('15 AI 버튼은 짧은 이름', await ph.locator('.ax-insight-short').isVisible() && !(await ph.locator('.ax-insight-long').isVisible()));
  const order = await ph.locator('.ph-actions').evaluate((w) => { const xs = [...w.querySelectorAll('button, a')].filter((e) => e.getBoundingClientRect().width > 0 && !e.classList.contains('seg-btn')); const acc = xs.find((e) => e.classList.contains('bg-accent')); return acc ? Math.min(...xs.map((e) => e.getBoundingClientRect().left)) === acc.getBoundingClientRect().left : true; });
  ok('15 주 버튼이 맨 앞', order);
  const kpis = await page.locator('main .kpi-strip .kpi').evaluateAll((xs) => xs.map((e) => Math.round(e.getBoundingClientRect().top)));
  ok('15 업무함 숫자 칸은 한 줄(4칸)', kpis.length === 4 && new Set(kpis).size === 1, kpis.join(','));
  const small = [];
  for (const u of ['/ax/tasks', '/ax/documents', '/ax/consultations', '/ax/clients/co_a', '/ax/growth']) { await go(page, u); small.push(...(await tiny(page)).map((x) => `${u}:${x}`)); }
  ok('15 내부 주요 화면에 작은 터치 영역 없음', small.length === 0, small.slice(0, 4).join(' | '));
  await page.getByRole('button', { name: '알림', exact: true }).first().click(); await sleep(400);
  const ib = await bellBox(page);
  ok('15 내부 알림 종: 펼침이 화면 안', !!ib && ib.l >= 0 && ib.r <= ib.vw, JSON.stringify(ib));
  ok('15 내부 휴대폰 오류 없음 · 넘침 없음', page.errs.length === 0 && (await overflow(page)) <= 0, page.errs.slice(0, 2).join(' | '));
}
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('kpjk-test', '1'); } catch {} });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(String(e)));
  await page.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill('ceo@a-precision.demo');
  await page.locator('input[type=password]').first().fill('client2026!');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/portal/); await sleep(1200);
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  await go(page, '/portal');
  await page.getByRole('button', { name: '알림', exact: true }).first().click(); await sleep(400);
  const cb = await page.evaluate(() => { const el = document.querySelector('[data-testid=bell-panel]'); if (!el) return null; const b = el.getBoundingClientRect(); const t = el.querySelector('a .font-bold, a .font-medium'); return { l: b.left, r: b.right, vw: innerWidth, color: t ? getComputedStyle(t).color : '' }; });
  ok('15 고객 알림 종(360px): 펼침이 화면 안', !!cb && cb.l >= 0 && cb.r <= cb.vw, JSON.stringify(cb));
  ok('15 고객 알림 종: 제목 글자가 보이는 색(흰색 아님)', !!cb && cb.color !== '' && cb.color !== 'rgb(255, 255, 255)', cb?.color);
  ok('15 고객 알림 종: 날짜 묶음 제목', (await page.locator('[data-bell-group]').count()) >= 1);
  await page.getByTestId('bell-all').click(); await page.waitForURL(/\/portal\/notifications/); await sleep(600);
  const labels = await page.locator('[data-notif-group]').evaluateAll((xs) => xs.map((e) => e.getAttribute('data-notif-group')));
  const rank = { today: 0, yesterday: 1, week: 2, older: 3 };
  ok('15 고객 알림: 날짜 묶음(오늘 · 어제 · 이번 주 · 이전 순)', labels.length >= 1 && labels.every((k, i) => i === 0 || rank[labels[i - 1]] < rank[k]), labels.join(','));
  const unreadBefore = await page.locator('[data-unread]').count();
  ok('15 고객 알림: 안 읽은 알림 표시', unreadBefore >= 1 && /읽지 않은 알림 \d+건/.test(await page.locator('main .page-header').innerText()));
  await page.getByRole('button', { name: '모두 읽음' }).click(); await sleep(400);
  ok('15 고객 알림: 모두 읽음 → 표시 사라짐', (await page.locator('[data-unread]').count()) === 0 && (await page.getByRole('button', { name: '모두 읽음' }).count()) === 0);
  await go(page, '/portal/company');
  const doneShown = () => page.locator('[data-testid=growth-quests] [data-done="1"]').count();
  ok('15 우리 회사: 끝낸 항목은 접혀 있음', (await page.getByTestId('quest-done-toggle').isVisible()) && (await doneShown()) === 0);
  await page.getByTestId('quest-done-toggle').click(); await sleep(300);
  ok('15 우리 회사: 누르면 끝낸 항목이 보임', (await doneShown()) >= 1);
  const facts = page.getByTestId('company-facts');
  const visibleRows = () => facts.locator('dl > div').evaluateAll((xs) => xs.filter((e) => e.getBoundingClientRect().height > 0).length);
  const before = await visibleRows();
  ok('15 우리 회사: 회사 정보는 앞쪽 6칸만', before === 6, `${before}칸`);
  await page.getByTestId('facts-more').click(); await sleep(300);
  ok('15 우리 회사: 나머지 칸 펼침', (await visibleRows()) > before && (await page.getByTestId('facts-more').count()) === 0);
  await go(page, '/portal/services');
  ok('15 함께 검토: 화면 오류 없음', (await page.locator('main h1').innerText()).includes('함께 검토'));
  ok('15 고객 휴대폰(360px) 오류 없음 · 넘침 없음', page.errs.length === 0 && (await overflow(page)) <= 0, page.errs.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------- PC 정리 (대표 PC — 대시보드 · 업무규칙 · 리포트 · 실증 기록) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  await go(page, '/ax/dashboard');
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  const ops = await page.locator('#ops-strip').boundingBox();
  const kpi = await page.locator('#tut-kpi').boundingBox();
  ok('16 대시보드: 운영 현황 6개 상태가 첫 화면(900px)에 · 숫자 칸 바로 아래', !!ops && !!kpi && ops.y + ops.height <= 900 && ops.y > kpi.y, `운영 현황 ${Math.round(ops?.y ?? 0)}~${Math.round((ops?.y ?? 0) + (ops?.height ?? 0))}px`);
  ok('16 대시보드: 운영 현황은 한 줄(6칸 같은 높이)', new Set(await page.locator('#ops-strip a').evaluateAll((xs) => xs.map((e) => Math.round(e.getBoundingClientRect().top)))).size === 1);
  const coach = page.getByTestId('coach-start');
  const ch = (await coach.boundingBox())?.height ?? 999;
  ok('16 대시보드: 실증 안내는 낮게(기준선 줄 포함 ≤ 150px)', ch <= 150, `${Math.round(ch)}px`);
  await coach.getByRole('button', { name: /왜 핵심인가요/ }).click(); await sleep(300);
  ok('16 대시보드: 왜 핵심인가요 → 펼침', await page.getByTestId('coach-why').isVisible());

  await go(page, '/ax/reports');
  const tabNames = await page.getByRole('tab').allInnerTexts();
  ok('16 리포트: 탭 4개(실증 진행 · 측정 지점 · 운영 현황 · 실증 기록)', ['실증 진행', '측정 지점', '운영 현황', '실증 기록'].every((t) => tabNames.some((x) => x.includes(t))), tabNames.join(','));
  await page.getByRole('tab', { name: /^측정 지점/ }).click(); await sleep(300);
  ok('16 리포트 측정 지점: 기준선 조사 전이면 "미시작"', await page.getByText('도입 전 기준선이 아직 없습니다').first().isVisible() && await page.locator('main').getByText('미시작', { exact: true }).isVisible());
  await page.getByRole('tab', { name: /^실증 진행/ }).click(); await sleep(300);
  ok('16 리포트: 다른 탭에서 첫 탭(실증 진행)으로 돌아옴', await page.getByText('영역별 기록 현황').isVisible());
  // 기준선 조사를 마친 상태 — 저장된 상태에 조사 한 건을 넣고 다시 연다
  const storeKey = await page.evaluate(() => Object.keys(localStorage).find((k) => { try { return !!JSON.parse(localStorage.getItem(k) ?? 'null')?.state; } catch { return false; } }));
  await page.evaluate(() => window.__kpjkState().logout());
  await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); s.state.settings.baselineSurveys = [{ id: 'bs_t', surveyVersion: 't', phase: 'before', respondentUserId: 'u_admin', respondentName: '시험', recordedAt: new Date().toISOString(), answers: {}, metrics: { docLeadDays: 5 }, source: 'ceo_recall' }]; localStorage.setItem(key, JSON.stringify(s)); }, storeKey);
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill('ceo@kpjk.co.kr'); await page.locator('input[type=password]').first().fill('kpjk2026!');
  await page.getByRole('button', { name: '로그인' }).click(); await page.waitForURL('**/ax/**'); await sleep(1000);
  await go(page, '/ax/reports?tab=kpi');
  ok('16 리포트 측정 지점: 조사를 마쳤으면 "조사 완료"(고정 문구 아님)', await page.getByText('도입 전 기준선 조사 완료').isVisible() && await page.locator('main').getByText('조사 완료', { exact: true }).isVisible() && !(await page.locator('main').getByText('미시작', { exact: true }).isVisible()));

  await go(page, '/ax/tasks');
  await page.locator('main .page-header').getByRole('link', { name: '자동 규칙' }).click();
  await page.waitForURL(/\/ax\/settings/); await sleep(900);
  const rules = await page.locator('#rules').boundingBox();
  ok('16 업무함 → 자동 규칙: 설정의 자동 업무 규칙으로 바로', /\/ax\/settings#rules/.test(page.url()) && !!rules && rules.y < 450, `${Math.round(rules?.y ?? -1)}px`);
  const rsTxt = (await page.getByTestId('rules-summary').innerText()).replace(/\s+/g, ' ');
  const stR = await dump(page);
  const ruleN = stR.tasks.filter((t) => t.ruleKey && /^(contract_renewal|aftercare_review|result_unread|quote_expiring|doc_overdue_followup|no_contact|progress_report|report_unseen):/.test(t.ruleKey)).length;
  ok('16 자동 규칙 요약: 켜진 규칙 · 규칙이 만든 업무 수가 기록과 같음', rsTxt.includes(`규칙이 만든 업무 ${ruleN}건`) && /켜진 규칙 \d+ \/ \d+/.test(rsTxt), rsTxt);

  await go(page, '/ax/reports?tab=evidence');
  const days = await page.locator('[data-activity-day]').evaluateAll((xs) => xs.map((e) => e.getAttribute('data-activity-day')));
  const firstLabel = await page.locator('[data-activity-day] h3').first().innerText();
  ok('16 실증 기록: 날짜별 묶음(최신 날짜부터) · 첫 묶음은 오늘', days.length >= 2 && days.every((d, i) => i === 0 || days[i - 1] > d) && firstLabel.startsWith('오늘'), `${days.slice(0, 3).join(',')} / ${firstLabel.split('\n')[0]}`);
  ok('16 PC 페이지 오류 없음 · 넘침 없음', page.errs.length === 0 && (await overflow(page)) <= 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 17) 스스로 준비하기 — 지시서 TEST 01~10 (휴대폰) ----------
// 공고는 운영 서버 공개 목록에서 받아 둔 실제 기업마당 상시 공고 사본(가짜 공고 아님). 회사 · 계정은 데모 샘플.
{
  const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/bizinfo-open.json', import.meta.url), 'utf8'));
  const OFFICIAL = [...fs.readFileSync(new URL('../../src/lib/official-links.ts', import.meta.url), 'utf8').matchAll(/url: "(https:[^"]+)"/g)].map((m) => m[1]);
  const fxIds = new Set(fx.items.map((x) => x.id));
  const P = fx.items[0];
  const page = await session('mobile', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  await page.route('**/api/programs**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, items: fx.items, cachedAt: fx.savedAt }) }));
  const relogin = async (id, pwd, to) => {
    await page.evaluate(() => window.__kpjkState().logout());
    await page.goto(B + '/login', { waitUntil: 'networkidle' });
    await page.getByLabel('아이디 (이메일)').fill(id);
    await page.locator('input[type=password]').first().fill(pwd);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(to); await sleep(1200);
    await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
    await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  };
  const pages = new Set();
  const visit = async (path) => { await go(page, path); pages.add(path.replace(/\?.*$/, '')); if ((await overflow(page)) > 0) page.errs.push(`가로 넘침 ${path}`); };
  await page.evaluate((items) => { const st = window.__kpjkState(); st.upsertPrograms(items, st.session.userId); st.shareProgram(items[0].id, ['co_a'], st.session.userId); st.shareProgram(items[1].id, ['co_a'], st.session.userId); }, fx.items);

  // TEST 01 기업조건 매칭 — 고객 공고 목록(기존 매칭 규칙)에 실제 공고만, 직접 준비 · 전문가 문의 버튼이 따로
  await relogin('ceo@a-precision.demo', 'client2026!', /\/portal/);
  let st = await dump(page);
  const before = { opp: st.opportunities.filter((o) => o.companyId === 'co_a').length, inq: st.inquiries.filter((q) => q.companyId === 'co_a').length };
  await visit('/portal/programs'); await sleep(600);
  const goIds = await page.locator('[data-self-go]').evaluateAll((xs) => xs.map((e) => e.getAttribute('data-self-go')));
  ok('17 TEST01 기업조건 매칭: 고객 공고 목록은 실제 공고만 · 공고마다 직접 준비하기', goIds.length > 0 && goIds.every((id) => fxIds.has(id)) && goIds.includes(P.id), `${goIds.length}건`);
  ok('17 TEST01 전문가 문의 버튼은 직접 준비와 따로', (await page.getByRole('button', { name: '담당 컨설턴트에게 물어보기' }).count()) === goIds.length);
  await page.locator(`[data-self-go="${P.id}"]`).click(); await page.waitForURL(/\/portal\/self\/program\//); await sleep(800); pages.add('/portal/self/program');
  ok('17 TEST01 공고 화면: 매칭은 검토 후보(자격 · 선정 판단 아님) 안내', await page.getByText('신청 자격과 선정 여부를 판단한 것이 아니며').first().isVisible());

  // TEST 02 관련 교육 · 공식 링크
  const learnIds = await page.getByTestId('self-learn').locator('[data-learn]').evaluateAll((xs) => xs.map((e) => e.getAttribute('data-learn')));
  const pubIds = new Set(st.learnContents.filter((x) => x.published).map((x) => x.id));
  ok('17 TEST02 관련 교육: 공개한 학습 자료만 연결', learnIds.length > 0 && learnIds.every((id) => pubIds.has(id)), learnIds.join(','));
  const ext = await page.locator('main a[target=_blank]').evaluateAll((xs) => xs.map((a) => a.href));
  const bad = ext.filter((h) => !(h === P.url || OFFICIAL.some((o) => h === o || h === o + '/')));
  ok('17 TEST02 공식 링크: 공고문 원문 + 확인한 공식 기관 주소만(https)', ext.includes(P.url) && bad.length === 0 && ext.every((h) => h.startsWith('https://')), `${ext.length}개${bad.length ? ' 벗어남 ' + bad.join(' ') : ''}`);

  // TEST 03 직접 준비 상태 저장 · 재접속 복원
  await page.getByTestId('self-start').click(); await sleep(500);
  for (const k of ['notice', 'eligibility', 'period']) await page.locator(`[data-check="${k}"]`).check();
  await sleep(300);
  await relogin('ceo@a-precision.demo', 'client2026!', /\/portal/);
  await visit('/portal/self/program/' + encodeURIComponent(P.id));
  st = await dump(page);
  const run = st.selfRuns.find((r) => r.companyId === 'co_a' && r.kind === 'program' && r.targetKey === P.id);
  ok('17 TEST03 다시 로그인해도 준비 상태 그대로(체크 3 · 준비 중)', (await page.locator('[data-check]:checked').count()) === 3 && run?.status === 'preparing' && Object.keys(run.checks).length === 3);

  // TEST 04 신청 완료 기록 → 실행 이력
  await page.locator('[data-status="applied"]').click(); await sleep(400);
  await page.getByLabel('접수번호').fill('TEST-0001'); await page.getByRole('button', { name: '번호 저장' }).click(); await sleep(400);
  st = await dump(page);
  const act = st.activities.find((a) => a.type === 'self_status' && a.meta?.runId === run.id && a.meta?.to === 'applied');
  ok('17 TEST04 신청 완료 → 활동 기록(고객 입력 · 누가 · 언제)', !!act && act.actorRole === 'client' && act.actorId === 'c_a' && !!act.at && /고객 입력/.test(act.text));
  ok('17 TEST04 화면 이력 · 근거는 "확인 전"으로 표시', /신청 완료/.test(await page.getByTestId('self-history').textContent()) && /고객 근거 첨부 · 확인 전/.test(await page.getByTestId('self-evidence').textContent()));
  ok('17 TEST04 담당자에게 알림(내부)', st.notifications.some((n) => n.audience === 'internal' && n.companyId === 'co_a' && n.href === '/ax/clients/co_a?tab=portal'));

  // TEST 05 결과 변경 → 다음 행동 · 담당자 확인 업무
  const nextBefore = await page.getByTestId('self-next').innerText();
  await page.locator('[data-status="selected"]').click(); await sleep(500);
  const nextAfter = await page.getByTestId('self-next').innerText();
  st = await dump(page);
  const fuTask = st.tasks.filter((t) => t.ruleKey === `self_run:${run.id}:selected`);
  ok('17 TEST05 선정 기록 → 다음 할 일이 바뀜', nextBefore !== nextAfter && /선정/.test(nextAfter), nextAfter.replace(/\s+/g, ' ').slice(0, 80));
  ok('17 TEST05 선정 → 담당자 확인 업무(담당 컨설턴트)', fuTask.length === 1 && fuTask[0].assigneeId === 'u_park' && fuTask[0].source === 'auto');
  await visit('/portal/self/growth/' + encodeURIComponent('기업부설연구소'));
  await page.getByTestId('self-start').click(); await sleep(400);
  await page.locator('[data-status="done"]').click(); await sleep(600);
  ok('17 TEST05 성장과제 직접 완료 → 이어지는 과제(특허자본) 제시', /특허자본/.test(await page.getByTestId('self-followups').innerText().catch(() => '')));
  await visit('/portal/self');
  ok('17 TEST05 완료한 과제는 다시 권하지 않음', (await page.locator('[data-doable="기업부설연구소"]').count()) === 0);

  // TEST 06 중복 방지
  st = await dump(page);
  const dup = await page.evaluate(([pid, title]) => {
    const s = window.__kpjkState();
    const id2 = s.startSelfRun({ companyId: 'co_a', kind: 'program', targetKey: pid, targetTitle: title });
    const same = window.__kpjkState().setSelfStatus(id2, 'selected');
    window.__kpjkState().setSelfStatus(id2, 'waiting'); window.__kpjkState().setSelfStatus(id2, 'selected');
    const t = window.__kpjkState();
    return { id2, same, runs: t.selfRuns.filter((r) => r.companyId === 'co_a' && r.kind === 'program' && r.targetKey === pid).length, tasks: t.tasks.filter((x) => x.ruleKey === `self_run:${id2}:selected`).length };
  }, [P.id, P.title]);
  ok('17 TEST06 같은 공고 다시 시작해도 기록 1건 · 같은 상태 다시 고르면 기록 안 함 · 확인 업무 1건', dup.id2 === run.id && dup.same === false && dup.runs === 1 && dup.tasks === 1, JSON.stringify(dup));

  // TEST 07 고객 A ↔ B 분리 (화면 · 저장 동작. 서버 표 권한은 supabase/test RLS 시험에서 따로)
  await relogin('choi@bntech.demo', 'client2026!', /\/portal/);
  const bRun = await page.evaluate(() => window.__kpjkState().startSelfRun({ companyId: 'co_b', kind: 'growth', targetKey: '인사노무', targetTitle: '인사노무' }));
  await relogin('ceo@a-precision.demo', 'client2026!', /\/portal/);
  await visit('/portal/self/growth/' + encodeURIComponent('인사노무'));
  const leak = await page.evaluate((bid) => {
    const s = window.__kpjkState();
    return { start: s.startSelfRun({ companyId: 'co_b', kind: 'growth', targetKey: '인사노무', targetTitle: '인사노무' }), set: s.setSelfStatus(bid, 'done'), ev: s.addSelfEvidence(bid, { kind: 'number', label: '접수번호', value: 'X' }), help: s.requestSelfHelp(bid, 'x'), status: window.__kpjkState().selfRuns.find((r) => r.id === bid)?.status };
  }, bRun);
  ok('17 TEST07 고객 A 화면에 B 기록 안 보임(같은 과제도 시작 전)', !!bRun && (await page.getByTestId('self-start').isVisible()) && !(await page.locator(`[data-self-run="${bRun}"]`).count()));
  ok('17 TEST07 고객 A 는 B 기록을 만들거나 바꾸지 못함', leak.start === null && leak.set === false && leak.ev === null && leak.help === false && leak.status === 'exploring', JSON.stringify(leak));

  // TEST 09 직접 진행 ↔ 전문가 문의 경로 분리
  st = await dump(page);
  ok('17 TEST09 직접 진행만으로는 상담 요청 · 문의가 생기지 않음', st.opportunities.filter((o) => o.companyId === 'co_a').length === before.opp && st.inquiries.filter((q) => q.companyId === 'co_a').length === before.inq);
  await visit('/portal/self/program/' + encodeURIComponent(P.id));
  await page.getByTestId('expert-help').getByRole('button', { name: '담당 컨설턴트에게 물어보기' }).click(); await sleep(300);
  await page.getByRole('dialog').getByRole('button', { name: '보내기' }).click(); await sleep(600);
  st = await dump(page);
  const r2 = st.selfRuns.find((r) => r.id === run.id);
  const opp = st.opportunities.find((o) => o.id === r2.helpRef);
  ok('17 TEST09 직접 하다 전문가 요청: 진행 상태 · 준비를 담아 요청 · 직접 기록은 그대로', !!opp && r2.status === 'selected' && /스스로 준비하기에서 요청/.test(JSON.stringify(opp)) && (await page.getByTestId('expert-asked').isVisible()));
  ok('17 TEST09 요청 뒤에도 직접 기록 계속 가능', await page.evaluate((id) => window.__kpjkState().setSelfStatus(id, 'waiting'), run.id));
  const runsBefore = st.selfRuns.length;
  await visit('/portal/programs');
  const other = goIds.find((id) => id !== P.id);
  if (other) {
    await page.locator(`[data-self-go="${other}"]`).locator('xpath=..').getByRole('button', { name: '담당 컨설턴트에게 물어보기' }).click(); await sleep(300);
    await page.getByRole('dialog').getByRole('button', { name: '보내기' }).click(); await sleep(600);
  }
  st = await dump(page);
  ok('17 TEST09 전문가 문의만 해도 직접 진행 기록은 생기지 않음', !!other && st.selfRuns.length === runsBefore && st.opportunities.some((o) => o.companyId === 'co_a' && fx.items.find((x) => x.id === other) && o.serviceName?.includes(fx.items.find((x) => x.id === other).title.slice(0, 20))));

  // 내부: 근거 확인 · 권한 구분 · 측정(샘플 분리)
  await relogin('park@kpjk.co.kr', 'kpjk2026!', /\/ax\//);
  await visit('/ax/clients/co_a?tab=portal');
  const panel = page.getByTestId('client-self-runs');
  await panel.getByRole('button', { name: '확인' }).first().click(); await sleep(400);
  st = await dump(page);
  ok('17 내부: 담당자가 고객 근거 확인 → 확인 기록(누가 · 언제), 상태는 고객 값 그대로', st.selfRuns.find((r) => r.id === run.id)?.evidence.some((e) => e.confirmedBy === 'u_park' && e.confirmedAt) && st.selfRuns.find((r) => r.id === run.id)?.status === 'waiting' && st.activities.some((a) => a.type === 'self_confirmed' && a.actorId === 'u_park'));
  const parkTry = await page.evaluate((id) => window.__kpjkState().setSelfStatus(id, 'not_selected'), run.id);
  await visit('/ax/programs?tab=learn');
  ok('17 내부: 담당자는 고객 상태 · 학습 자료를 바꾸지 못함(대표만 학습 자료)', parkTry === false && (await page.getByTestId('learn-new').count()) === 0);
  await relogin('ceo@kpjk.co.kr', 'kpjk2026!', /\/ax\//);
  await visit('/ax/programs?tab=self');
  const rows = await page.getByTestId('self-overview').locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())));
  const started = rows.find((r) => r[0].startsWith('지원사업 직접 준비 시작'));
  ok('17 측정: 샘플 기업 기록은 "샘플 · 시험"에만, 실제 고객 칸은 0 · 기준선 없는 시간 변화는 계산 안 함', started?.[1] === '0건' && started?.[2] !== '0건' && rows.some((r) => /기준선이 없어 계산하지 않습니다/.test(r.join(' '))), JSON.stringify(started));
  await page.evaluate(() => { const s = window.__kpjkState(); s.setLearnPublished('lc_bizplan', false, s.session.userId); });

  // TEST 08 비회원: 공개 학습만 · 아무것도 묻지 않음 · 고객 화면은 로그인 필요
  await page.evaluate(() => window.__kpjkState().logout());
  await visit('/learn');
  st = await dump(page);
  const pubNow = new Set(st.learnContents.filter((x) => x.published).map((x) => x.id));
  const anonIds = await page.locator('[data-learn]').evaluateAll((xs) => xs.map((e) => e.getAttribute('data-learn')));
  ok('17 TEST08 비회원 /learn: 공개 자료만(비공개로 바꾼 자료 안 보임)', anonIds.length === pubNow.size && anonIds.every((id) => pubNow.has(id)) && !anonIds.includes('lc_bizplan'), `${anonIds.length}개`);
  ok('17 TEST08 비회원 /learn: 입력 칸 없음(개인정보 · 회원가입 요구 없음) · 공고 찾기로 연결', (await page.locator('main input, main textarea, main select').count()) === 0 && (await page.getByTestId('learn-to-match').getAttribute('href')) === '/match');
  await visit('/learn/lc_bizplan');
  ok('17 TEST08 비공개 자료 주소로 들어와도 내용 안 보임', (await page.getByText('찾을 수 없는 학습 자료입니다').isVisible()) && !(await page.getByTestId('learn-body').count()));
  await visit('/learn/lc_prep_docs');
  const box = page.getByTestId('learn-public-checks').locator('input').first(); await box.check();
  await page.reload({ waitUntil: 'networkidle' }); await sleep(600);
  ok('17 TEST08 비회원 체크는 저장되지 않음', !(await page.getByTestId('learn-public-checks').locator('input').first().isChecked()));
  await page.goto(B + '/portal/self', { waitUntil: 'networkidle' }); await sleep(900);
  ok('17 TEST08 비회원은 고객 화면(스스로 준비하기)에 못 들어감', /\/login/.test(page.url()), page.url());
  await visit('/match');
  ok('17 TEST08 지원사업 찾기(/match) → 무료 학습 연결', (await page.getByTestId('match-to-learn').getAttribute('href')) === '/learn');

  // TEST 10 새 화면 오류 · 넘침 없음 (기존 기능 회귀는 이 파일의 1~16 · run.mjs · 단위 · RLS 시험)
  ok('17 TEST10 새 화면 페이지 오류 · 가로 넘침 없음', page.errs.length === 0, `${pages.size}개 화면${page.errs.length ? ' · ' + page.errs.slice(0, 2).join(' | ') : ''}`);
  await page.context().close();
}

// ---------- 첫 로그인 안내(튜토리얼) — 휴대폰에서 화면이 끝까지 내려가지 않게 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('kpjk-test', '1'); } catch {} });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(String(e)));
  await page.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill('park@kpjk.co.kr');
  await page.locator('input[type=password]').first().fill('kpjk2026!');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('**/ax/**');
  const tut = page.getByRole('dialog', { name: '튜토리얼' });
  await tut.waitFor({ timeout: 8000 });
  await sleep(1500);
  ok('16 첫 안내: 맨 위 숫자 칸부터(화면이 끝까지 내려가지 않음)', (await tut.getByText('지금 처리할 숫자').isVisible()) && (await page.evaluate(() => scrollY)) < 700, `scrollY ${await page.evaluate(() => scrollY)}`);
  await tut.getByRole('button', { name: '다음' }).click(); await sleep(1500);
  const deep = await page.evaluate(() => scrollY);
  await tut.getByRole('button', { name: '건너뛰기' }).click(); await sleep(1200);
  ok('16 첫 안내: 닫으면 화면 맨 위로', (await page.evaluate(() => scrollY)) === 0, `브리핑 단계 ${deep}px → ${await page.evaluate(() => scrollY)}px`);
  ok('16 첫 안내: 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
console.log(`\n== OK ${okN} / FAIL ${failN}`);
process.exit(failN ? 1 : 0);
