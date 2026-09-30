// 서버 모드 전 화면 — 오해를 부르는 데모 표시가 남았는지 (대표·컨설턴트·고객, PC·모바일)
import { launch, ctxFor, login, B, ACC, L, ok, sql, summary, state } from './lib.mjs';
const PAT = /DEMO|데모|Demo|샘플|브라우저에만|브라우저 안에서|이 브라우저|시연용|가상|예시 데이터/g;
const AX = ['/ax/dashboard', '/ax/brief', '/ax/tasks', '/ax/opportunities', '/ax/clients', '/ax/clients?view=board', '/ax/consultations', '/ax/projects', '/ax/documents', '/ax/results', '/ax/inquiries', '/ax/schedule', '/ax/reports', '/ax/baseline', '/ax/coach', '/ax/survey', '/ax/why', '/ax/settings'];
const PORTAL = ['/portal', '/portal/projects', '/portal/documents', '/portal/results', '/portal/inquiries', '/portal/schedule', '/portal/services', '/portal/notifications', '/portal/me'];
const co = sql(`select id from companies where name like 'Pilot 검증기업 A%'`);
const pj = sql(`select id from projects where company_id='${co}' limit 1`);
const TABS = ['overview', 'work', 'vault', 'docs', 'money', 'consult', 'schedule', 'portal', 'journal', 'history'];
const b = await launch();
const hits = {};
async function sweep(p, who, routes) {
  for (const r of routes) {
    await p.goto(B + r, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1300);
    const t = await p.evaluate(() => document.body.innerText);
    const lines = t.split('\n').filter((x) => { PAT.lastIndex = 0; return PAT.test(x); });
    for (const x of lines) { const k = x.trim().slice(0, 140); (hits[k] ??= new Set()).add(`${who} ${r}`); }
  }
}
for (const [who, acc, kind, routes] of [
  ['대표PC', ACC.ceo, 'pc', [...AX, `/ax/clients/${co}`, ...TABS.map((t) => `/ax/clients/${co}?tab=${t}`), `/ax/projects/${pj}`]],
  ['컨설턴트M', ACC.con, 'mobile', [...AX, `/ax/clients/${co}`, `/ax/projects/${pj}`]],
  ['고객PC', ACC.c1, 'pc', PORTAL],
  ['고객M', ACC.c1, 'mobile', PORTAL],
]) {
  const { p } = await ctxFor(b, kind);
  await login(p, acc, /\/(ax|portal)/);
  await sweep(p, who, routes);
  L(`${who} 화면 오류`, p.errs.filter((e) => !/ERR_CERT|favicon/.test(e)).slice(0, 3).join(' || ') || 'OK 0');
  await p.context().close();
}
console.log('\n--- 데모성 표현이 보인 줄 ---');
for (const [k, v] of Object.entries(hits)) console.log(`• ${k}\n    ← ${[...v].slice(0, 4).join(', ')}${v.size > 4 ? ` 외 ${v.size - 4}` : ''}`);
ok('DEMO DATA 표기 없음', !Object.keys(hits).some((k) => /DEMO DATA/.test(k)));
await b.close();
process.exit(summary() ? 1 : 0);
