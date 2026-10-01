// 실제 사용 그대로: 대표가 PC에서 기업 3곳 등록(서류 읽기 포함) → 자동 갱신 2번 지나도 그대로 → 휴대폰 로그인에서도 3곳
// 사용: node realuse.mjs   (setup.sql 직후 대표 계정만 있는 상태에서도 된다)
import { launch, ctxFor, login, B, ACC, L, ok, sql, body, summary } from './lib.mjs';
const DOC = process.env.BIZREG_PDF || new URL('./files/', import.meta.url).pathname + 'pilot-a1.txt';
const b = await launch();
const { p } = await ctxFor(b, 'pc');
const banners = [];
p.on('console', (m) => { if (/\[sync\]/.test(m.text())) banners.push(m.text().slice(0, 300)); });
await login(p, ACC.ceo, /\/ax\//);
const dlg = () => p.locator('[role=dialog]:visible').last();
const before = Number(sql(`select count(*) from companies`));
const NAMES = ['실사용 검증 A (비식별)', '실사용 검증 B (비식별)', '실사용 검증 C (비식별)'];
for (const [i, name] of NAMES.entries()) {
  await p.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '기업고객 등록' }).first().click(); await p.waitForTimeout(600);
  if (i === 0 && process.env.BIZREG_PDF) {
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), dlg().getByRole('button', { name: /PDF 또는 사진 선택/ }).click()]);
    await fc.setFiles(DOC);
    await dlg().getByText('서류에서 읽어 채웠습니다').waitFor({ timeout: 40000 }).catch(() => {});
  }
  await dlg().getByLabel(/^기업명/).first().fill(name);
  if (!(await dlg().getByLabel(/^대표자/).first().inputValue())) await dlg().getByLabel(/^대표자/).first().fill('비식별 대표');
  if (i === 1) {
    await dlg().getByRole('button', { name: '10~29명', exact: true }).click().catch(() => {});
    await dlg().getByRole('button', { name: '대표와 동일' }).click().catch(() => {});
  }
  if (i === 2) {
    await dlg().getByLabel(/설립일|개업일/).first().fill('2015-03-02').catch(() => {});
    await dlg().getByLabel(/대표자 생년월일/).first().fill('1970-05-05').catch(() => {});
  }
  await dlg().getByRole('button', { name: '등록', exact: true }).click(); await p.waitForTimeout(3000);
  ok(`등록 ${i + 1}: 서버 저장`, sql(`select count(*) from companies where name='${name}'`) === '1', banners.slice(-1)[0] ?? '');
}
ok('서버 기업 수 +3', Number(sql(`select count(*) from companies`)) === before + 3);
// 자동 갱신(15초) 두 번 지나도 화면에 그대로
await p.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(35000);
const t = await body(p);
ok('PC: 35초 뒤에도 3곳 그대로', NAMES.every((n) => t.includes(n)));
// 휴대폰에서 같은 대표 계정
const { p: m } = await ctxFor(b, 'mobile');
await login(m, ACC.ceo, /\/ax\//);
await m.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await m.waitForTimeout(2500);
const mt = await body(m);
ok('휴대폰: 같은 3곳 보임', NAMES.every((n) => mt.includes(n)), NAMES.filter((n) => !mt.includes(n)).join(','));
ok('저장 실패 기록 없음', banners.length === 0, banners.join(' | '));
const fails = summary(); await b.close(); process.exit(fails ? 1 : 0);
