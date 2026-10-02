import type { Activity, ActivityType } from "./types";

/**
 * 실증 기록(Evidence Log) 거르기.
 *
 * 기록이 수백 건을 넘으면 "그 고객 자료가 언제 들어왔지?", "지난달 권한 거절이 있었나?"를
 * 스크롤로 찾을 수 없다. 기간·분류·행위자·기업·검색어로 좁히고, 좁힌 결과를 그대로 내보낸다.
 * 기록 자체는 고치지 않는다 — 보는 범위만 바꾼다.
 */

export type EvidenceGroup = "company" | "sales" | "project" | "docs" | "work" | "comms" | "account" | "data";

export const EVIDENCE_GROUPS: { key: EvidenceGroup; label: string }[] = [
  { key: "docs", label: "요청자료" },
  { key: "sales", label: "상담·견적·계약" },
  { key: "project", label: "프로젝트·결과물" },
  { key: "work", label: "업무·일정·규칙" },
  { key: "comms", label: "문의·공지·의견" },
  { key: "company", label: "기업고객" },
  { key: "account", label: "로그인·권한" },
  { key: "data", label: "데이터·설정" },
];

/** 모든 기록 종류가 어느 분류인지 — 새 종류를 추가하면 여기서 타입 오류가 나서 빠뜨릴 수 없다 */
export const GROUP_OF: Record<ActivityType, EvidenceGroup> = {
  company_created: "company", company_updated: "company", company_archived: "company", companies_imported: "company", company_doc_read: "company",
  consultation_logged: "sales", consultation_updated: "sales", consultation_deleted: "sales",
  opportunity_created: "sales", program_shared: "sales", program_unshared: "sales", request_canceled: "sales", lead_created: "sales", lead_updated: "sales", opportunity_status_changed: "sales", approval_requested: "sales", approval_decided: "sales",
  quote_created: "sales", quote_sent: "sales", quote_responded: "sales", quote_converted: "sales", quote_updated: "sales",
  contract_sent: "sales", contract_signed: "sales", contract_created: "sales", contract_updated: "sales",
  project_created: "project", project_stage_changed: "project", project_updated: "project", project_archived: "project",
  result_shared: "project", result_downloaded: "project", result_withdrawn: "project",
  document_requested: "docs", document_uploaded: "docs", document_reviewed: "docs", document_revision_requested: "docs",
  doc_request_updated: "docs", doc_request_canceled: "docs",
  task_created: "work", task_completed: "work", task_updated: "work", task_deleted: "work",
  schedule_created: "work", schedule_updated: "work", schedule_deleted: "work", rule_task_created: "work", rule_changed: "work", ai_action_taken: "work",
  inquiry_created: "comms", inquiry_answered: "comms", notice_published: "comms", notice_updated: "comms", notice_removed: "comms", survey_submitted: "comms",
  profile_updated: "company", vault_updated: "docs", file_uploaded: "docs", file_removed: "docs",
  work_status_changed: "project", journal_written: "work",
  payment_added: "sales", payment_received: "sales", payment_removed: "sales",
  sign_in: "account", sign_in_failed: "account", sign_out: "account", portal_login: "account", permission_denied: "account",
  user_created: "account", user_updated: "account", user_deactivated: "account", password_reset: "account",
  evidence_exported: "data", backup_exported: "data", backup_imported: "data", data_exported: "data", live_mode_changed: "data",
  org_updated: "data", demo_reset: "data", samples_removed: "data", samples_restored: "data", baseline_survey_saved: "data",
};

export type Period = "all" | "today" | "7" | "30" | "custom";

export interface EvidenceFilter {
  period: Period;
  /** custom 일 때 YYYY-MM-DD (그날 하루 포함) */
  from?: string;
  to?: string;
  group: EvidenceGroup | "all";
  /** "all" | "client"(모든 고객) | "system" | 사용자 id */
  actor: string;
  company: string | "all";
  q: string;
}

export const EMPTY_FILTER: EvidenceFilter = { period: "all", group: "all", actor: "all", company: "all", q: "" };

export function isFiltered(f: EvidenceFilter) {
  return f.period !== "all" || f.group !== "all" || f.actor !== "all" || f.company !== "all" || !!f.q.trim();
}

/** 로컬 날짜의 00:00 을 ISO 로 */
function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

export function periodRange(f: EvidenceFilter, now: Date): { from?: string; to?: string } {
  if (f.period === "today") return { from: startOfLocalDay(now) };
  if (f.period === "7" || f.period === "30") {
    const d = new Date(now);
    d.setDate(d.getDate() - Number(f.period) + 1);
    return { from: startOfLocalDay(d) };
  }
  if (f.period === "custom") {
    const from = f.from ? new Date(`${f.from}T00:00:00`).toISOString() : undefined;
    // 끝 날짜는 그날 하루 끝까지 포함
    const to = f.to ? new Date(new Date(`${f.to}T00:00:00`).getTime() + 86400000).toISOString() : undefined;
    return { from, to };
  }
  return {};
}

export interface NameCtx {
  userName: (id: string) => string | undefined;
  companyName: (id?: string) => string | undefined;
}

export function filterEvidence(items: Activity[], f: EvidenceFilter, now: Date, names: NameCtx): Activity[] {
  const { from, to } = periodRange(f, now);
  const q = f.q.trim().toLowerCase();
  return items
    .filter((a) => {
      if (from && a.at < from) return false;
      if (to && a.at >= to) return false;
      if (f.group !== "all" && (GROUP_OF[a.type] ?? "data") !== f.group) return false;
      if (f.actor === "client" && a.actorRole !== "client") return false;
      if (f.actor === "system" && a.actorRole !== "system") return false;
      if (f.actor !== "all" && f.actor !== "client" && f.actor !== "system" && a.actorId !== f.actor) return false;
      if (f.company !== "all" && a.companyId !== f.company) return false;
      if (q) {
        const hay = [a.text, a.type, names.userName(a.actorId) ?? "", names.companyName(a.companyId) ?? ""].join(" ").toLowerCase();
        if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** 내보낸 파일 첫 장에 적을 "어떤 조건으로 거른 결과인가" */
export function describeFilter(f: EvidenceFilter, names: NameCtx): string[] {
  const out: string[] = [];
  const P: Record<Period, string> = { all: "전체 기간", today: "오늘", "7": "최근 7일", "30": "최근 30일", custom: `${f.from ?? "처음"} ~ ${f.to ?? "지금"}` };
  out.push(`기간: ${P[f.period]}`);
  out.push(`분류: ${f.group === "all" ? "전체" : EVIDENCE_GROUPS.find((g) => g.key === f.group)?.label}`);
  out.push(`행위자: ${f.actor === "all" ? "전체" : f.actor === "client" ? "고객 전체" : f.actor === "system" ? "시스템(자동 규칙)" : names.userName(f.actor) ?? f.actor}`);
  out.push(`기업: ${f.company === "all" ? "전체" : names.companyName(f.company) ?? f.company}`);
  if (f.q.trim()) out.push(`검색어: ${f.q.trim()}`);
  return out;
}
