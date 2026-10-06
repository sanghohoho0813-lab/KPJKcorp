"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Consultation } from "@/lib/types";
import { addDays, iso } from "@/lib/format";
import { defaultPicked, followItems, type FollowItem } from "@/lib/consult-followups";
import { Button, Field, Input, Select, Textarea, cx } from "@/components/ui/ui";
import { Confirm, Modal } from "@/components/ui/overlay";
import { can } from "@/lib/permissions";

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
          // 한글 조합 중 Enter는 글자 확정이다 — 그때 넣으면 마지막 글자가 잘리거나 칸에 남는다
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" icon={<Plus size={15} />} onClick={add}>추가</Button>
      </div>
    </div>
  );
}

/** 작성과 수정이 같은 폼을 쓴다 — 항목이 갈라지면 둘 중 하나가 반드시 뒤처진다. */
export function NewConsultationModal(props: { open: boolean; onClose: () => void; companyId?: string; projectId?: string; consultationId?: string | null }) {
  if (!props.open) return null;
  return <ConsultationModalInner key={props.consultationId ?? "new"} {...props} />;
}

function ConsultationModalInner({ open, onClose, companyId, projectId, consultationId }: { open: boolean; onClose: () => void; companyId?: string; projectId?: string; consultationId?: string | null }) {
  const st = useStore();
  const create = useStore((s) => s.createConsultation);
  const makeFollowUps = useStore((s) => s.createConsultFollowUps);
  const update = useStore((s) => s.updateConsultation);
  const remove = useStore((s) => s.deleteConsultation);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const editing = st.consultations.find((x) => x.id === consultationId);

  const [company, setCompany] = useState(editing?.companyId ?? companyId ?? st.companies[0]?.id ?? "");
  const [project, setProject] = useState(editing?.projectId ?? projectId ?? "");
  const [date, setDate] = useState(() => localDateTimeInput(editing ? new Date(editing.date) : new Date()));
  const [type, setType] = useState<Consultation["type"]>(editing?.type ?? "후속상담");
  const [channel, setChannel] = useState<Consultation["channel"]>(editing?.channel ?? "방문");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [core, setCore] = useState<string[]>(editing?.summary.core ?? []);
  const [requirements, setRequirements] = useState<string[]>(editing?.summary.requirements ?? []);
  const [promises, setPromises] = useState<string[]>(editing?.summary.promises ?? []);
  const [documents, setDocuments] = useState<string[]>(editing?.summary.documents ?? []);
  const [nextAction, setNextAction] = useState(editing?.summary.nextAction ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  // 저장하면 함께 만들 것 — 체크를 바꾼 항목만 기억한다 (나머지는 기본값: 업무 켬 · 자료 요청 끔)
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [taskDue, setTaskDue] = useState(() => localDateInput(addDays(new Date(), 3)));
  const [docDue, setDocDue] = useState(() => localDateInput(addDays(new Date(), 7)));

  const cid = companyId ?? company;
  const c = st.companies.find((x) => x.id === cid);
  const projects = st.projects.filter((p) => p.companyId === cid);
  const items = followItems({ nextAction, promises, documents }, editing?.id, { tasks: st.tasks, docRequests: st.docRequests, companyId: cid });
  const isPicked = (it: FollowItem) => !it.done && (picked[it.key] ?? defaultPicked(it));
  const chosen = items.filter(isPicked);
  const mayDoc = can(st.session?.role, "doc.request");

  const reset = () => {
    setNotes(""); setCore([]); setRequirements([]); setPromises([]); setDocuments([]); setNextAction("");
    setDate(localDateTimeInput(new Date()));
  };

  const submit = () => {
    if (!cid) { toast("기업을 선택해 주세요.", "error"); return; }
    if (!notes.trim() && core.length === 0) { toast("상담 내용 또는 핵심 내용을 입력해 주세요.", "error"); return; }
    if (chosen.some((x) => x.kind !== "doc") && !taskDue) { toast("후속 업무 기한을 넣어 주세요.", "error"); return; }
    if (chosen.some((x) => x.kind === "doc") && !docDue) { toast("자료 제출 기한을 넣어 주세요.", "error"); return; }
    const summary = { core, requirements, promises, documents, nextAction: nextAction.trim() };
    let id: string | undefined;
    if (editing) {
      update(editing.id, { projectId: project || undefined, date: new Date(date).toISOString(), type, channel, notes: notes.trim(), summary }, me);
      id = editing.id;
    } else {
      id = create({ companyId: cid, projectId: project || undefined, date: new Date(date).toISOString(), consultantId: c?.consultantId ?? me, type, channel, notes: notes.trim(), summary }, me);
    }
    if (!id) return;
    // 상담에서 정한 것 → 업무 · 자료 요청 (이미 만든 것은 건너뛴다 — 수정해서 다시 저장해도 겹치지 않는다)
    const made = chosen.length
      ? makeFollowUps(id, chosen.map((x) => ({ kind: x.kind, text: x.text })), { task: iso(new Date(`${taskDue}T18:00:00`)), doc: iso(new Date(`${docDue}T18:00:00`)) }, me)
      : { tasks: 0, docs: 0 };
    const extra = [made.tasks ? `후속 업무 ${made.tasks}건` : "", made.docs ? `고객 자료 요청 ${made.docs}건` : ""].filter(Boolean).join(" · ");
    toast(`${editing ? "상담 기록을 수정했습니다" : "상담 기록을 저장했습니다"}${extra ? ` · ${extra}` : ""}`);
    if (!editing) reset();
    onClose();
  };

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "상담 기록 수정" : "상담 기록 작성"}
      size="lg"
      footer={
        <>
          {editing && <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirmDel(true)}>삭제</Button>}
          <span className="flex-1" />
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

      {/* 저장하면 함께 만들 것 — 상담에서 정한 것을 업무 · 자료 요청으로. 무엇이 만들어질지 미리 보이고 고를 수 있다 */}
      <div className={cx("mt-3 rounded-xl border px-4 py-3", chosen.length ? "border-accent/50 bg-soft/50" : "border-line bg-surface-2")} data-testid="consult-followups">
        <div className="text-[0.88rem] font-bold">저장하면 함께 만들 것</div>
        {items.length === 0 ? (
          <p className="mt-1 text-[0.8rem] text-ink-3">다음 Action · 우리가 약속한 것 · 필요 자료를 적으면, 저장할 때 담당자 업무와 고객 자료 요청으로 바로 만들 수 있습니다.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {items.map((it) => {
              const off = it.done || (it.kind === "doc" && !mayDoc);
              return (
                <li key={it.key}>
                  <label className={cx("flex items-start gap-2.5 rounded-lg px-1 py-1 text-[0.88rem]", off ? "opacity-60" : "cursor-pointer")}>
                    <input type="checkbox" disabled={off} checked={isPicked(it)} onChange={(e) => setPicked((p) => ({ ...p, [it.key]: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--theme-accent)]" data-follow={it.kind} />
                    <span className="min-w-0 flex-1">
                      <span className={cx("mr-1.5 inline-block rounded px-1.5 py-0.5 align-[1px] text-[0.72rem] font-bold", it.kind === "doc" ? "bg-info-bg text-info" : "bg-surface text-ink-2")}>{it.kind === "next" ? "업무" : it.kind === "promise" ? "약속 → 업무" : "고객 자료 요청"}</span>
                      <span className="font-semibold">{it.text}</span>
                      <span className="ml-1.5 text-[0.75rem] text-ink-3">{it.done ? (it.kind === "doc" ? "이미 요청 중" : "이미 등록됨") : it.kind === "doc" ? (mayDoc ? "고객 화면 · 알림" : "자료 요청 권한 없음") : it.type}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {(chosen.some((x) => x.kind !== "doc") || chosen.some((x) => x.kind === "doc")) && (
          <div className="mt-2 flex flex-wrap gap-3">
            {chosen.some((x) => x.kind !== "doc") && (
              <div className="w-[200px]"><Field label="업무 기한"><Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} aria-label="후속 업무 기한" /></Field>
                <span className="mt-1 flex gap-1">{([["내일", 1], ["3일 뒤", 3], ["1주 뒤", 7]] as const).map(([l, n]) => <button key={l} type="button" onClick={() => setTaskDue(localDateInput(addDays(new Date(), n)))} className={cx("pressable rounded-md px-2 py-0.5 text-[0.75rem] font-semibold", taskDue === localDateInput(addDays(new Date(), n)) ? "bg-soft text-accent-strong" : "text-ink-3 hover:bg-surface")}>{l}</button>)}</span>
              </div>
            )}
            {chosen.some((x) => x.kind === "doc") && (
              <div className="w-[200px]"><Field label="자료 제출 기한"><Input type="date" value={docDue} onChange={(e) => setDocDue(e.target.value)} aria-label="자료 제출 기한" /></Field></div>
            )}
          </div>
        )}
        {chosen.length > 0 && <p className="mt-2 text-[0.78rem] text-ink-3">업무는 담당 컨설턴트 업무함에, 자료 요청은 고객 화면 요청자료에 올라가고 고객에게 알림이 갑니다. 이미 만든 항목은 다시 만들지 않습니다.</p>}
      </div>
    </Modal>
      <Confirm
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => {
          if (!editing) return;
          remove(editing.id, me);
          toast("상담 기록을 삭제했습니다.");
          setConfirmDel(false);
          onClose();
        }}
        title="이 상담 기록을 삭제할까요?"
        desc="삭제하면 이 상담을 근거로 한 판단의 출처가 사라집니다. 삭제 사실은 활동 로그에 남습니다."
        confirmText="삭제"
        danger
      />
    </>
  );
}