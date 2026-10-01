import type { Activity, Company, CompanyFile, CompanyVault, Consultation, Contract, DocumentRequest, Inquiry, JournalEntry, Notice, Payment, Project, Schedule, Task, User } from "./types";
import { PAYMENT_KIND_LABEL, WORK_STATUS, workStatusOf } from "./work-status";
import { slotLabel } from "./vault";
import { JOURNAL_TYPE } from "./journal";
import { DOC_STATUS, INQUIRY_STATUS, PRIORITY, SCHEDULE_TYPE, TASK_STATUS, stageLabel } from "./stages";
import { CONSULT_AREA_LABEL, ENTITY_TYPES } from "./company-options";
import type { SheetData } from "./xlsx";

/**
 * 전체 데이터 엑셀 내보내기.
 *
 * 백업(JSON)은 "되살리기 위한 파일"이고, 이 엑셀은 "사람이 열어 보고 거르고 보고서에 붙이기 위한 파일"이다.
 * 그래서 내부 코드값 대신 화면에 보이는 한글 이름으로 쓰고, id 대신 기업명·담당자 이름을 넣는다.
 * 계산해서 새로 만든 숫자(비율·점수)는 넣지 않는다 — 기록 그대로만.
 */

export interface ExportCtx {
  companies: Company[];
  projects: Project[];
  consultations: Consultation[];
  contracts: Contract[];
  docRequests: DocumentRequest[];
  schedules: Schedule[];
  tasks: Task[];
  inquiries: Inquiry[];
  notices: Notice[];
  activities: Activity[];
  users: User[];
  payments?: Payment[];
  companyFiles?: CompanyFile[];
  companyVaults?: CompanyVault[];
  journal?: JournalEntry[];
  orgName?: string;
  exportedBy: string;
  now: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** 엑셀에서 정렬·필터가 되도록 "2026-09-29 14:05" 꼴로 (내보내는 PC 의 시각대) */
export function ymdhm(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function ymd(iso?: string) {
  return ymdhm(iso).slice(0, 10);
}

const ROLE: Record<string, string> = { admin: "대표", consultant: "컨설턴트", client: "고객", system: "시스템" };
const CONTRACT_STATUS: Record<Contract["status"], string> = { draft: "작성중", sent: "발송", signed: "체결" };

export function buildExportSheets(ctx: ExportCtx): SheetData[] {
  const who = (id?: string) => (id ? ctx.users.find((u) => u.id === id)?.name ?? "" : "");
  const cname = (id?: string) => (id ? ctx.companies.find((c) => c.id === id)?.name ?? "" : "");
  const pname = (id?: string) => (id ? ctx.projects.find((p) => p.id === id)?.name ?? "" : "");
  const entity = (k?: string) => ENTITY_TYPES.find((e) => e.key === k)?.label ?? "";

  const sheets: SheetData[] = [
    {
      name: "기업고객",
      rows: [
        ["코드", "기업명", "대표자", "사업자번호", "법인등록번호", "사업자 형태", "업종", "업태", "종목", "그 외 업태·종목", "설립일", "주소", "지역", "대표번호", "담당자", "직책", "연락처", "이메일", "임직원 수", "매출", "홈페이지", "관심 분야", "유입 경로", "최초 상담일", "담당 컨설턴트", "메모", "상태"],
        ...ctx.companies.map((c) => [
          c.code, c.name, c.ceo, c.bizNo, c.corpNo, entity(c.entityType), c.industry, c.bizCategory, c.bizItem, c.bizItemsExtra, c.establishedAt, c.address, c.region, c.companyPhone,
          c.contactName, c.contactTitle, c.contactPhone, c.contactEmail, c.employees || null, c.revenue, c.website,
          (c.interests ?? []).map((k) => CONSULT_AREA_LABEL[k] ?? k).join(", "), c.leadSource, ymd(c.firstConsultDate), who(c.consultantId), c.memo,
          c.archived ? "보관됨" : c.sample ? "샘플" : "",
        ]),
      ],
    },
    {
      name: "프로젝트",
      rows: [
        ["기업", "프로젝트", "유형", "단계", "진행 상태", "다음 할 일", "시작일", "마감일", "단계 변경일", "담당 컨설턴트", "고객 공개", "설명", "상태"],
        ...ctx.projects.map((p) => [cname(p.companyId), p.name, p.type, stageLabel(p.stage), WORK_STATUS[workStatusOf(p)].label, p.nextStep, ymd(p.startDate), ymd(p.dueDate), ymd(p.stageChangedAt), who(p.consultantId), p.clientVisible ? "공개" : "비공개", p.description, p.archived ? "보관됨" : ""]),
      ],
    },
    {
      name: "상담 기록",
      rows: [
        ["상담일", "기업", "프로젝트", "상담 유형", "방식", "담당", "핵심 내용", "고객 요구", "약속한 것", "필요 자료", "다음 할 일", "상담 메모"],
        ...ctx.consultations.map((c) => [ymdhm(c.date), cname(c.companyId), pname(c.projectId), c.type, c.channel, who(c.consultantId), c.summary.core.join("\n"), c.summary.requirements.join("\n"), c.summary.promises.join("\n"), c.summary.documents.join("\n"), c.summary.nextAction, c.notes]),
      ],
    },
    {
      name: "계약",
      rows: [
        ["기업", "프로젝트", "계약명", "상태", "발송일", "체결일", "기간", "종료일", "금액(원)", "범위"],
        ...ctx.contracts.map((c) => [cname(c.companyId), pname(c.projectId), c.title, CONTRACT_STATUS[c.status], ymd(c.sentAt), ymd(c.signedAt), c.period, ymd(c.endDate), c.amount ?? null, c.scope]),
      ],
    },
    {
      name: "요청자료",
      rows: [
        ["기업", "프로젝트", "자료명", "상태", "요청일", "기한", "제출일", "검토일", "파일 수", "담당", "검토 의견", "설명"],
        ...ctx.docRequests.map((d) => [cname(d.companyId), pname(d.projectId), d.name, DOC_STATUS[d.status]?.label ?? d.status, ymd(d.requestedAt), ymd(d.dueDate), ymd(d.submittedAt), ymd(d.reviewedAt), d.files.length, who(d.assigneeId), d.reviewNote, d.description]),
      ],
    },
    {
      name: "일정",
      rows: [
        ["시작", "종료", "일정", "종류", "기업", "프로젝트", "장소", "담당", "고객 공개", "메모"],
        ...ctx.schedules.map((s) => [ymdhm(s.start), ymdhm(s.end), s.title, SCHEDULE_TYPE[s.type]?.label ?? s.type, cname(s.companyId), pname(s.projectId), s.location, who(s.assigneeId), s.visibleToClient ? "공개" : "", s.memo]),
      ],
    },
    {
      name: "업무",
      rows: [
        ["업무", "종류", "상태", "우선순위", "기한", "담당", "기업", "프로젝트", "생성", "만든 시각", "완료 시각", "메모"],
        ...ctx.tasks.map((t) => [t.title, t.type, TASK_STATUS[t.status]?.label ?? t.status, PRIORITY[t.priority]?.label ?? t.priority, ymd(t.dueDate), who(t.assigneeId), cname(t.companyId), pname(t.projectId), t.source === "auto" ? "자동 규칙" : "직접", ymdhm(t.createdAt), ymdhm(t.completedAt), t.memo]),
      ],
    },
    {
      name: "고객 문의",
      rows: [
        ["접수 시각", "기업", "프로젝트", "분류", "제목", "상태", "담당", "첫 답변 시각", "주고받은 글 수", "문의 내용"],
        ...ctx.inquiries.map((i) => {
          const firstReply = i.messages.find((m, idx) => idx > 0 && m.authorId !== i.createdBy);
          return [ymdhm(i.createdAt), cname(i.companyId), pname(i.projectId), i.category, i.title, INQUIRY_STATUS[i.status]?.label ?? i.status, who(i.assigneeId), ymdhm(firstReply?.createdAt), i.messages.length, i.messages[0]?.body ?? ""];
        }),
      ],
    },
    {
      name: "공지",
      rows: [
        ["게시 시각", "받는 고객", "제목", "홈 고정", "게시 종료", "작성", "내용"],
        ...ctx.notices.map((n) => [ymdhm(n.publishedAt), n.companyId ? cname(n.companyId) : "전체 고객", n.title, n.pinned ? "고정" : "", ymdhm(n.expiresAt), who(n.authorId), n.body]),
      ],
    },
    {
      name: "수금",
      rows: [
        ["기업", "프로젝트", "종류", "이름", "금액(원)", "받기로 한 날", "입금일", "영업자", "영업자 수수료(원)", "메모"],
        ...(ctx.payments ?? []).map((p) => [cname(p.companyId), pname(p.projectId), PAYMENT_KIND_LABEL[p.kind], p.label, p.amount ?? null, p.dueDate, p.receivedAt, p.agentName, p.agentFee ?? null, p.note]),
      ],
    },
    {
      // 파일 내용은 넣지 않는다 — 어떤 서류가 어디 있는지 목록만
      name: "서류함 목록",
      rows: [
        ["기업", "서류 칸", "파일 이름", "폴더", "발급일", "올린 날", "올린 사람", "크기(byte)"],
        ...(ctx.companyFiles ?? []).map((f) => [cname(f.companyId), slotLabel(ctx.companyVaults?.find((v) => v.companyId === f.companyId), f.slot), f.fileName, f.folder, f.issuedAt, ymdhm(f.uploadedAt), who(f.uploadedBy), f.size]),
      ],
    },
    {
      name: "업무 일기",
      rows: [
        ["날짜", "기업", "종류", "내용", "쓴 사람", "고정"],
        ...(ctx.journal ?? []).map((j) => [j.entryDate, cname(j.companyId), JOURNAL_TYPE[j.type].label, j.content, who(j.authorId), j.pinned ? "고정" : ""]),
      ],
    },
    {
      name: "처리 기록",
      rows: [
        ["시각", "종류", "행위자", "역할", "기업", "프로젝트", "내용"],
        ...[...ctx.activities].sort((a, b) => b.at.localeCompare(a.at)).map((a) => [ymdhm(a.at), a.type, who(a.actorId) || (a.actorRole === "system" ? "시스템" : a.actorId), ROLE[a.actorRole] ?? a.actorRole, cname(a.companyId), pname(a.projectId), a.text]),
      ],
    },
  ];

  const cover: SheetData = {
    name: "안내",
    header: false,
    widths: [16, 70],
    rows: [
      [`${ctx.orgName ?? "KPJK"} · Business AX 전체 데이터`],
      [],
      ["내보낸 시각", ymdhm(ctx.now.toISOString())],
      ["내보낸 사람", ctx.exportedBy],
      [],
      ["시트", "건수"],
      ...sheets.map((s) => [s.name, `${Math.max(0, s.rows.length - 1)}건`]),
      [],
      ["주의", "고객 연락처·상담 내용 등 개인정보가 들어 있습니다. 회사 밖으로 보내거나 개인 PC에 오래 두지 마세요."],
      ["", "이 파일은 보기·보고서용입니다. 시스템으로 되돌려 넣으려면 '백업 내보내기(JSON)'를 쓰세요."],
      ["", "모든 값은 시스템에 기록된 그대로이며, 계산해서 새로 만든 수치는 없습니다."],
    ],
  };
  return [cover, ...sheets];
}

export function exportFileName(now: Date) {
  return `KPJK_AX_데이터_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`;
}
