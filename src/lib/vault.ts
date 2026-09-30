import type { CompanyFile, CompanyVault, CustomDocSlot, VaultSlotState } from "./types";
import { parseKoreanDate } from "./docparse";

/**
 * 기업 서류함 — 어떤 서류를 받았고, 언제 발급됐고, 언제 만료되는지.
 *
 * 컨설팅을 하면 같은 서류를 몇 번이고 다시 찾는다. 카톡 대화방·메일·PC 폴더를 뒤지는 대신
 * 기업마다 한 곳에 두고, 유효기간이 지나면 먼저 알려 준다.
 *
 * 기본 칸은 어느 컨설팅에서나 공통으로 쓰는 서류만 둔다. 그 밖의 서류(정관, 특허 명세서 등)는
 * 담당자가 칸을 직접 만들거나 "기타 서류"에 올린다.
 */

export interface SlotMeta {
  key: string;
  label: string;
  /** 유효기간(개월) — 발급일 기준 */
  validMonths?: number;
  /** 파일 없이 "받음"만 표시하는 칸 (공동인증서처럼 파일을 두면 안 되는 것) */
  noFile?: boolean;
  /** 신분증처럼 조심해서 다룰 서류 */
  sensitive?: boolean;
  hint?: string;
  /** 어디서 발급받는지 — 서류 요청 문구에 그대로 들어간다 */
  whereToGet?: string;
  custom?: boolean;
}

export const BUILTIN_SLOTS: SlotMeta[] = [
  { key: "bizReg", label: "사업자등록증", whereToGet: "홈택스 또는 세무서에서 발급" },
  { key: "corpReg", label: "법인등기부등본", validMonths: 3, hint: "보통 3개월 이내 발급본을 요구합니다", whereToGet: "인터넷등기소 또는 등기소에서 발급 (3개월 이내 발급본)" },
  { key: "ceoId", label: "대표자 신분증 사본", sensitive: true, hint: "주민등록번호 뒷자리는 가려서 받아도 됩니다", whereToGet: "신분증 앞면 사본 (주민번호 뒷자리 가림)" },
  { key: "jointCert", label: "공동인증서", noFile: true, validMonths: 12, sensitive: true, hint: "받았는지와 어디에 두었는지만 적습니다. 비밀번호는 적지 않습니다.", whereToGet: "법인 공동인증서 (전달 방법은 따로 안내드리겠습니다)" },
  { key: "smeCert", label: "중소기업 확인서", validMonths: 12, whereToGet: "중소기업현황정보시스템(sminfo.mss.go.kr)에서 발급" },
  { key: "healthIns", label: "대표자 건강보험 자격득실확인서", validMonths: 3, sensitive: true, whereToGet: "국민건강보험공단 홈페이지 또는 정부24에서 발급" },
];

export const OTHER_SLOT = "other";
export const OTHER_LABEL = "기타 서류";

export function emptyVault(companyId: string): CompanyVault {
  return { id: companyId, companyId, slots: {}, customSlots: [] };
}

/** 이 기업의 서류 칸 전부 — 기본 칸 다음에 직접 만든 칸 */
export function slotsOf(vault: CompanyVault | undefined): SlotMeta[] {
  const custom = (vault?.customSlots ?? []).map((c: CustomDocSlot): SlotMeta => ({
    key: c.key, label: c.label, validMonths: c.validMonths, sensitive: c.sensitive, custom: true,
    hint: c.validMonths ? `직접 만든 칸입니다. 유효 ${c.validMonths}개월.` : "직접 만든 칸입니다.",
  }));
  return [...BUILTIN_SLOTS, ...custom];
}

export function slotLabel(vault: CompanyVault | undefined, key: string) {
  if (key === OTHER_SLOT) return OTHER_LABEL;
  return slotsOf(vault).find((s) => s.key === key)?.label ?? "(지운 서류 칸)";
}

/* ---------------- 날짜 ---------------- */

const pad = (n: number) => String(n).padStart(2, "0");
export function todayYmd(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 발급일 + n개월 — 1월 31일 + 1개월은 2월 28일(29일)로 맞춘다 */
export function addMonthsYmd(ymd: string, months: number): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return undefined;
  const y = Number(m[1]); const mo = Number(m[2]) - 1 + months; const d = Number(m[3]);
  const ty = y + Math.floor(mo / 12); const tm = ((mo % 12) + 12) % 12;
  const last = new Date(ty, tm + 1, 0).getDate();
  return `${ty}-${pad(tm + 1)}-${pad(Math.min(d, last))}`;
}

export function daysFromTo(from: string, to: string) {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** 남은 날 → 사람 말 */
export function dueText(daysLeft: number | null) {
  if (daysLeft === null) return "기한 미정";
  if (daysLeft < 0) return `${-daysLeft}일 지남`;
  if (daysLeft === 0) return "오늘까지";
  if (daysLeft === 1) return "내일까지";
  return `${daysLeft}일 남음`;
}

export const DOC_EXPIRING_DAYS = 30;

export interface SlotStatus {
  meta: SlotMeta;
  state: VaultSlotState;
  files: CompanyFile[];
  /** 받았는가 — 파일이 있거나 "받음"을 눌렀다 */
  received: boolean;
  expiresOn?: string;
  daysLeft: number | null;
  expired: boolean;
  expiringSoon: boolean;
  /** 받았고 만료되지 않음 */
  usable: boolean;
}

export function slotStatus(meta: SlotMeta, vault: CompanyVault | undefined, files: CompanyFile[], today: string): SlotStatus {
  const state = vault?.slots?.[meta.key] ?? { received: false };
  const mine = files.filter((f) => f.slot === meta.key).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const received = state.received || mine.length > 0;
  // 발급일: 직접 적은 값이 먼저, 없으면 가장 최근 파일에서 읽은 값
  const issued = state.issuedAt || mine.find((f) => f.issuedAt)?.issuedAt;
  const expiresOn = meta.validMonths && issued ? addMonthsYmd(issued, meta.validMonths) : undefined;
  const daysLeft = expiresOn ? daysFromTo(today, expiresOn) : null;
  const expired = received && daysLeft !== null && daysLeft < 0;
  const expiringSoon = received && daysLeft !== null && daysLeft >= 0 && daysLeft <= DOC_EXPIRING_DAYS;
  return { meta, state: { ...state, issuedAt: issued }, files: mine, received, expiresOn, daysLeft, expired, expiringSoon, usable: received && !expired };
}

/* ---------------- 파일 종류 ---------------- */

export type PreviewKind = "pdf" | "image" | "text" | "none";
export function previewKind(fileName: string, mime = ""): PreviewKind {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext) || mime.startsWith("image/")) return "image";
  if (["txt", "csv", "md"].includes(ext) || mime.startsWith("text/")) return "text";
  return "none";
}

/* ---------------- 서류 판별 ---------------- */

export type Confidence = "sure" | "maybe" | "unknown";
export const CONFIDENCE_LABEL: Record<Confidence, string> = { sure: "확실", maybe: "확인 필요", unknown: "모름" };

export interface ClassifyResult {
  /** 고른 칸. 모르면 null */
  key: string | null;
  confidence: Confidence;
  /** 사람 말로 된 근거 */
  reason: string;
  issuedAt: string | null;
  /** 칸은 없지만 무엇인지 아는 서류 — 그 이름으로 칸을 만들어 올릴 수 있다 */
  suggestedLabel: string | null;
}

interface Signal { re: RegExp; weight: number; say: string }

const BUILTIN_SIGNALS: Record<string, Signal[]> = {
  bizReg: [
    { re: /사업자등록증/, weight: 3, say: "제목 '사업자등록증'" },
    { re: /개업\s*연월일/, weight: 2, say: "'개업연월일'" },
    { re: /사업장\s*소재지/, weight: 1, say: "'사업장 소재지'" },
    { re: /교부\s*일자/, weight: 1, say: "'교부일자'" },
    { re: /법인명\s*\(?\s*단체명/, weight: 1, say: "'법인명(단체명)'" },
    { re: /업\s*태/, weight: 1, say: "'업태'" },
  ],
  corpReg: [
    { re: /등기사항\s*전부\s*증명서/, weight: 3, say: "제목 '등기사항전부증명서'" },
    { re: /회사\s*성립\s*연월일/, weight: 2, say: "'회사성립연월일'" },
    { re: /임원에\s*관한\s*사항/, weight: 2, say: "'임원에 관한 사항'" },
    { re: /등기\s*기록/, weight: 1, say: "'등기기록'" },
    { re: /1\s*주의\s*금액/, weight: 1, say: "'1주의 금액'" },
    { re: /등기\s*번호/, weight: 1, say: "'등기번호'" },
    { re: /대표\s*이사/, weight: 1, say: "'대표이사'" },
  ],
  ceoId: [
    { re: /주민\s*등록증/, weight: 3, say: "제목 '주민등록증'" },
    { re: /운전\s*면허증/, weight: 3, say: "제목 '운전면허증'" },
    { re: /여권|PASSPORT/i, weight: 2, say: "'여권'" },
    { re: /\d{6}\s*-\s*[1-4]\d{6}/, weight: 1, say: "주민등록번호 모양의 숫자" },
    { re: /발급\s*기관|시장\s*·?\s*군수|경찰청장/, weight: 1, say: "'발급기관'" },
  ],
  smeCert: [
    { re: /중소기업\s*확인서/, weight: 3, say: "제목 '중소기업확인서'" },
    { re: /중소벤처기업부/, weight: 2, say: "'중소벤처기업부'" },
    { re: /소기업|중기업|소상공인/, weight: 1, say: "'소기업·중기업'" },
    { re: /확인서\s*번호|확인\s*번호/, weight: 1, say: "'확인서 번호'" },
    { re: /유효\s*기간/, weight: 1, say: "'유효기간'" },
  ],
  healthIns: [
    { re: /자격\s*득실\s*확인서/, weight: 3, say: "제목 '자격득실확인서'" },
    { re: /국민건강보험공단/, weight: 2, say: "'국민건강보험공단'" },
    { re: /건강보험/, weight: 1, say: "'건강보험'" },
    { re: /자격\s*취득일|자격\s*상실일|가입자\s*구분/, weight: 1, say: "'자격취득일'" },
  ],
};

const BUILTIN_NAME_HINTS: Record<string, RegExp> = {
  bizReg: /사업자\s*등록증|사업자등록/,
  corpReg: /등기부|등기사항|등기\s*전부/,
  ceoId: /신분증|주민등록증|운전면허|여권/,
  smeCert: /중소기업\s*확인/,
  healthIns: /건강보험|득실/,
};

/** 기본 칸에 없지만 자주 오는 일반 서류 — 같은 이름의 칸이 있으면 그 칸으로, 없으면 "이 이름으로 칸을 만들까요" */
export const KNOWN_EXTRA_DOCS: { label: string; signals: Signal[]; nameHint: RegExp }[] = [
  { label: "법인인감증명서", signals: [{ re: /인감\s*증명서/, weight: 3, say: "제목 '인감증명서'" }, { re: /인감/, weight: 1, say: "'인감'" }], nameHint: /인감/ },
  { label: "납세증명서", signals: [{ re: /납세\s*증명서/, weight: 3, say: "제목 '납세증명서'" }, { re: /국세\s*완납|체납액?\s*없음|징수\s*유예/, weight: 1, say: "'체납액 없음'" }], nameHint: /납세|국세\s*완납/ },
  { label: "지방세 납세증명서", signals: [{ re: /지방세\s*납세\s*증명/, weight: 3, say: "제목 '지방세 납세증명서'" }], nameHint: /지방세/ },
  { label: "4대보험 완납증명서", signals: [{ re: /4대\s*(?:사회)?보험/, weight: 2, say: "'4대보험'" }, { re: /완납\s*증명/, weight: 2, say: "'완납증명'" }], nameHint: /4대\s*보험|완납/ },
  { label: "주주명부", signals: [{ re: /주주\s*명부/, weight: 3, say: "제목 '주주명부'" }], nameHint: /주주명부/ },
  { label: "정관", signals: [{ re: /정\s*관/, weight: 2, say: "'정관'" }, { re: /제\s*1\s*조|총\s*칙/, weight: 1, say: "'제1조·총칙'" }], nameHint: /^정관|_정관|정관\./ },
  { label: "통장 사본", signals: [{ re: /계좌\s*번호|예금주/, weight: 2, say: "'계좌번호·예금주'" }], nameHint: /통장/ },
];

const compact = (s: string) => s.replace(/\s+/g, "");

function plausible(ymd: string) {
  const y = Number(ymd.slice(0, 4));
  return y >= 2000 && y <= new Date().getFullYear() + 1;
}

/** 서류의 발급일 — 라벨(발급·발행·교부·출력일자) 뒤의 날짜를 먼저, 없으면 마지막 'YYYY년 M월 D일' */
export function findIssuedDate(text: string): string | null {
  const labeled = /(?:발급\s*일자?|발행\s*일자?|교부\s*일자?|출력\s*일자?)\s*[:：]?\s*([0-9년월일.\-/\s]{6,24})/.exec(text);
  const fromLabel = labeled ? parseKoreanDate(labeled[1]) : undefined;
  if (fromLabel && plausible(fromLabel)) return fromLabel;
  const all = [...text.matchAll(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)];
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const d = parseKoreanDate(all[i][0]);
    if (d && plausible(d)) return d;
  }
  return null;
}

/**
 * 이 파일은 어느 칸인가 — 낱말 맞추기. 제목이 맞고 2점 이상 앞서면 "확실", 문구 몇 개면 "확인 필요".
 * 외부 호출 없는 순수 함수.
 */
export function classifyDocument(input: { text: string; fileName: string }, slots: SlotMeta[]): ClassifyResult {
  const text = input.text ?? "";
  const name = input.fileName ?? "";
  const hasText = compact(text).length >= 10;
  const scores: Record<string, number> = {};
  const reasons: Record<string, string[]> = {};
  const bump = (key: string, w: number, say: string) => { scores[key] = (scores[key] ?? 0) + w; (reasons[key] ??= []).push(say); };
  const fileSlots = slots.filter((m) => !m.noFile);
  const labelOf = new Map(fileSlots.map((m) => [m.key, m.label]));

  for (const m of fileSlots) {
    const builtin = BUILTIN_SIGNALS[m.key];
    if (builtin) {
      for (const s of builtin) if (s.re.test(text)) bump(m.key, s.weight, s.say);
      const hint = BUILTIN_NAME_HINTS[m.key];
      if (hint && hint.test(name)) bump(m.key, 2, `파일 이름에 '${m.label}'`);
      continue;
    }
    const known = KNOWN_EXTRA_DOCS.find((k) => compact(k.label) === compact(m.label));
    if (known) {
      for (const s of known.signals) if (s.re.test(text)) bump(m.key, s.weight, s.say);
      if (known.nameHint.test(name)) bump(m.key, 2, `파일 이름에 '${m.label}'`);
    }
    const core = compact(m.label);
    if (core.length >= 2) {
      if (compact(text).includes(core)) bump(m.key, 3, `본문에 '${m.label}'`);
      if (compact(name).includes(core)) bump(m.key, 2, `파일 이름에 '${m.label}'`);
    }
  }

  let suggested: { label: string; score: number; say: string[] } | null = null;
  for (const k of KNOWN_EXTRA_DOCS) {
    if (fileSlots.some((m) => compact(m.label) === compact(k.label))) continue;
    let sc = 0; const say: string[] = [];
    for (const s of k.signals) if (s.re.test(text)) { sc += s.weight; say.push(s.say); }
    if (k.nameHint.test(name)) { sc += 2; say.push(`파일 이름에 '${k.label}'`); }
    if (sc > (suggested?.score ?? 0)) suggested = { label: k.label, score: sc, say };
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  const issuedAt = hasText ? findIssuedDate(text) : null;
  const suggest = (sg: { label: string; say: string[] }): ClassifyResult => ({ key: null, confidence: "maybe", reason: `'${sg.label}' 로 보입니다 — 이 기업에 그 칸이 없습니다 (${sg.say.join(", ")})`, issuedAt, suggestedLabel: sg.label });

  if (!top || top[1] === 0) {
    if (suggested && suggested.score >= 3) return suggest(suggested);
    return { key: null, confidence: "unknown", reason: hasText ? "아는 문구가 없습니다" : "글자를 읽지 못했습니다 — 파일 이름에도 힌트가 없습니다", issuedAt, suggestedLabel: null };
  }
  const [key, score] = top;
  const margin = score - (second?.[1] ?? 0);
  const why = (reasons[key] ?? []).join(", ");
  if (suggested && suggested.score > score && suggested.score >= 3) return suggest(suggested);
  if (!hasText) return { key, confidence: "maybe", reason: `${why} — 글자는 읽지 못했습니다`, issuedAt, suggestedLabel: null };
  if (score >= 3 && margin >= 2) return { key, confidence: "sure", reason: why, issuedAt, suggestedLabel: null };
  if (score >= 2) {
    const rival = second ? ` (${labelOf.get(second[0]) ?? second[0]} 일 수도 있습니다)` : "";
    return { key, confidence: "maybe", reason: `${why}${rival}`, issuedAt, suggestedLabel: null };
  }
  return { key, confidence: "unknown", reason: `${why} — 근거가 약합니다`, issuedAt, suggestedLabel: null };
}
