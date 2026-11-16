/**
 * 개인정보 검사의 미탐지 점검 — 검사기를 만든 규칙과 별개로, 실제 문서에서 나올 수 있는 "적는 방식"을 늘어놓고 찾는지 본다.
 * 값은 실행 중에 조립한 가짜 값이다(저장소에 실제 모양의 번호를 두지 않는다). 결과 표에도 원래 값 대신 모양만 적는다.
 * 실행: npx tsx lossguard/eval/pii.ts [--out lossguard/eval/results]
 * 주의: 이 목록도 우리가 상상한 적는 방식이다. 실제 노무비 대장 · 표지에서의 미탐지율은 실증에서만 잴 수 있다.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import type { RawCell, RawWorkbook } from "../engine/types";
import { scanWorkbook, sanitizeWorkbook, shapeOf, PII_LABEL } from "../engine/privacy/scan";
import { ENGINE_VERSION } from "../engine/version";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "lossguard/eval/results";
const j = (...p: string[]) => p.join("");
const fw = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(0xff10 + Number(d))).replace(/-/g, "－");
const RRN = j("850714", "-", "2000123"), FRN = j("850714", "-", "5000123"), MOB = j("010", "-", "0000", "-", "1234");
const T = (v: string): RawCell => ({ v, t: "text" });
const N = (n: number): RawCell => ({ v: String(n), t: "num", n });

interface Case { group: string; how: string; must: "block" | "warn"; rows: RawCell[][]; target: [number, number]; hiddenSheet?: boolean }
const CASES: Case[] = [
  { group: "주민 · 외국인등록번호", how: "기본(######-#######)", must: "block", rows: [[T("비고"), T(RRN)]], target: [0, 1] },
  { group: "주민 · 외국인등록번호", how: "붙여 씀(13자리)", must: "block", rows: [[T("비고"), T(RRN.replace("-", ""))]], target: [0, 1] },
  { group: "주민 · 외국인등록번호", how: "가운데 띄어 씀(###### - #######)", must: "block", rows: [[T("비고"), T(RRN.replace("-", " - "))]], target: [0, 1] },
  { group: "주민 · 외국인등록번호", how: "전각 숫자(한글 입력기)", must: "block", rows: [[T("비고"), T(fw(RRN))]], target: [0, 1] },
  { group: "주민 · 외국인등록번호", how: "숫자 칸(13자리 수)", must: "block", rows: [[T("비고"), N(Number(RRN.replace("-", "")))]], target: [0, 1] },
  { group: "주민 · 외국인등록번호", how: "글 속(주민번호:…입니다)", must: "block", rows: [[T(`주민번호:${RRN}입니다`)]], target: [0, 0] },
  { group: "주민 · 외국인등록번호", how: "외국인등록번호(성별 자리 5~8)", must: "block", rows: [[T("비고"), T(FRN)]], target: [0, 1] },
  { group: "주민 · 외국인등록번호", how: "숨긴 시트 안", must: "block", rows: [[T("비고"), T(RRN)]], target: [0, 1], hiddenSheet: true },
  { group: "주민 · 외국인등록번호", how: "두 칸에 나눠 적음(앞 6 | 뒤 7) — 머리글 '주민번호'", must: "block", rows: [[T("성명"), T("주민번호"), T("")], [T("홍길동"), T("850714"), T("2000123")]], target: [1, 2] },
  { group: "주민 · 외국인등록번호", how: "점으로 나눔(######.#######)", must: "block", rows: [[T("비고"), T(RRN.replace("-", "."))]], target: [0, 1] },
  { group: "운전면허 · 여권", how: "운전면허번호(##-##-######-##)", must: "block", rows: [[T("비고"), T(j("11", "-", "12", "-", "345678", "-", "90"))]], target: [0, 1] },
  { group: "운전면허 · 여권", how: "머리글 '여권번호' 아래", must: "block", rows: [[T("여권번호")], [T(j("M", "12345678"))]], target: [1, 0] },
  { group: "카드번호", how: "#### #### #### ####(룬 통과)", must: "block", rows: [[T(j("4111", " 1111", " 1111", " 1111"))]], target: [0, 0] },
  { group: "카드번호", how: "붙여 씀 16자리(룬 통과)", must: "block", rows: [[T(j("4111", "1111", "1111", "1111"))]], target: [0, 0] },
  { group: "휴대전화", how: "기본(###-####-####)", must: "warn", rows: [[T(MOB)]], target: [0, 0] },
  { group: "휴대전화", how: "점 · 띄어쓰기", must: "warn", rows: [[T(MOB.replace(/-/g, "."))]], target: [0, 0] },
  { group: "휴대전화", how: "국가번호(+82 10 …)", must: "warn", rows: [[T(j("+82 ", "10-0000-1234"))]], target: [0, 0] },
  { group: "휴대전화", how: "전각 숫자", must: "warn", rows: [[T(fw(MOB))]], target: [0, 0] },
  { group: "휴대전화", how: "숫자 칸(앞 0 빠짐) — 머리글 '연락처'", must: "warn", rows: [[T("연락처")], [N(1000001234)]], target: [1, 0] },
  { group: "이메일", how: "기본", must: "warn", rows: [[T(j("tester", "@", "example.com"))]], target: [0, 0] },
  { group: "이메일", how: "가린 꼴(tester(at)example.com)", must: "warn", rows: [[T(j("tester", "(at)", "example.com"))]], target: [0, 0] },
  { group: "계좌번호", how: "은행 이름 + ###-######-##", must: "warn", rows: [[T("국민은행"), T(j("123", "-", "456789", "-", "01"))]], target: [0, 1] },
  { group: "계좌번호", how: "은행 이름 + 붙여 쓴 14자리", must: "warn", rows: [[T("입금계좌"), T(j("12345", "678901234"))]], target: [0, 1] },
  { group: "사람 이름", how: "머리글 '성명' 아래", must: "warn", rows: [[T("성명")], [T("홍길동")]], target: [1, 0] },
  { group: "사람 이름", how: "머리글 '작업자명' 아래", must: "warn", rows: [[T("작업자명")], [T("김철수")]], target: [1, 0] },
  { group: "사람 이름", how: "표지 '대표이사 ○○○ (인)'", must: "warn", rows: [[T("대표이사 김철수 (인)")]], target: [0, 0] },
  { group: "사람 이름", how: "'담당: ○○○'", must: "warn", rows: [[T("담당: 이영희")]], target: [0, 0] },
  { group: "사람 이름", how: "표지 '담당자 | ○○○'(옆 칸)", must: "warn", rows: [[T("담당자"), T("박민수")]], target: [0, 1] },
  { group: "사람 이름", how: "자유 글 속(현장 소장은 박민수입니다)", must: "warn", rows: [[T("현장 소장은 박민수입니다")]], target: [0, 0] },
];

function wb(c: Case): RawWorkbook {
  return { fileName: "x.xlsx", sheets: [{ name: "자료", hidden: !!c.hiddenSheet, rows: c.rows, merges: [], hiddenRows: [], hiddenCols: [] }] };
}

let commit = "unknown";
try { commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* 없음 */ }
const rows: string[] = [];
let found = 0, leveled = 0, cleaned = 0;
const misses: string[] = [];
for (const c of CASES) {
  const w = wb(c);
  const rep = scanWorkbook(w);
  const [r, col] = c.target;
  const hits = rep.hits.filter((h) => h.row === r && h.col === col);
  const level = hits.some((h) => h.level === "block") ? "block" : hits.some((h) => h.level === "warn") ? "warn" : hits.length ? "info" : "none";
  const ok = level !== "none";
  const levelOk = c.must === "block" ? level === "block" : level === "block" || level === "warn";
  const after = sanitizeWorkbook(w).workbook.sheets[0].rows[r]?.[col];
  const before = c.rows[r][col];
  const removed = !!after && after.v !== before.v;
  if (ok) found++;
  if (levelOk) leveled++;
  if (removed) cleaned++;
  if (!levelOk) misses.push(`${c.group} — ${c.how}`);
  rows.push(`| ${c.group} | ${c.how} | ${shapeOf(before.v)} | ${c.must === "block" ? "멈춤" : "지움"} | ${level === "none" ? "**못 찾음**" : level === "block" ? "멈춤" : level === "warn" ? "지움" : "알림만"}${hits.length ? ` (${[...new Set(hits.map((h) => PII_LABEL[h.kind]))].join(", ")})` : ""} | ${removed ? "지워짐" : "**남음**"} |`);
}
const md = [
  `# 개인정보 검사 미탐지 점검 (가짜 값) — 엔진 ${ENGINE_VERSION} · 커밋 ${commit}`, "",
  "> 실행 중에 조립한 가짜 값으로 잰 것이다. 적는 방식 목록도 우리가 만든 것이라, 실제 문서의 미탐지율을 뜻하지 않는다.", "",
  `찾음 ${found}/${CASES.length} · 등급까지 맞음 ${leveled}/${CASES.length} · 지운 사본에서 지워짐 ${cleaned}/${CASES.length}`, "",
  "| 종류 | 적는 방식 | 모양 | 기대 | 결과 | 지운 사본 |", "|---|---|---|---|---|---|", ...rows, "",
  "## 못 찾거나 등급이 낮은 것", "", ...(misses.length ? misses.map((m) => `- ${m}`) : ["- 없음"]),
];
mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
writeFileSync(`${OUT}/${stamp}-${commit}-pii.md`, md.join("\n") + "\n");
writeFileSync(`${OUT}/${stamp}-${commit}-pii.json`, JSON.stringify({ engine: ENGINE_VERSION, commit, total: CASES.length, found, leveled, cleaned, misses }, null, 1));
console.log(md.join("\n"));
