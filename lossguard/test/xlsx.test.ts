// 엑셀 읽기 — 쓰기 → 읽기 왕복(병합 · 숨긴 행 · 숨긴 시트 · 공유 문자열 · 숫자), LibreOffice 가 다시 저장한 합성 파일, 손상 파일
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readXlsx } from "../engine/io/xlsx";
import { readWorkbook } from "../engine/io/read";
import { writeXlsx } from "../synth/xlsx-write";
import { generateCase } from "../synth/index";
import { analyze } from "../engine/analyze";
import pack from "../packs/construction-interior/index";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };

(async () => {
  const bytes = writeXlsx([
    { name: "내역서", rows: [["공 사 내 역 서", null, null], [], ["품 명", "재료비", null], [null, "단가", "금액"], ["석고보드 & <9.5T>", 6800, 1360000], ["숨긴 줄", 1, 2]], merges: [{ r1: 0, c1: 0, r2: 0, c2: 2 }, { r1: 2, c1: 0, r2: 3, c2: 0 }, { r1: 2, c1: 1, r2: 2, c2: 2 }], hiddenRows: [5], widths: [20, 10, 10] },
    { name: "숨긴시트", hidden: true, rows: [["x"]], merges: [], hiddenRows: [], widths: [10] },
  ]);
  const wb = await readXlsx(bytes, "t.xlsx");
  ok(wb.sheets.length === 2 && wb.sheets[0].name === "내역서" && wb.sheets[1].hidden, "시트 이름 · 숨긴 시트");
  const s = wb.sheets[0];
  ok(s.rows[4][0].v === "석고보드 & <9.5T>" && s.rows[4][1].t === "num" && s.rows[4][1].n === 6800, "특수문자 · 숫자 칸");
  ok(s.merges.length === 3 && s.merges.some((m) => m.r1 === 2 && m.r2 === 3 && m.c1 === 0), "병합 범위(세로 · 가로)");
  ok(s.hiddenRows.includes(5), "숨긴 행");
  ok(s.rows[1].length === 0, "빈 줄 보존");

  let bad = 0;
  for (const junk of [new Uint8Array(10), new TextEncoder().encode("품명,수량\n석고보드,1"), bytes.slice(0, bytes.length - 30)]) {
    try { await readXlsx(junk); } catch { bad++; }
  }
  ok(bad === 3, "손상 · 다른 형식 파일은 오류로 알림(멈추지 않음)");

  // 합성 현장 한 건: 생성기 → xlsx → 읽기 → 엔진, 정답과 같은 값
  const c = generateCase(4, { split: "dev" });
  const docs = [];
  for (const d of c.docs) docs.push({ docId: d.docId, kind: d.kind, round: d.round, workbook: await readXlsx(d.bytes, d.fileName) });
  const res = analyze({ docs, meta: c.meta, pack });
  let items = 0, same = 0;
  for (const d of c.docs) for (const g of d.gt) for (const r of g.rows) {
    if (r.kind !== "item") continue;
    items++;
    const l = res.docs.find((x) => x.docId === d.docId)!.sheets.find((x) => x.sheet === g.name)!.lines.find((x) => x.row === r.row);
    if (l && l.name === r.name && l.qty === r.qty && l.amount === r.amount) same++;
  }
  ok(items > 0 && same === items, `합성 문서 왕복 후 항목 값 일치 ${same}/${items}`);

  // 다른 프로그램 · 다른 형식으로 다시 저장한 합성 파일(fixtures/make-fixtures.ts) — xlsx · xls · HTML 표 · CSV(CP949)
  //  HTML · CSV 는 보이는 값만 담는다(수량이 반올림되어 보일 수 있음) → 수량은 0.5 이내, 계산 검산은 오탐 0건이어야 한다
  const dir = join(__dirname, "fixtures");
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => /^synthetic-.*\.(xlsx|xls|html|csv)$/.test(x)).sort()) {
      const gtPath = join(dir, f.replace(/\.[a-z]+$/, ".gt.json"));
      if (!existsSync(gtPath)) continue;
      const display = /\.(html|csv)$/.test(f);
      const gt = JSON.parse(readFileSync(gtPath, "utf8")) as { sheet: string; items: { row: number; name: string; qty: number; amount: number }[]; columns: { col: number; role: string; group?: string }[] }[];
      const wb2 = await readWorkbook(new Uint8Array(readFileSync(join(dir, f))), f);
      const r2 = analyze({ docs: [{ docId: "contract", kind: "contract", workbook: wb2 }], meta: { vat: "excluded" }, pack });
      const sheets = r2.docs[0].sheets.filter((x) => x.lines.length);
      let n = 0, hit = 0, colN = 0, colHit = 0;
      for (const g of gt) {
        const sh = r2.docs[0].sheets.find((x) => x.sheet === g.sheet) ?? (gt.length === 1 && sheets.length === 1 ? sheets[0] : undefined);
        for (const it of g.items) {
          n++;
          const l = sh?.lines.find((x) => x.row === it.row);
          if (l && l.name === it.name && l.qty !== undefined && Math.abs(l.qty - it.qty) <= (display ? 0.5 : 0) && Math.abs((l.amount ?? NaN) - it.amount) < 0.5) hit++;
        }
        for (const gc of g.columns) { colN++; if (sh?.columns.some((x) => x.col === gc.col && x.role === gc.role && (x.group ?? undefined) === (gc.group ?? undefined))) colHit++; }
      }
      ok(n > 0 && hit === n && colHit === colN, `${wb2.format} 형식 ${f}: 열 ${colHit}/${colN} · 항목 ${hit}/${n}`);
      ok(r2.findings.length === 0, `${f}: 오류 없는 합성 문서에서 탐지 0건(실제 ${r2.findings.length}건${r2.findings.length ? " — " + r2.findings.slice(0, 2).map((x) => x.title).join(" / ") : ""})`);
    }
  }
  process.exit(fail ? 1 : 0);
})();
