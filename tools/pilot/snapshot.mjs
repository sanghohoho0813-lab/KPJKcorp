// 고객 화면 "우리 회사 한눈에" — 담당자가 재무제표 숫자를 넣으면 고객 대표 휴대폰에 숫자로 보인다
//  1) 컨설턴트(PC): 기업 상세 → 재무·계약 현황 → 2개년 매출 입력("42억" · "38억 5천만") · 계약 시작일 → 서버에 저장
//  2) 고객(휴대폰): 홈 "우리 회사 한눈에" → 최근 매출 · 전년 대비 +9.1% · 계약 N일차 · 연도별 막대 2개 · 성장 퀘스트
//  3) 고객: 우리 회사 화면 — 사업자등록번호 보임, 내부 메모·대표자 생년월일 안 보임, 서류는 확인일만
//  4) 고객은 재무를 고칠 수 없다 — 고객 토큰으로 직접 보내도 서버가 막는다
import { readFileSync } from 'node:fs';
import { launch, ctxFor, login, B, ACC, CO1, ok, sql, summary, SB } from './lib.mjs';

const TAG = Date.now().toString(36).slice(-5);
const co = sql(`select id from public.companies where name = '${CO1}' limit 1`);
const y = new Date().getFullYear() - 1;
// 내부 칸(고객에게 보이면 안 되는 값)을 미리 넣어 둔다
sql(`update public.companies set memo = '내부 메모 ${TAG}', ceo_birth = '1971-02-03', biz_no = '000-81-12345', financials = '[]'::jsonb, contract_started_at = null,
  docs = jsonb_build_object('bizReg', jsonb_build_object('fileName','시험.pdf','size',1,'readAt','2026-09-20T01:00:00Z','method','paste','fields','[]'::jsonb)) where id = '${co}'`);

const b = await launch();
try {
  // 1) 컨설턴트 입력
  const { p } = await ctxFor(b, 'pc');
  await login(p, ACC.con, /\/ax\//);
  await p.goto(`${B}/ax/clients/${co}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  const card = p.locator('#financials-card');
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: '입력하기' }).click(); await p.waitForTimeout(300);
  await card.getByLabel('연도').first().fill(String(y));
  await card.getByLabel('매출').first().fill('42억');
  await card.getByRole('button', { name: '연도 추가' }).click();
  await card.getByLabel('매출').nth(1).fill('38억 5천만');
  await card.getByTestId('fin-save').click(); await p.waitForTimeout(800);
  const start = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  await card.getByTestId('contract-start').fill(start);
  await card.getByTestId('contract-start').blur(); await p.waitForTimeout(3500);
  const fin = JSON.parse(sql(`select financials::text from public.companies where id = '${co}'`) || '[]');
  ok('1 서버: 연도별 재무 2개년 저장', fin.length === 2 && fin.find((f) => f.year === y)?.revenue === 4_200_000_000 && fin.find((f) => f.year === y - 1)?.revenue === 3_850_000_000, JSON.stringify(fin.map((f) => [f.year, f.revenue])));
  ok('1 서버: 계약 시작일 저장', sql(`select contract_started_at from public.companies where id = '${co}'`) === start);
  ok('1 페이지 오류 없음 (컨설턴트)', p.errs.filter((e) => !/Failed to load resource|favicon|ERR_CERT/.test(e)).length === 0, p.errs.slice(0, 2).join(' | '));

  // 2) 고객 휴대폰
  const { p: c } = await ctxFor(b, 'mobile');
  await login(c, ACC.c1, /\/portal/);
  await c.goto(`${B}/portal`, { waitUntil: 'domcontentloaded' }); await c.waitForTimeout(3000);
  const snap = c.getByTestId('company-snapshot');
  const t = await snap.innerText();
  ok('2 고객: 최근 매출 42억', /42억 원/.test(t), t.match(/\d+억[^\n]*/)?.[0]);
  ok('2 고객: 전년 대비 +9.1%', /전년 대비 \+9\.1%/.test(t));
  ok('2 고객: 계약 15일차', /15\s*일차/.test(t), t.match(/\d+\s*일차/)?.[0]);
  ok('2 고객: 연도별 막대 2개', (await c.getByTestId('revenue-bars').getByRole('listitem').count()) === 2);
  await c.getByTestId('growth-quests').getByRole('button', { name: /더 보기/ }).click().catch(() => {});
  ok('2 고객: "전년보다 매출 키우기" 완료', (await c.getByTestId('quest-growth').getAttribute('data-done')) === '1');
  ok('2 고객: 재무 퀘스트 2/3', /2\/3/.test(await c.getByTestId('quest-financials').innerText()));
  ok('2 가로 넘침 없음', (await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) === 0);

  // 3) 우리 회사 화면 — 보이는 것 / 안 보이는 것
  await c.goto(`${B}/portal/company`, { waitUntil: 'domcontentloaded' }); await c.waitForTimeout(2500);
  const body = await c.locator('body').innerText();
  ok('3 사업자등록번호 보임', /000-81-12345/.test(body));
  ok('3 내부 메모 안 보임', !body.includes(`내부 메모 ${TAG}`));
  ok('3 대표자 생년월일 안 보임 (화면)', !/1971/.test(body));
  ok('3 대표자 생년월일·메모가 고객 브라우저에 아예 안 옴', !(await c.evaluate(() => JSON.stringify(window.__kpjkState?.().companies ?? []))).match(/1971-02-03|내부 메모/));
  ok('3 근거 서류는 확인일만', /사업자등록증 확인 · 2026-09-20/.test(await c.getByTestId('facts-docs').innerText()), await c.getByTestId('facts-docs').innerText());

  // 4) 고객은 고칠 수 없다 — 고객 로그인 토큰으로 서버에 직접 고치기를 보내 본다
  const tok = await c.evaluate(() => { try { return JSON.parse(localStorage.getItem('kpjk-auth') ?? '{}').access_token ?? ''; } catch { return ''; } });
  const anon = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim();
  const before = sql(`select financials::text from public.companies where id = '${co}'`);
  const res = await fetch(`${SB}/rest/v1/companies?id=eq.${co}`, { method: 'PATCH', headers: { apikey: anon, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ financials: [{ year: 2000, revenue: 1 }] }) });
  const got = await res.json().catch(() => null);
  ok('4 고객이 재무를 고치려 하면 서버가 막음', !!tok && Array.isArray(got) && got.length === 0 && sql(`select financials::text from public.companies where id = '${co}'`) === before, `${res.status} ${JSON.stringify(got)?.slice(0, 80)}`);
  ok('페이지 오류 없음 (고객)', c.errs.filter((e) => !/Failed to load resource|favicon|ERR_CERT/.test(e)).length === 0, c.errs.slice(0, 2).join(' | '));
} finally {
  sql(`update public.companies set memo = '', ceo_birth = null, financials = '[]'::jsonb, contract_started_at = null, docs = null where id = '${co}'`);
  await b.close();
}
process.exit(summary() ? 1 : 0);
