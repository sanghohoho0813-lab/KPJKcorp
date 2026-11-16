/**
 * 파일 형식 견고성 — 같은 합성 내역서(양식 V1~V8)를 다른 형식으로 바꿔 읽기 정확도를 잰다.
 *  · xlsx(우리 쓰기 도구) · xlsx(LibreOffice 재저장) · xls(Excel 97~2003, LibreOffice) · HTML 표(LibreOffice, 보이는 값만)
 *  · CSV(CP949, 천 단위 쉼표, 병합 정보 없음 — 첫 내역 시트만)
 * 잰 것: 열 역할 정확도(T1) · 항목 값 일치(T3; HTML · CSV 는 수량 0.5 이내) · 오류 없는 문서의 탐지 건수(오탐)
 * 실행: npx tsx lossguard/eval/formats.ts [--n 16] [--out lossguard/eval/results]   (soffice · iconv 필요)
 * 주의: 합성 자료를 LibreOffice 로 바꾼 것이다. 실제 엑셀 · ERP 가 만든 파일의 성능을 뜻하지 않는다.
 */
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readWorkbook } from "../engine/io/read";
import { readXlsx } from "../engine/io/xlsx";
import { analyze } from "../engine/analyze";
import { ENGINE_VERSION } from "../engine/version";
import pack from "../packs/construction-interior/index";
import { generateCase } from "../synth/index";
import type { GtSheet } from "../synth/render";

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const N = Number(opt("n", "16"));
const OUT = opt("out", "lossguard/eval/results");
const pc = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");
const TPLS = ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"];
const FORMATS = ["xlsx", "xlsx-lo", "xls", "html", "csv"] as const;
type Fmt = (typeof FORMATS)[number];
const csvField = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const shown = (n: number) => { const [i, f] = String(Math.abs(n)).split("."); return (n < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : ""); };

interface Acc { cols: number; colHit: number; items: number; itemHit: number; fp: number; docs: number; failed: number; ms: number }
const acc = () => ({ cols: 0, colHit: 0, items: 0, itemHit: 0, fp: 0, docs: 0, failed: 0, ms: 0 });

(async () => {
  const t0 = Date.now();
  const tot = new Map<Fmt, Acc>(FORMATS.map((f) => [f, acc()]));
  const byTpl = new Map<string, Acc>();
  const misses: string[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "lg-fmt-"));
  for (let k = 0; k < N; k++) {
    const tpl = TPLS[k % TPLS.length], seed = 9001 + k;
    const c = generateCase(seed, { split: "eval", contractTemplate: tpl, inject: false, noChange: true, noSettlement: true });
    const d = c.docs[0];
    const src = join(tmp, `c${k}.xlsx`);
    writeFileSync(src, d.bytes);
    for (const [filter, ext] of [["xlsx:Calc MS Excel 2007 XML", "xlsx"], ["xls:MS Excel 97", "xls"], ["html:HTML (StarCalc)", "html"]]) {
      execFileSync("soffice", ["--headless", "--convert-to", filter, "--outdir", join(tmp, ext), src], { stdio: "ignore" });
    }
    const gts = d.gt.filter((g) => g.kind === "detail");
    const wb0 = await readXlsx(new Uint8Array(d.bytes), "src.xlsx");
    const sh0 = wb0.sheets.find((s) => s.name === gts[0].name)!;
    const csvText = sh0.rows.map((r) => (r ?? []).map((x) => csvField(x.t === "num" ? shown(x.n!) : x.v)).join(",")).join("\r\n") + "\r\n";
    writeFileSync(join(tmp, `c${k}.u.csv`), csvText);
    const csvBytes = execFileSync("iconv", ["-f", "UTF-8", "-t", "CP949", join(tmp, `c${k}.u.csv`)]);
    const files: Record<Fmt, [Uint8Array, string, GtSheet[]]> = {
      xlsx: [new Uint8Array(d.bytes), "a.xlsx", gts],
      "xlsx-lo": [new Uint8Array(readFileSync(join(tmp, "xlsx", `c${k}.xlsx`))), "b.xlsx", gts],
      xls: [new Uint8Array(readFileSync(join(tmp, "xls", `c${k}.xls`))), "c.xls", gts],
      html: [new Uint8Array(readFileSync(join(tmp, "html", `c${k}.html`))), "d.html", gts],
      csv: [new Uint8Array(csvBytes), "e.csv", [gts[0]]],
    };
    for (const f of FORMATS) {
      const [bytes, name, gt] = files[f];
      const a = tot.get(f)!;
      const t = byTpl.get(`${tpl}|${f}`) ?? acc();
      a.docs++; t.docs++;
      let res;
      const s0 = Date.now();
      try {
        const wb = await readWorkbook(bytes, name);
        res = analyze({ docs: [{ docId: "c", kind: "contract", workbook: wb }], meta: { vat: "excluded" }, pack });
      } catch (e) { a.failed++; t.failed++; misses.push(`${tpl} ${f}: 읽기 실패 ${e instanceof Error ? e.message : e}`); continue; }
      a.ms += Date.now() - s0;
      const display = f === "html" || f === "csv";
      const sheets = res.docs[0].sheets.filter((x) => x.lines.length);
      for (const g of gt) {
        const sh = res.docs[0].sheets.find((x) => x.sheet === g.name) ?? (gt.length === 1 && sheets.length === 1 ? sheets[0] : undefined);
        const cols = g.columns.filter((x) => x.role !== "no" && x.role !== "note");
        for (const gc of cols) {
          a.cols++; t.cols++;
          if (sh?.columns.some((x) => x.col === gc.col && x.role === gc.role && (x.group ?? undefined) === (gc.group ?? undefined))) { a.colHit++; t.colHit++; }
          else if (misses.length < 60) misses.push(`${tpl} ${f} ${g.name}: 열 ${gc.col + 1} ${gc.group ? gc.group + "." : ""}${gc.role} → ${sh?.columns.find((x) => x.col === gc.col) ? (sh.columns.find((x) => x.col === gc.col)!.group ?? "") + "." + sh.columns.find((x) => x.col === gc.col)!.role : "없음"}`);
        }
        for (const it of g.rows.filter((r) => r.kind === "item")) {
          a.items++; t.items++;
          const l = sh?.lines.find((x) => x.row === it.row);
          if (l && l.kind === "item" && l.name === it.name && l.qty !== undefined && Math.abs(l.qty - (it.qty ?? NaN)) <= (display ? 0.5 : 1e-9) && Math.abs((l.amount ?? NaN) - (it.amount ?? NaN)) < 0.5) { a.itemHit++; t.itemHit++; }
        }
      }
      a.fp += res.findings.length; t.fp += res.findings.length;
      if (res.findings.length && misses.length < 60) misses.push(`${tpl} ${f}: 오류 없는 문서에서 탐지 ${res.findings.length}건 — ${res.findings.slice(0, 2).map((x) => x.title).join(" / ")}`);
      byTpl.set(`${tpl}|${f}`, t);
    }
  }
  let commit = "unknown", dirty = false;
  try { commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); dirty = execSync("git status --porcelain -- lossguard/engine lossguard/packs", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().length > 0; } catch { /* git 없음 */ }
  const md = [
    `# 파일 형식 견고성 (합성 자료) — 엔진 ${ENGINE_VERSION} · 커밋 ${commit}${dirty ? " (엔진 미커밋 변경 있음)" : ""}`, ``,
    `합성 내역서 ${N}건(양식 V1~V8 순환, 시드 9001~${9000 + N}, 오류 주입 없음)을 형식만 바꿔 읽었다. LibreOffice 변환본이며, 실제 엑셀 · ERP 가 만든 파일의 성능을 뜻하지 않는다.`,
    `HTML · CSV 는 보이는 값만 담기므로 수량은 0.5 이내를 맞은 것으로 센다. CSV 는 첫 내역 시트만, 병합 정보 없이 만든다.`, ``,
    `| 형식 | 문서 | 읽기 실패 | 열 역할(T1) | 항목 값(T3) | 오탐(오류 없는 문서의 탐지) | 평균 분석 시간 |`, `|---|---|---|---|---|---|---|`,
    ...FORMATS.map((f) => { const a = tot.get(f)!; return `| ${f} | ${a.docs} | ${a.failed} | ${pc(a.colHit, a.cols)} (${a.colHit}/${a.cols}) | ${pc(a.itemHit, a.items)} (${a.itemHit}/${a.items}) | ${a.fp} | ${a.docs - a.failed ? Math.round(a.ms / (a.docs - a.failed)) : "-"}ms |`; }),
    ``, `## 양식별(열 역할 / 항목 값)`, ``, `| 양식 | ${FORMATS.join(" | ")} |`, `|---|${FORMATS.map(() => "---").join("|")}|`,
    ...TPLS.map((tp) => `| ${tp} | ${FORMATS.map((f) => { const t = byTpl.get(`${tp}|${f}`); return t ? `${pc(t.colHit, t.cols)} / ${pc(t.itemHit, t.items)}${t.fp ? ` · 오탐 ${t.fp}` : ""}` : "-"; }).join(" | ")} |`),
    ``, `## 놓친 것(최대 60)`, ``, ...(misses.length ? misses.map((m) => `- ${m}`) : ["- 없음"]),
    ``, `총 ${((Date.now() - t0) / 1000).toFixed(1)}초`,
  ];
  mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(`${OUT}/${stamp}-${commit}-formats.md`, md.join("\n") + "\n");
  writeFileSync(`${OUT}/${stamp}-${commit}-formats.json`, JSON.stringify({ engine: ENGINE_VERSION, commit, dirty, n: N, totals: Object.fromEntries(tot), byTemplate: Object.fromEntries(byTpl), misses }, null, 1));
  console.log(md.join("\n"));
})();
