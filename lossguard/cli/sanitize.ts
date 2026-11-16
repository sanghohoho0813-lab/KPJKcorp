/**
 * 개인정보를 지운 사본 만들기 — 실제 자료를 개발 · 검토용으로 넘기기 전에 쓴다.
 *  · 읽을 수 있는 형식(.xlsx · .xls · CSV · HTML 표)을 읽어 개인정보(block · warn)를 지우거나 가명으로 바꾼 뒤 .xlsx 로 다시 쓴다.
 *  · 사본은 "값만" 담는다: 수식 · 메모 · 그림 · 파일 속성(작성자 등) · 서식은 들어가지 않는다. 병합 · 숨긴 행/열/시트는 남긴다.
 *  · 같은 이름은 여러 파일에 걸쳐 같은 가명이 된다. 가명 대응표는 만들지 않는다(되돌릴 수 없게).
 *  · 보고서에는 원래 값이 없다(위치 · 종류 · 모양만). 회사 전화 · 사업자번호는 알림만 하고 남긴다.
 *  · 못 찾는 것(자유 글 속 이름 등)이 있을 수 있으니, 넘기기 전에 사람이 한 번 훑어본다(실증 준비 키트 4-2).
 *
 * 실행: npx tsx lossguard/cli/sanitize.ts 파일1.xls 파일2.csv … [--out 폴더]   (기본 폴더: lossguard/private/sanitized-시각)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { readWorkbook } from "../engine/io/read";
import { describeReport, Pseudonyms, sanitizeWorkbook, scanWorkbook } from "../engine/privacy/scan";
import { writeRawWorkbook } from "../synth/xlsx-write";

const args = process.argv.slice(2);
const paths: string[] = [];
let out = resolve(__dirname, "..", "private", `sanitized-${new Date().toISOString().replace(/[:.]/g, "-")}`);
for (let i = 0; i < args.length; i++) { if (args[i] === "--out") { out = resolve(args[++i]); } else paths.push(args[i]); }
if (!paths.length) { console.log("사용법: npx tsx lossguard/cli/sanitize.ts 파일… [--out 폴더]"); process.exit(1); }

(async () => {
  mkdirSync(out, { recursive: true });
  const names = new Pseudonyms();
  const md: string[] = ["# 개인정보 지운 사본 보고서", "", "원래 값은 이 보고서에 없습니다(위치 · 종류 · 모양만). 사본을 넘기기 전에 사람이 한 번 훑어보세요.", ""];
  for (const p of paths) {
    const wb = await readWorkbook(new Uint8Array(readFileSync(p)), basename(p));
    const before = scanWorkbook(wb);
    const { workbook, changed } = sanitizeWorkbook(wb, names);
    const after = scanWorkbook(workbook);
    const name = basename(p).replace(/\.[^.]+$/, "") + ".sanitized.xlsx";
    writeFileSync(resolve(out, name), writeRawWorkbook(workbook));
    md.push(`## ${basename(p)} (${wb.format}) → ${name}`, "", `- 지우기 전: ${before.level} · 바꾼 칸 ${changed}개 · 지운 뒤 다시 검사: ${after.level}`, ...describeReport(before).map((x) => `- ${x}`), "");
  }
  md.push(`가명 ${names.size}명(대응표 없음)`);
  writeFileSync(resolve(out, "privacy-report.md"), md.join("\n") + "\n");
  console.log(md.join("\n"));
  console.log(`\n저장: ${out}`);
})().catch((e) => { console.error("읽지 못했습니다:", e instanceof Error ? e.message : e); process.exit(1); });
