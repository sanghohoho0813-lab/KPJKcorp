import { mapHeaders, findHeaderRow, buildImportRows, companyTemplateSheets, IMPORT_FIELDS } from "../../src/lib/company-import";
let fail = 0; const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const rows = [
  ["2026 고객 명단", "", ""],
  ["상호", "대표자명", "사업자등록번호", "사업장 소재지", "종업원수", "E-mail", "설립일자", "구분", "담당 컨설턴트", "모르는열"],
  ["테스트상사", "김철수", "1234567890", "경기도 성남시 분당구", "1,200명", "a@b.co", "43529", "개인", "박컨설", "x"],
  ["", "", "", "", "", "", "", "", "", ""],
  ["테스트상사 ", "이영희", "", "", "", "", "", "", "", ""],
  ["(주)기존회사", "최대표", "", "", "", "", "", "", "", ""],
  ["오류기업", "", "12345", "", "많음", "bad@", "2020.13.40", "모름", "없는사람", ""],
  ["숫자만기업", "정대표", "999-88-77777", "", "", "", "2021년 7월 1일", "주식회사", "", ""],
];
const hr = findHeaderRow(rows);
ok(hr === 1, "header row " + hr);
const map = mapHeaders(rows[hr]);
ok(JSON.stringify(map) === JSON.stringify(["name","ceo","bizNo","address","employees","contactEmail","establishedAt","entityType","consultant",null]), "mapping " + JSON.stringify(map));
const res = buildImportRows(rows, hr, map, { companies: [{ name: "기존회사 주식회사", bizNo: "999-88-77777" }], users: [{ id: "u_park", name: "박컨설", role: "consultant" }, { id: "u_c", name: "고객", role: "client" }], me: "u_me", nowIso: "2026-09-29T00:00:00.000Z" });
ok(res.length === 5, "rows (blank skipped) " + res.length);
const [a, b, c, d, e] = res;
ok(a.status === "ok" && a.line === 3 && a.data.bizNo === "123-45-67890" && a.data.region === "경기" && a.data.employees === 1200 && a.data.employeeBand === "300+" && a.data.establishedAt === "2019-03-05" && a.data.entityType === "sole" && a.data.consultantId === "u_park" && a.data.contactName === "김철수" && a.data.contactTitle === "대표이사", "row A " + JSON.stringify(a.data));
ok(b.status === "duplicate" && /3번째 줄/.test(b.problems[0]), "in-file dup name: " + b.problems);
ok(c.status === "duplicate" && /이름의 기업이 이미/.test(c.problems[0]), "existing name dup (주) normalized: " + c.problems);
ok(e.status === "duplicate" && /사업자번호의 기업이 이미/.test(e.problems[0]), "existing bizNo dup: " + e.problems);
ok(d.status === "error" && d.problems.length === 6 && d.notes.length === 1 && d.data.consultantId === "u_me", "errors: " + d.problems.join(" | ") + " / " + d.notes);
ok(e.data.establishedAt === "2021-07-01" && e.data.entityType === "corporation", "korean date + 주식회사");
const t = companyTemplateSheets();
const tmplMap = mapHeaders(t[0].rows[0] as string[]);
ok(tmplMap.every((k, i) => k === IMPORT_FIELDS[i].key), "template header round-trips");
const ex = t[1].rows[t[1].rows.length - 1];
ok(ex.length === IMPORT_FIELDS.length, "example row width " + ex.length);
process.exit(fail ? 1 : 0);
