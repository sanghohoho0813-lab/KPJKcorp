/**
 * LossGuard 엔진의 자료형.
 * 업종 낱말(머리글 이름 · 단위 · 같은 뜻 낱말 · 합계 낱말)은 여기에 없다 — 업종 묶음(IndustryPack)이 준다.
 * 엔진은 화면 · 통신 · Node 모듈 · 현재 시각을 쓰지 않는다(같은 입력이면 같은 결과).
 */

// ── 원본(읽은 그대로) ────────────────────────────────────────────────
export type CellType = "text" | "num" | "empty";
/**
 * v: 파일에 적힌 글자(숫자는 저장된 값의 글자), n: 숫자 칸이면 그 값, f: 수식 칸,
 * shown: 저장된 값이 아니라 화면에 보이던 글자만 남은 칸(CSV · HTML 표) — 숫자가 표시 자릿수로 반올림되어 있을 수 있다
 */
export interface RawCell { v: string; t: CellType; n?: number; f?: boolean; shown?: boolean }
/** 병합 범위(0부터, 끝 포함) */
export interface Merge { r1: number; c1: number; r2: number; c2: number }
export interface RawSheet {
  name: string;
  hidden: boolean;
  rows: RawCell[][];
  merges: Merge[];
  hiddenRows: number[];
  hiddenCols: number[];
}
export interface RawWorkbook { fileName: string; sheets: RawSheet[] }

// ── 구조 ────────────────────────────────────────────────────────────
export type LeafRole = "no" | "name" | "spec" | "unit" | "qty" | "unitPrice" | "amount" | "note";
/** 열 묶음: 재료비 · 노무비 · 경비 · 합계 / 변경 전 · 변경 후 · 증감(정산서의 계약 · 정산도 같은 묶음) */
export type GroupKey = "mat" | "lab" | "exp" | "sum" | "before" | "after" | "delta";
export type SheetKind = "cover" | "summary" | "detail" | "unitcost" | "other";
export type LineKind = "item" | "section" | "subtotal" | "total" | "adjust" | "tax" | "note";
/** cost: 매입 · 지급 장부(세금계산서 목록 · 거래명세서 목록 · 지급 내역) — 내역서 읽기가 아니라 장부 읽기로 읽는다 */
export type DocKind = "contract" | "change" | "settlement" | "cost" | "other";
export type SheetShape = "plain" | "split" | "compare" | "none";

export interface ColumnEvidence { name: number; shape: number; arith: number }
export interface ColumnAssign {
  col: number;
  role: LeafRole;
  group?: GroupKey;
  /** 머리글 경로(예: "재료비>단가") — 원문 */
  label: string;
  evidence: ColumnEvidence;
  /** 어떻게 정했나: 머리글 이름 / 산술 관계 / 자료 모양 / 사람이 지정 */
  via: "name" | "arith" | "shape" | "decision";
}

export interface Num3 { qty?: number; unitPrice?: number; amount?: number }

export interface NormName {
  /** 띄어쓰기 · 기호를 지운 이름 */
  compact: string;
  /** 같은 뜻 낱말을 대표 낱말로 바꾼 compact */
  canon: string;
  tokens: string[];
  bigrams: string[];
  /** 한글을 자모로 풀어 만든 글자 두 개 묶음(오타 비교용) */
  jamo: string[];
  specNums: string[];
  specWords: string[];
  unit: string;
}

export interface Line {
  docId: string;
  sheet: string;
  sheetIndex: number;
  /** 0부터 센 행 번호(화면에는 +1) */
  row: number;
  kind: LineKind;
  hidden: boolean;
  level: number;
  /** 속한 구간(공종 등)의 이름 경로 */
  path: string[];
  /** 속한 구간의 열쇠(구간 줄이면 자기 열쇠) */
  sectionKey: string;
  /** 합계 줄이 닫는 구간의 열쇠 */
  closes?: string;
  no: string;
  name: string;
  spec: string;
  unit: string;
  qty?: number;
  unitPrice?: number;
  amount?: number;
  groups: Partial<Record<GroupKey, Num3>>;
  /** 값이 나온 칸: "qty" · "unitPrice" · "amount" · "name" · "mat.amount" · "after.qty" … → 열 번호 */
  cols: Record<string, number>;
  norm: NormName;
  /** 줄 지문 — 행 번호를 넣지 않는다(행이 밀려도 같은 줄) */
  fp: string;
  flags: string[];
}

export interface SheetChecks { arithRows: number; arithOk: number; totalRows: number; totalOk: number; coverage: number }
export interface CoverAmount { row: number; col: number; amount: number; label: string }

export interface ParsedSheet {
  docId: string;
  fileName: string;
  sheet: string;
  sheetIndex: number;
  kind: SheetKind;
  hidden: boolean;
  headerRows: number[];
  columns: ColumnAssign[];
  shape: SheetShape;
  lines: Line[];
  confidence: number;
  checks: SheetChecks;
  coverAmounts: CoverAmount[];
  diagnostics: string[];
}
export interface ParsedDoc { docId: string; kind: DocKind; round?: number; fileName: string; sheets: ParsedSheet[] }

// ── 연결 · 결과 ─────────────────────────────────────────────────────
export interface LineRef { docId: string; sheet: string; row: number; fp: string }
export type LinkState = "auto" | "review" | "confirmed" | "rejected";
export interface Link {
  a: LineRef;
  b: LineRef;
  score: number;
  state: LinkState;
  /** 점수의 항목별 기여(설명용) */
  parts: Record<string, number>;
  via: "align" | "global" | "decision";
}
export interface LineageItem {
  docId: string;
  status: "changed" | "same" | "added" | "removed";
  base?: LineRef;
  next?: LineRef;
  name: string;
  qtyBefore?: number;
  qtyAfter?: number;
  amountBefore?: number;
  amountAfter?: number;
  linkState?: LinkState;
}

export interface EvidenceRef {
  docId: string;
  fileName: string;
  sheet: string;
  row: number;
  /** 근거 칸: 이름 → 열 번호 */
  cols: Record<string, number>;
  /** 그 칸의 원문 글자 */
  values: Record<string, string>;
  role: "base" | "compare";
}
export type DetectorKey = "D01" | "D02" | "D03" | "D10";
export interface Finding {
  key: string;
  detector: DetectorKey;
  check: string;
  severity: "high" | "mid" | "low";
  title: string;
  message: string;
  amount?: number;
  certainty: "calc" | "linked" | "inferred";
  evidence: EvidenceRef[];
  calc: { expr: string; inputs: Record<string, number> };
  caveat?: string;
}

// ── 입력 · 출력 ─────────────────────────────────────────────────────
export interface DocInput { docId: string; kind: DocKind; round?: number; workbook: RawWorkbook }
export interface CaseMeta {
  /** 계약금액(공급가액 기준이면 vat = "excluded") */
  contractAmount?: number;
  vat: "excluded" | "included";
  changes?: { round: number; prevAmount?: number; newAmount?: number }[];
}
export interface ColumnDecision { docId: string; sheet: string; columns: { col: number; role: LeafRole; group?: GroupKey }[] }
export interface LinkDecision { a: string; b: string; same: boolean }
export interface Decisions { columns?: ColumnDecision[]; links?: LinkDecision[] }

export interface MatchOptions { synonyms?: boolean; align?: boolean; specPrice?: boolean }

export interface AnalyzeInput {
  docs: DocInput[];
  meta: CaseMeta;
  pack: IndustryPack;
  decisions?: Decisions;
  options?: { matching?: MatchOptions };
}
export interface AnalyzeResult {
  docs: ParsedDoc[];
  links: Link[];
  lineage: LineageItem[];
  findings: Finding[];
  skipped: { detector: string; reason: string }[];
  /** 매입 · 지급 장부(cost 문서)를 읽은 결과 */
  ledgers: ParsedLedger[];
  versions: { engine: string; pack: string; inputHash: string };
}

// ── 매입 · 지급 장부 ────────────────────────────────────────────────
export type LedgerRole = "date" | "vendor" | "vendorId" | "item" | "spec" | "qty" | "unitPrice" | "supply" | "tax" | "total" | "docNo" | "site" | "note";
export interface LedgerRecord {
  row: number;
  /** YYYY-MM-DD (읽지 못하면 없음) */
  date?: string;
  /** 1970-01-01 부터 센 날 수(간격 계산용) */
  day?: number;
  vendor: string;
  item: string;
  /** 비교에 쓰는 금액: 공급가액이 있으면 공급가액, 없으면 합계 */
  amount: number;
  docNo: string;
  /** 값이 나온 칸: 역할 → 열 번호 */
  cols: Partial<Record<LedgerRole, number>>;
  /** 거래 지문 — 행 번호를 넣지 않는다 */
  fp: string;
}
export interface ParsedLedger {
  docId: string;
  fileName: string;
  sheet: string;
  sheetIndex: number;
  headerRow: number;
  columns: { col: number; role: LedgerRole; label: string }[];
  records: LedgerRecord[];
  diagnostics: string[];
}

// ── 업종 묶음 ───────────────────────────────────────────────────────
export interface PackParams {
  /** 줄 계산 허용 오차: max(lineAbsTol, |금액| × lineRelTol) */
  lineAbsTol: number;
  lineRelTol: number;
  /** 합계 허용 오차: max(1, 줄 수 × sumTolPerLine) */
  sumTolPerLine: number;
  /** 자동 연결 · 확인 대기 · 순서 정렬 문턱 */
  tAuto: number;
  tReview: number;
  tAlign: number;
  /** 읽기 신뢰도가 이보다 낮으면 사람에게 열을 묻는다 */
  confidenceThreshold: number;
  /** 계약금액 대비 비율로 정하는 심각도 */
  severityHigh: number;
  severityMid: number;
  /** D10: 같은 거래처 · 같은 금액을 "가까운 날"로 보는 최대 날 수(초기 가설) */
  dupWindowDays: number;
}
export interface IndustryPack {
  key: string;
  version: string;
  label: string;
  headerAliases: Record<LeafRole, string[]>;
  groupAliases: Record<GroupKey, string[]>;
  subtotalWords: string[];
  totalWords: string[];
  adjustWords: string[];
  taxWords: string[];
  overheadWords: string[];
  noteMarkers: string[];
  nameNoise: string[];
  sheetNames: Record<Exclude<SheetKind, "other">, string[]>;
  coverAmountLabels: string[];
  units: { code: string; forms: string[] }[];
  unitConversions: { a: string; b: string; factor: number }[];
  synonyms: string[][];
  /** 매입 · 지급 장부의 머리글 별칭 */
  ledgerAliases: Record<LedgerRole, string[]>;
  params: PackParams;
}
