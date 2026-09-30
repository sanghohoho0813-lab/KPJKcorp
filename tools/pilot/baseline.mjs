// 조직 공용 설정(도입 전 기준선 조사)이 실제 서버에 저장되고 다른 브라우저에서 보이는가
import { launch, ctxFor, login, B, ACC, ok, sql, summary, state } from './lib.mjs';
const b = await launch();
const { p } = await ctxFor(b, 'pc');
await login(p, ACC.ceo, /\/ax\//);
await p.goto(B + '/ax/baseline', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
const opt = (q, l) => p.getByRole('group', { name: new RegExp(q) }).getByRole('button', { name: l, exact: true });
await opt('실제로 받기까지', '1~2일').click();
await p.getByRole('button', { name: '임시저장' }).click(); await p.waitForTimeout(2000);
ok('기준선 임시저장 → 서버', sql(`select coalesce(jsonb_array_length(baseline_surveys),0) from app_settings where id=1`) !== '0');
for (let i = 0; i < 6; i++) { await p.getByRole('button', { name: '다음' }).click(); await p.waitForTimeout(250); }
await p.getByRole('button', { name: '제출' }).click(); await p.waitForTimeout(2500);
ok('기준선 제출 → 서버 기준값 연동', sql(`select baseline->>'docLeadDays' from app_settings where id=1`) === '1.5');
ok('저장 실패 경고 없음', !(await p.evaluate(() => document.body.innerText)).includes('저장 실패'));
const { p: q } = await ctxFor(b, 'mobile');
await login(q, ACC.ceo, /\/ax\//);
ok('다른 브라우저에서 같은 기준선', (await state(q)).settings.baseline?.docLeadDays === 1.5);
ok('화면 오류 없음', p.errs.filter((e) => !/ERR_CERT/.test(e)).length === 0, p.errs.slice(0, 2).join(' | '));
await b.close();
process.exit(summary() ? 1 : 0);
