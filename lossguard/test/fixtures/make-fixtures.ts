/**
 * 시험 파일 만들기 — 합성 현장(가상)을 우리 쓰기 도구로 xlsx 로 만든 뒤 다른 프로그램 · 다른 형식으로 다시 저장한다.
 *  · synthetic-lo-*.xlsx : LibreOffice 가 다시 저장한 xlsx(공유 문자열 · 스타일 · 병합 표기 방식이 다름)
 *  · synthetic-lo-*.xls  : LibreOffice 가 저장한 Excel 97~2003(BIFF8) — 예전 엑셀 파일
 *  · synthetic-lo-*.html : LibreOffice 가 저장한 HTML 표 — 웹에서 내려받은 "엑셀"(보이는 값만, 반올림된 숫자)
 *  · synthetic-cp949-*.csv : 첫 내역 시트를 CSV(CP949, 천 단위 쉼표)로 — ERP · 회계 프로그램 내려받기 흉내(병합 정보 없음)
 * 실행: npx tsx lossguard/test/fixtures/make-fixtures.ts   (soffice · iconv 필요)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCase } from "../../synth/index";
import { readXlsx } from "../../engine/io/xlsx";

const here = __dirname;
const picks: [string, string, number][] = [["v2", "V2", 801], ["v6", "V6", 802], ["v8", "V8", 803]];

const csvField = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const shown = (n: number) => {
  const [i, f] = String(Math.abs(n)).split(".");
  return (n < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : "");
};

(async () => {
  for (const [tag, tpl, seed] of picks) {
    const c = generateCase(seed, { split: "eval", contractTemplate: tpl, inject: false, noChange: true, noSettlement: true });
    const d = c.docs[0];
    const tmp = mkdtempSync(join(tmpdir(), "lg-fx-"));
    const src = join(tmp, `synthetic-src-${tag}.xlsx`);
    writeFileSync(src, d.bytes);
    const outDir = mkdtempSync(join(tmpdir(), "lg-fx-out-"));
    for (const [filter, ext] of [["xlsx:Calc MS Excel 2007 XML", "xlsx"], ["xls:MS Excel 97", "xls"], ["html:HTML (StarCalc)", "html"]]) {
      execFileSync("soffice", ["--headless", "--convert-to", filter, "--outdir", outDir, src], { stdio: "ignore" });
      renameSync(join(outDir, `synthetic-src-${tag}.${ext}`), join(here, `synthetic-lo-${tag}.${ext}`));
    }
    const gt = d.gt.filter((g) => g.kind === "detail").map((g) => ({
      sheet: g.name,
      columns: g.columns.filter((x) => x.role !== "no" && x.role !== "note"),
      items: g.rows.filter((r) => r.kind === "item").map((r) => ({ row: r.row, name: r.name, qty: r.qty, amount: r.amount })),
    }));
    writeFileSync(join(here, `synthetic-lo-${tag}.gt.json`), JSON.stringify(gt, null, 1));

    // CSV(CP949): 첫 내역 시트만, 숫자는 천 단위 쉼표 글자로
    const wb = await readXlsx(new Uint8Array(d.bytes), "src.xlsx");
    const sh = wb.sheets.find((s) => s.name === gt[0].sheet)!;
    const text = sh.rows.map((r) => (r ?? []).map((x) => csvField(x.t === "num" ? shown(x.n!) : x.v)).join(",")).join("\r\n") + "\r\n";
    const utf8 = join(tmp, "u.csv");
    writeFileSync(utf8, text);
    const csvName = `synthetic-cp949-${tag}`;
    writeFileSync(join(here, `${csvName}.csv`), execFileSync("iconv", ["-f", "UTF-8", "-t", "CP949", utf8]));
    writeFileSync(join(here, `${csvName}.gt.json`), JSON.stringify([{ ...gt[0], sheet: csvName }], null, 1));
    console.log(`${tag} · 양식 ${tpl} · 항목 ${gt.reduce((s, g) => s + g.items.length, 0)}줄 · xlsx/xls/html/csv`);
  }
})();
