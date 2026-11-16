/**
 * 실제 자료 점검용 명령줄 도구 — 실증기업 자료를 저장소 밖(또는 lossguard/private/)에서 돌려 읽기 결과와 탐지 결과를 본다.
 * 결과 파일에는 원본 자료의 일부(품명 · 금액)가 들어가므로 기본 저장 위치는 커밋되지 않는 lossguard/private/ 다.
 *
 * 실행 예:
 *   npx tsx lossguard/cli/analyze.ts --doc contract=/자료/계약내역서.xlsx --doc change:1=/자료/변경1차.xlsx \
 *     --doc settlement=/자료/정산서.xlsx --amount 125000000 --vat excluded --change 1:prev=125000000,new=131500000
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { CaseMeta, DocInput, DocKind } from "../engine/types";
import { readXlsx } from "../engine/io/xlsx";
import { analyze } from "../engine/analyze";
import { fmt } from "../engine/detect/common";
import pack from "../packs/construction-interior/index";

const args = process.argv.slice(2);
const docs: { kind: DocKind; round?: number; path: string }[] = [];
const meta: CaseMeta = { vat: "excluded", changes: [] };
let out = resolve(__dirname, "..", "private", new Date().toISOString().replace(/[:.]/g, "-"));
for (let i = 0; i < args.length; i++) {
  const a = args[i], v = args[i + 1];
  if (a === "--doc") { const [k, p] = v.split("="); const [kind, round] = k.split(":"); docs.push({ kind: kind as DocKind, round: round ? Number(round) : undefined, path: p }); i++; }
  else if (a === "--amount") { meta.contractAmount = Number(v.replace(/,/g, "")); i++; }
  else if (a === "--vat") { meta.vat = v === "included" ? "included" : "excluded"; i++; }
  else if (a === "--change") { const [r, rest] = v.split(":"); const o: Record<string, number> = {}; for (const kv of rest.split(",")) { const [k, n] = kv.split("="); o[k] = Number(n.replace(/,/g, "")); } meta.changes!.push({ round: Number(r), prevAmount: o.prev, newAmount: o.new }); i++; }
  else if (a === "--out") { out = resolve(v); i++; }
}
if (!docs.length) {
  console.log("사용법: npx tsx lossguard/cli/analyze.ts --doc contract=파일.xlsx [--doc change:1=파일.xlsx] [--doc settlement=파일.xlsx] [--amount 계약금액] [--vat excluded|included] [--change 1:prev=직전금액,new=변경금액] [--out 폴더]");
  process.exit(1);
}
const repo = resolve(__dirname, "..", "..");
if (out.startsWith(repo) && !out.startsWith(resolve(repo, "lossguard", "private"))) console.warn("주의: 결과를 저장소 안(lossguard/private/ 밖)에 씁니다. 원본 자료가 들어 있으니 커밋하지 마세요.");

(async () => {
  const inputs: DocInput[] = [];
  const files: string[] = [];
  for (const [i, d] of docs.entries()) {
    const bytes = new Uint8Array(readFileSync(d.path));
    const sha = createHash("sha256").update(bytes).digest("hex");
    const wb = await readXlsx(bytes, basename(d.path));
    inputs.push({ docId: `${d.kind}${d.round ?? ""}-${i + 1}`, kind: d.kind, round: d.round, workbook: wb });
    files.push(`| ${d.kind}${d.round ? ` ${d.round}차` : ""} | ${basename(d.path)} | ${bytes.length.toLocaleString()} 바이트 | ${sha.slice(0, 16)}… | 시트 ${wb.sheets.length}개 |`);
  }
  const t0 = Date.now();
  const res = analyze({ docs: inputs, meta, pack });
  const ms = Date.now() - t0;
  const md: string[] = [
    `# LossGuard 점검 결과 (내부 확인용 · 원본 자료 포함 — 커밋 금지)`,
    ``,
    `엔진 ${res.versions.engine} · 업종 묶음 ${res.versions.pack} · 입력 지문 ${res.versions.inputHash} · 분석 ${ms}ms · 계약금액 ${meta.contractAmount !== undefined ? fmt(meta.contractAmount) : "입력 안 함"} (${meta.vat === "included" ? "부가세 포함" : "부가세 별도"})`,
    ``,
    `## 입력 파일`, ``, `| 종류 | 파일 | 크기 | SHA-256 | 시트 |`, `|---|---|---|---|---|`, ...files,
    ``, `## 읽기 결과`,
  ];
  for (const d of res.docs) for (const s of d.sheets) {
    const kinds = new Map<string, number>();
    for (const l of s.lines) kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + 1);
    md.push(``, `### ${d.docId} / ${s.sheet} — ${s.kind}${s.hidden ? " (숨긴 시트)" : ""} · 신뢰도 ${s.confidence}${s.confidence < pack.params.confidenceThreshold && s.lines.length ? " ⚠ 열 지정 확인 필요" : ""}`);
    md.push(`머리글 ${s.headerRows.map((r) => r + 1).join(", ") || "없음"}행 · 줄 ${[...kinds.entries()].map(([k, n]) => `${k} ${n}`).join(" · ") || "없음"} · 줄 계산 ${s.checks.arithOk}/${s.checks.arithRows} · 합계 ${s.checks.totalOk}/${s.checks.totalRows}`);
    if (s.columns.length) md.push(``, `| 열 | 머리글 | 역할 | 근거(이름 · 모양 · 계산) |`, `|---|---|---|---|`, ...s.columns.map((c) => `| ${c.col + 1} | ${c.label || "(없음)"} | ${c.group ? c.group + "." : ""}${c.role} | ${c.via} · ${c.evidence.name} · ${c.evidence.shape.toFixed(2)} · ${c.evidence.arith.toFixed(2)} |`));
    if (s.coverAmounts.length) md.push(``, `표지 금액: ${s.coverAmounts.map((a) => `${a.row + 1}행 '${a.label}' ${fmt(a.amount)}`).join(" · ")}`);
    if (s.diagnostics.length) md.push(``, ...s.diagnostics.map((x) => `- ${x}`));
  }
  md.push(``, `## 탐지 결과 ${res.findings.length}건`, ``, `| 심각도 | 탐지 | 내용 | 근거 위치 | 문제가 아닐 수 있는 경우 |`, `|---|---|---|---|---|`);
  for (const f of res.findings) md.push(`| ${f.severity} | ${f.detector}/${f.check} | ${f.title} — ${f.message} | ${f.evidence.map((e) => `${e.fileName} ${e.sheet} ${e.row + 1}행`).join("; ")} | ${f.caveat ?? ""} |`);
  const byDoc = new Map<string, { auto: number; review: number }>();
  for (const l of res.links) { const x = byDoc.get(l.b.docId) ?? { auto: 0, review: 0 }; if (l.state === "review") x.review++; else x.auto++; byDoc.set(l.b.docId, x); }
  md.push(``, `## 문서 간 항목 연결`, ...[...byDoc.entries()].map(([k, v]) => `- ${k}: 자동 ${v.auto} · 확인 대기 ${v.review}`));
  const review = res.links.filter((l) => l.state === "review").slice(0, 40);
  if (review.length) {
    const lineOf = (docId: string, sheet: string, row: number) => res.docs.find((d) => d.docId === docId)?.sheets.find((s) => s.sheet === sheet)?.lines.find((l) => l.row === row);
    md.push(``, `확인 대기(같은 항목인지 담당자와 확인):`, ``, `| 기준 문서 | 비교 문서 | 점수 | 항목별 |`, `|---|---|---|---|`);
    for (const l of review) { const a = lineOf(l.a.docId, l.a.sheet, l.a.row), b = lineOf(l.b.docId, l.b.sheet, l.b.row); md.push(`| ${a?.name} ${a?.spec} (${l.a.sheet} ${l.a.row + 1}행) | ${b?.name} ${b?.spec} (${l.b.sheet} ${l.b.row + 1}행) | ${l.score} | ${Object.entries(l.parts).map(([k, v]) => `${k} ${v}`).join(" · ")} |`); }
  }
  const lin = new Map<string, number>();
  for (const x of res.lineage) lin.set(x.status, (lin.get(x.status) ?? 0) + 1);
  if (res.lineage.length) md.push(``, `## 변경 계보`, `${[...lin.entries()].map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  if (res.skipped.length) md.push(``, `## 돌리지 않은 점검`, ...res.skipped.map((s) => `- ${s.detector}: ${s.reason}`));
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, "report.md"), md.join("\n") + "\n");
  writeFileSync(resolve(out, "result.json"), JSON.stringify({ meta, versions: res.versions, findings: res.findings, links: res.links, lineage: res.lineage, sheets: res.docs.map((d) => d.sheets.map((s) => ({ docId: d.docId, sheet: s.sheet, kind: s.kind, confidence: s.confidence, checks: s.checks, columns: s.columns, headerRows: s.headerRows, diagnostics: s.diagnostics }))) }, null, 2));
  console.log(md.join("\n"));
  console.log(`\n저장: ${out}/report.md · result.json (원본 자료 포함 — 커밋하지 마세요)`);
})().catch((e) => { console.error("읽지 못했습니다:", e instanceof Error ? e.message : e); process.exit(1); });
