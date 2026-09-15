"use client";

import { useState } from "react";
import { Briefcase, CalendarDays, CheckSquare, FileText, FileUp, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { INTERNAL_STAGES, SCHEDULE_TYPE } from "@/lib/stages";
import { addDays } from "@/lib/format";
import type { Contract, InternalStage, Project, ScheduleType, Task } from "@/lib/types";
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
// 클릭 위주 폼 + 서류 자동 채우기로 커져서 CompanyForm.tsx로 옮겼다. 기존 import 경로는 그대로 쓴다.
export { CompanyModal } from "./CompanyForm";

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
    const nm = f.nextMilestone && f.nextMilestone.label.trim() && f.nextMilestone.date ? { label: f.nextMilestone.label.trim(), date: f.nextMilestone.date } : undefined;
    const data = { ...f, name: f.name.trim(), description: f.description.trim(), nextMilestone: nm };
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
        <div className="rounded-xl border border-line p-4">
          <div className="text-[0.85rem] font-semibold">다음 예정 <span className="font-normal text-ink-3">— 고객 Portal에 "예상 완료"로 표시됩니다</span></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_180px]">
            <Input value={f.nextMilestone?.label ?? ""} onChange={(e) => set("nextMilestone", e.target.value || f.nextMilestone?.date ? { label: e.target.value, date: f.nextMilestone?.date ?? "" } : undefined)} placeholder="예: 중간 보고 미팅 / 결과보고서 전달" />
            <Input type="date" value={f.nextMilestone?.date ? dateInput(f.nextMilestone.date) : ""} onChange={(e) => set("nextMilestone", e.target.value || f.nextMilestone?.label ? { label: f.nextMilestone?.label ?? "", date: e.target.value ? new Date(`${e.target.value}T18:00:00`).toISOString() : "" } : undefined)} />
          </div>
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-3">표준 소요일이 쌓이기 전까지는 시스템이 예상일을 계산하지 않습니다. 담당자가 적은 날짜만 고객에게 보입니다.</p>
        </div>
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

/* ---------------- 자료요청 수정 · 취소 (제출 전) ---------------- */

/** 제출·검토가 시작된 뒤에는 손대지 않는다 — 요청 내용과 받은 자료가 어긋나면 기록이 의미를 잃는다. */
export const DOC_EDITABLE = ["planned", "requested", "revision"];

export function EditDocRequestModal(props: { open: boolean; requestId: string | null; onClose: () => void }) {
  if (!props.open || !props.requestId) return null;
  return <EditDocRequestInner key={props.requestId} {...props} />;
}

function EditDocRequestInner({ open, requestId, onClose }: { open: boolean; requestId: string | null; onClose: () => void }) {
  const st = useStore();
  const update = useStore((s) => s.updateDocRequest);
  const cancel = useStore((s) => s.cancelDocRequest);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const req = st.docRequests.find((r) => r.id === requestId);
  const [name, setName] = useState(req?.name ?? "");
  const [desc, setDesc] = useState(req?.description ?? "");
  const [due, setDue] = useState(() => dateInput(req?.dueDate));
  const [confirmDel, setConfirmDel] = useState(false);
  if (!req) return null;

  const company = st.companies.find((c) => c.id === req.companyId);
  const submit = () => {
    if (!name.trim()) { toast("자료명을 입력해 주세요.", "error"); return; }
    update(req.id, { name: name.trim(), description: desc.trim(), dueDate: due === dateInput(req.dueDate) ? undefined : new Date(`${due}T18:00:00`).toISOString() }, me);
    toast("자료요청을 수정했습니다. 고객에게 변경 안내가 전송되었습니다.");
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="sm"
        title={<span className="flex items-center gap-2"><FileUp size={18} /> 자료요청 수정</span>}
        footer={
          <>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirmDel(true)}>요청 취소</Button>
            <span className="flex-1" />
            <Button variant="ghost" onClick={onClose}>닫기</Button>
            <Button variant="accent" onClick={submit}>저장</Button>
          </>
        }
      >
        <div className="mb-3 rounded-xl bg-surface-2 px-4 py-2.5 text-[0.85rem]"><b>{company?.name}</b> · {st.projects.find((p) => p.id === req.projectId)?.name}</div>
        <div className="space-y-3">
          <Field label="자료명"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="설명 (고객에게 표시)"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} /></Field>
          <Field label="제출기한" hint="기한을 바꾸면 고객에게 변경 알림이 전송됩니다."><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
      </Modal>
      <Confirm
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => {
          cancel(req.id, me);
          toast("자료요청을 취소하고 고객에게 안내했습니다.");
          setConfirmDel(false);
          onClose();
        }}
        title="이 자료요청을 취소할까요?"
        desc="고객 화면에서 사라지고 취소 안내가 전송됩니다. 이 요청으로 자동 생성된 검토 업무도 함께 정리됩니다."
        confirmText="요청 취소"
        danger
      />
    </>
  );
}

/* ---------------- 계약 직접 등록 · 수정 ---------------- */

/** 견적 없이 맺은 기존 계약을 시스템에 올릴 때 쓴다. 견적에서 전환된 계약도 여기서 종료일·금액·상태를 고친다. */
export function ContractModal(props: { open: boolean; contractId?: string | null; companyId?: string; onClose: () => void }) {
  if (!props.open) return null;
  return <ContractModalInner key={props.contractId ?? `new:${props.companyId ?? ""}`} {...props} />;
}

function ContractModalInner({ open, contractId, companyId, onClose }: { open: boolean; contractId?: string | null; companyId?: string; onClose: () => void }) {
  const st = useStore();
  const create = useStore((s) => s.createContract);
  const update = useStore((s) => s.updateContract);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const editing = st.contracts.find((c) => c.id === contractId);
  const liveCompanies = st.companies.filter((c) => !c.archived);

  const [cid, setCid] = useState(editing?.companyId ?? companyId ?? liveCompanies[0]?.id ?? "");
  const [pid, setPid] = useState(editing?.projectId ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [scope, setScope] = useState(editing?.scope ?? "");
  const [period, setPeriod] = useState(editing?.period ?? "");
  const [status, setStatus] = useState<Contract["status"]>(editing?.status ?? "draft");
  const [endDate, setEndDate] = useState(editing?.endDate ? dateInput(editing.endDate) : "");
  const [amount, setAmount] = useState(editing?.amount ? String(Math.round(editing.amount / 10000)) : "");
  const [signedAt, setSignedAt] = useState(editing?.signedAt ? dateInput(editing.signedAt) : "");
  const [err, setErr] = useState<Record<string, string | undefined>>({});

  const projects = st.projects.filter((p) => p.companyId === cid && !p.archived);

  const submit = () => {
    const e: Record<string, string | undefined> = {};
    if (!cid) e.cid = "기업을 선택해 주세요.";
    if (!pid) e.pid = "프로젝트를 선택해 주세요. 계약은 항상 프로젝트에 붙습니다.";
    if (!title.trim()) e.title = "계약명은 필수입니다.";
    if (!period.trim()) e.period = "기간 표기는 필수입니다. 예: 2026.03 ~ 2026.12";
    if (status === "signed" && !signedAt) e.signedAt = "서명 완료 계약은 서명일이 필요합니다.";
    setErr(e);
    if (Object.keys(e).length) { toast("입력값을 확인해 주세요.", "error"); return; }
    const data = {
      companyId: cid, projectId: pid, title: title.trim(), scope: scope.trim(), period: period.trim(), status,
      endDate: endDate ? new Date(`${endDate}T23:59:00`).toISOString() : undefined,
      amount: amount ? Number(amount) * 10000 : undefined,
      signedAt: signedAt ? new Date(`${signedAt}T09:00:00`).toISOString() : undefined,
      sentAt: editing?.sentAt ?? (status !== "draft" ? new Date().toISOString() : undefined),
    };
    if (editing) {
      update(editing.id, data, me);
      toast("계약을 수정했습니다.");
    } else {
      const id = create(data, me);
      if (!id) { toast("계약을 등록할 권한이 없습니다.", "error"); return; }
      toast(`계약을 등록했습니다.${data.endDate ? " 종료 30일 전에 갱신 협의 업무가 자동으로 잡힙니다." : ""}`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={<span className="flex items-center gap-2"><FileText size={18} /> {editing ? "계약 수정" : "계약 등록"}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit}>{editing ? "저장" : "등록"}</Button></>}
    >
      {!editing && (
        <p className="mb-3 rounded-xl bg-surface-2 px-4 py-2.5 text-[0.82rem] leading-relaxed text-ink-2">
          견적 없이 맺은 기존 계약을 올릴 때 씁니다. 새 계약은 가능하면 <b className="text-ink">견적 → 고객 수락 → 계약 전환</b> 흐름을 타야 매출 기록이 이어집니다.
        </p>
      )}
      {editing?.source === "quote" && (
        <p className="mb-3 rounded-xl bg-info-bg px-4 py-2.5 text-[0.82rem] text-info">견적에서 전환된 계약입니다. 금액은 견적 합계에서 왔습니다.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="기업 *" hint={err.cid}>
          {editing ? (
            <div className="flex h-11 items-center rounded-[10px] bg-surface-2 px-3.5 text-[0.95rem] font-semibold">{st.companies.find((c) => c.id === cid)?.name}</div>
          ) : (
            <Select value={cid} onChange={(e) => { setCid(e.target.value); setPid(""); }}>
              {liveCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="프로젝트 *" hint={err.pid}>
          <Select value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">선택</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="계약명 *" hint={err.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 경영진단 컨설팅 계약" autoFocus /></Field>
        </div>
        <Field label="기간 표기 *" hint={err.period}><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="예: 2026.03 ~ 2026.12" /></Field>
        <Field label="종료일" hint="입력하면 30일 전에 갱신 협의 업무가 자동으로 잡힙니다"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
        <Field label="계약 금액">
          <div className="flex items-center gap-2">
            <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" />
            <span className="shrink-0 text-[0.85rem] text-ink-3">만원</span>
          </div>
        </Field>
        <Field label="상태">
          <Select value={status} onChange={(e) => setStatus(e.target.value as Contract["status"])}>
            <option value="draft">초안</option><option value="sent">서명 대기</option><option value="signed">서명 완료</option>
          </Select>
        </Field>
        {status === "signed" && (
          <Field label="서명일 *" hint={err.signedAt}><Input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} /></Field>
        )}
      </div>
      <div className="mt-3">
        <Field label="범위" hint="고객 Portal 계약 상태에도 표시됩니다."><Textarea rows={2} value={scope} onChange={(e) => setScope(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
