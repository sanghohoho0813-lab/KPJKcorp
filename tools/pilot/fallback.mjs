// 서버 연결 실패 → 데모 즉시 복귀 → 서버로 복귀 / 사용 중 끊김 안내 / 연결 점검
import { launch, ctxFor, login, B, ACC, SB, L, ok, body, summary, state } from './lib.mjs';
const b = await launch();
const { ctx, p } = await ctxFor(b, 'pc');
let down = true, hits = 0;
await ctx.route(SB + '/**', (r) => { if (down) { hits++; return r.abort('internetdisconnected'); } return r.continue(); });

// 1) 서버 닿지 않음 → 로그인 화면 안내
await p.goto(B + '/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
ok('서버 끊김: 로그인 화면에 비상 안내', await p.getByTestId('server-down').isVisible().catch(() => false));
await p.getByLabel('아이디 (이메일)').fill(ACC.ceo.id);
await p.locator('input[type=password]').first().fill(ACC.ceo.pw);
await p.getByRole('button', { name: '로그인', exact: true }).click(); await p.waitForTimeout(2500);
const t1 = await body(p);
ok('서버 끊김: "비밀번호 틀림"이 아니라 연결 문제로 안내', /서버에 연결하지 못했습니다/.test(t1) && !/올바르지 않습니다/.test(t1));
ok('서버 끊김: 로그인 시도 횟수에 안 셈', !/\(1\/5\)/.test(t1));

// 2) 이 브라우저를 데모로
await p.getByRole('button', { name: '이 브라우저를 데모 모드로 전환' }).click(); await p.waitForTimeout(3000);
const t2 = await body(p);
ok('데모 전환: 비상 데모 표시', await p.getByTestId('forced-demo').isVisible().catch(() => false));
ok('데모 전환: 데모 계정 안내 표시', /데모 계정/.test(t2));
ok('데모 전환: DEMO DATA 배지', /DEMO DATA/.test(t2));
ok('데모 전환: 로그인 설명이 데모 문구', /브라우저 안에서만 동작/.test(t2));
const before = hits;
await login(p, { id: 'ceo@kpjk.co.kr', pw: 'kpjk2026!' }, /\/ax\//);
const s1 = await state(p);
ok('데모 로그인 → 데모 데이터(샘플 기업 6)', s1.companies.filter((c) => c.sample).length === 6 && !s1.serverMode, `companies=${s1.companies.length}`);
await p.goto(B + '/ax/documents', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
ok('데모 중 서버 호출 없음', hits === before, `${hits - before}회`);
ok('데모 화면 DEMO DATA 표시', /DEMO DATA/.test(await body(p)));

// 3) 서버 복구 → 서버로 돌아가기
down = false;
await p.getByRole('button', { name: '로그아웃' }).first().click().catch(() => {}); await p.waitForTimeout(1200);
await p.goto(B + '/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
await p.getByRole('button', { name: '서버 연결로 돌아가기' }).click(); await p.waitForTimeout(3000);
const t3 = await body(p);
ok('서버 복귀: 서버 연결 배지·서버 문구', /서버 연결/.test(t3) && /Supabase Auth/.test(t3) && !/데모 계정/.test(t3));
await login(p, ACC.ceo, /\/ax\//);
const s2 = await state(p);
ok('서버 복귀: 서버 데이터(데모 기업 없음)', s2.serverMode && !s2.companies.some((c) => c.sample) && s2.companies.some((c) => c.name.startsWith('Pilot')));

// 4) 사용 중 끊김 → 상단 안내 → 복구되면 사라짐
down = true;
let banner = false;
for (let i = 0; i < 25 && !banner; i++) { await p.waitForTimeout(1000); banner = await p.getByTestId('server-banner').isVisible().catch(() => false); }
ok('사용 중 끊김: 상단 안내 표시', banner);
down = false;
let gone = false;
for (let i = 0; i < 25 && !gone; i++) { await p.waitForTimeout(1000); gone = !(await p.getByTestId('server-banner').isVisible().catch(() => false)); }
ok('연결 복구: 안내 자동으로 사라짐', gone);
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
ok('복구 후 새로고침: 로그인·데이터 유지', /\/ax\//.test(p.url()) && (await state(p)).companies.some((c) => c.name.startsWith('Pilot')));

// 5) 연결 점검 (설정 → 데이터 → 서버)
await p.goto(B + '/ax/settings#data', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
await p.getByRole('button', { name: '연결 점검' }).first().click(); await p.waitForTimeout(6000);
const t5 = await p.evaluate(() => { const el = document.querySelector('#data') || document.body; return el.innerText; });
const lines = t5.split('\n').filter((x) => /연결 정보|서버 응답|서버 로그인|표 \d+|최신 설정|권한 함수|내 역할|파일 보관함|점검|통과|확인 필요|실패/.test(x)).slice(0, 20);
L('연결 점검 결과', '\n  ' + lines.join('\n  '));
ok('연결 점검: 실패 항목 없음', !/실패|막힘/.test(lines.join(' ')) );

// 6) ?demo=1 은 서버가 살아 있어도 안내를 띄운다(발표자용)
const { p: q } = await ctxFor(b, 'mobile');
await q.goto(B + '/login?demo=1', { waitUntil: 'domcontentloaded' }); await q.waitForTimeout(2500);
ok('?demo=1: 비상 전환 안내 표시(모바일)', await q.getByTestId('server-down').isVisible().catch(() => false));
L('page errors', p.errs.filter((e) => !/ERR_CERT|ERR_INTERNET_DISCONNECTED|Failed to fetch|favicon|\[sync\]|AuthRetryableFetchError/.test(e)).slice(0, 4).join(' || ') || 'OK 0');
await b.close();
process.exit(summary() ? 1 : 0);
