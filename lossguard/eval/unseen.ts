/**
 * 개발 · 평가에 쓰지 않은 씨앗(41~240)으로 열 인식 다시 재기 — 같은 생성기지만 개발 중 본 적 없는 조합.
 * 이 측정으로 "공종코드를 품명으로 읽는" 오류를 찾았다(DEV_RECORD). 고치기 전 기록: 시트 500개 중 10개 오인식(T1 99.74%).
 * 실행: npx tsx lossguard/eval/unseen.ts [--out lossguard/eval/results]
 * 주의: 합성 자료다. 같은 생성기에서 나온 것이므로 실제 양식의 다양성을 대신하지 못한다.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { generateCase } from "../synth/index";
import { readXlsx } from "../engine/io/xlsx";
import { analyze } from "../engine/analyze";
import { ENGINE_VERSION } from "../engine/version";
import pack from "../packs/construction-interior/index";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "lossguard/eval/results";
(async () => {
  let n = 0, hit = 0, sheets = 0, bad = 0, cleanDocs = 0, fp = 0, items = 0, itemHit = 0;
  const badList: string[] = [];
  for (let seed = 41; seed <= 240; seed++) {
    const c = generateCase(seed, { split: seed % 2 ? "dev" : "eval" });
    const docs = [];
    for (const d of c.docs) docs.push({ docId: d.docId, kind: d.kind, round: d.round, workbook: await readXlsx(d.bytes, d.fileName) });
    const r = analyze({ docs, meta: c.meta, pack });
    for (const d of c.docs) for (const g of d.gt.filter((x) => x.kind === "detail")) {
      const sh = r.docs.find((x) => x.docId === d.docId)!.sheets.find((s) => s.sheet === g.name)!;
      sheets++;
      let good = true;
      for (const gc of g.columns.filter((x) => x.role !== "no" && x.role !== "note")) { n++; if (sh.columns.some((x) => x.col === gc.col && x.role === gc.role && (x.group ?? undefined) === (gc.group ?? undefined))) hit++; else good = false; }
      for (const gr of g.rows.filter((x) => x.kind === "item")) { items++; const l = sh.lines.find((x) => x.row === gr.row); if (l && l.name === gr.name && l.qty === gr.qty && l.amount === gr.amount) itemHit++; }
      if (!good) { bad++; if (badList.length < 20) badList.push(`씨앗 ${seed} · ${d.docId} · 양식 ${g.template}`); }
    }
    if (!c.errors.length) { cleanDocs += c.docs.length; fp += r.findings.length; }
  }
  let commit = "unknown";
  try { commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* 없음 */ }
  const md = [
    `# 처음 보는 씨앗(41~240)의 열 인식 — 엔진 ${ENGINE_VERSION} · 커밋 ${commit} (합성 자료)`, "",
    `| 지표 | 값 |`, `|---|---|`,
    `| 세부 시트 | ${sheets} |`, `| 열을 하나라도 틀린 시트 | ${bad} |`, `| 핵심 열 정확도(T1) | ${((100 * hit) / n).toFixed(2)}% (${hit}/${n}) |`,
    `| 항목 값 일치(품명 · 수량 · 금액) | ${((100 * itemHit) / items).toFixed(2)}% (${itemHit}/${items}) |`, `| 오류를 넣지 않은 현장의 문서 ${cleanDocs}개에서 나온 결과 | ${fp}건 |`, "",
    "고치기 전(엔진 0.4.0, 커밋 61405ba): 열을 틀린 시트 10개 · T1 99.74%(3,847/3,857) — DEV_RECORD §5.", "",
    ...(badList.length ? ["## 틀린 시트", "", ...badList.map((b) => `- ${b}`)] : []),
  ];
  mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(`${OUT}/${stamp}-${commit}-unseen.md`, md.join("\n") + "\n");
  console.log(md.join("\n"));
})();
