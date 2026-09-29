import { buildXlsx, readXlsx, parseDelimited, decodeText, excelSerialToDate, colName } from "../../src/lib/xlsx";
let fail = 0; const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
(async () => {
  const bytes = buildXlsx([{ name: "기업고객", rows: [["기업명", "대표자", "임직원"], ["예시기업(주)", "홍길동 & <김>", 12], ["줄\n바꿈", "", null]] }, { name: "a/b:c*", rows: [["x"]] }]);
  const s = await readXlsx(bytes);
  ok(s.length === 2 && s[0].name === "기업고객", "sheet names " + s.map(x=>x.name));
  ok(s[0].rows[1][1] === "홍길동 & <김>" && s[0].rows[1][2] === "12", "escape & number");
  ok(s[0].rows[2][0] === "줄\n바꿈", "newline");
  ok(colName(0) === "A" && colName(26) === "AA" && colName(701) === "ZZ", "colName");
  const csv = parseDelimited('기업명,대표자\n"A, Inc","김 ""대표"""\n');
  ok(csv[1][0] === "A, Inc" && csv[1][1] === '김 "대표"', "csv quotes");
  const tsv = parseDelimited("a\tb\n1\t2");
  ok(tsv[1][1] === "2", "tsv");
  const euc = new Uint8Array([0xb1, 0xe2, 0xbe, 0xf7, 0xb8, 0xed]); // 기업명 in EUC-KR
  ok(decodeText(euc) === "기업명", "euc-kr fallback: " + decodeText(euc));
  ok(excelSerialToDate(45292) === "2024-01-01", "serial " + excelSerialToDate(45292));
  process.exit(fail ? 1 : 0);
})();
