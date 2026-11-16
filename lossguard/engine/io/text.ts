import type { Merge, RawCell, RawSheet } from "../types";

/**
 * 글자 파일 읽기 — CSV · TSV(은행 · ERP 내려받기)와 웹에서 받은 "엑셀"(사실은 HTML 표).
 * 글자 판별: BOM(UTF-8 · UTF-16) → UTF-8(엄격) → CP949(EUC-KR 확장). 숫자도 글자 그대로 둔다(엔진이 1,234 · (1,000) 등을 읽는다).
 */
export function decodeText(b: Uint8Array): string {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder("utf-8").decode(b.subarray(3));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
  try { return new TextDecoder("utf-8", { fatal: true }).decode(b); } catch { /* UTF-8 아님 */ }
  try { return new TextDecoder("euc-kr").decode(b); } catch { /* 디코더 없음 */ }
  return new TextDecoder("utf-8").decode(b);
}

const cell = (s: string): RawCell => (s.trim() ? { v: s.trim(), t: "text" } : { v: "", t: "empty" });

/** 구분자 짐작: 따옴표 밖 개수가 줄마다 고르게 나오는 것 */
function guessDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
  let best = ",", bestScore = -1;
  for (const d of [",", "\t", ";", "|"]) {
    const counts = lines.map((l) => { let n = 0, q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === d && !q) n++; } return n; });
    const max = Math.max(0, ...counts);
    if (!max) continue;
    const same = counts.filter((c) => c === max).length;
    const score = max * same;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

export function parseDelimited(text: string, delimiter?: string): string[][] {
  const d = delimiter ?? guessDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
      continue;
    }
    if (ch === '"' && field === "") q = true;
    else if (ch === d) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function csvSheet(text: string, name: string): RawSheet {
  const rows = parseDelimited(text).map((r) => r.map(cell));
  while (rows.length && rows[rows.length - 1].every((c) => c.t === "empty")) rows.pop();
  return { name, hidden: false, rows, merges: [], hiddenRows: [], hiddenCols: [] };
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function htmlText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m))
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** HTML 표(들) → 시트(들). rowspan · colspan 은 병합으로 */
export function htmlSheets(html: string, baseName: string): RawSheet[] {
  const out: RawSheet[] = [];
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  let from = 0;
  const used = new Set<string>();
  tables.forEach((t, ti) => {
    // 시트 이름: 표 제목(caption) → 표 바로 앞 제목(h1~h6, 강조 글자 우선) → "파일 이름 n"
    const at = html.indexOf(t, from);
    const before = html.slice(from, at);
    from = at + t.length;
    const cap = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(t)?.[1];
    const heads = [...before.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
    const head = heads.length ? heads[heads.length - 1][1] : undefined;
    const em = head ? /<em\b[^>]*>([\s\S]*?)<\/em>/i.exec(head)?.[1] : undefined;
    let name = htmlText(cap ?? em ?? head ?? "").slice(0, 31) || (tables.length > 1 ? `${baseName} ${ti + 1}` : baseName);
    while (used.has(name)) name = `${name} ${ti + 1}`;
    used.add(name);
    const rows: RawCell[][] = [];
    const merges: Merge[] = [];
    const taken = new Set<string>();
    const trs = t.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
    trs.forEach((tr, r) => {
      rows[r] ??= [];
      let c = 0;
      for (const m of tr.matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
        while (taken.has(`${r},${c}`)) c++;
        const attrs = m[2];
        const rs = Math.max(1, Number(/rowspan\s*=\s*["']?(\d+)/i.exec(attrs)?.[1] ?? 1));
        const cs = Math.max(1, Number(/colspan\s*=\s*["']?(\d+)/i.exec(attrs)?.[1] ?? 1));
        const text = htmlText(m[3]);
        while (rows[r].length < c) rows[r].push({ v: "", t: "empty" });
        rows[r][c] = cell(text);
        if (rs > 1 || cs > 1) {
          merges.push({ r1: r, c1: c, r2: r + rs - 1, c2: c + cs - 1 });
          for (let rr = r; rr < r + rs; rr++) for (let cc = c; cc < c + cs; cc++) if (rr !== r || cc !== c) taken.add(`${rr},${cc}`);
        }
        c += cs;
      }
    });
    for (let k = 0; k < rows.length; k++) if (!rows[k]) rows[k] = [];
    if (rows.some((rw) => rw.some((x) => x.t !== "empty"))) out.push({ name, hidden: false, rows, merges, hiddenRows: [], hiddenCols: [] });
  });
  return out;
}
