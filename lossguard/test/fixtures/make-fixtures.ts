/**
 * 시험 파일 만들기 — 합성 현장(가상)을 우리 쓰기 도구로 xlsx 로 만든 뒤 LibreOffice 로 다시 저장한다.
 * 다른 프로그램이 쓴 xlsx(공유 문자열 · 스타일 · 병합 표기 방식이 다름)를 읽을 수 있는지 시험하기 위함.
 * 실행: npx tsx lossguard/test/fixtures/make-fixtures.ts   (soffice 필요)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCase } from "../../synth/index";

const here = __dirname;
const picks: [string, string, number][] = [["v2", "V2", 801], ["v6", "V6", 802], ["v8", "V8", 803]];
for (const [tag, tpl, seed] of picks) {
  const c = generateCase(seed, { split: "eval", contractTemplate: tpl, inject: false, noChange: true, noSettlement: true });
  const d = c.docs[0];
  const tmp = mkdtempSync(join(tmpdir(), "lg-fx-"));
  const src = join(tmp, `synthetic-src-${tag}.xlsx`);
  writeFileSync(src, d.bytes);
  const outDir = mkdtempSync(join(tmpdir(), "lg-fx-out-"));
  execFileSync("soffice", ["--headless", "--convert-to", "xlsx:Calc MS Excel 2007 XML", "--outdir", outDir, src], { stdio: "ignore" });
  renameSync(join(outDir, `synthetic-src-${tag}.xlsx`), join(here, `synthetic-lo-${tag}.xlsx`));
  const gt = d.gt.filter((g) => g.kind === "detail").map((g) => ({
    sheet: g.name,
    columns: g.columns.filter((x) => x.role !== "no" && x.role !== "note"),
    items: g.rows.filter((r) => r.kind === "item").map((r) => ({ row: r.row, name: r.name, qty: r.qty, amount: r.amount })),
  }));
  writeFileSync(join(here, `synthetic-lo-${tag}.gt.json`), JSON.stringify(gt, null, 1));
  console.log(`synthetic-lo-${tag}.xlsx (${readFileSync(join(here, `synthetic-lo-${tag}.xlsx`)).length} bytes) · 양식 ${tpl} · 항목 ${gt.reduce((s, g) => s + g.items.length, 0)}줄`);
}
