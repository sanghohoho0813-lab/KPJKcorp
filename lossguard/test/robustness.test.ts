// 손상 · 대용량 · 압축 폭탄 — 실제 자료를 받기 전에 "멈추지 않고, 이유를 알려 주고, 틀린 결과를 내지 않는지"
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { readWorkbook } from "../engine/io/read";
import { ZIP_LIMITS } from "../engine/io/zip";
import { analyze } from "../engine/analyze";
import { intake, MAX_FILE_BYTES } from "../app/ingest";
import pack from "../packs/construction-interior/index";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const FX = join(__dirname, "fixtures");

// 씨앗 있는 난수(같은 시험이 늘 같은 파일을 만든다)
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function zipOne(name: string, content: Uint8Array): Uint8Array {
  const nm = new TextEncoder().encode(name);
  const comp = deflateRawSync(content);
  const lh = new Uint8Array(30 + nm.length); const lv = new DataView(lh.buffer);
  lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, 8, true); lv.setUint32(18, comp.length, true); lv.setUint32(22, content.length, true); lv.setUint16(26, nm.length, true); lh.set(nm, 30);
  const ch = new Uint8Array(46 + nm.length); const cv = new DataView(ch.buffer);
  cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, 8, true); cv.setUint32(20, comp.length, true); cv.setUint32(24, content.length, true); cv.setUint16(28, nm.length, true); cv.setUint32(42, 0, true); ch.set(nm, 46);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, 1, true); ev.setUint16(10, 1, true); ev.setUint32(12, ch.length, true); ev.setUint32(16, lh.length + comp.length, true);
  const out = new Uint8Array(lh.length + comp.length + ch.length + end.length);
  out.set(lh, 0); out.set(comp, lh.length); out.set(ch, lh.length + comp.length); out.set(end, lh.length + comp.length + ch.length);
  return out;
}

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);

(async () => {
  // 1) 압축 폭탄: 한도를 넘으면 멈추고 이유를 알림
  const saved = ZIP_LIMITS.totalBytes;
  ZIP_LIMITS.totalBytes = 4 * 1024 * 1024;
  const bomb = zipOne("xl/worksheets/sheet1.xml", new Uint8Array(12 * 1024 * 1024));
  let bombMsg = "";
  try { await readWorkbook(bomb, "bomb.xlsx"); } catch (e) { bombMsg = e instanceof Error ? e.message : String(e); }
  ZIP_LIMITS.totalBytes = saved;
  ok(bomb.length < 40000 && /압축 폭탄|너무 커/.test(bombMsg), `압축 폭탄(파일 ${Math.round(bomb.length / 1024)}KB → 풀면 12MB, 시험 한도 4MB): 멈추고 이유를 알림`);

  // 2) 파일 크기 한도(30MB) — 읽기 전에 거절
  let big = "";
  try { await intake(new Uint8Array(MAX_FILE_BYTES + 1), "big.xlsx"); } catch (e) { big = e instanceof Error ? e.message : ""; }
  ok(/너무 큽니다/.test(big), "30MB 넘는 파일은 읽기 전에 거절(나눠 달라고 안내)");

  // 3) 손상 파일 퍼징: 형식마다 무작위로 바이트 바꾸기 · 자르기 · 0 으로 덮기 — 멈추지 않고(3초 안) 오류 또는 읽기
  const sources = ["synthetic-lo-v2.xlsx", "synthetic-lo-v6.xls", "synthetic-lo-v8.html", "synthetic-cp949-v2.csv"];
  for (const src of sources) {
    const orig = new Uint8Array(readFileSync(join(FX, src)));
    const r = rng(src.length * 7919);
    let read = 0, rejected = 0, hung = 0, weird = 0, analyzeFail = 0;
    const N = 60;
    for (let k = 0; k < N; k++) {
      const b = orig.slice();
      const mode = k % 3;
      if (mode === 0) for (let i = 0; i < 1 + Math.floor(r() * 20); i++) b[Math.floor(r() * b.length)] = Math.floor(r() * 256);
      else if (mode === 1) { const cut = Math.floor(r() * b.length); b.fill(0, cut, Math.min(b.length, cut + 64 + Math.floor(r() * 512))); }
      const bytes = mode === 2 ? b.slice(0, Math.floor(r() * b.length)) : b;
      const res = await withTimeout(readWorkbook(bytes, src).then((w) => ({ w }), (e) => ({ e })), 3000);
      if (res === "timeout") { hung++; continue; }
      if ("e" in res) { if (res.e instanceof Error) rejected++; else weird++; continue; }
      read++;
      try { const { format: _f, ...wb } = res.w; void _f; analyze({ docs: [{ docId: "c", kind: "contract", workbook: wb }], meta: { vat: "excluded" }, pack }); } catch { analyzeFail++; }
    }
    ok(hung === 0 && weird === 0 && analyzeFail === 0, `손상 ${src} ${N}개: 읽음 ${read} · 이유와 함께 거절 ${rejected} · 멈춤 ${hung} · 이상한 오류 ${weird} · 읽은 뒤 분석 실패 ${analyzeFail}`);
  }

  // 4) 대용량: 5만 줄 CSV(가상) — 읽기 · 분석 시간
  const lines = ["품명,규격,단위,수량,단가,금액"];
  const rr = rng(42);
  for (let i = 0; i < 50000; i++) { const q = 1 + Math.floor(rr() * 200), p = 100 * (1 + Math.floor(rr() * 900)); lines.push(`가상자재${i % 997},규격${i % 13},개,${q},${p},${q * p}`); }
  const csv = new TextEncoder().encode(lines.join("\n"));
  const t0 = Date.now();
  const wb = await readWorkbook(csv, "large.csv");
  const t1 = Date.now();
  const { format: _fmt, ...wb2 } = wb; void _fmt;
  const res = analyze({ docs: [{ docId: "c", kind: "contract", workbook: wb2 }], meta: { vat: "excluded" }, pack });
  const t2 = Date.now();
  const items = res.docs[0].sheets[0]?.lines.filter((l) => l.kind === "item").length ?? 0;
  ok(items === 50000 && res.findings.length === 0 && t2 - t0 < 60000, `5만 줄 CSV(${(csv.length / 1048576).toFixed(1)}MB): 읽기 ${t1 - t0}ms · 분석 ${t2 - t1}ms · 항목 ${items} · 오류 없는 자료에서 결과 ${res.findings.length}건`);

  process.exit(fail ? 1 : 0);
})();
