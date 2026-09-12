"use client";

import { useState } from "react";
import { Building2, Briefcase, CalendarDays, CheckSquare, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { INTERNAL_STAGES, SCHEDULE_TYPE } from "@/lib/stages";
import { addDays } from "@/lib/format";
import type { Company, InternalStage, Project, ScheduleType, Task } from "@/lib/types";
import { Confirm, Modal } from "@/components/ui/overlay";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/ui";

function dateTimeInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return `${dateInput(d.toISOString())}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dateInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const PROJECT_TYPES = ["경영진단", "정책자금", "연구소", "기업인증", "법인자문", "운영개선", "기타"];

/* ---------------- 기업고객 등록 · 수정 ---------------- */

type CompanyForm = Omit<Company, "id" | "code">;

const EMPTY_COMPANY = (consultantId: string): CompanyForm => ({
  name: "", ceo: "", industry: "", bizNo: "", contactName: "", contactTitle: "", contactPhone: "",
  contactEmail: "", address: "", employees: 0, revenue: "", firstConsultDate: new Date().toISOString(),
  consultantId, memo: "",
});

export function CompanyModal(props: { open: boolean; companyId?: string | null; onClose: () => void; onCreated?: (id: string) => void }) {
  // 열릴 때마다 새로 마운트해서 폼을 초기화한다. effect로 setState 하지 않는다.
  if (!props.open) return null;
  return <CompanyModalInner key={props.companyId ?? "new"} {...props} />;
}

function CompanyModalInner({ open, companyId, onClose, onCreated }: { open: boolean; companyId?: string | null; onClose: () => void; onCreated?: (id: string) => void }) {
  const st = useStore();
  const create = useStore((s) => s.createCompany);
  const update = useStore((s) => s.updateCompany);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const editing = st.companies.find((c) => c.id === companyId);
  const consultants = st.users.filter((u) => u.role !== "client");
  const [f, setF] = useState<CompanyForm>(() => (editing ? { ...editing } : EMPTY_COMPANY(me)));
  const [err, setErr] = useState<Partial<Record<keyof CompanyForm, string>>>({});

  const set = <K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErr((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof CompanyForm, string>> = {};
    if (!f.name.trim()) e.name = "기업명은 필수입니다.";
    else if (st.companies.some((c) => c.id !== companyId && c.name.trim() === f.name.trim())) e.name = "같은 이름의 기업이 이미 있습니다.";
    if (!f.ceo.trim()) e.ceo = "대표자명은 필수입니다.";
    if (!f.contactName.trim()) e.contactName = "담당자명은 필수입니다.";
    if (f.bizNo && !/^[0-9-]{10,14}$/.test(f.bizNo.trim())) e.bizNo = "숫자와 하이픈만, 10자리 이상 입력해 주세요.";
    if (f.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail.trim())) e.contactEmail = "이메일 형식이 아닙니다.";
    if (f.employees < 0) e.employees = "0 이상이어야 합니다.";
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) { toast("입력값을 확인해 주세요.", "error"); return; }
    const data: CompanyForm = {
      ...f,
      name: f.name.trim(), ceo: f.ceo.trim(), industry: f.industry.trim(), bizNo: f.bizNo.trim(),
      contactName: f.contactName.trim(), contactTitle: f.contactTitle.trim(), contactPhone: f.contactPhone.trim(),
      contactEmail: f.contactEmail.trim(), address: f.address.trim(), revenue: f.revenue.trim(), memo: f.memo.trim(),
    };
    if (editing) {
      update(editing.id, data, me);
      toast("기업정보를 수정했습니다. 변경 항목이 활동 기록에 남았습니다.");
      onClose();
    } else {
      const id = create(data, me);
      if (!id) { toast("기업고객을 등록할 권한이 없습니다.", "error"); return; }
      toast(`${data.name}을(를) 등록했습니다.`);
      onClose();
      onCreated?.(id);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={<span className="flex items-center gap-2"><Building2 size={18} /> {editing ? "기업정보 수정" : "기업고객 등록"}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit}>{editing ? "저장" : "등록"}</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="기업명 *" hint={err.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 에이정밀(주)" autoFocus /></Field>
        <Field label="대표자 *" hint={err.ceo}><Input value={f.ceo} onChange={(e) => set("ceo", e.target.value)} /></Field>
        <Field label="업종"><Input value={f.industry} onChange={(e) => set("industry", e.target.value)} placeholder="예: 정밀부품 제조" /></Field>
        <Field label="사업자번호" hint={err.bizNo}><Input value={f.bizNo} onChange={(e) => set("bizNo", e.target.value)} placeholder="000-00-00000" inputMode="numeric" /></Field>
        <Field label="담당자 *" hint={err.contactName}><Input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></Field>
        <Field label="담당자 직책"><Input value={f.contactTitle} onChange={(e) => set("contactTitle", e.target.value)} placeholder="예: 경영지원팀장" /></Field>
        <Field label="연락처"><Input value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="010-0000-0000" inputMode="tel" /></Field>
        <Field label="이메일" hint={err.contactEmail}><Input value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} inputMode="email" /></Field>
        <Field label="주소"><Input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="예: 경기 화성시" /></Field>
        <Field label="임직원 수" hint={err.employees}><Input value={String(f.employees || "")} onChange={(e) => set("employees", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} inputMode="numeric" /></Field>
        <Field label="매출 규모"><Input value={f.revenue} onChange={(e) => set("revenue", e.target.value)} placeholder="예: 120억" /></Field>
        <Field label="담당 컨설턴트">
          <Select value={f.consultantId} onChange={(e) => set("consultantId", e.target.value)}>
            {consultants.map((u) => <option key={u.id} value={u.id}>{u.name} {u.title}</option>)}
          </Select>
        </Field>
        <Field label="최초 상담일">
          <Input type="date" value={dateInput(f.firstConsultDate)} onChange={(e) => set("firstConsultDate", new Date(`${e.target.value}T09:00:00`).toISOString())} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="메모" hint="상담에서 파악한 관심사·의사결정 방식 등을 적어두면 브리핑과 추천에 쓰입니다.">
          <Textarea value={f.memo} onChange={(e) => set("memo", e.target.value)} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------- 프로젝트 등록 · 수정 ---------------- */

type ProjectForm = Omit<Project, "id" | "stageChangedAt">;

const EMPTY_PROJECT = (companyId: string, consultantId: string): ProjectForm => ({
  companyId, name: "", type: PROJECT_TYPES[0], consultantId,
  startDate: new Date().toISOString(), dueDate: addDays(new Date(), 60).toISOString(),
  stage: "consult", description: "", clientVisible: true,
});

export function ProjectModal(props: { open: boolean; projectId?: string | null; companyId?: string; onClose: () => void; onCreated?: (id: string) => void }) {
  if (!props.open) return null;
  return <ProjectModalInner key={`${props.projectId ?? "new"}:${props.companyId ?? ""}`} {...props} />;
}

function ProjectModalInner({ open, projectId, companyId, onClose, onCreated }: { open: boolean; projectId?: string | null; companyId?: string; onClose: () => void; onCreated?: (id: string) => void }) {
  const st = useStore();
  const create = useStore((s) => s.createProject);
  const update = useStore((s) => s.updateProject);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const editing = st.projects.find((p) => p.id === projectId);
  const consultants = st.users.filter((u) => u.role !== "client");
  const [f, setF] = useState<ProjectForm>(() => {
    if (editing) return { ...editing };
    const cid = companyId ?? st.companies[0]?.id ?? "";
    const c = st.companies.find((x) => x.id === cid);
    return EMPTY_PROJECT(cid, c?.consultantId ?? me);
  });
  const [err, setErr] = useState<Partial<Record<keyof ProjectForm, string>>>({});

  const set = <K extends keyof ProjectForm>(k: K, v: ProjectForm[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErr((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof ProjectForm, string>> = {};
    if (!f.companyId) e.companyId = "기업을 선택해 주세요.";
    if (!f.name.trim()) e.name = "프로젝트명은 필수입니다.";
    if (new Date(f.dueDate) < new Date(f.startDate)) e.dueDate = "마감일이 시작일보다 빠릅니다.";
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) { toast("입력값을 확인해 주세요.", "error"); return; }
    const data = { ...f, name: f.name.trim(), description: f.description.trim() };
    if (editing) {
      update(editing.id, data, me);
      toast("프로젝트를 수정했습니다.");
      onClose();
    } else {
      const id = create(data, me);
      if (!id) { toast("프로젝트를 등록할 권한이 없습니다.", "error"); return; }
      toast("프로젝트를 등록했습니다.");
      onClose();
      onCreated?.(id);
    }
  };

  const company = st.companies.find((c) => c.id === f.companyId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={<span className="flex items-center gap-2"><Briefcase size={18} /> {editing ? "프로젝트 수정" : "프로젝트 등록"}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit}>{editing ? "저장" : "등록"}</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="기업 *" hint={err.companyId}>
          {editing ? (
            <div className="flex h-11 items-center rounded-[10px] bg-surface-2 px-3.5 text-[0.95rem] font-semibold">{company?.name}</div>
          ) : (
            <Select value={f.companyId} onChange={(e) => {
              const c = st.companies.find((x) => x.id === e.target.value);
              setF((x) => ({ ...x, companyId: e.target.value, consultantId: c?.consultantId ?? x.consultantId }));
            }}>
              {st.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="유형">
          <Select value={f.type} onChange={(e) => set("type", e.target.value)}>
            {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="프로젝트명 *" hint={err.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 경영진단 컨설팅" autoFocus /></Field>
        </div>
        <Field label="담당 컨설턴트">
          <Select value={f.consultantId} onChange={(e) => set("consultantId", e.target.value)}>
            {consultants.map((u) => <option key={u.id} value={u.id}>{u.name} {u.title}</option>)}
          </Select>
        </Field>
        <Field label="진행 단계" hint={editing ? "단계를 바꾸면 고객 Portal 진행률과 알림이 함께 움직입니다." : undefined}>
          <Select value={f.stage} onChange={(e) => set("stage", e.target.value as InternalStage)}>
            {INTERNAL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="시작일"><Input type="date" value={dateInput(f.startDate)} onChange={(e) => set("startDate", new Date(`${e.target.value}T09:00:00`).toISOString())} /></Field>
        <Field label="마감일" hint={err.dueDate}><Input type="date" value={dateInput(f.dueDate)} onChange={(e) => set("dueDate", new Date(`${e.target.value}T18:00:00`).toISOString())} /></Field>
      </div>
      <div className="mt-3 space-y-3">
        <Field label="설명" hint="고객 Portal에도 표시됩니다."><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} /></Field>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-4 py-3 text-[0.88rem]">
          <input type="checkbox" checked={f.clientVisible} onChange={(e) => set("clientVisible", e.target.checked)} className="h-4 w-4" />
          <span className="font-semibold">고객 Portal에 공개</span>
          <span className="text-[0.8rem] text-ink-3">끄면 고객에게 이 프로젝트가 보이지 않습니다</span>
        </label>
      </div>
    </Modal>
  );
}

/** 화면에서 등록·수정 버튼을 노출할지 — store의 정책과 같은 판단을 쓴다. */
export function useMay() {
  const role = useStore((s) => s.session?.role);
  return (p: Parameters<typeof can>[1]) => can(role, p);
}

/* ---------------- 일정 수정 · 삭제 ---------------- */

export function EditScheduleModal(props: { open: boolean; scheduleId: string | null; onClose: () => void }) {
  if (!props.open || !props.scheduleId) return null;
  return <EditScheduleInner key={props.scheduleId} {...props} />;
}

function EditScheduleInner({ open, scheduleId, onClose }: { open: boolean; scheduleId: string | null; onClose: () => void }) {
  const st = useStore();
  const update = useStore((s) => s.updateSchedule);
  const remove = useStore((s) => s.deleteSchedule);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const sc = st.schedules.find((x) => x.id === scheduleId);
  const [title, setTitle] = useState(sc?.title ?? "");
  const [type, setType] = useState<ScheduleType>(sc?.type ?? "meeting");
  const [start, setStart] = useState(() => dateTimeInput(sc?.start));
  const [location, setLocation] = useState(sc?.location ?? "");
  const [visible, setVisible] = useState(sc?.visibleToClient ?? true);
  const [confirmDel, setConfirmDel] = useState(false);
  if (!sc) return null;

  const submit = () => {
    if (!title.trim()) { toast("일정 제목을 입력해 주세요.", "error"); return; }
    update(sc.id, {
      title: title.trim(), type, start: new Date(start).toISOString(),
      location: location.trim() || undefined, visibleToClient: visible,
    }, me);
    toast("일정을 수정했습니다.");
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="sm"
        title={<span className="flex items-center gap-2"><CalendarDays size={18} /> 일정 수정</span>}
        footer={
          <>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirmDel(true)}>삭제</Button>
            <span className="flex-1" />
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button variant="accent" onClick={submit}>저장</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="제목"><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="유형">
              <Select value={type} onChange={(e) => setType(e.target.value as ScheduleType)}>
                {(Object.keys(SCHEDULE_TYPE) as ScheduleType[]).map((k) => <option key={k} value={k}>{SCHEDULE_TYPE[k].label}</option>)}
              </Select>
            </Field>
            <Field label="일시"><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          </div>
          <Field label="장소"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-[0.9rem]">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-[var(--theme-accent)]" /> 고객 Portal에 표시
          </label>
          {sc.visibleToClient && sc.companyId && (
            <p className="text-[0.78rem] leading-relaxed text-ink-3">
              고객에게 공개된 일정입니다. 시간을 바꾸면 고객에게 변경 알림이 전송됩니다.
            </p>
          )}
        </div>
      </Modal>
      <Confirm
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => {
          remove(sc.id, me);
          toast("일정을 삭제했습니다.");
          setConfirmDel(false);
          onClose();
        }}
        title="이 일정을 삭제할까요?"
        desc={sc.visibleToClient && sc.companyId ? "고객에게 공개된 일정이라 취소 알림이 함께 전송됩니다. 삭제 기록은 활동 로그에 남습니다." : "삭제 기록은 활동 로그에 남습니다."}
        confirmText="삭제"
        danger
      />
    </>
  );
}

/* ---------------- 업무 수정 · 삭제 ---------------- */

export function EditTaskModal(props: { open: boolean; taskId: string | null; onClose: () => void }) {
  if (!props.open || !props.taskId) return null;
  return <EditTaskInner key={props.taskId} {...props} />;
}

function EditTaskInner({ open, taskId, onClose }: { open: boolean; taskId: string | null; onClose: () => void }) {
  const st = useStore();
  const update = useStore((s) => s.updateTask);
  const remove = useStore((s) => s.deleteTask);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const t = st.tasks.find((x) => x.id === taskId);
  const [title, setTitle] = useState(t?.title ?? "");
  const [type, setType] = useState<Task["type"]>(t?.type ?? "후속연락");
  const [due, setDue] = useState(() => dateInput(t?.dueDate));
  const [priority, setPriority] = useState<Task["priority"]>(t?.priority ?? "normal");
  const [assignee, setAssignee] = useState(t?.assigneeId ?? me);
  const [status, setStatus] = useState<Task["status"]>(t?.status ?? "todo");
  const [memo, setMemo] = useState(t?.memo ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  if (!t) return null;

  const submit = () => {
    if (!title.trim()) { toast("업무 제목을 입력해 주세요.", "error"); return; }
    update(t.id, {
      title: title.trim(), type, dueDate: new Date(`${due}T18:00:00`).toISOString(),
      priority, assigneeId: assignee, status, memo: memo.trim() || undefined,
    }, me);
    toast("업무를 수정했습니다.");
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="sm"
        title={<span className="flex items-center gap-2"><CheckSquare size={18} /> 업무 수정</span>}
        footer={
          <>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirmDel(true)}>삭제</Button>
            <span className="flex-1" />
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button variant="accent" onClick={submit}>저장</Button>
          </>
        }
      >
        {t.source === "auto" && (
          <div className="mb-3 rounded-xl bg-info-bg px-4 py-2.5 text-[0.82rem] text-info">
            시스템이 자동 생성한 업무입니다. 수정·삭제해도 원래 사건(자료 제출·문의 등)의 기록은 남습니다.
          </div>
        )}
        <div className="space-y-3">
          <Field label="제목"><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="유형">
              <Select value={type} onChange={(e) => setType(e.target.value as Task["type"])}>
                {["후속연락", "자료검토", "내부작업", "문의응대", "미팅준비", "보고서", "기타"].map((k) => <option key={k}>{k}</option>)}
              </Select>
            </Field>
            <Field label="기한"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
            <Field label="우선순위">
              <Select value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])}>
                <option value="urgent">긴급</option><option value="normal">보통</option><option value="low">낮음</option>
              </Select>
            </Field>
            <Field label="상태">
              <Select value={status} onChange={(e) => setStatus(e.target.value as Task["status"])}>
                <option value="todo">대기</option><option value="doing">진행 중</option><option value="hold">보류</option><option value="done">완료</option>
              </Select>
            </Field>
          </div>
          <Field label="담당자">
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {st.users.filter((u) => u.role !== "client").map((u) => <option key={u.id} value={u.id}>{u.name} {u.title}</option>)}
            </Select>
          </Field>
          <Field label="메모"><Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} /></Field>
        </div>
      </Modal>
      <Confirm
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => {
          remove(t.id, me);
          toast("업무를 삭제했습니다.");
          setConfirmDel(false);
          onClose();
        }}
        title="이 업무를 삭제할까요?"
        desc="삭제 기록은 활동 로그에 남습니다. 완료 처리와 달리 실적 집계에서도 빠집니다."
        confirmText="삭제"
        danger
      />
    </>
  );
}
