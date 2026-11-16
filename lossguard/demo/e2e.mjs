#!/usr/bin/env node
/**
 * 시연 화면 종단 시험 — 실제 브라우저(Chromium, 화면 없음)로 처음부터 끝까지 누른다.
 * 가상 공사자료로: 예시 현장 → 분석 → 원본 근거 → 처리 단계(완료 · 반영 금액) → 연결 판단(같음 · 다름 · 회사 규칙 · 후보 연결)
 * → 열 지정 고치기 → 재분석 비교 → 기록 → 보고서(PDF) → 다른 현장에서 회사 규칙 재사용 → 개인정보 파일 · 손상 파일 → 새로고침 뒤 보존.
 * 끝으로 브라우저가 보낸 모든 요청이 127.0.0.1 의 화면 파일 GET 뿐인지(외부 전송 없음) 확인한다.
 *
 * 실행: node lossguard/demo/e2e.mjs [--shots <폴더>] [--pdf <파일>]   (Playwright · Chromium 필요)
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const SHOTS = opt("shots"), PDF = opt("pdf");
const PORT = 4300 + Math.floor(Math.random() * 600);
const BASE = `http://127.0.0.1:${PORT}`;

let fail = 0;
const ok = (c, m) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const t0 = Date.now();

const server = spawn("node", [join(here, "serve.mjs")], { env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((res, rej) => { server.stdout.on("data", (d) => { if (String(d).includes("127.0.0.1")) res(); }); server.on("exit", (c) => rej(new Error("서버 종료 " + c))); setTimeout(() => rej(new Error("서버 시작 시간 초과")), 240000); });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const requests = [], problems = [];
page.on("request", (r) => requests.push({ method: r.method(), url: r.url() }));
page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text()); });
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
await page.addInitScript(() => { document.addEventListener("securitypolicyviolation", (e) => console.error("CSP 위반: " + e.violatedDirective + " " + e.blockedURI)); });
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true }); };
const tid = (id) => `[data-testid="${id}"]`;
const count = (sel) => page.locator(sel).count();
const text = (sel) => page.locator(sel).first().innerText();

try {
  // 1) 처음 화면 · 예시 현장 A
  await page.goto(BASE + "/");
  await page.fill(tid("user-name"), "김대표");
  await shot("01-home");
  await page.click(tid("sample-A"));
  await page.waitForSelector(tid("site-title"));
  await page.waitForSelector(tid("file-line"));
  const files = await count(tid("file-line"));
  const fileText = await page.locator(tid("file-line")).allInnerTexts();
  ok(files === 4 && fileText.some((t) => t.includes(".xls") && t.includes("97~2003")) && fileText.some((t) => t.includes("CSV")), `예시 현장 A: 파일 4개를 형식 판별해 읽음(xlsx · xls · CSV) — ${files}개`);
  await shot("02-upload");

  // 2) 분석
  await page.click(tid("analyze"));
  await page.waitForSelector(tid("finding-detail"), { timeout: 30000 });
  const n1 = await count(tid("finding-item"));
  ok(n1 >= 5, `분석 → 확인할 결과 ${n1}건`);
  const cats = await page.locator(".sum-card").allInnerTexts();
  ok(cats.length === 3 && cats.some((c) => c.includes("계산 불일치")) && cats.some((c) => c.includes("미확인 불일치")) && cats.some((c) => c.includes("자료 부족")), "결과를 계산 불일치 · 미확인 불일치 · 자료 부족으로 나눠 보여 줌");
  ok(/손실로 확정된 금액이 아닙니다/.test(await text(tid("finding-detail"))), "결과 상세에 '손실로 확정된 금액이 아님' 표시");

  // 3) 원본 근거 · 계산 과정 — 계산 불일치 결과 하나를 골라 본다
  const calcItem = page.locator(tid("finding-item"), { hasText: "줄 계산" }).first();
  await calcItem.click();
  await page.waitForSelector(tid("calc-steps"));
  const steps = await text(tid("calc-steps"));
  ok(/수량 .+ × 단가 .+ = /.test(steps) && /차이/.test(steps), "줄 계산 결과: 수량 × 단가 = 계산 금액 · 적힌 금액 · 차이를 단계로 보여 줌");
  const marked = await page.locator(`${tid("evidence-grid")} td.cell-base`).count();
  ok(marked >= 2, `원본 근거 표에서 근거 칸 ${marked}개를 강조(시트 · 행 · 열 주소)`);
  await shot("03-finding-calc");

  // 4) 처리 단계: 검토 필요 → 확인 중 → 실제 문제 → 조치 → 완료(반영 금액)
  const stepTo = async (s, fill = {}) => {
    await page.click(tid(`step-${s}`));
    if (fill.note) await page.fill(tid("step-note"), fill.note);
    if (fill.action) await page.fill(tid("step-action-text"), fill.action);
    if (fill.amount) await page.fill(tid("step-amount"), fill.amount);
    await page.click(tid("step-submit"));
    await page.waitForTimeout(250);
  };
  await page.click(tid("step-confirmed")).catch(() => {});
  ok(await count(tid("step-confirmed")) === 0, "검토 필요에서 바로 '실제 문제'로 건너뛸 수 없음(버튼 없음)");
  await stepTo("checking");
  await stepTo("confirmed", { note: "계산 오류 확인" });
  await page.click(tid("step-action")); await page.click(tid("step-submit")); await page.waitForTimeout(250);
  ok(/조치/.test(await page.locator(".toast-error").last().innerText().catch(() => "")), "조치 내용 없이 '조치'로 넘어가지 않음(오류 안내)");
  await page.fill(tid("step-action-text"), "발주처에 금액 정정 요청"); await page.click(tid("step-submit")); await page.waitForTimeout(250);
  await page.click(tid("step-done")); await page.click(tid("step-submit")); await page.waitForTimeout(250);
  ok(/반영 금액/.test(await page.locator(".toast-error").last().innerText().catch(() => "")), "반영 금액 입력 없이 '완료'로 넘어가지 않음");
  await page.fill(tid("step-amount"), "50000"); await page.fill(tid("step-note"), "정정 견적서 수령"); await page.click(tid("step-submit")); await page.waitForTimeout(300);
  const panel = await text(tid("case-panel"));
  ok(/완료/.test(panel) && /50,000원/.test(panel) && (panel.match(/김대표/g) ?? []).length >= 4, "완료 · 실제 반영 금액(사용자 입력 50,000원) · 확인자 이력 기록");
  await shot("04-case-done");

  // 5) 항목 연결: 확인 필요 2건 → 하나는 같음(회사 규칙으로도), 하나는 다름
  await page.click(tid("tab-links"));
  await page.waitForSelector(tid("chip-review"));
  ok(/2/.test(await text(tid("chip-review"))), "확인 필요 연결 2건");
  const first = page.locator(tid("pair-review")).first();
  await first.locator(tid("judge-company")).check();
  await first.locator(tid("judge-same")).click(); await page.waitForTimeout(300);
  await page.locator(tid("pair-review")).nth(1).locator(tid("judge-diff")).click(); await page.waitForTimeout(300);
  ok(await page.locator(tid("pending")).count() === 1, "판단을 저장하면 '바뀐 내용 — 다시 분석하면 반영' 표시");
  await page.click(tid("chip-unlinked")); await page.waitForTimeout(200);
  const unl = await count(tid("unlinked-row"));
  if (unl) { await page.locator(tid("cand-link")).first().click(); await page.waitForTimeout(300); }
  ok(unl >= 1, `연결 안 된 줄 ${unl}개에 후보를 보여 주고 직접 연결`);
  await shot("05-links");

  // 6) 열 지정 고치기: 계약 내역 시트의 수량 ↔ 단가를 일부러 바꿔 저장
  await page.click(tid("tab-structure"));
  await page.waitForSelector(tid("sheet-editor"));
  const roles = await page.$$eval('select[data-testid^="col-role-"]', (els) => els.map((e) => e.value));
  const qi = roles.indexOf("qty"), pi = roles.indexOf("unitPrice");
  await page.selectOption(tid(`col-role-${qi}`), "unitPrice");
  await page.selectOption(tid(`col-role-${pi}`), "qty");
  await page.click(tid("col-save")); await page.waitForTimeout(300);
  await shot("06-structure");

  // 7) 다시 분석 → 바뀐 것 비교
  await page.click(tid("analyze"));
  await page.waitForSelector(tid("diff-view"), { timeout: 30000 });
  const diff = await text(tid("diff-view"));
  ok(/바뀐 연결/.test(diff) && /열 지정이 바뀐 시트/.test(diff), "다시 분석 → 바뀐 결과 · 연결 · 열 지정을 비교해 보여 줌");
  await shot("07-diff");
  await page.click(tid("diff-close"));

  // 8) 기록
  await page.click(tid("tab-history"));
  await page.waitForSelector(tid("judgment-table"));
  const runs = await count(tid("run-row"));
  const jrows = await page.locator(`${tid("judgment-table")} tbody tr`).count();
  const jtext = await text(tid("judgment-table"));
  ok(runs === 2 && jrows >= 5 && /회사 규칙/.test(jtext) && /이 현장/.test(jtext) && /김대표/.test(jtext), `기록: 분석 ${runs}회 · 사람 판단 ${jrows}건(범위 · 판 · 확인자 · 출처)`);
  await shot("08-history");

  // 9) 열 지정 거두기 → 다시 분석 → 원래 열로
  await page.click(tid("tab-structure"));
  await page.waitForSelector(tid("column-judgment"));
  await page.locator(tid("column-judgment")).getByRole("button", { name: "판단 거두기" }).click(); await page.waitForTimeout(300);
  await page.click(tid("analyze"));
  await page.waitForSelector(tid("diff-view"), { timeout: 30000 });
  ok(/열 지정이 바뀐 시트/.test(await text(tid("diff-view"))), "열 지정 판단을 거두고 다시 분석하면 원래 열로 돌아감(비교에 표시)");
  await page.click(tid("diff-close"));

  // 10) 나란히 비교
  await page.click(tid("tab-compare"));
  await page.waitForSelector(tid("compare"));
  ok(await page.locator(`${tid("compare")} td.diff`).count() >= 1, "계약 ↔ 변경 · 정산을 나란히 놓고 다른 값을 표시");
  await shot("09-compare");

  // 11) 보고서 · PDF
  await page.click(tid("tab-report"));
  await page.waitForSelector(tid("report"));
  const rep = await text(tid("report"));
  ok(/50,000원/.test(rep) && /사용자가 입력한 실제 반영 금액/.test(rep) && /손실로 확정된 금액이 아닙니다/.test(rep) && /가상\(합성\) 공사 자료로만 시험/.test(rep) && !/절감 성과|손실 확정됨/.test(rep), "보고서: 반영 금액은 입력값만 · 손실 확정 표현 없음 · 합성 자료 고지");
  await shot("10-report");
  if (PDF) {
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: PDF, format: "A4", printBackground: true, margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" } });
    await page.emulateMedia({ media: "screen" });
    ok(statSync(PDF).size > 20000, `보고서 PDF 저장(${Math.round(statSync(PDF).size / 1024)}KB)`);
  }

  // 12) 다른 현장(B)에서 회사 규칙 재사용
  await page.click(tid("nav-home"));
  await page.click(tid("sample-B"));
  await page.waitForSelector(tid("file-line"));
  await page.click(tid("analyze"));
  await page.waitForSelector(tid("finding-detail"), { timeout: 30000 }).catch(() => {});
  await page.click(tid("tab-links"));
  await page.waitForSelector(tid("chip-rule"));
  const ruleN = Number((await text(tid("chip-rule"))).replace(/\D/g, ""));
  ok(ruleN >= 1, `현장 A 에서 회사 규칙으로 남긴 판단이 현장 B 에서 다시 쓰임(회사 규칙 연결 ${ruleN}건)`);
  await page.click(tid("chip-rule")); await page.waitForTimeout(200);
  await shot("11-rule-reuse");
  await page.click(tid("nav-rules"));
  await page.waitForSelector(tid("rules-table"));
  ok(await page.locator(`${tid("rules-table")} tbody tr`).count() >= 1, "회사 연결 규칙 목록(출처 · 확인자 · 판)");

  // 13) 새 현장 · 개인정보 파일 · 손상 파일
  await page.click(tid("nav-home"));
  await page.click(tid("new-site"));
  await page.fill(tid("site-name"), "[가상] 개인정보 시험 현장");
  await page.click(tid("site-create"));
  await page.waitForSelector(tid("file-contract"), { state: "attached" });
  const j = (...p) => p.join("");
  const piiCsv = ["품명,규격,단위,수량,단가,금액", "석고보드,9.5T,장,10,6800,68000", "합판,12T,장,5,15000,75000", "몰딩,30x30,m,20,1500,30000", "", "담당자,홍길동,연락처," + j("010-", "0000-", "1234"), "주민번호," + j("850714-", "2000123")].join("\n");
  await page.setInputFiles(tid("file-contract"), { name: "가상-개인정보.csv", mimeType: "text/csv", buffer: Buffer.from(piiCsv) });
  await page.waitForSelector(tid("pii-sanitize"));
  ok(/주민|등록번호/.test(await page.locator(".modal").innerText()) && !(await page.locator(".modal").innerText()).includes(j("850714-", "2000123")), "주민번호가 든 파일 → 멈추고 묻는다(화면에 원래 번호를 보여 주지 않음)");
  await page.click(tid("pii-sanitize"));
  await page.waitForSelector(tid("file-line"));
  ok(/개인정보 지움/.test(await text(tid("file-line"))), "'지우고 사용' → 지운 뒤에만 저장");
  await page.setInputFiles(tid("file-settlement"), { name: "손상된파일.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37 + 11) % 256)) });
  await page.waitForTimeout(500);
  ok(await page.locator(".toast-error").count() >= 1 && (await count(tid("file-line"))) === 1, "손상 · 알 수 없는 파일 → 오류 안내, 저장하지 않음, 화면은 계속 동작");

  // 14) 새로고침 뒤 보존(브라우저 안 저장소)
  await page.goto(BASE + "/");
  await page.waitForSelector(tid("site-card"));
  ok(await count(tid("site-card")) === 3, "새로고침해도 현장 · 기록이 남음(이 브라우저 안 IndexedDB)");

  // 15) 외부 전송 없음
  const bad = requests.filter((r) => !r.url.startsWith(BASE + "/") || r.method !== "GET");
  const paths = [...new Set(requests.map((r) => r.url.replace(BASE, "")))];
  ok(bad.length === 0, `브라우저 요청 ${requests.length}건이 모두 ${BASE} 의 GET — 경로: ${paths.join(", ")}`);
  ok(problems.length === 0, `콘솔 오류 · CSP 위반 없음${problems.length ? ": " + problems.slice(0, 3).join(" | ") : ""}`);
  const blocked = await page.evaluate(async () => { try { await fetch("https://example.com/"); return "보내짐"; } catch { return "막힘"; } });
  ok(blocked === "막힘", "화면 코드가 외부로 보내려 해도 보안 정책(CSP connect-src 'none')이 막음");
} catch (e) {
  ok(false, "진행 중 오류: " + (e instanceof Error ? e.message : e));
  if (SHOTS) await page.screenshot({ path: join(SHOTS, "error.png"), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  server.kill();
}
console.log(`종단 시험 ${fail ? "실패 " + fail + "건" : "모두 통과"} · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
process.exit(fail ? 1 : 0);
