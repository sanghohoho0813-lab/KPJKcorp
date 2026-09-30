import type { Company, CompanyFile, CompanyVault, DocumentRequest, Project } from "./types";
import { BUILTIN_SLOTS, slotStatus, slotsOf, todayYmd } from "./vault";
import { WORK_STATUS, isOpen, workCell } from "./work-status";
import { dueText } from "./vault";

/**
 * 고객에게 보낼 문구 — 카톡·문자·메일에 그대로 붙인다.
 * 사실만 적는다: 비어 있는 서류, 업무별 현재 상태, 우리가 정한 다음 할 일.
 */

const who = (c: Company) => (c.contactName && c.contactName !== c.ceo ? `${c.contactName}님` : c.ceo ? `${c.ceo} 대표님` : "대표님");

/** 서류 요청 — 서류함에서 안 받았거나 만료된 칸 + 아직 안 낸 요청자료 */
export function documentRequestMessage(c: Company, vault: CompanyVault | undefined, files: CompanyFile[], docRequests: DocumentRequest[], slotKeys?: string[], today = todayYmd()) {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const meta of slotsOf(vault)) {
    if (slotKeys && !slotKeys.includes(meta.key)) continue;
    if (!slotKeys && meta.key === "jointCert") continue;   // 공동인증서는 전달 방법을 따로 정한다
    const s = slotStatus(meta, vault, files, today);
    if (s.usable) continue;
    const where = BUILTIN_SLOTS.find((b) => b.key === meta.key)?.whereToGet;
    lines.push(`${lines.length + 1}. ${meta.label}${s.expired ? " (기존 서류는 유효기간이 지나 새 발급본이 필요합니다)" : ""}${where ? `\n   - ${where}` : ""}`);
    seen.add(meta.label);
  }
  if (!slotKeys) {
    for (const d of docRequests.filter((x) => x.companyId === c.id && (x.status === "requested" || x.status === "revision"))) {
      if (seen.has(d.name)) continue;
      lines.push(`${lines.length + 1}. ${d.name}${d.status === "revision" ? " (보완 필요)" : ""}${d.dueDate ? `\n   - ${d.dueDate.slice(0, 10)}까지 Portal 요청자료에 올려 주세요` : ""}`);
    }
  }
  if (!lines.length) return `안녕하세요, ${who(c)}.\n현재 추가로 받을 서류는 없습니다. 진행 상황은 확인 후 다시 안내드리겠습니다.`;
  return [`안녕하세요, ${who(c)}.`, "", `${c.name} 진행을 위해 아래 서류가 필요합니다.`, "", ...lines, "", "준비되시는 대로 보내주시면 바로 진행하겠습니다. 감사합니다."].join("\n");
}

/** 진행 상황 보고 — 업무별 상태 + 다음 단계 */
export function progressReportMessage(c: Company, projects: Project[], today = todayYmd()) {
  const list = projects.filter((p) => p.companyId === c.id && !p.archived && p.clientVisible !== false);
  const cells = list.map((p) => workCell(p, today)).filter((x) => x.status !== "on_hold" && x.status !== "not_applicable");
  if (!cells.length) return `안녕하세요, ${who(c)}.\n${c.name} 진행 중인 업무가 아직 없습니다. 준비되는 대로 안내드리겠습니다.`;
  const rows = cells.map((x) => `- ${x.project.name}: ${WORK_STATUS[x.status].label}${isOpen(x.status) && x.daysLeft !== null ? ` (목표 ${x.project.dueDate.slice(0, 10)}, ${dueText(x.daysLeft)})` : ""}`);
  const next = cells.filter((x) => isOpen(x.status) && x.project.nextStep).map((x) => `- ${x.project.name}: ${x.project.nextStep}`);
  return [`안녕하세요, ${who(c)}.`, "", `${c.name} 진행 상황 공유드립니다.`, "", ...rows, ...(next.length ? ["", "[다음 단계]", ...next] : []), "", "문의사항 있으시면 편하게 연락 주세요. 감사합니다."].join("\n");
}
