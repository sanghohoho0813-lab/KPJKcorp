import type { RawWorkbook } from "../types";
import { readXlsx } from "./xlsx";
import { readXls } from "./xls";
import { isCfb, readCfb } from "./cfb";
import { csvSheet, decodeText, htmlSheets } from "./text";

/**
 * 파일 하나 → RawWorkbook. 확장자가 아니라 내용(앞부분 바이트)으로 형식을 판별한다
 * (예: 확장자는 .xls 인데 내용은 HTML 표인 웹 내려받기 파일).
 * 지원: .xlsx · .xls(BIFF8) · CSV/TSV(UTF-8 · CP949 · UTF-16) · HTML 표. 그 밖의 형식은 이유와 함께 거절한다.
 */
export class FormatError extends Error {}

export type DetectedFormat = "xlsx" | "xls" | "csv" | "html" | "spreadsheetml" | "pdf" | "hwp" | "doc" | "zip-other" | "unknown";

export function detectFormat(b: Uint8Array): DetectedFormat {
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "xlsx";
  if (isCfb(b)) {
    try {
      const names = [...readCfb(b).keys()];
      if (names.includes("Workbook") || names.includes("Book")) return "xls";
      if (names.some((n) => /hwp/i.test(n)) || names.includes("FileHeader")) return "hwp";
      if (names.includes("WordDocument")) return "doc";
    } catch { return "unknown"; }
    return "unknown";
  }
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  const head = decodeText(b.subarray(0, Math.min(b.length, 4096))).toLowerCase();
  if (head.includes("urn:schemas-microsoft-com:office:spreadsheet")) return "spreadsheetml";
  if (/<table\b/.test(head) || (/<html\b/.test(head) && /<table\b/.test(decodeText(b).toLowerCase()))) return "html";
  if (/[\x00-\x08\x0e-\x1f]/.test(head.replace(/[\t\r\n]/g, ""))) return "unknown";
  return "csv";
}

const baseName = (f: string) => (f.split(/[\\/]/).pop() ?? f).replace(/\.[^.]+$/, "") || "Sheet1";

export async function readWorkbook(bytes: Uint8Array, fileName = ""): Promise<RawWorkbook & { format: DetectedFormat }> {
  const format = detectFormat(bytes);
  switch (format) {
    case "xlsx": {
      try { return { ...(await readXlsx(bytes, fileName)), format }; }
      catch (e) { throw new FormatError(`엑셀(.xlsx)로 열지 못했습니다: ${e instanceof Error ? e.message : e}. 한글(.hwpx) · 워드(.docx)라면 엑셀 또는 PDF 로 저장해 주세요.`); }
    }
    case "xls": return { ...readXls(bytes, fileName), format };
    case "csv": return { fileName, sheets: [csvSheet(decodeText(bytes), baseName(fileName))], format };
    case "html": return { fileName, sheets: htmlSheets(decodeText(bytes), baseName(fileName)), format };
    case "spreadsheetml": throw new FormatError("Excel 2003 XML 형식은 아직 읽지 않습니다. 엑셀에서 .xlsx 로 저장해 주세요.");
    case "pdf": throw new FormatError("PDF 는 아직 읽지 않습니다(표 인식 정확도 문제). 원본 엑셀 파일을 부탁드립니다.");
    case "hwp": throw new FormatError("한글(.hwp) 파일은 읽지 않습니다. 표를 엑셀로 옮기거나 원본 엑셀을 부탁드립니다.");
    case "doc": throw new FormatError("워드 문서는 읽지 않습니다. 원본 엑셀을 부탁드립니다.");
    default: throw new FormatError("알 수 없는 파일 형식입니다.");
  }
}
