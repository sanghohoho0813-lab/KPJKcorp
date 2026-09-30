// 파일럿 준비: 대표 로그인 → 컨설턴트 계정 → 기업 2곳 → 고객 계정 2개 → 프로젝트 → 자료요청 (전부 앱 화면으로)
import { launch, ctxFor, login, B, ACC, CO1, CO2, L, ok, sql, body, toasts, summary, closeTut } from './lib.mjs';
const b = await launch();
const { p } = await ctxFor(b, 'pc');

// 로그인 화면 — 서버 모드 문구
await p.goto(B + '/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
let t = await body(p);
ok('로그인 화면: DEMO DATA 없음', !/DEMO DATA/.test(t));
ok('로그인 화면: "브라우저 안에서만 동작" 없음', !/브라우저 안에서만 동작/.test(t));
ok('로그인 화면: 서버 인증 안내', /서버의 인증\(Supabase Auth\)/.test(t));
ok('로그인 화면: 데모 계정 안내 없음', !/데모 계정/.test(t));
ok('로그인 화면: 서버 연결 배지', /서버 연결/.test(t));
ok('로그인 화면: 비상 데모 안내 숨김(서버 정상)', !(await p.getByTestId('server-down').count()));

await login(p, ACC.ceo, /\/ax\//);
ok('대표 로그인 → /ax', /\/ax\//.test(p.url()), p.url());
t = await body(p);
ok('대시보드: DEMO DATA 없음', !/DEMO DATA/.test(t));

async function createUser(role, a, companyName) {
  await p.goto(B + '/ax/settings', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '계정 만들기' }).first().click(); await p.waitForTimeout(600);
  await p.getByLabel(/^역할/).selectOption(role);
  if (companyName) await p.getByLabel(/소속 기업/).selectOption({ label: companyName });
  await p.getByLabel(/이름 \*/).fill(a.name);
  await p.getByLabel(/직책 \*/).fill(role === 'client' ? '담당자' : '컨설턴트');
  await p.getByLabel(/아이디 \(이메일\) \*/).fill(a.id);
  await p.getByLabel(/초기 비밀번호/).fill(a.pw);
  await p.getByLabel(/비밀번호 확인/).fill(a.pw);
  await p.getByRole('button', { name: '만들기', exact: true }).click(); await p.waitForTimeout(2500);
  const row = sql(`select role, coalesce(company_id,''), active from profiles where email='${a.id}'`);
  L(`계정 생성 ${a.id}`, row ? `OK ${row}` : `FAIL ${await toasts(p)}`);
}

async function createCompany(name) {
  await p.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '기업고객 등록' }).first().click(); await p.waitForTimeout(600);
  await p.getByLabel(/기업명/).fill(name);
  await p.getByLabel(/^대표자/).first().fill('비식별 대표');
  await p.getByLabel(/^담당자/).first().fill('비식별 담당');
  await p.getByRole('group', { name: '담당 컨설턴트' }).getByRole('button', { name: `${ACC.con.name} 컨설턴트` }).click();
  await p.getByRole('button', { name: '등록', exact: true }).click(); await p.waitForTimeout(2500);
  const id = sql(`select id from companies where name='${name}'`);
  L(`기업 등록 ${name}`, id ? `OK ${id}` : `FAIL ${await toasts(p)}`);
  return id;
}

async function createProject(companyName, pname) {
  await p.goto(B + '/ax/projects', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '프로젝트 등록' }).first().click(); await p.waitForTimeout(600);
  await p.getByLabel(/^기업 \*/).selectOption({ label: companyName });
  await p.getByLabel(/프로젝트명/).fill(pname);
  await p.getByLabel('진행 단계').selectOption('doc_request');
  await p.getByLabel('담당 컨설턴트').selectOption({ label: `${ACC.con.name} 컨설턴트` }).catch(() => {});
  await p.getByRole('button', { name: '등록', exact: true }).click(); await p.waitForTimeout(2500);
  const id = sql(`select id from projects where name='${pname}'`);
  L(`프로젝트 등록 ${pname}`, id ? `OK ${id}` : `FAIL ${await toasts(p)}`);
  return id;
}

async function createDocReq(pid, name) {
  await p.goto(B + '/ax/projects/' + pid, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1800);
  await p.getByRole('button', { name: '자료 요청' }).first().click(); await p.waitForTimeout(600);
  await p.getByLabel('자료명').fill(name);
  await p.getByLabel('설명 (고객에게 표시)').fill('파일럿 검증용 요청입니다. 실제 서류가 아닌 시험 파일을 올려 주세요.');
  await p.locator('[role=dialog]').getByRole('button', { name: /^요청|등록|보내기/ }).last().click(); await p.waitForTimeout(2500);
  const id = sql(`select id||'|'||status from document_requests where name='${name}'`);
  L(`자료요청 생성 ${name}`, id ? `OK ${id}` : `FAIL ${await toasts(p)}`);
}

await createUser('consultant', ACC.con);
const co1 = await createCompany(CO1);
const co2 = await createCompany(CO2);
await createUser('client', ACC.c1, CO1);
await createUser('client', ACC.c2, CO2);
const pj1 = await createProject(CO1, 'Pilot 벤처확인 준비 (A)');
const pj2 = await createProject(CO2, 'Pilot 벤처확인 준비 (B)');
if (pj1) await createDocReq(pj1, '파일럿 제출자료 A-1');
if (pj2) await createDocReq(pj2, '파일럿 제출자료 B-1');

t = await body(p);
ok('설정 후 DEMO DATA 없음', !/DEMO DATA/.test(t));
L('서버 저장 실패 알림', (await toasts(p)) || '(없음)');
L('page errors', p.errs.length ? p.errs.slice(0, 5).join(' || ') : 'OK 0');
await b.close();
process.exit(summary() ? 1 : 0);
