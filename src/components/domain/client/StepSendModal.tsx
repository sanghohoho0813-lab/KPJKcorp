"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Send, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { CUSTOMER_STEPS, STEP_TO_STAGE, stageProgress, stageToCustomerStep } from "@/lib/stages";
import { DOC_CATALOG, DOCS_BY_TYPE, STEP_MESSAGES } from "@/lib/doc-catalog";
import { addDays, iso, uid } from "@/lib/format";
import { uploadResult as uploadResultFile } from "@/lib/server/storage";
import type { Project } from "@/lib/types";
import { Button, Input, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

/**
 * 진행 업무 단계를 누르면 열린다 — 단계 변경 + 고객에게 보낼 말 + (자료 요청 단계면) 요청 서류를 한 번에.
 * 고객에게는 알림 1건으로 간다.
 */
export function StepSendModal({ project: p, step, onClose }: { project: Project; step: number; onClose: () => void }) {
  const send = useStore((s) => s.sendProjectStep);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const docRequests = useStore((s) => s.docRequests);
  const cur = stageToCustomerStep(p.stage);
  const target = CUSTOMER_STEPS[step];
  const moving = step !== cur;
  const presets = STEP_MESSAGES[step] ?? [];
  const [message, setMessage] = useState(presets[0] ?? "");
  const [docs, setDocs] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [due, setDue] = useState(() => iso(addDays(new Date(), 7, 18)).slice(0, 10));
  const askDocs = step === 0;
  // 완료 단계: 결과 보고서를 같은 창에서 함께 공유
  const attachResult = step === CUSTOMER_STEPS.length - 1;
  const serverMode = useStore((s) => s.serverMode);
  const share = useStore((s) => s.shareResult);
  const [resFile, setResFile] = useState<File | null>(null);
  const [resName, setResName] = useState(`${p.name} 결과 보고서`);
  const [busy, setBusy] = useState(false);

  // 이미 받는 중인 서류 — 다시 요청하지 않는다
  const pending = useMemo(() => new Set(docRequests.filter((d) => d.companyId === p.companyId && (d.status === "requested" || d.status === "revision" || d.status === "planned")).map((d) => d.name)), [docRequests, p.companyId]);
  const suggested = (p.type && DOCS_BY_TYPE[p.type]) || [];
  const toggle = (name: string) => setDocs((d) => (d.includes(name) ? d.filter((x) => x !== name) : [...d, name]));
  const addCustom = () => {
    const n = custom.trim();
    if (!n) return;
    if (!docs.includes(n)) setDocs((d) => [...d, n]);
    setCustom("");
  };
  const addPreset = (t: string) => setMessage((m) => (m.includes(t) ? m : m.trim() ? `${m.trim()} ${t}` : t));

  const submit = async () => {
    if (busy) return;
    if (!moving && !docs.length && !message.trim() && !resFile) { toast("보낼 메시지나 요청할 서류를 넣어 주세요.", "error"); return; }
    let shared = false;
    if (attachResult && resFile) {
      if (!resName.trim()) { toast("결과자료 이름을 넣어 주세요.", "error"); return; }
      setBusy(true);
      let storagePath: string | undefined;
      if (serverMode) {
        const up = await uploadResultFile(p.companyId, uid("rs"), resFile);
        if (!up.ok) { toast(up.reason ?? "파일을 올리지 못했습니다.", "error"); setBusy(false); return; }
        storagePath = up.path;
      }
      share({ projectId: p.id, companyId: p.companyId, name: resName.trim(), kind: "보고서", description: "", size: resFile.size, sharedBy: me, storagePath }, me);
      shared = true;
      setBusy(false);
    }
    const r = send(p.id, STEP_TO_STAGE[step], { message, docs: askDocs ? docs : [], dueDate: new Date(`${due}T18:00:00`).toISOString() }, me);
    if (!r) return;
    const parts = [moving ? `${target.label} 단계로 바꿨습니다` : "보냈습니다", r.docs ? `자료 ${r.docs}건 요청` : "", shared ? "결과자료 공유" : ""].filter(Boolean);
    toast(`${p.name} — ${parts.join(" · ")}. 고객 화면에 바로 반영되고 알림이 갑니다.`);
    onClose();
  };

  const chip = (name: string) => {
    const on = docs.includes(name);
    const already = pending.has(name);
    return (
      <button key={name} type="button" disabled={already} onClick={() => toggle(name)} aria-pressed={on}
        className={cx("inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[0.82rem] font-medium transition-colors disabled:cursor-default disabled:opacity-50",
          on ? "border-accent bg-soft text-accent" : "border-line bg-surface hover:border-accent hover:text-accent")}>
        {on ? <Check size={13} /> : already ? null : <Plus size={13} className="opacity-60" />}{name}{already && " · 요청 중"}
      </button>
    );
  };

  return (
    <Modal open onClose={onClose} size="md"
      title={<span className="flex flex-wrap items-center gap-2"><Send size={17} className="text-accent" /> {moving ? `${target.label} 단계로` : `${target.label} · 고객에게 보내기`}</span>}
      footer={<>
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button variant="accent" icon={<Send size={15} />} onClick={submit} disabled={busy}>
          {busy ? "올리는 중…" : moving ? "단계 바꾸고 보내기" : "보내기"}{askDocs && docs.length ? ` (자료 ${docs.length}건)` : ""}
        </Button>
      </>}>
      <div className="rounded-xl bg-surface-2 px-4 py-2.5 text-[0.85rem] text-ink-2">
        <b className="text-ink">{p.name}</b> · 고객 화면 {CUSTOMER_STEPS[cur].label}{moving && <> → <b className="text-accent">{target.label}</b></>} · 진행률 {stageProgress(STEP_TO_STAGE[step])}%
      </div>

      {askDocs && (
        <div className="mt-4" data-doc-picker>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[0.88rem] font-bold">요청할 서류 <span className="font-normal text-ink-3">— 눌러서 담기</span></div>
            {suggested.length > 0 && (
              <button type="button" className="text-[0.8rem] font-semibold text-accent" onClick={() => setDocs((d) => [...d, ...suggested.filter((n) => !d.includes(n) && !pending.has(n))])}>
                {p.type} 서류 모두 담기
              </button>
            )}
          </div>
          {suggested.length > 0 && (
            <>
              <div className="mb-1.5 mt-2 text-[0.75rem] font-semibold text-ink-3">{p.type}에서 자주 받는 서류</div>
              <div className="flex flex-wrap gap-1.5">{suggested.map(chip)}</div>
            </>
          )}
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[0.8rem] font-semibold text-ink-3 hover:text-ink">
            {showAll ? "전체 목록 접기" : "전체 목록에서 고르기"}
          </button>
          {showAll && (
            <div className="mt-2 space-y-2.5">
              {DOC_CATALOG.map((g) => (
                <div key={g.group}>
                  <div className="mb-1 text-[0.75rem] font-semibold text-ink-3">{g.group}</div>
                  <div className="flex flex-wrap gap-1.5">{g.items.filter((n) => !suggested.includes(n)).map(chip)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addCustom(); } }} placeholder="목록에 없는 서류 직접 입력" aria-label="서류 직접 입력" />
            <Button variant="outline" icon={<Plus size={15} />} onClick={addCustom}>추가</Button>
          </div>

          <div className="mt-3 rounded-xl border border-line p-3">
            <div className="text-[0.8rem] font-semibold text-ink-2">담은 서류 {docs.length}건</div>
            {docs.length === 0 ? (
              <div className="mt-1 text-[0.8rem] text-ink-3">위에서 눌러 담으면 한 번에 요청됩니다. 서류 없이 단계만 바꿔도 됩니다.</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5" data-picked>
                {docs.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-[0.8rem] font-medium text-accent">
                    {n}
                    <button type="button" onClick={() => toggle(n)} aria-label={`${n} 빼기`} className="rounded-full p-0.5 hover:bg-accent/15"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <label className="mt-3 flex items-center gap-2 whitespace-nowrap text-[0.82rem] text-ink-2">제출 기한
              <Input type="date" className="w-auto" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {attachResult && (
        <div className="mt-4 rounded-xl border border-line p-3" data-result-attach>
          <div className="text-[0.88rem] font-bold">결과자료 함께 보내기 <span className="font-normal text-ink-3">(선택)</span></div>
          <p className="mt-0.5 text-[0.78rem] text-ink-3">고객 화면 완료자료에 올라가고 바로 내려받을 수 있습니다. 한 번에 50MB 까지.</p>
          <Input type="file" className="mt-2" aria-label="결과자료 파일" onChange={(e) => setResFile(e.target.files?.[0] ?? null)} />
          {resFile && <Input className="mt-2" value={resName} onChange={(e) => setResName(e.target.value)} aria-label="결과자료 이름" />}
        </div>
      )}

      <div className="mt-4">
        <div className="text-[0.88rem] font-bold">고객에게 보낼 메시지 <span className="font-normal text-ink-3">(알림으로 갑니다)</span></div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((t) => (
            <button key={t} type="button" onClick={() => addPreset(t)} className="rounded-full border border-line px-2.5 py-1 text-left text-[0.76rem] text-ink-2 hover:border-accent hover:text-accent">+ {t}</button>
          ))}
        </div>
        <textarea aria-label="고객에게 보낼 메시지" className="mt-2 min-h-24 w-full rounded-[10px] border border-line-2 bg-surface px-3.5 py-2.5 text-[0.9rem]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="직접 입력해도 됩니다. 비워 두면 단계 안내만 갑니다." />
        <p className="mt-1 text-[0.76rem] text-ink-3">내부 메모·금액·성과 약속은 쓰지 않습니다.</p>
      </div>
    </Modal>
  );
}
