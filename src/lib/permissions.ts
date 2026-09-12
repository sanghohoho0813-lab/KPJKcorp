import type { Role } from "./types";

/**
 * 권한 정책 — 단일 출처(single source of truth).
 *
 * 이전에는 설정 화면의 표가 "문서"이고 화면 버튼이 각자 role을 보고 판단했다.
 * 그러면 표와 실제 동작이 갈라지고, 버튼을 숨기는 것 말고는 막는 수단이 없다.
 * 여기서 정한 것을 (1) store의 쓰기 액션, (2) 화면의 버튼 노출, (3) 설정의 권한표가
 * 모두 같이 참조한다. 표는 이제 설명이 아니라 실제 규칙을 그린 것이다.
 *
 * 한계 — 이 검사는 브라우저 안에서 이루어진다. 서버가 없으므로 개발자도구로
 * 우회하는 것을 막지 못한다. 서버 DB/세션을 붙이기 전까지는 "업무 규칙"이지
 * "보안 경계"가 아니다. 이 문장을 지우려면 서버 검증이 먼저 있어야 한다.
 */
export type Permission =
  | "company.create"
  | "company.update"
  | "project.create"
  | "project.update"
  | "doc.request"
  | "doc.review"
  | "doc.submit"
  | "schedule.create"
  | "schedule.update"
  | "schedule.delete"
  | "task.create"
  | "task.update"
  | "task.delete"
  | "consultation.create"
  | "quote.create"
  | "quote.send"
  | "quote.respond"
  | "opportunity.create"
  | "opportunity.advance"
  | "approval.request"
  | "approval.decide"
  | "result.share"
  | "inquiry.create"
  | "inquiry.answer"
  | "settings.write"
  | "baseline.write"
  | "sprint.manage"
  | "portal.preview"
  | "user.manage"
  | "company.archive"
  | "project.archive"
  | "doc.update"
  | "consultation.update";

const POLICY: Record<Permission, Role[]> = {
  "company.create": ["admin", "consultant"],
  "company.update": ["admin", "consultant"],
  "project.create": ["admin", "consultant"],
  "project.update": ["admin", "consultant"],
  "doc.request": ["admin", "consultant"],
  "doc.review": ["admin", "consultant"],
  "doc.submit": ["client"],
  "schedule.create": ["admin", "consultant"],
  "schedule.update": ["admin", "consultant"],
  "schedule.delete": ["admin", "consultant"],
  "task.create": ["admin", "consultant"],
  "task.update": ["admin", "consultant"],
  "task.delete": ["admin", "consultant"],
  "consultation.create": ["admin", "consultant"],
  "quote.create": ["admin", "consultant"],
  "quote.send": ["admin", "consultant"],
  "quote.respond": ["client"],
  "opportunity.create": ["admin", "consultant", "client"],
  "opportunity.advance": ["admin", "consultant"],
  "approval.request": ["consultant"],
  // 승인은 대표만. 이전에는 버튼만 숨겼고 액션은 누구나 호출할 수 있었다.
  "approval.decide": ["admin"],
  "result.share": ["admin", "consultant"],
  "inquiry.create": ["client"],
  "inquiry.answer": ["admin", "consultant"],
  "settings.write": ["admin", "consultant", "client"],
  "baseline.write": ["admin"],
  "sprint.manage": ["admin"],
  "portal.preview": ["admin", "consultant"],
  // 계정 생성·비활성화·비밀번호 재설정은 대표만. 직원이 계정을 만들 수 있으면 권한 체계가 무의미해진다.
  "user.manage": ["admin"],
  "company.archive": ["admin", "consultant"],
  "project.archive": ["admin", "consultant"],
  "doc.update": ["admin", "consultant"],
  "consultation.update": ["admin", "consultant"],
};

export function can(role: Role | undefined | null, p: Permission): boolean {
  if (!role) return false;
  return POLICY[p].includes(role);
}

/** 설정 화면의 권한표 — 위 POLICY에서 직접 만든다. 손으로 적은 표가 아니다. */
export const PERMISSION_ROWS: { label: string; perms: Permission[] }[] = [
  { label: "기업고객 등록 · 수정", perms: ["company.create", "company.update"] },
  { label: "프로젝트 등록 · 수정", perms: ["project.create", "project.update"] },
  { label: "자료 요청 · 검토", perms: ["doc.request", "doc.review"] },
  { label: "자료 제출", perms: ["doc.submit"] },
  { label: "일정 등록 · 수정 · 삭제", perms: ["schedule.create", "schedule.update", "schedule.delete"] },
  { label: "업무 등록 · 수정 · 삭제", perms: ["task.create", "task.update", "task.delete"] },
  { label: "상담 기록", perms: ["consultation.create"] },
  { label: "견적 작성 · 발송", perms: ["quote.create", "quote.send"] },
  { label: "견적 회신", perms: ["quote.respond"] },
  { label: "매출기회 등록", perms: ["opportunity.create"] },
  { label: "매출기회 단계 이동", perms: ["opportunity.advance"] },
  { label: "대표 승인 요청", perms: ["approval.request"] },
  { label: "대표 승인 / 반려", perms: ["approval.decide"] },
  { label: "결과자료 공유", perms: ["result.share"] },
  { label: "문의 작성", perms: ["inquiry.create"] },
  { label: "문의 답변", perms: ["inquiry.answer"] },
  { label: "실증 기준선 · 스프린트", perms: ["baseline.write", "sprint.manage"] },
  { label: "고객 화면 미리보기", perms: ["portal.preview"] },
  { label: "기업 · 프로젝트 보관", perms: ["company.archive", "project.archive"] },
  { label: "자료요청 수정 · 취소", perms: ["doc.update"] },
  { label: "상담기록 수정 · 삭제", perms: ["consultation.update"] },
  { label: "사용자 계정 관리", perms: ["user.manage"] },
];

export function rowVerdict(role: Role, perms: Permission[]): "all" | "some" | "none" {
  const yes = perms.filter((p) => can(role, p)).length;
  return yes === perms.length ? "all" : yes === 0 ? "none" : "some";
}
