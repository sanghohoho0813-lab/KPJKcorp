// 경계 — 엔진은 AX · 업종 묶음 · Node 를 모르고, AX 는 LossGuard 를 모르며, 실제 자료 파일은 저장소에 없다
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const ROOT = join(__dirname, "..", "..");
const LG = join(ROOT, "lossguard");

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (f === "node_modules" || f === ".next" || f.startsWith(".git")) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const imports = (src: string) => [...src.matchAll(/(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const lgFiles = walk(LG).filter((f) => f.endsWith(".ts"));
const engineFiles = lgFiles.filter((f) => relative(LG, f).startsWith("engine"));
const srcFiles = walk(join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f));

// 1) lossguard → AX 금지
const toAx = lgFiles.filter((f) => imports(readFileSync(f, "utf8")).some((i) => i.startsWith("@/") || /(^|\/)src\//.test(i)));
ok(toAx.length === 0, `lossguard/ 가 AX(src/)를 불러오지 않음 ${toAx.map((f) => relative(ROOT, f)).join(", ")}`);
// 2) AX → lossguard 금지(제품 단계 전까지)
const toLg = srcFiles.filter((f) => imports(readFileSync(f, "utf8")).some((i) => i.includes("lossguard")));
ok(toLg.length === 0, `src/ 가 lossguard/ 를 불러오지 않음 ${toLg.map((f) => relative(ROOT, f)).join(", ")}`);
// 3) 엔진은 업종 묶음 · 생성기 · 평가 · Node 모듈을 불러오지 않음(브라우저 · 서버 공용)
const bad = engineFiles.filter((f) => imports(readFileSync(f, "utf8")).some((i) => !i.startsWith(".") || /\.\.\/(\.\.\/)?(packs|synth|eval|cli|test)\b/.test(i) || i.startsWith("node:")));
ok(bad.length === 0, `엔진이 상대 경로의 엔진 파일만 불러옴 ${bad.map((f) => relative(ROOT, f)).join(", ")}`);
// 4) 엔진 코드(주석 제외)에 건설 업종 낱말이 없음 — 업종 지식은 업종 묶음에만
const WORDS = ["공종", "내역서", "타일", "석고", "철거", "도장", "경량", "목공", "방수", "미장", "천정", "천장", "창호", "일위대가", "집계표", "갑지", "을지", "기성", "하도급", "공사", "인테리어", "건설", "단수정리", "부가가치세", "공과잡비", "품명", "규격"];
const hits: string[] = [];
for (const f of engineFiles) { const code = stripComments(readFileSync(f, "utf8")); for (const w of WORDS) if (code.includes(w)) hits.push(`${relative(LG, f)}:${w}`); }
ok(hits.length === 0, `엔진 코드에 업종 낱말 없음 ${hits.slice(0, 8).join(", ")}`);
// 5) lossguard/ 안의 표 파일은 합성 자료뿐
const dataFiles = walk(LG).filter((f) => /\.(xlsx|xls|xlsm|csv|tsv|html?|hwp|hwpx|pdf|docx?)$/i.test(f));
const notSynthetic = dataFiles.filter((f) => !/^synthetic-/.test(f.split("/").pop()!));
ok(notSynthetic.length === 0, `lossguard/ 의 표 · 문서 파일 ${dataFiles.length}개가 모두 synthetic- 로 시작 ${notSynthetic.map((f) => relative(ROOT, f)).join(", ")}`);
// 6) 비공개 결과 폴더는 커밋 대상에서 빠짐
const gi = readFileSync(join(LG, ".gitignore"), "utf8");
ok(/^private\/?$/m.test(gi), "lossguard/.gitignore 에 private/ (실제 자료 · 실행 결과 보관 위치)");

process.exit(fail ? 1 : 0);
