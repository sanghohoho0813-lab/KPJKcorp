"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Modal } from "@/components/ui/overlay";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/ui";
import type { ScheduleType, Task } from "@/lib/types";
import { SCHEDULE_TYPE } from "@/lib/stages";
import { addDays } from "@/lib/format";

function localDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function localDateTimeInput(d: Date) {
  return `${localDateInput(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function NewDocRequestModal({ projectId, open, onClose }: { projectId: string | null; open: boolean; onClose: () => void }) {
  const session = useStore((s) => s.session);
  const create = useStore((s) => s.createDocRequest);
  const toast = useStore((s) => s.toast);
  const projects = useStore((s) => s.projects);
  const companies = useStore((s) => s.companies);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState(localDateInput(addDays(new Date(), 7)));
  const p = projects.find((x) => x.id === projectId);
  const c = companies.find((x) => x.id === p?.companyId);
  const submit = () => {
    if (!projectId || !name.trim()) {
      toast("자료명을 입력해 주세요.", "error");
      return;
    }
    create(projectId, { name: name.trim(), description: desc.trim(), dueDate: new Date(`${due}T18:00:00`).toISOString() }, session?.userId ?? "u_admin");
    toast("자료 요청이 등록되고 고객에게 알림이 전송되었습니다.");
    setName(""); setDesc("");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="자료 요청 등록" size="sm" footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit}>요청 등록</Button></>}>
      <div className="mb-3 rounded-xl bg-surface-2 px-4 py-2.5 text-[0.85rem]"><b>{c?.name}</b> · {p?.name}</div>
      <div className="space-y-3">
        <Field label="자료명"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 최근 3년 재무제표" autoFocus /></Field>
        <Field label="설명 (고객에게 표시)"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="어떤 형태로 준비하면 되는지 적어주세요." className="min-h-20" /></Field>
        <Field label="제출기한"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function NewScheduleModal({ open, onClose, companyId, projectId }: { open: boolean; onClose: () => void; companyId?: string; projectId?: string }) {
  const session = useStore((s) => s.session);
  const create = useStore((s) => s.createSchedule);
  const toast = useStore((s) => s.toast);
  const companies = useStore((s) => s.companies);
  const projects = useStore((s) => s.projects);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ScheduleType>("meeting");
  const [start, setStart] = useState(localDateTimeInput(addDays(new Date(), 1, 14)));
  const [location, setLocation] = useState("");
  const [cid, setCid] = useState(companyId ?? "");
  const [visible, setVisible] = useState(true);
  const submit = () => {
    if (!title.trim()) {
      toast("일정 제목을 입력해 주세요.", "error");
      return;
    }
    const pid = projectId ?? projects.find((p) => p.companyId === cid && !["done", "aftercare"].includes(p.stage))?.id;
    create({ title: title.trim(), type, start: new Date(start).toISOString(), location: location.trim() || undefined, companyId: cid || undefined, projectId: pid, assigneeId: session?.userId ?? "u_admin", visibleToClient: visible }, session?.userId ?? "u_admin");
    toast(visible && cid ? "일정이 등록되고 고객에게 알림이 전송되었습니다." : "일정이 등록되었습니다.");
    setTitle(""); setLocation("");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="일정 등록" size="sm" footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit}>등록</Button></>}>
      <div className="space-y-3">
        <Field label="제목"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 대표 미팅 (중간 보고)" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="유형"><Select value={type} onChange={(e) => setType(e.target.value as ScheduleType)}>{(Object.keys(SCHEDULE_TYPE) as ScheduleType[]).map((k) => <option key={k} value={k}>{SCHEDULE_TYPE[k].label}</option>)}</Select></Field>
          <Field label="일시"><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        </div>
        {!companyId && <Field label="기업"><Select value={cid} onChange={(e) => setCid(e.target.value)}><option value="">내부 일정</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
        <Field label="장소"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 고객사 본사 회의실 / 화상" /></Field>
        <label className="flex items-center gap-2 text-[0.9rem]"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-[var(--theme-accent)]" /> 고객 Portal에 표시</label>
      </div>
    </Modal>
  );
}

export function NewTaskModal({ open, onClose, companyId, projectId }: { open: boolean; onClose: () => void; companyId?: string; projectId?: string }) {
  const session = useStore((s) => s.session);
  const create = useStore((s) => s.createTask);
  const toast = useStore((s) => s.toast);
  const companies = useStore((s) => s.companies);
  const users = useStore((s) => s.users);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Task["type"]>("후속연락");
  const [due, setDue] = useState(localDateInput(addDays(new Date(), 1)));
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [assignee, setAssignee] = useState(session?.userId ?? "u_park");
  const [cid, setCid] = useState(companyId ?? "");
  const submit = () => {
    if (!title.trim()) {
      toast("업무 제목을 입력해 주세요.", "error");
      return;
    }
    create({ title: title.trim(), type, dueDate: new Date(`${due}T18:00:00`).toISOString(), priority, assigneeId: assignee, companyId: cid || undefined, projectId }, session?.userId ?? "u_admin");
    toast("업무가 등록되었습니다.");
    setTitle("");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="업무 등록" size="sm" footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit}>등록</Button></>}>
      <div className="space-y-3">
        <Field label="제목"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 비앤테크 미제출 자료 후속 연락" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="유형"><Select value={type} onChange={(e) => setType(e.target.value as Task["type"])}>{["후속연락", "자료검토", "내부작업", "문의응대", "미팅준비", "보고서", "기타"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="기한"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="우선순위"><Select value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])}><option value="urgent">긴급</option><option value="normal">보통</option><option value="low">낮음</option></Select></Field>
          <Field label="담당자"><Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>{users.filter((u) => u.role !== "client").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        </div>
        {!companyId && <Field label="기업"><Select value={cid} onChange={(e) => setCid(e.target.value)}><option value="">내부</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
      </div>
    </Modal>
  );
}
