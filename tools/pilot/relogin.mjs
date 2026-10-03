// 로그인이 끊기는 상황 — 쓰던 내용이 사라지지 않는가, 일시 장애에 로그아웃되지 않는가
//  1) 서버가 잠깐 500·429 를 내도 로그아웃되지 않는다 (화면·로그인 유지, 다시 로그인 창도 안 뜸)
//  2) 고객이 문의를 쓰는 중에 서버에서 세션이 끝남 → 15초 안에 "다시 로그인" 창 · 주소·쓰던 글 그대로
//     → 틀린 비밀번호는 창에서 안내 → 맞는 비밀번호 → 창 닫힘 → 그대로 보내기 → 서버에 저장
//  3) 로그인 유효시간이 지나 갱신도 안 되는 상태에서 보낸 문의 → 손님 권한으로 보내지 않고 보관 → 다시 로그인 창(저장 대기 표시)
//     → 다시 로그인하면 서버에 저장
//  4) 새로고침했더니 로그인이 끝나 있음 → 로그인 화면에 이유 → 로그인하면 보던 화면으로
//  5) 계정 중지 → 로그인 화면으로 + "사용이 중지된 계정" 안내
import { launch, ctxFor, login, B, ACC, ok, sql, summary, state } from './lib.mjs';

const TAG = Date.now().toString(36).slice(-5);
const uid = (email) => sql(`select id from auth.users where email = '${email}'`);
const endSessions = (email) => sql(`delete from auth.sessions where user_id = '${uid(email)}'`);
// 이 브라우저의 로그인 토큰을 "유효시간 지남"으로 바꾼다 (갱신 토큰은 위에서 서버가 이미 끝냄)
const expireLocal = (p) => p.evaluate(() => { const v = JSON.parse(localStorage.getItem('kpjk-auth')); v.expires_at = Math.floor(Date.now() / 1000) - 60; localStorage.setItem('kpjk-auth', JSON.stringify(v)); });
const relogin = (p) => p.getByTestId('relogin');
const realErrs = (p) => p.errs.filter((e) => !/Failed to load resource|favicon|ERR_CERT|AuthApiError|Invalid Refresh Token|session_not_found|Session from session_id/i.test(e));

const b = await launch();

// 1) 일시 장애
{
  const { p, ctx } = await ctxFor(b, 'pc');
  await login(p, ACC.con, /\/ax\//);
  await p.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  await p.route(/\/rest\/v1\/profiles/, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"upstream error","code":"XX000"}' }));
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(5000);
  await p.unroute(/\/rest\/v1\/profiles/);
  await p.route(/\/auth\/v1\/user/, (r) => r.fulfill({ status: 429, contentType: 'application/json', body: '{"message":"rate limit"}' }));
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(5000);
  const s = await state(p);
  ok('1 서버 500·429 에도 로그인 유지', !!s?.session && s.serverMode === true);
  ok('1 화면 그대로 (로그인 화면으로 안 감)', /\/ax\/clients/.test(p.url()), p.url());
  ok('1 다시 로그인 창 안 뜸', !(await relogin(p).isVisible().catch(() => false)));
  await p.unroute(/\/auth\/v1\/user/);
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(4000);
  ok('1 복구 뒤 연결 안내 사라짐', !(await state(p))?.syncError, (await state(p))?.syncError ?? '');
  await ctx.close();
}

// 2) 쓰는 중에 세션이 끝남
const newInquiry = async (p, title, text) => {
  await p.goto(B + '/portal/inquiries', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  await p.getByRole('button', { name: '새 문의' }).first().click(); await p.waitForTimeout(500);
  const dlg = p.locator('[role=dialog]').filter({ has: p.getByRole('button', { name: '문의 보내기' }) }).last();
  await dlg.locator('input').first().fill(title);
  await dlg.locator('textarea').first().fill(text);
  return dlg;
};
{
  const { p, ctx } = await ctxFor(b, 'mobile');
  await login(p, ACC.c1, /\/portal/);
  const T = `세션 시험 ${TAG}`, TXT = '쓰던 중인 긴 문의 내용입니다. 사라지면 안 됩니다.';
  const dlg = await newInquiry(p, T, TXT);
  endSessions(ACC.c1.id);
  await relogin(p).waitFor({ timeout: 25000 }).catch(() => {});
  ok('2 세션 끝남 → 다시 로그인 창', await relogin(p).isVisible().catch(() => false));
  ok('2 주소 그대로', /\/portal\/inquiries/.test(p.url()), p.url());
  ok('2 쓰던 글 그대로', (await dlg.locator('textarea').first().inputValue()) === TXT);
  ok('2 계정 표시', (await relogin(p).innerText()).includes(ACC.c1.id));
  await relogin(p).locator('input[type=password]').fill('wrong-password-1');
  await relogin(p).getByRole('button', { name: '로그인하고 이어가기' }).click(); await p.waitForTimeout(2500);
  ok('2 틀린 비밀번호 → 창에서 안내', await relogin(p).getByRole('alert').isVisible().catch(() => false));
  await relogin(p).locator('input[type=password]').fill(ACC.c1.pw);
  await relogin(p).getByRole('button', { name: '로그인하고 이어가기' }).click(); await p.waitForTimeout(3500);
  ok('2 맞는 비밀번호 → 창 닫힘', !(await relogin(p).isVisible().catch(() => false)));
  ok('2 쓰던 글 여전히 그대로', (await dlg.locator('textarea').first().inputValue()) === TXT);
  await dlg.getByRole('button', { name: '문의 보내기' }).click(); await p.waitForTimeout(4000);
  ok('2 이어서 보낸 문의 서버 저장', sql(`select count(*) from public.inquiries where title = '${T}'`) === '1');
  ok('2 페이지 오류 없음', realErrs(p).length === 0, realErrs(p).slice(0, 2).join(' | '));
  await ctx.close();
}

// 3) 갱신도 안 되는 상태에서 보냄 → 보관 → 다시 로그인하면 저장
{
  const { p, ctx } = await ctxFor(b, 'mobile');
  await login(p, ACC.c1, /\/portal/);
  const T = `보관 시험 ${TAG}`;
  const dlg = await newInquiry(p, T, '로그인이 풀린 채 보낸 문의');
  endSessions(ACC.c1.id);
  await expireLocal(p);
  await dlg.getByRole('button', { name: '문의 보내기' }).click();
  await relogin(p).waitFor({ timeout: 15000 }).catch(() => {});
  ok('3 보내는 순간 다시 로그인 창', await relogin(p).isVisible().catch(() => false));
  ok('3 저장 대기 표시', await p.getByTestId('relogin-unsaved').isVisible().catch(() => false), await p.getByTestId('relogin-unsaved').innerText().catch(() => ''));
  ok('3 손님 권한으로 보내지 않음 (서버에 아직 없음)', sql(`select count(*) from public.inquiries where title = '${T}'`) === '0');
  ok('3 화면에는 보낸 문의가 보임', (await p.locator('body').innerText()).includes(T));
  await relogin(p).locator('input[type=password]').fill(ACC.c1.pw);
  await relogin(p).getByRole('button', { name: '로그인하고 이어가기' }).click(); await p.waitForTimeout(5000);
  ok('3 다시 로그인 → 창 닫힘', !(await relogin(p).isVisible().catch(() => false)));
  ok('3 보관했던 문의 서버 저장', sql(`select count(*) from public.inquiries where title = '${T}'`) === '1');
  ok('3 저장 대기 0', ((await state(p))?.unsaved ?? 0) === 0);
  ok('3 페이지 오류 없음', realErrs(p).length === 0, realErrs(p).slice(0, 2).join(' | '));
  await ctx.close();
}

// 4) 새로고침했더니 로그인이 끝나 있음
{
  const { p, ctx } = await ctxFor(b, 'mobile');
  await login(p, ACC.c1, /\/portal/);
  await p.goto(B + '/portal/documents', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  endSessions(ACC.c1.id);
  await expireLocal(p);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1500);
  ok('4 로그인 화면으로', /\/login/.test(p.url()), p.url());
  const note = await p.getByTestId('signout-notice').innerText().catch(() => '');
  ok('4 이유 안내', /유효시간/.test(note), note);
  await p.getByLabel('아이디 (이메일)').fill(ACC.c1.id);
  await p.locator('input[type=password]').first().fill(ACC.c1.pw);
  await p.getByRole('button', { name: '로그인', exact: true }).click();
  await p.waitForURL(/\/portal\/documents/, { timeout: 15000 }).catch(() => {});
  ok('4 로그인하면 보던 화면으로', /\/portal\/documents/.test(p.url()), p.url());
  await ctx.close();
}

// 5) 계정 중지
{
  const { p, ctx } = await ctxFor(b, 'pc');
  await login(p, ACC.con, /\/ax\//);
  await p.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
  const id = uid(ACC.con.id);
  sql(`update public.profiles set active = false where id = '${id}'`);
  try {
    await p.evaluate(() => window.dispatchEvent(new Event('focus')));
    await p.waitForURL(/\/login/, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1200);
    ok('5 계정 중지 → 로그인 화면', /\/login/.test(p.url()), p.url());
    const note = await p.getByTestId('signout-notice').innerText().catch(() => '');
    ok('5 중지 안내', /중지된 계정/.test(note), note);
    ok('5 다시 로그인 창은 아님', !(await relogin(p).isVisible().catch(() => false)));
  } finally {
    sql(`update public.profiles set active = true where id = '${id}'`);
  }
  await ctx.close();
}

sql(`delete from public.inquiries where title like '%시험 ${TAG}'`);
await b.close();
process.exit(summary() ? 1 : 0);
