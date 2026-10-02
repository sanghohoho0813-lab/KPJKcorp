import type { Company } from "./types";

/**
 * 서버에 붙기 전, 이 브라우저(데모 저장소)에만 입력해 둔 기업을 지키는 곳.
 *
 * 서버로 로그인하는 순간 화면은 서버 내용으로 바뀐다. 그 전에 이 브라우저에서 직접 등록한 기업(샘플 제외)을
 * 따로 보관해 두었다가, 서버 화면에서 "서버로 올리기" 한 번으로 옮긴다.
 * (예: 서버 연결 전 PC 에서 3곳을 등록 → 휴대폰에서 안 보임 → 연결 후 PC 에서 올리면 어디서나 보임)
 *
 * 기업 기본 정보·담당자·주주·직접 만든 칸만 옮긴다. 데모 모드의 서류함 파일은 실제 파일이 없으므로 옮기지 않는다.
 */
const KEY = "kpjk-local-carryover";

export interface Carryover {
  savedAt: string;
  companies: Company[];
}

export function loadCarryover(): Carryover | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (!raw) return null;
    const v = JSON.parse(raw) as Carryover;
    return Array.isArray(v?.companies) && v.companies.length ? v : null;
  } catch { return null; }
}

export function clearCarryover() {
  try { window.localStorage.removeItem(KEY); } catch { /* 저장소 막힘 */ }
}

/** 직접 입력한 기업만 골라 보관한다(같은 기업은 한 번만). 보관한 수를 돌려준다 */
export function stashLocalCompanies(companies: Company[]): number {
  const mine = companies.filter((c) => !c.sample && c.name?.trim());
  if (!mine.length) return 0;
  try {
    const prev = loadCarryover()?.companies ?? [];
    const key = (c: Company) => (c.bizNo?.replace(/\D/g, "") || c.name.replace(/\s|\(주\)|주식회사/g, ""));
    const seen = new Set(prev.map(key));
    const merged = [...prev, ...mine.filter((c) => !seen.has(key(c)))];
    window.localStorage.setItem(KEY, JSON.stringify({ savedAt: new Date().toISOString(), companies: merged } satisfies Carryover));
    return merged.length;
  } catch { return 0; }
}

/** 서버 목록에 이미 있는 기업인가 — 사업자번호가 같거나, 없으면 이름이 같으면 같은 기업으로 본다 */
export function sameCompany(a: Pick<Company, "name" | "bizNo">, b: Pick<Company, "name" | "bizNo">) {
  const na = a.bizNo?.replace(/\D/g, ""), nb = b.bizNo?.replace(/\D/g, "");
  if (na && nb) return na === nb;
  const n = (s: string) => s.replace(/\s|\(주\)|주식회사|㈜/g, "");
  return n(a.name) === n(b.name);
}
