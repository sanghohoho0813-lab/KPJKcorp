// 예전 엑셀(.xls) · HTML 표 · Excel 2003 XML · UTF-16 텍스트 읽기.
// 시험 파일은 tools/test/fixtures/sample.fods(지어낸 기업 3곳)를 LibreOffice 로 바꾼 것과 xlwt 로 만든 것 — 실제 고객 정보 없음.
import { readFileSync } from "fs";
import { join } from "path";
import { readTableFile, buildXlsx } from "../../src/lib/xlsx";
import { readCfb } from "../../src/lib/xls";
import { buildImportRows, findHeaderRow, mapHeaders } from "../../src/lib/company-import";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const FX = join(__dirname, "fixtures");
const asFile = (name: string, bytes: Uint8Array) => ({ name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
const fx = (name: string) => asFile(name, new Uint8Array(readFileSync(join(FX, name))));

const LONG = "가나다라마바사아자차카타파하".repeat(400);
const ROW1 = ["예시정밀(주)", "홍길동", "123-45-67890", "110111-1234567", "법인", "", "제조업", "금속가공", "도매 및 소매업 — 금속제품", "43529", "서울특별시 중구 예시로 1", "12", "첫 줄 메모"];

async function main() {
  // 1) LibreOffice 가 저장한 .xls (BIFF8) — 공유 문자열이 8KB 를 넘어 CONTINUE 로 이어지는 긴 메모 포함
  const xls = await readTableFile(fx("sample-lo.xls"));
  ok(xls.map((s) => s.name).join() === "기업고객,수식", "xls 시트 이름: " + xls.map((s) => s.name));
  ok(JSON.stringify(xls[0].rows[1]) === JSON.stringify(ROW1), "xls 첫 기업 줄 그대로: " + JSON.stringify(xls[0].rows[1]));
  ok(xls[0].rows[2][12] === LONG, `xls 5,600자 메모가 레코드 경계를 넘어도 그대로 (${xls[0].rows[2][12]?.length})`);
  ok(xls[0].rows[3][9] === "2022.11.30" && xls[0].rows[3][12] === "줄1\n줄2", "xls 글자 날짜 · 줄바꿈");
  ok(JSON.stringify(xls[1].rows.map((r) => r[0])) === JSON.stringify(["3", "가나", "TRUE", "0.3", "-123.5"]), "xls 수식 결과(숫자·글자·참거짓·소수·음수): " + JSON.stringify(xls[1].rows.map((r) => r[0])));
  const streams = readCfb(new Uint8Array(readFileSync(join(FX, "sample-lo.xls"))));
  const comp = streams.get("\u0001CompObj");
  ok(!!comp && comp.length === 73 && comp[2] === 0xfe && comp[3] === 0xff, "4KB 미만 스트림(미니 스트림)도 읽음");

  // 2) xlwt 가 만든 .xls — 다른 프로그램, 정수(RK)·실수·날짜 서식
  const xw = await readTableFile(fx("sample-xlwt.xls"));
  ok(JSON.stringify(xw[0].rows) === JSON.stringify([["상호", "대표자명", "사업자등록번호", "종업원수", "개업일자", "매출"], ["예시물산", "박예시", "2148801234", "7", "43952", "1234567.89"], ["ABC Trading", "Lee", "", "-3", "", "0.07"]]), "xlwt xls: " + JSON.stringify(xw[0].rows));

  // 3) 웹에서 내려받은 "엑셀"(HTML 표)
  const html = await readTableFile(fx("sample-lo.html"));
  ok(JSON.stringify(html[0].rows[1]) === JSON.stringify(ROW1) && html[0].rows[2][12] === LONG && html[0].rows[3][12] === "줄1\n줄2", "HTML 표: 첫 줄 · 긴 메모 · 줄바꿈");
  const inline = await readTableFile(asFile("명단.xls", new TextEncoder().encode('<html><body><table><tr><th>상호</th><th colspan="2">대표자</th><th>비고</th></tr><tr><td>가&amp;나<br>상사</td><td>김&nbsp;대표</td><td></td><td>&#54620;글</td></tr></table></body></html>')));
  ok(JSON.stringify(inline[0].rows) === JSON.stringify([["상호", "대표자", "", "비고"], ["가&나\n상사", "김 대표", "", "한글"]]), ".xls 이름의 HTML · colspan · 기호: " + JSON.stringify(inline[0].rows));

  // 4) Excel 2003 XML
  const xml = await readTableFile(fx("sample-2003.xml"));
  ok(JSON.stringify(xml[0].rows[1]) === JSON.stringify(ROW1) && xml[0].rows[2][12] === LONG, "2003 XML 첫 줄 · 긴 메모");
  ok(JSON.stringify(xml[1].rows.map((r) => r[0])) === JSON.stringify(["3", "가나", "TRUE", "0.3", "-123.5"]), "2003 XML 수식 결과: " + JSON.stringify(xml[1].rows.map((r) => r[0])));

  // 5) 엑셀 "유니코드 텍스트"(UTF-16 + BOM, 탭 구분)
  const u16 = "﻿상호\t대표자\r\n가나상사\t김대표\r\n";
  const bytes = new Uint8Array(u16.length * 2);
  for (let i = 0; i < u16.length; i += 1) { bytes[i * 2] = u16.charCodeAt(i) & 0xff; bytes[i * 2 + 1] = u16.charCodeAt(i) >> 8; }
  const t16 = await readTableFile(asFile("명단.txt", bytes));
  ok(JSON.stringify(t16[0].rows) === JSON.stringify([["상호", "대표자"], ["가나상사", "김대표"]]), "UTF-16 텍스트: " + JSON.stringify(t16[0].rows));

  // 6) 표가 아닌 문서는 분명한 안내
  const docx = await readTableFile(asFile("정관.docx", buildXlsx([{ name: "x", rows: [["a"]] }]))).then(() => "", (e: Error) => e.message);
  ok(/문서 파일입니다/.test(docx), "docx → 안내: " + docx);

  // 7) .xls 명단 → 등록 미리보기까지 (등록 화면과 같은 규칙)
  const rows = xls[0].rows;
  const hr = findHeaderRow(rows);
  const imp = buildImportRows(rows, hr, mapHeaders(rows[hr]), { companies: [], users: [], me: "u_me", nowIso: "2026-10-16T00:00:00.000Z" });
  ok(imp.length === 3 && imp.every((r) => r.status === "ok"), "xls 3곳 모두 등록 가능: " + imp.map((r) => r.status + r.problems.join("/")).join(" "));
  ok(imp[0].data.establishedAt === "2019-03-05" && imp[1].data.employees === 1200 && imp[2].data.region === "광주" && imp[0].data.bizItemsExtra === "도매 및 소매업 — 금속제품" && imp[2].data.establishedAt === "2022-11-30", "날짜 일련번호 · 숫자 · 지역 · 그 외 업태");

  // 8) 손상된 파일 — 멈추지 않고 읽거나 오류로 끝난다 (잘린 파일 · 바이트 뒤섞기 200회)
  {
    const src = new Uint8Array(readFileSync(join(FX, "sample-lo.xls")));
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const t0 = Date.now();
    let threwOther = 0;
    for (let k = 0; k < 200; k += 1) {
      const b = k < 40 ? src.slice(0, Math.floor(src.length * (k + 1) / 41)) : src.slice();
      if (k >= 40) for (let j = 0; j < 20; j += 1) b[Math.floor(rnd() * b.length)] = Math.floor(rnd() * 256);
      try { await readTableFile(asFile("x.xls", b)); } catch (e) { if (!(e instanceof Error)) threwOther += 1; }
    }
    ok(threwOther === 0 && Date.now() - t0 < 15000, `손상 파일 200개: 멈춤 없음 (${Date.now() - t0}ms)`);
  }

  if (fail) { console.log(`\n실패 ${fail}`); process.exit(1); } else console.log("\n전부 통과");
}
void main();
