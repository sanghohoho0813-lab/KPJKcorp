// 기업 등록에 올린 파일들 → 등록 미리보기 (파일 종류 가리기 · 서류 여러 장 → 한 줄씩 · 같은 회사 서류 합치기 · 검증).
// 기업·사람·번호는 모두 지어낸 것.
import { fileKind, shouldGoBulk, docsToSource, entityOfDoc, type ReadDoc } from "../../src/lib/company-sources";
import { buildImportRows, findHeaderRow, mapHeaders } from "../../src/lib/company-import";
import { bizNoValid } from "../../src/lib/docparse";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };

/** 사업자번호 9자리 → 검증번호를 붙인 10자리 (지어낸 번호를 "맞는 번호"로 만들기) */
function withCheck(nine: string) {
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const d = nine.split("").map(Number);
  let sum = d.reduce((a, x, i) => a + x * w[i], 0);
  sum += Math.floor((d[8] * 5) / 10);
  const c = (10 - (sum % 10)) % 10;
  const s = nine + c;
  return `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}`;
}

// 1) 파일 종류
const kinds = ["명단.xlsx", "옛명단.XLS", "c.csv", "d.tsv", "웹.html", "e.pdf", "f.JPG", "g.heic", "h.hwp", "i.docx", "j.zip"].map((n) => fileKind({ name: n }));
ok(kinds.join() === "table,table,table,table,table,doc,doc,doc,unknown,unknown,unknown", "파일 종류: " + kinds.join());
ok(fileKind({ name: "사진", type: "image/png" }) === "doc" && fileKind({ name: "x", type: "application/pdf" }) === "doc", "이름 없이 형식으로도");
const F = (name: string) => ({ name, type: "" }) as File;
ok(!shouldGoBulk([F("a.pdf")]) && shouldGoBulk([F("a.pdf"), F("b.jpg")]) && shouldGoBulk([F("명단.xls")]) && !shouldGoBulk([F("a.jpg")]), "한 장은 이 창에서, 엑셀·여러 장은 일괄 등록으로");

// 2) 사업자 형태
ok(entityOfDoc({ text: "사 업 자 등 록 증\n( 법인사업자 )", parsed: { source: "bizReg" } }) === "법인", "법인사업자 → 법인");
ok(entityOfDoc({ text: "( 간이과세자 - 세금계산서 발급사업자 )", parsed: { source: "bizReg" } }) === "개인", "간이과세자 → 개인");
ok(entityOfDoc({ text: "", parsed: { source: "bizReg", bizNo: "123-86-00000" } }) === "법인" && entityOfDoc({ text: "", parsed: { source: "bizReg", bizNo: "123-45-00000" } }) === "개인", "제목이 안 읽히면 번호 가운데 두 자리로");

// 3) 서류 여러 장 → 미리보기
const BIZ_A = withCheck("214880123");
const BIZ_C = withCheck("105870456");
ok(bizNoValid(BIZ_A) && bizNoValid(BIZ_C), "시험용 번호는 검증번호가 맞음");
const docs: ReadDoc[] = [
  // 같은 회사: 등기부등본이 먼저, 사업자등록증이 뒤 — 상호·주소는 등록증, 자본금은 등기부
  { fileName: "가나_등기부.pdf", size: 400_000, method: "pdf_text", text: "등기사항전부증명서(말소사항 포함)", parsed: { source: "corpReg", name: "주식회사 가나정밀", corpNo: "110111-1234567", capital: 50_000_000, establishedAt: "2019-03-05", address: "서울특별시 중구 등기로 1", ceo: "홍예시" } },
  { fileName: "가나_사업자등록증.pdf", size: 200_000, method: "pdf_text", text: "사 업 자 등 록 증\n( 법인사업자 )", parsed: { source: "bizReg", name: "(주)가나정밀", bizNo: BIZ_A, corpNo: "110111-1234567", ceo: "홍예시", address: "서울특별시 중구 사업장로 2", bizCategory: "제조업", bizItem: "금속가공", bizItemsExtra: "도매 및 소매업 — 금속제품", establishedAt: "2019-03-05" } },
  // 개인 사진 — 번호를 잘못 읽음
  { fileName: "식당.jpg", size: 1_500_000, method: "ocr", text: "( 일반과세자 )", parsed: { source: "bizReg", name: "다라식당", ceo: "김예시", bizNo: "123-45-67890", ceoBirth: "1980-01-02", bizCategory: "음식점업", bizItem: "한식", address: "경기도 성남시 예시로 3" } },
  // 개인 사진 — 번호는 맞음
  { fileName: "미용실.png", size: 900_000, method: "ocr", text: "( 간이과세자 )", parsed: { source: "bizReg", name: "마바미용실", ceo: "이예시", bizNo: BIZ_C, address: "전남광주통합특별시 서구 예시길 5", bizCategory: "서비스업", bizItem: "미용업", establishedAt: "2023-05-10" } },
  // 서류가 아닌 사진
  { fileName: "영수증.jpg", size: 300_000, method: "ocr", text: "합계 12,000원", parsed: { source: "unknown" } },
];
const src = docsToSource(docs, "서류 5개", "2026-10-16T01:00:00.000Z");
const rows = src.sheets[0].rows;
ok(src.fromDocs === true && rows.length === 4, "같은 회사 서류 두 장은 한 줄 · 아무것도 못 읽은 파일은 줄을 만들지 않음 → 3줄 + 머리글: " + rows.length);
ok(src.warnings?.length === 1 && /영수증\.jpg/.test(src.warnings[0]) && /보이지 않습니다/.test(src.warnings[0]), "못 읽은 파일은 안내로: " + src.warnings);
const hr = findHeaderRow(rows);
const map = mapHeaders(rows[hr]);
ok(map.every(Boolean), "서류 표의 머리글은 모두 등록 항목: " + JSON.stringify(map));
const res = buildImportRows(rows, hr, map, { companies: [], users: [], me: "u_me", nowIso: "2026-10-16T01:00:00.000Z", extras: src.extras });
const [a, b, c] = res;
ok(a.status === "ok" && a.data.name === "(주)가나정밀" && a.data.address === "서울특별시 중구 사업장로 2" && a.data.bizNo === BIZ_A && a.data.corpNo === "110111-1234567" && a.data.entityType === "corporation" && a.data.contactTitle === "대표이사", "합친 줄: 상호·주소는 등록증, 번호·형태: " + JSON.stringify([a.data.name, a.data.address, a.data.entityType]));
ok(a.data.capital === 50_000_000 && a.data.bizItemsExtra === "도매 및 소매업 — 금속제품" && a.data.industry === "제조업", "자본금(등기부) · 그 외 업태 · 업종");
ok(a.data.docs?.bizReg?.method === "pdf_text" && a.data.docs.bizReg.fileName === "가나_사업자등록증.pdf" && a.data.docs?.corpReg?.fileName === "가나_등기부.pdf" && a.data.docs.bizReg.readAt === "2026-10-16T01:00:00.000Z", "두 서류 모두 '읽은 기록'");
ok(JSON.stringify(a.files) === JSON.stringify(["가나_등기부.pdf", "가나_사업자등록증.pdf"]), "줄마다 어느 파일에서 왔는지");
ok(b.status === "error" && /검증번호가 맞지 않습니다/.test(b.problems.join()) && b.notes.some((n) => /사진 글자 인식/.test(n)), "사진에서 잘못 읽은 번호는 등록 막고 이유: " + b.problems.join(" / "));
ok(b.data.entityType === "sole" && b.data.contactTitle === "대표" && b.data.ceoBirth === "1980-01-02", "개인 · 직책 대표 · 생년월일(내부용)");
ok(c.status === "ok" && c.data.region === "광주" && c.data.docs?.bizReg?.method === "ocr" && c.notes.some((n) => /한 번 확인/.test(n)), "맞게 읽은 사진은 등록 가능 + 확인 안내");
// 상호 없이 번호만 읽힌 서류 → 줄은 만들되 "확인 필요"
{
  const one = docsToSource([{ fileName: "흐림.jpg", size: 1, method: "ocr", text: "", parsed: { source: "unknown", bizNo: BIZ_C } }], "x");
  const r1 = buildImportRows(one.sheets[0].rows, 0, mapHeaders(one.sheets[0].rows[0]), { companies: [], users: [], me: "u", nowIso: "2026-10-16T00:00:00.000Z", extras: one.extras });
  ok(r1.length === 1 && r1[0].status === "error" && r1[0].problems.some((p) => /보이지 않습니다/.test(p)) && r1[0].problems.some((p) => /기업명이 비어/.test(p)), "번호만 읽힌 서류: " + r1[0]?.problems.join(" / "));
}

// 4) 이미 있는 기업은 서류로 올려도 건너뜀
const dup = buildImportRows(rows, hr, map, { companies: [{ name: "가나정밀 주식회사", bizNo: "" }], users: [], me: "u_me", nowIso: "2026-10-16T01:00:00.000Z", extras: src.extras });
ok(dup[0].status === "duplicate", "이미 있는 기업(이름)은 건너뜀: " + dup[0].problems);

if (fail) { console.log(`\n실패 ${fail}`); process.exit(1); } else console.log("\n전부 통과");
