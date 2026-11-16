/**
 * LossGuard 제품 로직의 자료형 — 화면 · 저장소와 무관한 순수 자료.
 * 시연 화면(demo/)은 이 자료를 브라우저 안(IndexedDB)에 저장하고, 나중에 KPJK 포털에 붙일 때는 같은 자료를 서버 저장소에 둔다(§M 설계).
 *
 * 원칙
 *  - 자동 판단(엔진)과 사람 판단(Judgment)을 섞지 않는다. 사람 판단은 지우지 않고 판(version)을 올려 남긴다.
 *  - 사람 판단마다 누가 · 언제 · 어떤 파일 · 어떤 판의 엔진에서 · 어떤 범위(현장 / 회사)로 내렸는지 남긴다.
 *  - 탐지 결과는 "확인할 곳"이지 손실이 아니다. 실제 반영 금액은 사용자가 입력한 값만 쓴다.
 */
import type { AnalyzeResult, DocKind, Finding, GroupKey, LeafRole, LinkState, RawWorkbook } from "../engine/types";
import type { PiiLevel, PiiKind } from "../engine/privacy/scan";

export type FileKind = Exclude<DocKind, "other">;

export interface Company { id: string; name: string; createdAt: string }

export interface Site {
  id: string;
  companyId: string;
  name: string;
  client?: string;
  location?: string;
  /** 준공(완료) · 진행 중 — D04 같은 탐지는 준공 현장에서만 경고로 낸다(명세 §C-6-1) */
  status: "progress" | "completed";
  contractAmount?: number;
  vat: "excluded" | "included";
  changes: { round: number; prevAmount?: number; newAmount?: number }[];
  memo?: string;
  createdAt: string;
}

/** 올린 파일 — 원본 바이트는 저장하지 않는다. 읽은 값(개인정보를 지운 것)만 저장한다 */
export interface StoredFile {
  id: string;
  siteId: string;
  kind: FileKind;
  round?: number;
  fileName: string;
  size: number;
  sha256: string;
  format: string;
  uploadedAt: string;
  uploadedBy: string;
  pii: { level: PiiLevel | "none"; counts: Partial<Record<PiiKind, number>>; changedCells: number; pseudonyms: number };
  /** 분석에 쓰는가(같은 종류 · 차수의 새 파일이 오면 이전 파일은 쉬게 한다) */
  active: boolean;
}
export interface StoredWorkbook { fileId: string; workbook: RawWorkbook }

// ── 사람 판단 ────────────────────────────────────────────────────────
export interface LineSnap { fileId: string; sheet: string; row: number; fp: string; name: string; spec: string; unit: string; qty?: number; unitPrice?: number; amount?: number }
export interface ColumnJudgment { type: "column"; fileId: string; sheet: string; columns: { col: number; role: LeafRole; group?: GroupKey }[]; before: { col: number; role: LeafRole; group?: GroupKey }[] }
export interface LinkJudgment { type: "link"; same: boolean; a: LineSnap; b: LineSnap }
/** 회사 규칙: 이 회사의 다른 현장에도 쓰는 "이 이름 = 저 이름" 판단 */
export interface NameRule { type: "nameRule"; same: boolean; aKey: string; bKey: string; a: { name: string; spec: string; unit: string }; b: { name: string; spec: string; unit: string } }
export type JudgmentPayload = ColumnJudgment | LinkJudgment | NameRule;

export interface Judgment {
  id: string;
  companyId: string;
  /** 현장 판단이면 그 현장, 회사 규칙이면 처음 판단한 현장(출처) */
  siteId: string;
  scope: "site" | "company";
  /** 같은 대상의 판들을 묶는 열쇠 */
  subject: string;
  version: number;
  status: "active" | "superseded" | "withdrawn";
  payload: JudgmentPayload;
  by: string;
  at: string;
  note?: string;
  source: { siteName: string; fileName?: string; fileHash?: string; sheet?: string; row?: number; runNo?: number; engine: string; pack: string };
}

// ── 분석 실행 ────────────────────────────────────────────────────────
/** 연결이 어떻게 정해졌나 — 자동 판단과 사람 판단을 구분한다 */
export type LinkOrigin = "auto" | "review" | "person" | "rule" | "person-rejected" | "rule-rejected";
/** calc: 원본 숫자끼리의 계산으로 확인되는 불일치 · unconfirmed: 자동 연결 · 추정에 기대는 불일치(사람 확인 전에는 단정하지 않음) */
export type FindingCategory = "calc" | "unconfirmed";
export interface FindingSnap {
  key: string; detector: string; check: string; title: string; message: string; amount?: number;
  certainty: Finding["certainty"]; severity: Finding["severity"]; category: FindingCategory;
  where: string;
}
export interface LinkSnap { a: string; b: string; docB: string; state: LinkState; origin: LinkOrigin; score: number; aName: string; bName: string }
export interface RunSnapshot {
  findings: FindingSnap[];
  links: LinkSnap[];
  columns: { fileId: string; sheet: string; confidence: number; roles: string }[];
  skipped: { detector: string; reason: string }[];
  counts: { auto: number; review: number; person: number; rule: number; rejected: number; unlinkedBase: number; unlinkedOther: number; items: number };
}
export interface Run {
  id: string;
  siteId: string;
  no: number;
  at: string;
  by: string;
  engine: string;
  pack: string;
  inputHash: string;
  files: { id: string; fileName: string; sha256: string; kind: FileKind; round?: number }[];
  judgmentIds: string[];
  rulesApplied: number;
  snapshot: RunSnapshot;
}

// ── 결과 처리(자기주도 해결) ──────────────────────────────────────────
export type CaseStatus = "open" | "checking" | "confirmed" | "not_issue" | "on_hold" | "action" | "done";
export interface CaseEvent {
  at: string;
  by: string;
  type: "status" | "note" | "action" | "reflected" | "auto";
  from?: CaseStatus;
  to?: CaseStatus;
  text?: string;
  amount?: number | null;
}
export interface FindingCase {
  siteId: string;
  key: string;
  status: CaseStatus;
  /** 조치 내용(조치 단계에서 적음) */
  action?: string;
  /** 실제 반영 금액 — 사용자가 입력한 값만. null = "반영 금액 없음"을 사용자가 고름, undefined = 아직 입력 안 함 */
  reflected?: { amount: number | null; note: string; by: string; at: string };
  history: CaseEvent[];
  firstRun: number;
  lastRun: number;
  /** 최근 분석에도 있는가(열 지정 · 연결을 바꾸면 사라질 수 있다) */
  present: boolean;
  snapshot: FindingSnap;
}

/** 분석 한 번의 결과(화면이 쓰는 것) — 저장하지 않고 필요할 때 다시 계산한다 */
export interface AnalysisView {
  result: AnalyzeResult;
  origins: Map<string, LinkOrigin>;
  /** 적용한 회사 규칙 · 적용하지 못한 회사 규칙(이유) */
  rules: { applied: { judgmentId: string; a: string; b: string }[]; skipped: { judgmentId: string; reason: string }[] };
  snapshot: RunSnapshot;
}

export interface Clock { now(): string; id(): string }
