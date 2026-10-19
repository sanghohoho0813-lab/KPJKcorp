// 정책자금 신청 서류 묶음 — 신청일 기준 서류 상태, 고를 파일, 요청 기한, 파일 이름·목록표, zip. 기업·서류는 지어낸 것.
import { KIT_LABEL, defaultApplyOn, kitDueDay, kitFileName, kitIncluded, kitRequestItems, kitRows, kitSheets, kitSummary, kitZipName, safeName } from "../../src/lib/apply-kit";
import { buildZip, unzip, readXlsx, buildXlsx } from "../../src/lib/xlsx";
import { POLICY_PREFIX } from "../../src/lib/policy-docs";
import type { CompanyFile, CompanyVault, DocumentRequest } from "../../src/lib/types";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };

const today = "2026-10-19";
const vault: CompanyVault = {
  id: "co_t", companyId: "co_t",
  customSlots: [{ key: "cd_fin", label: "표준재무제표증명 (최근 3년)" }, { key: "cd_ins", label: "4대보험 사업장 가입자 명부", validMonths: 1 }, { key: "cd_sh", label: "주주명부" }],
  slots: {
    bizReg: { received: true },
    corpReg: { received: true, issuedAt: "2026-09-01" },          // 3개월 → 12-01 까지
    smeCert: { received: true },                                   // 받음 표시만
    cd_ins: { received: true, issuedAt: "2026-10-10" },            // 1개월 → 11-10 까지
  },
};
const file = (id: string, slot: string, name: string, at: string, issuedAt?: string): CompanyFile => ({ id, companyId: "co_t", slot, fileName: name, size: 1000, mime: "application/pdf", uploadedAt: at, uploadedBy: "u1", ...(issuedAt ? { issuedAt } : {}) });
const files: CompanyFile[] = [
  file("f1", "bizReg", "사업자등록증_예전.pdf", "2025-03-01T01:00:00Z"),
  file("f2", "bizReg", "사업자등록증.pdf", "2026-10-01T01:00:00Z"),
  file("f3", "corpReg", "등기부.pdf", "2026-09-02T01:00:00Z"),
  file("f4", "cd_fin", "2023.pdf", "2026-10-05T01:00:00Z"),
  file("f5", "cd_fin", "2024.pdf", "2026-10-05T03:00:00Z"),
  file("f6", "cd_fin", "2025.pdf", "2026-10-05T05:00:00Z"),
  file("f7", "cd_ins", "명부.pdf", "2026-10-10T01:00:00Z"),
  file("fx", "bizReg", "다른회사.pdf", "2026-10-15T01:00:00Z"),
];
files[7] = { ...files[7], companyId: "co_other" };
const req = (name: string, status: DocumentRequest["status"], extra: Partial<DocumentRequest> = {}): DocumentRequest => ({ id: `r_${name}_${status}`, projectId: "", companyId: "co_t", name, description: "", requestedAt: "2026-10-01T00:00:00Z", dueDate: "2026-11-20T09:00:00Z", status, assigneeId: "u1", files: [], ...extra });
const reqs: DocumentRequest[] = [
  req("정관", "submitted", { files: [{ id: "d1", fileName: "정관_최신.pdf", size: 10, uploadedAt: "2026-10-12T02:00:00Z", uploadedBy: "c", version: 1 }] }),
  req("부가가치세 과세표준증명", "requested", { dueDate: "2026-12-01T09:00:00Z" }),
  req("납세증명서", "done", { submittedAt: "2026-08-01T00:00:00Z", files: [{ id: "d2", fileName: "납세.pdf", size: 10, uploadedAt: "2026-08-01T00:00:00Z", uploadedBy: "c", version: 1 }] }),
];

// 1) 신청 예정일 2026-11-20 (한 달 뒤)
const applyOn = "2026-11-20";
const rows = kitRows({ entity: "corporation", companyId: "co_t", vault, files, reqs, applyOn, today, extras: ["수출실적증명서", "주주명부", " "] });
const r = (k: string) => rows.find((x) => x.key === k)!;
ok(rows.length === 11 && !!r("x:수출실적증명서") && !rows.some((x) => x.key === "x:주주명부"), "공통 10 + 더한 서류 1 (이미 있는 이름·빈 칸은 겹치지 않음)");
ok(r("bizReg").state === "ready" && r("bizReg").sources.length === 1 && r("bizReg").sources[0].kind === "vault" && (r("bizReg").sources[0] as { file: CompanyFile }).file.id === "f2", "사업자등록증: 가장 최근 파일 한 개(예전 것·다른 회사 파일 제외)");
ok(r("corpReg").state === "ready" && r("corpReg").expiresOn === "2026-12-01", "등기부: 12-01까지 유효 → 11-20 신청에 씀");
ok(r("finStmt").state === "ready" && r("finStmt").sources.length === 3, "재무제표: 같은 날 올린 3개 연도 모두");
ok(r("insList").state === "expires" && r("insList").expiresOn === "2026-11-10" && r("insList").ask, "4대보험 명부: 11-10 만료 → 신청일엔 다시 발급(요청 체크)");
ok(r("smeCert").state === "noFile" && r("smeCert").ask, "중소기업 확인서: 받음 표시만 · 파일 없음");
ok(r("articles").state === "checking" && r("articles").sources[0].kind === "request", "정관: 고객 제출 · 검토 전 파일");
ok(r("vatBase").state === "open" && !r("vatBase").ask && /신청일보다 늦음/.test(r("vatBase").note), "부가세 과세표준: 요청 중 · 기한이 신청일보다 늦다고 알림");
ok(r("taxCert").state === "expires", "납세증명서: 8월 제출본은 30일 유효 → 신청일엔 지남(발급일 몰라도 제출일로 판단)");
ok(r("localTaxCert").state === "justBefore" && !r("localTaxCert").ask, "지방세 납세증명: 신청 직전 — 한 달 뒤 신청이면 아직 요청 안 함");
ok(r("shareholders").state === "missing" && r("x:수출실적증명서").state === "missing" && r("x:수출실적증명서").extra === true, "없는 서류·더한 서류: 없음");

const sum = kitSummary(rows);
ok(sum.ready === 4 && sum.files === 6 && sum.reissue === 2 && sum.missing === 3 && sum.open === 1 && sum.justBefore === 1, `요약: ${JSON.stringify(sum)}`);

// 2) 신청일이 가까우면 신청 직전 서류도 요청
const soon = kitRows({ entity: "corporation", companyId: "co_t", vault, files, reqs, applyOn: "2026-10-30", today });
ok(soon.find((x) => x.key === "localTaxCert")!.ask, "11일 뒤 신청 → 지방세 납세증명도 지금 요청");
ok(kitDueDay({ state: "missing" }, "2026-11-20", today) === "2026-11-15" && kitDueDay({ state: "justBefore" }, "2026-11-20", today) === "2026-11-18" && kitDueDay({ state: "missing" }, "2026-10-21", today) === "2026-10-20", "요청 기한: 신청 5일 전 · 직전 서류 2일 전 · 내일보다 이르지 않게");
const items = kitRequestItems(rows.filter((x) => x.ask), applyOn, "2026년 수출기업 지원사업", today);
ok(items.every((i) => i.dueDay <= applyOn) && items.find((i) => i.label === "4대보험 사업장 가입자 명부")!.description.startsWith(POLICY_PREFIX) && items.find((i) => i.label === "수출실적증명서")!.description.includes("2026년 수출기업 지원사업"), "요청 문구: 공통 서류는 준비 서류 문구, 더한 서류는 공고명");

// 3) 개인사업자: 법인 서류 없음
ok(!kitRows({ entity: "sole", companyId: "co_t", vault, files, reqs, applyOn, today }).some((x) => x.doc?.corpOnly), "개인사업자는 법인 서류 빼고");
ok(defaultApplyOn("2026-11-05", today) === "2026-11-05" && defaultApplyOn("2026-10-01", today) === "2026-10-26" && defaultApplyOn(undefined, today) === "2026-10-26", "신청 예정일 기본: 마감일 또는 일주일 뒤");

// 4) 파일 이름 · zip · 목록표
ok(kitFileName(4, "표준재무제표증명 (최근 3년)", "2024.PDF", 1, 3) === "04_표준재무제표증명(최근3년)_2.pdf" && kitFileName(1, "사업자등록증", "a.jpeg", 0, 1) === "01_사업자등록증.jpeg", "파일 이름: 순번_서류명(_n).확장자");
ok(safeName('a/b:c*d?"e<f>g|h') === "abcdefgh" && kitZipName("(주)테스트", "공고: 2026/수출", new Date(2026, 9, 19)) === "(주)테스트_공고2026수출_20261019.zip", "윈도우에서 못 쓰는 글자 빼기");
const sheets = kitSheets(rows, { companyName: "테스트(주)", programTitle: "2026년 수출기업 지원사업", applyOn, madeBy: "대표", when: new Date(2026, 9, 19, 10, 5), missingFiles: new Set(["articles#0"]) });
const list = sheets[0].rows;
ok(list.length === 12 && list[1][5] === "01_사업자등록증.pdf" && String(list[4][5]).split(", ").length === 3 && String(list[8][5]).startsWith("(원본 없음)") && list[6][2] === KIT_LABEL.expires, "목록표: 순번 = 파일 이름, 원본 없는 파일 표시, 기한 지난 서류는 파일 없음");

void (async () => {
const xbytes = buildXlsx(sheets);
const zip = buildZip([["00_서류목록.xlsx", xbytes], ["01_사업자등록증.pdf", new TextEncoder().encode("%PDF-1.4 test")]], new Date(2026, 9, 19, 10, 5));
const back = await unzip(zip);
const xl = await readXlsx(back.get("00_서류목록.xlsx")!);
ok(back.size === 2 && new TextDecoder().decode(back.get("01_사업자등록증.pdf")!) === "%PDF-1.4 test" && xl[0].name === "서류 목록" && xl[0].rows[1][1] === "사업자등록증" && xl[1].rows.some((x) => x[1] === "2026-11-20"), "zip 왕복: 한글 이름 · 파일 내용 · 목록표 엑셀");
ok(rows.filter(kitIncluded).length === 4, "묶음에 넣는 서류 4개(파일 있음·검토 전)");

if (fail) { console.log(`\n실패 ${fail}`); process.exit(1); } else console.log("\n전부 통과");
})();
