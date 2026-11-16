/**
 * 시연용 가상 공사자료 만들기 — 실제 기업 자료가 아니다(파일 이름은 모두 synthetic- 로 시작).
 *  · 현장 A(씨앗 32): 계약 내역서(.xlsx) · 변경 내역서 1차(.xlsx) · 정산서(.xls, LibreOffice 로 변환) · 매입 장부(CP949 CSV, 손으로 쓴 거래)
 *    — 줄 계산 · 합계 · 변경 오류가 들어 있고, 사전에 없는 다른 이름 때문에 "확인 필요" 연결이 생긴다
 *  · 현장 B(씨앗 36): 현장 A 와 같은 "다른 이름" 쌍이 다시 나온다 → 현장 A 에서 회사 규칙으로 확인하면 B 에서 다시 쓰인다
 * 실행: npx tsx lossguard/demo/make-samples.ts   (soffice · iconv 필요)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCase } from "../synth/index";

const out = join(__dirname, "samples");
const tmp = mkdtempSync(join(tmpdir(), "lg-demo-"));
const KIND = { contract: "계약내역서", change: "변경내역서", settlement: "정산서" } as const;

interface SampleFile { path: string; display: string; kind: "contract" | "change" | "settlement" | "cost"; round?: number }
interface SampleSite { key: string; name: string; status: "completed"; contractAmount?: number; vat: "excluded" | "included"; changes: { round: number; prevAmount?: number; newAmount?: number }[]; files: SampleFile[]; story: string }

function site(key: string, seed: number, name: string, xlsSettlement: boolean, story: string): SampleSite {
  const c = generateCase(seed, { split: "dev", inject: true });
  const files: SampleFile[] = [];
  for (const d of c.docs) {
    const k = d.kind as "contract" | "change" | "settlement";
    const base = `synthetic-${key}-${d.kind}${d.round ? d.round : ""}`;
    const display = `[가상] ${KIND[k]}${d.round ? ` ${d.round}차` : ""}`;
    if (k === "settlement" && xlsSettlement) {
      const src = join(tmp, `${base}.xlsx`);
      writeFileSync(src, d.bytes);
      execFileSync("soffice", ["--headless", "--convert-to", "xls:MS Excel 97", "--outdir", tmp, src], { stdio: "ignore" });
      writeFileSync(join(out, `${base}.xls`), readFileSync(join(tmp, `${base}.xls`)));
      files.push({ path: `${base}.xls`, display: `${display}.xls`, kind: k, round: d.round });
    } else {
      writeFileSync(join(out, `${base}.xlsx`), d.bytes);
      files.push({ path: `${base}.xlsx`, display: `${display}.xlsx`, kind: k, round: d.round });
    }
  }
  return { key, name: c.title.replace("[가상] ", "[가상] 현장 " + key + " · "), status: "completed", contractAmount: c.meta.contractAmount, vat: c.meta.vat, changes: c.meta.changes ?? [], files, story };
}

// 매입 · 지급 장부(손으로 쓴 거래) — 정상 반복 거래와 중복 가능성이 섞여 있다
const ledger = [
  "거래일자,승인번호,거래처,품목,수량,단가,공급가액,세액,합계",
  "2026-03-02,V-0301,(가상)한빛장비,고소작업대 임대,1,1200000,1200000,120000,1320000",
  "2026-03-04,V-0302,(가상)대한자재,석고보드 9.5T,300,6800,2040000,204000,2244000",
  "2026-03-09,V-0303,(가상)동방골재,모래 · 골재,10,35000,350000,35000,385000",
  "2026-03-16,V-0304,(가상)동방골재,모래 · 골재,10,35000,350000,35000,385000",
  "2026-03-18,V-0305,(가상)대한자재,합판 12T,40,15000,600000,60000,660000",
  "2026-03-18,V-0305,(가상)대한자재,합판 12T,40,15000,600000,60000,660000",
  "2026-03-23,V-0306,(가상)동방골재,모래 · 골재,10,35000,350000,35000,385000",
  "2026-03-30,V-0307,(가상)동방골재,모래 · 골재,10,35000,350000,35000,385000",
  "2026-04-02,V-0401,(가상)한빛장비,고소작업대 임대,1,1200000,1200000,120000,1320000",
  "2026-04-06,V-0402,(가상)서울타일,포세린 타일 600x600,120,32000,3840000,384000,4224000",
  "2026-04-08,V-0403,(가상)서울타일,포세린 타일 600x600,-120,32000,-3840000,-384000,-4224000",
  "2026-04-08,V-0404,(가상)서울타일,포세린 타일 600x600,120,32000,3840000,384000,4224000",
  "2026-04-14,V-0405,(가상)미래설비,배관 자재,1,780000,780000,78000,858000",
  "2026-04-16,V-0406,(가상)미래설비,배관 자재,1,780000,780000,78000,858000",
  "2026-04-20,V-0407,(가상)대한자재,실리콘,50,2400,120000,12000,132000",
  "2026-04-20,V-0408,(가상)대한자재,실리콘,50,2400,120000,12000,132000",
  "2026-04-22,V-0409,(가상)대한자재,석고보드 9.5T,180,6800,1224000,122400,1346400",
  "2026-05-04,V-0501,(가상)한빛장비,고소작업대 임대,1,1200000,1200000,120000,1320000",
  "2026-05-07,V-0502,(가상)한빛장비,고소작업대 임대,1,1200000,1200000,120000,1320000",
  "2026-05-12,V-0503,(가상)동방전기,전선 · 배선기구,1,640000,640000,64000,704000",
  "2026-05-12,V-0504,(가상)동방전기,조명기구,1,640000,640000,64000,704000",
  "2026-06-02,V-0601,(가상)한빛장비,고소작업대 임대,1,1200000,1200000,120000,1320000",
  "2026-06-15,V-0602,(가상)대한자재,경량철골 스터드,200,4200,840000,84000,924000",
  "2026-07-01,V-0701,(가상)한빛장비,고소작업대 임대,1,1200000,1200000,120000,1320000",
  ",,합계,,,,,,",
];

const A = site("A", 32, "", true, "계약 · 변경 1차 · 정산 · 매입 장부. 줄 계산 · 합계 · 변경 대조 결과와 '확인 필요' 연결 2건, 매입 장부의 중복 가능성이 들어 있다");
const csvU = join(tmp, "ledger.csv");
writeFileSync(csvU, ledger.join("\r\n") + "\r\n");
writeFileSync(join(out, "synthetic-A-cost.csv"), execFileSync("iconv", ["-f", "UTF-8", "-t", "CP949", csvU]));
A.files.push({ path: "synthetic-A-cost.csv", display: "[가상] 매입 장부.csv", kind: "cost" });
const B = site("B", 36, "", false, "현장 A 와 같은 '사전에 없는 다른 이름'이 다시 나온다 — A 에서 회사 규칙으로 확인한 판단이 B 에서 다시 쓰이는지 본다");
writeFileSync(join(out, "index.json"), JSON.stringify({ note: "가상(합성) 공사자료 — 실제 기업 자료가 아니다", sites: [A, B] }, null, 1));
console.log([A, B].map((s) => `${s.key}: ${s.name} · ${s.files.map((f) => f.path).join(", ")}`).join("\n"));
