// 분석 · 재분석 일관성 — 같은 자료 + 같은 판단이면 같은 결과, 판단을 넣었다 거두면 처음 결과로, 판단의 순서 · 문서 순서와 무관
import { generateCase } from "../synth/index";
import { readXlsx } from "../engine/io/xlsx";
import { analyze } from "../engine/analyze";
import type { AnalyzeResult, DocInput, LinkDecision } from "../engine/types";
import pack from "../packs/construction-interior/index";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const sig = (r: AnalyzeResult) => JSON.stringify({ f: r.findings.map((f) => [f.key, f.amount]), l: r.links.map((l) => [l.a.fp, l.b.fp, l.b.docId, l.state, l.score]).sort(), h: r.versions.inputHash });

(async () => {
  let n = 0, same = 0, perm = 0, decOrder = 0, revert = 0, cases = 0;
  for (let seed = 301; seed <= 320; seed++) {
    const c = generateCase(seed, { split: seed % 2 ? "dev" : "eval" });
    const docs: DocInput[] = [];
    for (const d of c.docs) docs.push({ docId: d.docId, kind: d.kind, round: d.round, workbook: await readXlsx(d.bytes, d.fileName) });
    const base = analyze({ docs, meta: c.meta, pack });
    cases++;
    // 1) 같은 입력 두 번
    n++; if (sig(analyze({ docs, meta: c.meta, pack })) === sig(base)) same++;
    // 2) 문서 순서 거꾸로
    if (sig(analyze({ docs: [...docs].reverse(), meta: c.meta, pack })) === sig(base)) perm++;
    // 3) 사람 판단(확인 대기 → 같다, 자동 → 다르다)을 넣고 순서를 바꿔도 같은 결과
    const decs: LinkDecision[] = [
      ...base.links.filter((l) => l.state === "review").slice(0, 3).map((l) => ({ a: l.a.fp, b: l.b.fp, same: true })),
      ...base.links.filter((l) => l.state === "auto").slice(0, 2).map((l) => ({ a: l.a.fp, b: l.b.fp, same: false })),
    ];
    const r1 = analyze({ docs, meta: c.meta, pack, decisions: { links: decs } });
    const r2 = analyze({ docs, meta: c.meta, pack, decisions: { links: [...decs].reverse() } });
    if (sig(r1) === sig(r2)) decOrder++;
    // 4) 판단을 거두면(빈 판단) 처음 결과와 같다
    if (sig(analyze({ docs, meta: c.meta, pack, decisions: { links: [] } })) === sig(base)) revert++;
  }
  ok(same === n, `같은 입력 두 번 → 결과 · 연결 · 입력 지문이 글자 하나까지 같음 ${same}/${n}`);
  ok(perm === cases, `문서를 넣는 순서를 거꾸로 해도 같음 ${perm}/${cases}`);
  ok(decOrder === cases, `사람 판단의 순서를 바꿔도 같음 ${decOrder}/${cases}`);
  ok(revert === cases, `판단을 거두면 처음 결과로 돌아감 ${revert}/${cases}`);
  process.exit(fail ? 1 : 0);
})();
