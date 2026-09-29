/**
 * 시간 규칙 목록 — 설정 화면의 켜기/끄기·기준일과 업무함의 "규칙" 배지가 같은 정의를 본다.
 * 실제 판정 로직은 store.syncRuleTasks 에 있다. 여기는 이름표·설명·기준일뿐이다.
 *
 * 기준일(예: 계약 만료 "30일" 전)은 회사마다 다르다. 운영해 보고 대표가 고칠 수 있게 한다.
 * 값은 settings.autoRules 안에 "규칙키.days" 로 저장한다 — 서버 표(app_settings.auto_rules, jsonb)를 바꾸지 않아도 된다.
 * 기준을 바꿔도 이미 만든 업무는 그대로이고, 같은 대상에 두 번 만들지 않는다(ruleKey 가 대상별이다).
 */
export interface AutoRuleDef {
  key: string;
  /** 업무함 배지에 쓰는 짧은 이름 */
  short: string;
  label: (n: number) => string;
  /** 무엇이 언제 만들어지는가 — 사용자가 켜고 끌 때 읽는 한 줄 */
  when: (n: number) => string;
  /** 왜 이 규칙이 있는가 */
  why: string;
  /** 기준일: 기본값과 고를 수 있는 값 */
  days: { default: number; options: number[] };
}

export const AUTO_RULES: AutoRuleDef[] = [
  {
    key: "contract_renewal", short: "계약",
    label: (n) => `계약 만료 ${n}일 전 갱신 협의`,
    when: (n) => `서명된 계약의 종료일 ${n}일 전부터, 담당자에게 '갱신 협의' 업무`,
    why: "만료를 지나서 알게 되면 재계약 협상력이 없어집니다. 종료일이 입력된 계약에만 적용됩니다.",
    days: { default: 30, options: [14, 30, 45, 60, 90] },
  },
  {
    key: "aftercare_review", short: "사후관리",
    label: (n) => `사후관리 ${n}일 경과 종료 점검`,
    when: (n) => `사후관리 단계로 바뀐 지 ${n}일이 지난 프로젝트에 '종료 점검' 업무`,
    why: "사후관리는 끝을 정하지 않으면 무한정 늘어지고, 추가 컨설팅으로 이을 시점도 놓칩니다.",
    days: { default: 90, options: [30, 60, 90, 120, 180] },
  },
  {
    key: "result_unread", short: "결과자료",
    label: (n) => `결과자료 ${n}일 미열람 확인`,
    when: (n) => `공유한 결과자료를 고객이 ${n}일 동안 열지 않으면 '확인 안내' 업무`,
    why: "전달했다고 생각한 결과물이 실제로는 도착하지 않은 경우가 가장 많은 클레임 원인입니다.",
    days: { default: 7, options: [3, 5, 7, 14] },
  },
  {
    key: "quote_expiring", short: "견적",
    label: (n) => `견적 유효기간 D-${n} 회신 확인`,
    when: (n) => `발송한 견적이 회신 없이 유효기간 ${n}일 전이 되면 '회신·연장 확인' 업무 (긴급)`,
    why: "유효기간이 지난 뒤 고객이 수락하면 금액을 다시 논의해야 합니다.",
    days: { default: 3, options: [1, 3, 5, 7] },
  },
  {
    key: "doc_overdue_followup", short: "자료",
    label: (n) => `자료 기한 ${n}일 초과 독촉`,
    when: (n) => `요청자료가 기한을 ${n}일 넘겨도 제출되지 않으면 '독촉' 업무 (긴급)`,
    why: "브리핑에는 올라오지만 업무함에 없으면 처리 여부가 기록되지 않았습니다.",
    days: { default: 3, options: [1, 2, 3, 5, 7] },
  },
];

export const RULE_BY_KEY: Record<string, AutoRuleDef> = Object.fromEntries(AUTO_RULES.map((r) => [r.key, r]));

export type AutoRuleSettings = Record<string, boolean | number> | undefined;

/** 이 규칙이 켜져 있는가 — 키가 없으면 켜진 것으로 본다 */
export function ruleOn(s: AutoRuleSettings, key: string) {
  return s?.[key] !== false;
}

/** 이 규칙의 기준일 — 저장된 값이 고를 수 있는 범위(1~365) 밖이면 기본값 */
export function ruleDays(s: AutoRuleSettings, key: string) {
  const v = s?.[`${key}.days`];
  const def = RULE_BY_KEY[key]?.days.default ?? 7;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 365 ? v : def;
}

/** Task.ruleKey ("contract_renewal:ct_x") → 규칙 정의 */
export function ruleOfTask(ruleKey?: string): AutoRuleDef | undefined {
  if (!ruleKey) return undefined;
  return RULE_BY_KEY[ruleKey.split(":")[0]];
}
