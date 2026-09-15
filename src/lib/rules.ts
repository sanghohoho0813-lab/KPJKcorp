/**
 * 시간 규칙 목록 — 설정 화면의 켜기/끄기와 업무함의 "규칙" 배지가 같은 정의를 본다.
 * 실제 판정 로직은 store.syncRuleTasks 에 있다. 여기는 이름표와 설명뿐이다.
 */
export interface AutoRuleDef {
  key: string;
  label: string;
  /** 무엇이 언제 만들어지는가 — 사용자가 켜고 끌 때 읽는 한 줄 */
  when: string;
  /** 왜 이 규칙이 있는가 */
  why: string;
}

export const AUTO_RULES: AutoRuleDef[] = [
  { key: "contract_renewal", label: "계약 만료 30일 전 갱신 협의", when: "서명된 계약의 종료일 30일 전부터, 담당자에게 '갱신 협의' 업무", why: "만료를 지나서 알게 되면 재계약 협상력이 없어집니다. 종료일이 입력된 계약에만 적용됩니다." },
  { key: "aftercare_review", label: "사후관리 90일 경과 종료 점검", when: "사후관리 단계로 바뀐 지 90일이 지난 프로젝트에 '종료 점검' 업무", why: "사후관리는 끝을 정하지 않으면 무한정 늘어지고, 추가 컨설팅으로 이을 시점도 놓칩니다." },
  { key: "result_unread", label: "결과자료 7일 미열람 확인", when: "공유한 결과자료를 고객이 7일 동안 열지 않으면 '확인 안내' 업무", why: "전달했다고 생각한 결과물이 실제로는 도착하지 않은 경우가 가장 많은 클레임 원인입니다." },
  { key: "quote_expiring", label: "견적 유효기간 D-3 회신 확인", when: "발송한 견적이 회신 없이 유효기간 3일 전이 되면 '회신·연장 확인' 업무 (긴급)", why: "유효기간이 지난 뒤 고객이 수락하면 금액을 다시 논의해야 합니다." },
  { key: "doc_overdue_followup", label: "자료 기한 3일 초과 독촉", when: "요청자료가 기한을 3일 넘겨도 제출되지 않으면 '독촉' 업무 (긴급)", why: "브리핑에는 올라오지만 업무함에 없으면 처리 여부가 기록되지 않았습니다." },
];

export const RULE_BY_KEY: Record<string, AutoRuleDef> = Object.fromEntries(AUTO_RULES.map((r) => [r.key, r]));

/** Task.ruleKey ("contract_renewal:ct_x") → 규칙 정의 */
export function ruleOfTask(ruleKey?: string): AutoRuleDef | undefined {
  if (!ruleKey) return undefined;
  return RULE_BY_KEY[ruleKey.split(":")[0]];
}
