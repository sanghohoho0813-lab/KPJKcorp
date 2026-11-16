import type { RawWorkbook } from "../engine/types";
import { readWorkbook } from "../engine/io/read";
import { Pseudonyms, sanitizeWorkbook, scanWorkbook, type PiiReport } from "../engine/privacy/scan";

/**
 * 파일 받기 — 형식 판별 → 읽기 → 개인정보 검사. 원본 바이트는 여기서 끝나고 저장하지 않는다.
 *  · 멈춤(주민 · 외국인등록번호 · 카드번호): 사용자가 "지우고 쓰기"를 고르기 전에는 저장하지 않는다
 *  · 지움(휴대전화 · 이메일 · 계좌 · 이름): 저장 전에 항상 지우거나 가명으로 바꾼다
 *  · 알림(회사 전화 · 사업자번호): 그대로 둔다
 */
export interface Intake {
  fileName: string;
  size: number;
  sha256: string;
  format: string;
  workbook: RawWorkbook;
  pii: PiiReport;
}

export const MAX_FILE_BYTES = 30 * 1024 * 1024;

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function intake(bytes: Uint8Array, fileName: string): Promise<Intake> {
  if (bytes.length > MAX_FILE_BYTES) throw new Error(`파일이 너무 큽니다(${(bytes.length / 1048576).toFixed(1)}MB). 30MB 이하로 나눠 주세요.`);
  if (!bytes.length) throw new Error("빈 파일입니다.");
  const [wb, sha] = await Promise.all([readWorkbook(bytes, fileName), sha256Hex(bytes)]);
  const { format, ...workbook } = wb;
  return { fileName, size: bytes.length, sha256: sha, format, workbook, pii: scanWorkbook(workbook) };
}

/** 저장할 표 — 개인정보(멈춤 · 지움)를 지운 것. 멈춤 등급인데 사용자가 허락하지 않았으면 오류 */
export function storable(x: Intake, allowSanitizeBlock: boolean): { workbook: RawWorkbook; changedCells: number; pseudonyms: number } {
  if (x.pii.level === "block" && !allowSanitizeBlock) throw new Error("주민 · 외국인등록번호 또는 카드번호가 있습니다. 지우고 쓰기를 고르거나, 그 열을 지운 파일을 다시 받아 주세요.");
  if (x.pii.level === "none" || x.pii.level === "info") return { workbook: x.workbook, changedCells: 0, pseudonyms: 0 };
  const names = new Pseudonyms();
  const r = sanitizeWorkbook(x.workbook, names);
  return { workbook: r.workbook, changedCells: r.changed, pseudonyms: names.size };
}
