/**
 * 기업 등록에 올린 파일들 → 등록 미리보기 한 장.
 *
 * 담당자는 파일 종류를 가려서 올리지 않는다. 사업자등록증 사진 여러 장, 홈택스 PDF, 쓰던 엑셀 명단(.xlsx·.xls·CSV)…
 * 무엇을 몇 개 올리든 같은 미리보기(한 줄 = 한 기업)로 모아, 엑셀 일괄 등록과 같은 규칙으로 검사한 뒤 등록한다.
 * - 엑셀·CSV: 시트를 그대로 표로.
 * - 서류(PDF·사진): 한 장씩 읽어 한 줄로. 같은 회사의 사업자등록증과 등기부등본은 한 줄로 합친다.
 *   번호는 검증번호로 확인하고, 사진 글자 인식은 "한 번 확인"을 붙인다. 지어내지 않는다 — 못 읽은 칸은 비운다.
 */
import type { CompanyDocKind, CompanyDocMeta } from "./types";
import { bizNoValid, corpNoValid, parseExtracted, type ParsedDoc } from "./docparse";
import { normalizeCompanyName, type RowExtra } from "./company-import";
import { IMAGE_EXT, extractTextFromFile, type ExtractMethod } from "./docextract";
import type { ReadSheet } from "./xlsx";

export type FileKind = "table" | "doc" | "unknown";

const TABLE_EXT = /\.(xlsx|xlsm|xls|csv|tsv|txt|xml|htm|html)$/i;
const TABLE_MIME = /spreadsheet|ms-excel|csv|tab-separated|text\/plain|text\/html|xml/i;

export function fileKind(f: { name: string; type?: string }): FileKind {
  if (/\.pdf$/i.test(f.name) || f.type === "application/pdf" || IMAGE_EXT.test(f.name) || /^image\//.test(f.type ?? "")) return "doc";
  if (TABLE_EXT.test(f.name) || TABLE_MIME.test(f.type ?? "")) return "table";
  return "unknown";
}

/** 파일 고르기 창에 보일 형식 — 휴대폰은 image/* 덕분에 카메라·사진첩도 고를 수 있다 */
export const ACCEPT_COMPANY_FILES = ".xlsx,.xlsm,.xls,.csv,.tsv,.txt,.xml,.htm,.html,.pdf,application/pdf,image/*,.heic,.heif";

export const SUPPORTED_TEXT = "엑셀(.xlsx·.xls)·CSV 명단, 사업자등록증·법인등기부등본 PDF·사진";

export interface CompanySource {
  label: string;
  sheets: ReadSheet[];
  /** 서류에서 만든 표면 true — 열 맞추기가 필요 없다 */
  fromDocs?: boolean;
  /** 첫 시트의 줄 번호(머리글 포함 0부터) → 서류 기록·확인할 점 */
  extras?: Record<number, RowExtra>;
  /** 못 읽은 파일 등 — 미리보기 맨 위에 그대로 보인다 */
  warnings?: string[];
}

export interface ReadDoc {
  fileName: string;
  size: number;
  method: ExtractMethod;
  /** 서류 전체 글자 — 사업자 형태(법인사업자·일반과세자 …)를 알아보는 데 쓴다 */
  text: string;
  parsed: ParsedDoc;
}

/** 사업자등록증 제목 줄로 사업자 형태. 없으면 번호로 (법인등록번호가 있거나 사업자번호 가운데가 81~88이면 법인) */
export function entityOfDoc(d: Pick<ReadDoc, "text" | "parsed">): "법인" | "개인" | "" {
  const t = d.text.replace(/\s+/g, "");
  if (/법인사업자/.test(t) || d.parsed.source === "corpReg") return "법인";
  if (/(일반|간이)과세자|면세사업자/.test(t)) return "개인";
  if (d.parsed.corpNo) return "법인";
  const mid = Number((d.parsed.bizNo ?? "").replace(/\D/g, "").slice(3, 5));
  if (d.parsed.bizNo && mid >= 81 && mid <= 88) return "법인";
  if (d.parsed.bizNo && Number.isFinite(mid)) return "개인";
  return "";
}

const DOC_HEADER = ["기업명", "대표자", "사업자번호", "법인등록번호", "사업자 형태", "직책", "업태", "종목", "그 외 업태·종목", "설립일", "주소"];

interface Merged {
  docs: ReadDoc[];
  p: ParsedDoc;
  entity: "법인" | "개인" | "";
}

/** 읽은 서류들 → 미리보기 표 (같은 회사의 서류는 한 줄로) */
export function docsToSource(docs: ReadDoc[], label: string, nowIso = new Date().toISOString()): CompanySource {
  const rows: Merged[] = [];
  const digits = (s?: string) => (s ?? "").replace(/\D/g, "");
  for (const d of docs) {
    const p = d.parsed;
    const same = rows.find((m) =>
      (digits(p.bizNo).length === 10 && digits(m.p.bizNo) === digits(p.bizNo))
      || (digits(p.corpNo).length === 13 && digits(m.p.corpNo) === digits(p.corpNo))
      || (!!p.name && !!m.p.name && normalizeCompanyName(m.p.name) === normalizeCompanyName(p.name)));
    const entity = entityOfDoc(d);
    if (!same) { rows.push({ docs: [d], p: { ...p }, entity }); continue; }
    same.docs.push(d);
    // 사업자등록증 값이 우선(상호·주소·업태는 등록증이 기준), 빈 칸만 다른 서류로 채운다
    const bizFirst = d.parsed.source === "bizReg" && same.p.source !== "bizReg";
    for (const k of Object.keys(p) as (keyof ParsedDoc)[]) {
      if (k === "source") continue;
      if (same.p[k] === undefined || (bizFirst && k !== "capital" && k !== "corpNo")) (same.p as unknown as Record<string, unknown>)[k] = p[k];
    }
    if (bizFirst) same.p.source = "bizReg";
    same.entity = same.entity === "법인" || entity === "법인" ? "법인" : same.entity || entity;
  }

  const table: string[][] = [DOC_HEADER];
  const extras: Record<number, RowExtra> = {};
  // 아무 칸도 못 읽은 파일은 빈 줄을 만들지 않고 안내로 남긴다 (미리보기에서 조용히 사라지지 않게)
  const warnings: string[] = [];
  const kept = rows.filter((m) => {
    const any = (Object.keys(m.p) as (keyof ParsedDoc)[]).some((k) => k !== "source" && m.p[k] !== undefined);
    if (!any) warnings.push(`${m.docs.map((d) => d.fileName).join(", ")}: 사업자등록증·등기부등본으로 보이지 않습니다 — 흐리거나 기울었다면 더 선명한 사진이나 PDF로 올려 주세요`);
    return any;
  });
  kept.forEach((m, i) => {
    const p = m.p;
    table.push([p.name ?? "", p.ceo ?? "", p.bizNo ?? "", p.corpNo ?? "", m.entity, m.entity === "개인" ? "대표" : "", p.bizCategory ?? "", p.bizItem ?? "", p.bizItemsExtra ?? "", p.establishedAt ?? "", p.address ?? ""]);
    const problems: string[] = [];
    const notes: string[] = [];
    if (m.docs.every((d) => d.parsed.source === "unknown")) problems.push("사업자등록증·등기부등본으로 보이지 않습니다 — 서류가 맞는지 확인해 주세요");
    if (p.bizNo && !bizNoValid(p.bizNo)) problems.push(`사업자번호 ${p.bizNo}의 검증번호가 맞지 않습니다 — 잘못 읽었을 수 있어요. 더 선명한 사진이나 PDF로 다시 올리거나, 한 곳씩 등록에서 고쳐 주세요`);
    if (!p.bizNo && m.docs.some((d) => d.parsed.source === "bizReg")) notes.push("사업자번호를 읽지 못했습니다 — 등록 후 기업정보에서 넣어 주세요");
    if (p.corpNo && !corpNoValid(p.corpNo)) notes.push(`법인등록번호 ${p.corpNo}는 검증번호가 맞지 않습니다 — 서류와 한 번 대조해 주세요`);
    if (m.docs.some((d) => d.method === "ocr")) notes.push("사진 글자 인식 — 상호·대표자·주소가 한두 글자 틀릴 수 있어 등록 후 한 번 확인해 주세요");
    const docMeta: Partial<Record<CompanyDocKind, CompanyDocMeta>> = {};
    for (const d of m.docs) {
      const kind: CompanyDocKind | undefined = d.parsed.source === "corpReg" ? "corpReg" : d.parsed.source === "bizReg" ? "bizReg" : undefined;
      if (!kind || docMeta[kind]) continue;
      const fields = (Object.keys(d.parsed) as (keyof ParsedDoc)[]).filter((k) => k !== "source" && d.parsed[k] !== undefined);
      docMeta[kind] = { fileName: d.fileName, size: d.size, readAt: nowIso, method: d.method, fields };
    }
    const data: RowExtra["data"] = {};
    if (Object.keys(docMeta).length) data.docs = docMeta;
    if (p.ceoBirth) data.ceoBirth = p.ceoBirth;
    if (p.capital) data.capital = p.capital;
    extras[i + 1] = { problems, notes, data, files: m.docs.map((d) => d.fileName) };
  });
  return { label, sheets: [{ name: "서류에서 읽음", rows: table }], fromDocs: true, extras, ...(warnings.length ? { warnings } : {}) };
}

export type FilesProgress = (done: number, total: number, label: string, ratio?: number) => void;

/**
 * 고른 파일들을 미리보기 한 장으로. 브라우저에서만 쓴다(PDF·사진 읽기 모듈은 쓸 때 내려받는다).
 * 엑셀과 서류를 섞어 올리면 따로 올려 달라고 한다 — 표의 열과 서류의 칸을 억지로 합치지 않는다.
 */
export async function readCompanyFiles(files: File[], onProgress?: FilesProgress): Promise<CompanySource> {
  if (!files.length) throw new Error("파일을 골라 주세요.");
  const unknown = files.filter((f) => fileKind(f) === "unknown");
  if (unknown.length) throw new Error(`읽을 수 없는 파일입니다: ${unknown.map((f) => f.name).join(", ")} — ${SUPPORTED_TEXT}을 올려 주세요.`);
  const tables = files.filter((f) => fileKind(f) === "table");
  const docFiles = files.filter((f) => fileKind(f) === "doc");
  if (tables.length && docFiles.length) throw new Error("엑셀 명단과 서류(PDF·사진)는 따로 올려 주세요. 먼저 하나를 등록한 뒤 다른 하나를 올리면 됩니다.");

  if (tables.length) {
    const { readTableFile } = await import("./xlsx");
    const sheets: ReadSheet[] = [];
    for (const [i, f] of tables.entries()) {
      onProgress?.(i, tables.length, `${f.name} 읽는 중`);
      if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name}: 10MB 보다 큰 파일은 올릴 수 없습니다. 명단 시트만 남겨 저장해 주세요.`);
      const got = (await readTableFile(f)).filter((s) => s.rows.some((r) => r.some((v) => v.trim())));
      sheets.push(...got.map((s) => (tables.length > 1 ? { ...s, name: `${f.name} · ${s.name}` } : s)));
    }
    if (!sheets.length) throw new Error("파일에 내용이 없습니다.");
    return { label: tables.length === 1 ? tables[0].name : `엑셀 ${tables.length}개`, sheets };
  }

  const read: ReadDoc[] = [];
  const failed: string[] = [];
  for (const [i, f] of docFiles.entries()) {
    const head = docFiles.length > 1 ? `${i + 1}/${docFiles.length} ${f.name}` : f.name;
    onProgress?.(i, docFiles.length, head, 0);
    try {
      const res = await extractTextFromFile(f, (ratio, label) => onProgress?.(i, docFiles.length, `${head} — ${label}`, ratio), { namePass: true });
      read.push({ fileName: f.name, size: f.size, method: res.method, text: [res.text, res.alt].filter(Boolean).join("\n"), parsed: parseExtracted(res.text, res.alt, res.method === "ocr") });
    } catch (e) {
      failed.push(`${f.name}: ${e instanceof Error ? e.message : "읽지 못했습니다"}`);
    }
  }
  if (!read.length) throw new Error(failed.join(" / ") || "서류를 읽지 못했습니다.");
  const src = docsToSource(read, docFiles.length === 1 ? docFiles[0].name : `서류 ${docFiles.length}개`);
  // 못 읽은 파일도 숨기지 않는다 — 미리보기 맨 위 안내로
  if (failed.length) src.warnings = [...failed, ...(src.warnings ?? [])];
  return src;
}

/** 등록 창(한 곳씩)에서: 이 파일들은 일괄 등록으로 넘길까? — 엑셀이거나 서류가 여러 장이면 */
export function shouldGoBulk(files: File[]) {
  return files.some((f) => fileKind(f) === "table") || files.filter((f) => fileKind(f) === "doc").length > 1;
}

