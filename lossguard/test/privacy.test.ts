// 개인정보 검사 · 제거 — 시험용 값은 모두 실행 중에 조립한 가짜 값이다(저장소에 실제 모양의 번호를 두지 않는다)
import type { RawCell, RawWorkbook } from "../engine/types";
import { scanWorkbook, sanitizeWorkbook, Pseudonyms, describeReport } from "../engine/privacy/scan";
import { readXlsx } from "../engine/io/xlsx";
import { writeRawWorkbook } from "../synth/xlsx-write";
import { generateCase } from "../synth/index";
import { analyze } from "../engine/analyze";
import pack from "../packs/construction-interior/index";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const T = (v: string): RawCell => ({ v, t: "text" });
const N = (n: number): RawCell => ({ v: String(n), t: "num", n });
const E: RawCell = { v: "", t: "empty" };
const j = (...p: string[]) => p.join("");

// 가짜 값(조립)
const rrn = j("85", "07", "14", "-", "2", "000", "123");            // 날짜 모양 + 성별 자리 2
const rrnNoDash = j("850714", "1", "000456");
const rrnBadDate = j("85", "13", "40", "-", "1", "000", "123");     // 13월 40일 → 아님
const rrnMasked = j("850714", "-", "1", "******");
const mobile = j("010", "-", "0000", "-", "1234");
const card = j("4111", " ", "1111", " ", "1111", " ", "1111");      // 룬 검사 통과하는 시험용 번호
const cardBad = j("4111", " ", "1111", " ", "1111", " ", "1112");
const email = j("tester", "@", "example", ".com");
const acct = j("123", "-", "456789", "-", "01");
const biz = j("123", "-", "45", "-", "67890");
const tel = j("02", "-", "000", "-", "1234");

(async () => {
  const wb: RawWorkbook = {
    fileName: "가짜.xlsx",
    sheets: [
      {
        name: "표지", hidden: false, merges: [], hiddenRows: [], hiddenCols: [],
        rows: [
          [T("견 적 서")],
          [T("담당자"), T("홍길동"), T("연락처"), T(mobile)],
          [T("대표이사 김철수 (인)"), E, T("사업자번호"), T(biz)],
          [T("대표전화"), T(tel), T("메일"), T(email)],
          [T("입금계좌 : 국민은행 " + acct)],
          [T("결제일"), T("2024-01-15"), T("국민은행")],
        ],
      },
      {
        name: "인원", hidden: false, merges: [], hiddenRows: [3], hiddenCols: [],
        rows: [
          [T("성명"), T("주민번호"), T("연락처"), T("일당"), T("비고")],
          [T("이순신"), T(rrn), N(1000001234), N(150000), T("카드 " + card)],
          [T("강감찬"), T(rrnMasked), T(mobile), N(160000), T("시험 " + cardBad)],
          [T("홍길동"), N(Number(rrnNoDash)), E, N(170000), T(rrnBadDate)],
        ],
      },
    ],
  };
  const rep = scanWorkbook(wb);
  const at = (sheet: string, r: number, c: number) => rep.hits.filter((h) => h.sheet === sheet && h.row === r && h.col === c).map((h) => h.kind);
  ok(rep.level === "block", `등급: 주민번호 · 카드번호가 있으면 block (${rep.level})`);
  ok(at("인원", 1, 1).includes("rrn"), "주민번호(글자) — 머리글 아래");
  ok(at("인원", 3, 1).includes("rrn"), "주민번호가 숫자 칸(13자리)으로 저장된 경우");
  ok(rep.hits.some((h) => h.sheet === "인원" && h.row === 3 && h.hidden), "숨긴 행 안의 값도 찾고 숨김 표시");
  ok(at("인원", 3, 4).length === 0, "날짜가 아닌 13자리(13월 40일)는 등록번호로 보지 않음");
  ok(at("인원", 2, 1).includes("rrn") || at("인원", 2, 1).includes("rrnPartial"), "뒷자리를 가린 등록번호도 찾음(생년월일 · 성별)");
  ok(at("인원", 1, 4).includes("card") && !at("인원", 2, 4).includes("card"), "카드번호: 룬 검사 통과만");
  ok(at("인원", 1, 2).includes("mobile"), "휴대전화가 숫자 칸(앞 0 빠짐)으로 저장 — 연락처 머리글 아래");
  ok(at("표지", 1, 1).includes("person") && at("표지", 1, 3).includes("mobile"), "표지의 '담당자 | 이름' · 휴대전화");
  ok(at("표지", 2, 0).includes("person"), "'대표이사 ○○○ (인)' 꼴의 이름");
  ok(at("표지", 2, 3).includes("bizno") && at("표지", 3, 1).includes("phone"), "사업자번호 · 일반 전화는 알림(info)");
  ok(at("표지", 3, 3).includes("email") && at("표지", 4, 0).includes("account"), "이메일 · 은행 낱말과 함께 있는 계좌번호");
  ok(at("표지", 5, 1).length === 0, "은행 낱말이 같은 줄에 있어도 날짜는 계좌번호로 보지 않음");
  const text = JSON.stringify(rep) + describeReport(rep).join("\n");
  const raws = [rrn, rrnNoDash, mobile, card, email, acct, "홍길동", "이순신", "김철수", "1000001234"];
  ok(raws.every((x) => !text.includes(x)), "보고서에 원래 값이 없음(위치 · 종류 · 모양만)");

  // 지우기
  const names = new Pseudonyms();
  const { workbook: clean, changed } = sanitizeWorkbook(wb, names);
  const all = JSON.stringify(clean);
  ok(changed > 0 && [rrn, mobile, card, email, acct, "이순신", "김철수", "1000001234"].every((x) => !all.includes(x)), `지운 사본에 block · warn 값이 없음(바꾼 칸 ${changed})`);
  ok(all.includes(biz) && all.includes(tel), "info(사업자번호 · 회사 전화)는 남김");
  ok(clean.sheets[1].rows[1][3].t === "num" && clean.sheets[1].rows[1][3].n === 150000, "분석용 숫자 칸(일당)은 그대로");
  const p1 = clean.sheets[0].rows[1][1].v, p2 = clean.sheets[1].rows[3][0].v;
  ok(p1 === p2 && /^사람\d\d$/.test(p1), `같은 이름 → 같은 가명(${p1})`);
  ok(JSON.stringify(wb).includes(rrn), "원본 객체는 바꾸지 않음");
  ok(scanWorkbook(clean).level === "info", `지운 사본을 다시 검사하면 info 이하 (${scanWorkbook(clean).level})`);

  // 값만 다시 쓴 파일(지운 사본) → 다시 읽기 → 다시 검사
  const back = await readXlsx(writeRawWorkbook(clean), "clean.xlsx");
  ok(scanWorkbook(back).level === "info", "지운 사본 파일을 다시 읽어도 block · warn 없음");
  ok(back.sheets[1].hiddenRows.includes(3) && back.sheets[1].rows[1][3].n === 150000, "지운 사본 파일: 숨긴 행 · 숫자 칸 보존");

  // 합성 내역서: 개인정보를 표지 · 비고에 넣고 지워도 분석 결과가 같다
  const c = generateCase(4, { split: "dev", inject: true });
  const docs0 = [];
  for (const d of c.docs) docs0.push({ docId: d.docId, kind: d.kind, round: d.round, workbook: await readXlsx(d.bytes, d.fileName) });
  const withPii = docs0.map((d) => ({ ...d, workbook: { ...d.workbook, sheets: d.workbook.sheets.map((s, i) => (i === 0 ? { ...s, rows: [...s.rows, [T("담당자"), T("홍길동"), T("연락처"), T(mobile)], [T("주민번호"), T(rrn)]] } : s)) } }));
  const r0 = analyze({ docs: docs0, meta: c.meta, pack });
  const scanned = withPii.map((d) => scanWorkbook(d.workbook));
  ok(scanned.every((x) => x.level === "block"), "합성 문서에 넣은 주민번호를 찾음");
  const nm = new Pseudonyms();
  const r1 = analyze({ docs: withPii.map((d) => ({ ...d, workbook: sanitizeWorkbook(d.workbook, nm).workbook })), meta: c.meta, pack });
  const keys = (r: typeof r0) => r.findings.map((f) => f.key).sort().join(",");
  const lines = (r: typeof r0) => r.docs.flatMap((d) => d.sheets.flatMap((s) => s.lines.filter((l) => l.kind === "item").map((l) => `${l.name}|${l.qty}|${l.unitPrice}|${l.amount}`))).join("\n");
  ok(keys(r0) === keys(r1) && r0.findings.length > 0, `지운 뒤에도 탐지 결과 동일(${r0.findings.length}건)`);
  ok(lines(r0) === lines(r1), "지운 뒤에도 항목(이름 · 수량 · 단가 · 금액) 동일");
  const changedItems = docs0.reduce((s, d) => s + sanitizeWorkbook(d.workbook).changed, 0);
  ok(changedItems === 0, `개인정보가 없는 합성 내역서에서는 바꾸는 칸 0개(실제 ${changedItems})`);

  // 오인 점검: 개인정보가 없는 합성 문서(양식 V1~V8 · 낯선 품명 세트)에서 찾은 것 · 바꾸는 칸
  const { generateStressCase } = await import("../synth/stress");
  let docsN = 0, warnOrBlock = 0, changedN = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const cc = seed % 2 ? generateCase(seed, { split: seed % 3 ? "dev" : "eval" }) : generateStressCase(seed, { catalog: "holdout", typo: 0.3 });
    for (const d of cc.docs) {
      const w = await readXlsx(d.bytes, d.fileName);
      docsN++;
      warnOrBlock += scanWorkbook(w).hits.filter((h) => h.level !== "info").length;
      changedN += sanitizeWorkbook(w).changed;
    }
  }
  ok(docsN > 30 && warnOrBlock === 0 && changedN === 0, `합성 문서 ${docsN}개(개인정보 없음): block · warn 오인 ${warnOrBlock}건 · 바꾼 칸 ${changedN}개`);

  process.exit(fail ? 1 : 0);
})();
