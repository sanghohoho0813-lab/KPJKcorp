import type { Finding } from "../engine/types";
import type { CaseStatus, FindingCategory } from "./model";

/**
 * 결과를 처음 보는 대표도 알 수 있게 — 무엇이 · 왜 · 어떻게 계산했는지 · 문제가 아닐 수 있는 경우.
 * 표현 원칙: "손실"이라 하지 않는다. 금액은 "차이 금액(확인 필요)"이다. 실제 반영 금액은 사용자가 입력한 값만 쓴다.
 */
export const CATEGORY: Record<FindingCategory, { label: string; plain: string }> = {
  calc: { label: "계산 불일치", plain: "파일에 적힌 숫자끼리 계산이 맞지 않습니다. 계산 자체는 확인되지만, 그 차이가 실제 손해인지는 담당자가 확인해야 합니다." },
  unconfirmed: { label: "미확인 불일치", plain: "자동 연결이나 추정에 기댄 결과입니다. 사람이 확인하기 전에는 불일치로 단정하지 않습니다." },
};

export const STATUS: Record<CaseStatus, { label: string; tone: "neutral" | "info" | "warning" | "error" | "success" }> = {
  open: { label: "검토 필요", tone: "warning" },
  checking: { label: "확인 중", tone: "info" },
  confirmed: { label: "실제 문제 확인", tone: "error" },
  not_issue: { label: "문제 아님", tone: "neutral" },
  on_hold: { label: "판단 보류", tone: "neutral" },
  action: { label: "조치 중", tone: "info" },
  done: { label: "완료", tone: "success" },
};

export const DETECTOR: Record<string, string> = {
  D01: "줄 계산",
  D02: "합계 대조",
  D03: "변경 대조",
  D10: "중복 가능성",
};

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toLocaleString("ko-KR", { maximumFractionDigits: 4 }));

/** 계산 과정 — 근거 숫자로 한 줄씩 */
export function calcSteps(f: Finding): string[] {
  const i = f.calc.inputs;
  const has = (...k: string[]) => k.every((x) => typeof i[x] === "number");
  if (f.detector === "D01" && has("qty", "unitPrice", "amount")) {
    const c = i.qty * i.unitPrice;
    return [`수량 ${num(i.qty)} × 단가 ${won(i.unitPrice)} = ${won(c)}`, `파일에 적힌 금액 ${won(i.amount)}`, `차이 ${won(i.amount - c)} (적힌 금액 − 계산 금액)`];
  }
  if (f.detector === "D01" && has("parts", "sum")) return [`재료비 · 노무비 · 경비 금액의 합 ${won(i.parts)}`, `합계 금액 ${won(i.sum)}`, `차이 ${won(i.parts - i.sum)}`];
  if (has("value", "expected")) return [`적힌 값 ${won(i.value)}`, `${f.calc.expr.replace(/^적힌 값 − /, "")}: ${won(i.expected)}`, `차이 ${won(i.value - i.expected)}`];
  if (has("summary", "detail")) return [`요약 시트의 구간 금액 ${won(i.summary)}`, `세부 시트의 같은 구간 항목 합 ${won(i.detail)}`, `차이 ${won(i.summary - i.detail)}`];
  if (has("document", "contract")) return [`문서의 최종 합계 ${won(i.document)}`, `입력한 계약금액 ${won(i.contract)}`, `차이 ${won(i.document - i.contract)}`];
  if (has("cover", "total")) return [`표지 금액 ${won(i.cover)}`, `합계 ${won(i.total)}`, `차이 ${won(i.cover - i.total)}`];
  if (has("value", "target")) return [`${f.calc.expr.split(" − ")[0]} ${won(i.value)}`, `${f.calc.expr.split(" − ")[1] ?? "기준"} ${won(i.target)}`, `차이 ${won(i.value - i.target)}`];
  if (has("hiddenSum", "hiddenRows")) return [`숨긴 행 ${i.hiddenRows}개의 금액 합 ${won(i.hiddenSum)}`, f.calc.expr];
  if (has("beforeQty", "contractQty")) return [`변경 문서의 '변경 전' 수량 ${num(i.beforeQty)} / 계약 문서 수량 ${num(i.contractQty)}`, `변경 문서의 '변경 전' 금액 ${won(i.beforeAmount ?? 0)} / 계약 문서 금액 ${won(i.contractAmount ?? 0)}`];
  if (f.detector === "D10") return [f.calc.expr, ...(has("amount") ? [`거래 한 건 금액 ${won(i.amount)}`] : []), "두 거래가 같은 거래인지는 원본(세금계산서 · 거래명세서 · 지급 내역)으로만 확인할 수 있습니다"];
  const parts = Object.entries(i).map(([k, v]) => `${k} ${num(v)}`);
  return [f.calc.expr, ...(parts.length ? [parts.join(" · ")] : [])];
}

/** 한 문단 설명 */
export function plainWhy(f: Finding): string {
  switch (f.detector) {
    case "D01": return "같은 줄 안의 숫자(수량 · 단가 · 금액)끼리 계산이 맞지 않습니다. 수식이 값으로 바뀌었거나, 손으로 고친 금액일 수 있습니다.";
    case "D02": return "합계 · 소계 · 요약 시트 · 표지의 금액이 그 아래 항목들의 합과 다릅니다. 항목을 고친 뒤 합계를 고치지 않았거나, 일부러 조정한 금액일 수 있습니다.";
    case "D03": return "변경 문서의 숫자가 변경 전 · 증감 · 변경 후 사이에서, 또는 계약 문서와 서로 맞지 않습니다. 변경 합의 금액을 확인할 곳입니다.";
    case "D10": return "같은 거래처 · 같은 금액의 거래가 짧은 간격으로 두 번 적혀 있습니다. 같은 거래를 두 번 적었거나 두 번 지급했을 가능성이 있지만, 정상적인 추가 주문일 수도 있습니다.";
    default: return f.message;
  }
}

export function amountLabel(f: Finding): string {
  if (f.amount === undefined) return "금액 없음";
  return f.detector === "D10" ? `확인 필요 금액 ${won(f.amount)}` : `차이 금액 ${won(f.amount)}`;
}

/** 근거 칸 이름(엔진의 열쇠 → 사람이 읽는 말) */
const KEYNAME: Record<string, string> = { name: "품명", spec: "규격", unit: "단위", qty: "수량", unitPrice: "단가", amount: "금액", date: "날짜", vendor: "거래처", item: "품목", supply: "공급가액", total: "합계", docNo: "문서번호", tax: "세액" };
const GROUPNAME: Record<string, string> = { mat: "재료비 ", lab: "노무비 ", exp: "경비 ", sum: "합계 ", before: "변경 전 ", after: "변경 후 ", delta: "증감 " };
export function keyLabel(k: string): string {
  const [g, r] = k.includes(".") ? k.split(".") : ["", k];
  return `${GROUPNAME[g] ?? ""}${KEYNAME[r] ?? r}`;
}

export const NOT_LOSS = "이 금액은 문서 사이의 차이이며 손실로 확정된 금액이 아닙니다.";
