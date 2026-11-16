// 파일 형식 — 내용으로 형식 판별 · 글자 인코딩 · CSV 따옴표/구분자 · HTML 병합 · 손상 파일 · 보이는 값(반올림)의 계산 검산
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectFormat, readWorkbook, FormatError } from "../engine/io/read";
import { decodeText, parseDelimited, htmlSheets } from "../engine/io/text";
import { analyze } from "../engine/analyze";
import pack from "../packs/construction-interior/index";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const enc = (s: string) => new TextEncoder().encode(s);
const FX = join(__dirname, "fixtures");

(async () => {
  // 글자 인코딩
  ok(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...enc("품목,수량")])) === "품목,수량", "UTF-8 (BOM)");
  const le = new Uint8Array(2 + 2 * 3); le[0] = 0xff; le[1] = 0xfe; [..."가나다"].forEach((ch, i) => { const c = ch.charCodeAt(0); le[2 + 2 * i] = c & 255; le[3 + 2 * i] = c >> 8; });
  ok(decodeText(le) === "가나다", "UTF-16LE (BOM) — 엑셀 '유니코드 텍스트' 저장");
  const cp = new Uint8Array(readFileSync(join(FX, "synthetic-cp949-v2.csv")));
  ok(decodeText(cp).includes("품 명") && !decodeText(cp).includes("�"), "CP949(EUC-KR) — 한글 윈도우 프로그램의 CSV");

  // CSV
  const rows = parseDelimited('a,"b,1","c ""q"""\r\n"줄\n바꿈",2,3\n');
  ok(rows.length === 2 && rows[0][1] === "b,1" && rows[0][2] === 'c "q"' && rows[1][0] === "줄\n바꿈", "CSV 따옴표 · 쉼표 · 따옴표 두 번 · 칸 안 줄바꿈");
  ok(parseDelimited("품목\t수량\t금액\n석재\t1,000\t2,000\n")[1][1] === "1,000", "탭 구분(TSV) 자동 판별 — 쉼표 숫자와 섞여도");
  ok(parseDelimited("a;b;c\n1;2;3\n")[1].length === 3, "세미콜론 구분 자동 판별");

  // HTML 표
  const hs = htmlSheets(`<html><body><h1>첫 표</h1><table><tr><td rowspan="2">이름</td><td colspan=2>재료비</td></tr><tr><td>단가</td><td>금액&nbsp;</td></tr><tr><td>A&amp;B</td><td>1,000</td><td>2,000</td></tr></table><table><caption>둘째</caption><tr><td>x</td></tr></table></body></html>`, "f");
  const h0 = hs[0];
  ok(hs.length === 2 && h0.name === "첫 표" && hs[1].name === "둘째", "HTML 표 여러 개 → 시트 여러 개(이름: 제목 · caption)");
  ok(h0.merges.some((m) => m.r1 === 0 && m.r2 === 1 && m.c1 === 0) && h0.merges.some((m) => m.c1 === 1 && m.c2 === 2), "rowspan · colspan → 병합");
  ok(h0.rows[1][1].v === "단가" && h0.rows[1][2].v === "금액" && h0.rows[2][0].v === "A&B", "병합 아래 칸 위치 · 문자 참조(&amp; &nbsp;)");

  // 형식 판별(확장자가 아니라 내용)
  const html = readFileSync(join(FX, "synthetic-lo-v6.html"));
  const asXls = await readWorkbook(new Uint8Array(html), "웹에서받은.xls");
  ok(asXls.format === "html" && asXls.sheets.length >= 1, "확장자 .xls 인데 내용이 HTML 표 → HTML 로 읽음");
  ok(detectFormat(new Uint8Array(readFileSync(join(FX, "synthetic-lo-v6.xls")))) === "xls", "OLE2 안의 Workbook → xls");
  ok(detectFormat(enc("%PDF-1.7\n...")) === "pdf" && detectFormat(new Uint8Array([0, 1, 2, 3, 0, 0, 9])) === "unknown", "PDF · 알 수 없는 바이너리 판별");
  let msgs = 0;
  for (const [b, f] of [[enc("%PDF-1.4"), "a.pdf"], [new Uint8Array([0, 1, 2, 3, 0, 0, 9, 8]), "a.bin"], [enc('<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet">'), "a.xml"]] as [Uint8Array, string][]) {
    try { await readWorkbook(b, f); } catch (e) { if (e instanceof FormatError && e.message.length > 10) msgs++; }
  }
  ok(msgs === 3, "PDF · 알 수 없는 형식 · Excel 2003 XML → 이유를 알려 주는 오류");

  // 손상된 .xls: 멈추거나 무한 반복하지 않고, 오류 또는 일부만 읽음
  const xls = new Uint8Array(readFileSync(join(FX, "synthetic-lo-v6.xls")));
  let handled = 0;
  for (const cut of [600, 2048, Math.floor(xls.length * 0.6), xls.length - 100]) {
    const t0 = Date.now();
    try { await readWorkbook(xls.slice(0, cut), "cut.xls"); handled++; } catch { handled++; }
    if (Date.now() - t0 > 2000) handled -= 10;
  }
  const loop = xls.slice(); // FAT 첫 칸을 자기 자신으로 → 연결 고리 순환
  const v = new DataView(loop.buffer); const fat0 = v.getUint32(0x4c, true); v.setUint32((fat0 + 1) * 512 + 4 * v.getUint32(0x30, true), v.getUint32(0x30, true), true);
  try { await readWorkbook(loop, "loop.xls"); handled++; } catch { handled++; }
  ok(handled === 5, "잘린 · 순환 고리가 있는 .xls 를 오류 또는 부분 읽기로 처리(멈추지 않음)");

  // 보이는 값(반올림)과 계산 검산: 수량 559.6 이 "560" 으로 보이는 CSV — 오탐 없음, 진짜 오류는 그대로 잡음
  const csv = ["품명,규격,단위,수량,단가,금액", "자재 가,,m2,560,30000,16788000", "자재 나,,m2,12,1000,12000", "자재 다,,m2,3,500,1500", "자재 라,,m2,7,2000,14000", "자재 마,,m2,10,1000,11000", "합계,,,,,16826500"].join("\n");
  const wb = await readWorkbook(enc(csv), "t.csv");
  const r = analyze({ docs: [{ docId: "c", kind: "contract", workbook: wb }], meta: { vat: "excluded" }, pack });
  const d01 = r.findings.filter((f) => f.detector === "D01");
  ok(wb.format === "csv" && d01.length === 1 && d01[0].message.includes("자재 마"), `반올림된 수량(560 ≈ 559.6)은 오탐 없음, 실제 1,000원 차이는 탐지 (D01 ${d01.length}건)`);

  // 같은 글자 숫자라도 엑셀 파일 안의 글자 칸(저장된 값)은 반올림 여유를 주지 않는다 — 평가에서 놓친 오류(E1b) 재발 방지
  const asText = csv.replace("560,30000,16788000", "560,30000,16800000").replace("10,1000,11000", "1,10000,10400").replace("16826500", "16837900").split("\n").map((l) => l.split(",").map((v) => (v ? { v, t: "text" as const } : { v: "", t: "empty" as const })));
  const wbX = { fileName: "t.xlsx", sheets: [{ name: "내역", hidden: false, rows: asText, merges: [], hiddenRows: [], hiddenCols: [] }] };
  const rX = analyze({ docs: [{ docId: "c", kind: "contract", workbook: wbX }], meta: { vat: "excluded" }, pack });
  ok(rX.findings.some((f) => f.detector === "D01" && f.message.includes("자재 마")), "엑셀 글자 칸의 숫자(1 × 10,000 ≠ 10,400)는 반올림 여유 없이 탐지");

  process.exit(fail ? 1 : 0);
})();
