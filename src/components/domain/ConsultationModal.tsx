"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Consultation } from "@/lib/types";
import { addDays, iso } from "@/lib/format";
import { Button, Field, Input, Select, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

function localDateTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 한 줄씩 추가하는 리스트 입력 — 상담 내용을 자유 서술로만 두면 나중에 검색·요약이 안 된다. */
function ListInput({ label, hint, items, onChange, placeholder }: { label: string; hint?: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <label className="text-[0.85rem] font-semibold text-ink-2">{label}</label>
        {hint && <span className="text-[0.75rem] text-ink-3">{hint}</span>}
      </div>
      {items.length > 0 && (
        <div className="mb-2 space-y-1">
          {items.map((it, i) => (
            <div key={`${it}-${i}`} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-[0.88rem]">
              <span className="min-w-0 flex-1">{it}</span>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="pressable shrink-0 rounded p-0.5 text-ink-3 hover:text-error" aria-label="삭제">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" icon={<Plus size={15} />} onClick={add}>추가</Button>
      </div>
    </div>
  );
}

export function NewConsultationModal({ open, onClose, companyId, projectId }: { open: boolean; onClose: () => void; companyId?: string; projectId?: string }) {
  const st = useStore();
  const create = useStore((s) => s.createConsultation);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";

  const [company, setCompany] = useState(companyId ?? st.companies[0]?.id ?? "");
  const [project, setProject] = useState(projectId ?? "");
  const [date, setDate] = useState(() => localDateTimeInput(new Date()));
  const [type, setType] = useState<Consultation["type"]>("후속상담");
  const [channel, setChannel] = useState<Consultation["channel"]>("방문");
  const [notes, setNotes] = useState("");
  const [core, setCore] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [promises, setPromises] = useState<string[]>([]);
  const [documents, setDocuments] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState("");
  const [makeTask, setMakeTask] = useState(true);
  const [taskDue, setTaskDue] = useState(() => localDateInput(addDays(new Date(), 3)));

  const cid = companyId ?? company;
  const c = st.companies.find((x) => x.id === cid);
  const projects = st.projects.filter((p) => p.companyId === cid);

  const reset = () => {
    setNotes(""); setCore([]); setRequirements([]); setPromises([]); setDocuments([]); setNextAction("");
    setDate(localDateTimeInput(new Date()));
  };

  const submit = () => {
    if (!cid) { toast("기업을 선택해 주세요.", "error"); return; }
    if (!notes.trim() && core.length === 0) { toast("상담 내용 또는 핵심 내용을 입력해 주세요.", "error"); return; }
    create(
      {
        companyId: cid,
        projectId: project || undefined,
        date: new Date(date).toISOString(),
        consultantId: c?.consultantId ?? me,
        type,
        channel,
        notes: notes.trim(),
        summary: { core, requirements, promises, documents, nextAction: nextAction.trim() },
      },
      me,
      makeTask && nextAction.trim() ? { create: true, dueDate: iso(new Date(`${taskDue}T18:00:00`)) } : undefined,
    );
    toast(makeTask && nextAction.trim() ? "상담 기록을 저장하고 후속 업무를 등록했습니다." : "상담 기록을 저장했습니다.");
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="상담 기록 작성"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="accent" onClick={submit}>저장</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {!companyId && (
          <Field label="기업">
            <Select value={company} onChange={(e) => { setCompany(e.target.value); setProject(""); }}>
              {st.companies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="프로젝트" hint="선택 — 특정 과제와 관련된 상담이면 연결합니다.">
          <Select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">연결 안 함</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="일시"><Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="유형">
          <Select value={type} onChange={(e) => setType(e.target.value as Consultation["type"])}>
            {(["초기상담", "후속상담", "정기미팅", "대표미팅"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="방식">
          <Select value={channel} onChange={(e) => setChannel(e.target.value as Consultation["channel"])}>
            {(["방문", "화상", "전화"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="상담 내용" hint="들은 그대로 편하게 적으세요. 아래 요약은 나중에 찾기 위한 항목입니다.">
          <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="예: 김민석 대표와 원가구조 논의. 2세 승계를 3년 내 준비 중이며…" />
        </Field>
      </div>

      <div className="mt-4 space-y-4 rounded-xl border border-line p-4">
        <div className="text-[0.85rem] font-bold">구조화 요약</div>
        <ListInput label="핵심 내용" items={core} onChange={setCore} placeholder="한 줄씩 입력 후 Enter" />
        <ListInput label="고객 요구사항" items={requirements} onChange={setRequirements} placeholder="한 줄씩 입력 후 Enter" />
        <ListInput label="우리가 약속한 것" hint="놓치면 신뢰가 깨지는 항목" items={promises} onChange={setPromises} placeholder="한 줄씩 입력 후 Enter" />
        <ListInput label="필요 자료" items={documents} onChange={setDocuments} placeholder="한 줄씩 입력 후 Enter" />
        <Field label="다음 Action">
          <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="예: 제안서 송부 및 계약 협의" />
        </Field>
      </div>

      <div className={cx("mt-3 rounded-xl border px-4 py-3", nextAction.trim() ? "border-accent/50 bg-soft/50" : "border-line bg-surface-2")}>
        <label className="flex items-center gap-2 text-[0.88rem] font-semibold">
          <input type="checkbox" checked={makeTask} onChange={(e) => setMakeTask(e.target.checked)} className="h-4 w-4 accent-[var(--theme-accent)]" />
          다음 Action을 후속 업무로 등록
        </label>
        <p className="mt-1 text-[0.8rem] text-ink-3">
          {nextAction.trim() ? "저장하면 담당자의 업무 목록에 추가되고, 기한이 지나면 브리핑에 자동으로 올라옵니다." : "다음 Action을 입력하면 활성화됩니다."}
        </p>
        {makeTask && nextAction.trim() && (
          <div className="mt-2 max-w-[220px]">
            <Field label="업무 기한"><Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} /></Field>
          </div>
        )}
      </div>
    </Modal>
  );
}
