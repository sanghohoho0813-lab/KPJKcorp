"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Download, FileText, MessageSquareText, RefreshCw, Search, Upload, Camera, X } from "lucide-react";
import type { DocumentRequest } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtDate, fmtDateTime, fmtSize, relativeDay, uid } from "@/lib/format";
import { MAX_UPLOAD_BYTES, uploadDocument as uploadDocumentFile, DOC_BUCKET, saveToDisk } from "@/lib/server/storage";
import { shrinkPhoto } from "@/lib/image-shrink";
import { Modal } from "@/components/ui/overlay";
import { Button, Field, Textarea, Input, Stat, Badge } from "@/components/ui/ui";
import { DocStatusBadge } from "./domain";
import { slotsOf } from "@/lib/vault";
import { policyDocOf } from "@/lib/policy-docs";

/** Internal review modal — completes the PRIMARY closed loop from the AX side. */
export function ReviewDocModal({ req, open, onClose }: { req: DocumentRequest | null; open: boolean; onClose: () => void }) {
  const session = useStore((s) => s.session);
  const review = useStore((s) => s.reviewDocument);
  const toast = useStore((s) => s.toast);
  const companies = useStore((s) => s.companies);
  const users = useStore((s) => s.users);
  const openDraft = useUi((s) => s.openDraft);
  const vaults = useStore((s) => s.companyVaults);
  const [note, setNote] = useState("");
  const [issued, setIssued] = useState("");
  // 제출된 파일 열기. 60초짜리 임시 주소를 그때그때 받아 쓴다 — 링크가 새어 나가도 오래 못 쓴다.
  const openFile = async (f: { storagePath?: string; fileName: string }) => {
    if (!f.storagePath) return;
    const r = await saveToDisk(DOC_BUCKET, f.storagePath, f.fileName);
    if (!r.ok) useStore.getState().toast(r.reason ?? "파일을 열지 못했습니다.", "error");
  };
  const company = companies.find((c) => c.id === req?.companyId);
  const consultant = users.find((u) => u.id === req?.assigneeId);
  if (!req) return null;
  // 유효기간이 있는 서류(등기부·납세증명 …) — 서류함 칸이나 정책자금 준비 서류 목록에서 찾는다
  const slot = slotsOf(vaults.find((v) => v.companyId === req.companyId)).find((m) => m.label.replace(/\s+/g, "") === req.name.replace(/\s+/g, ""));
  const pdoc = policyDocOf(req.name);
  const validMonths = slot?.validMonths ?? pdoc?.validMonths;
  const act = (outcome: "done" | "revision" | "reviewing") => {
    if (outcome === "revision" && !note.trim()) {
      toast("보완이 필요한 내용을 적어주세요.", "error");
      return;
    }
    review(req.id, outcome, note.trim() || undefined, session?.userId ?? "u_admin", outcome === "done" && issued ? issued : undefined);
    setIssued("");
    toast(outcome === "done" ? "검토 완료 — 고객 Portal 상태가 '확인완료'로 바뀌었습니다." : outcome === "revision" ? "보완 요청 — 고객에게 알림이 전송되었습니다." : "검토를 시작했습니다.");
    setNote("");
    onClose();
  };
  const canReview = req.status === "submitted" || req.status === "reviewing";
  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><FileText size={18} /> {req.name}</span>} size="md">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DocStatusBadge status={req.status} />
        <span className="text-[0.85rem] text-ink-2">{company?.name}</span>
        <span className="text-[0.85rem] text-ink-3">· 담당 {consultant?.name}</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4 md:grid-cols-4">
        <Stat label="요청일" value={fmtDate(req.requestedAt)} />
        <Stat label="제출기한" value={<>{fmtDate(req.dueDate)} <span className="text-ink-3">({relativeDay(req.dueDate)})</span></>} />
        <Stat label="제출일" value={req.submittedAt ? fmtDateTime(req.submittedAt) : "-"} />
        <Stat label="검토일" value={req.reviewedAt ? fmtDateTime(req.reviewedAt) : "-"} />
      </div>
      {req.description && <p className="mb-4 text-[0.9rem] text-ink-2">{req.description}</p>}
      <div className="mb-4">
        <div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">제출 파일</div>
        {req.files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-2 px-4 py-4 text-center text-[0.85rem] text-ink-3">아직 제출된 파일이 없습니다.</div>
        ) : (
          <ul className="space-y-1.5">
            {req.files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-[0.88rem]">
                <span className="flex min-w-0 items-center gap-2 font-semibold"><FileText size={16} className="shrink-0 text-ink-3" /> <span className="truncate">{f.fileName}</span> <Badge>v{f.version}</Badge></span>
                <span className="flex shrink-0 items-center gap-2 text-ink-3">
                  {fmtSize(f.size)} · {fmtDateTime(f.uploadedAt)}
                  {f.storagePath && (
                    <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={() => void openFile(f)}>
                      열기
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {req.reviewNote && req.status === "revision" && (
        <div className="mb-4 rounded-xl bg-error-bg px-4 py-3 text-[0.88rem] text-error"><b>보완 요청 내용:</b> {req.reviewNote}</div>
      )}
      {canReview && validMonths && slot && (
        <Field label={`발급일 (선택) — 넣으면 서류함이 유효기간(${pdoc?.validText ?? `${validMonths}개월`})을 계산해 지나기 전에 알려 드립니다`}>
          <Input type="date" value={issued} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setIssued(e.target.value)} aria-label="발급일" data-testid="review-issued" />
        </Field>
      )}
      {canReview && (
        <Field label="검토 메모 (보완 요청 시 고객에게 전달됩니다)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 거래처별 구분 없이 합계만 제출되어 거래처 단위 연령 구분이 필요합니다." />
        </Field>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={<MessageSquareText size={16} />} onClick={() => openDraft({ kind: req.status === "revision" ? "revision_reminder" : "doc_reminder", ctx: { companyName: company?.name, contactName: company?.contactName, consultantName: consultant?.name, docName: req.name, dueText: `${fmtDate(req.dueDate)} (${relativeDay(req.dueDate)})`, note: req.reviewNote } })}>
          안내 초안
        </Button>
        <div className="flex gap-2">
          {req.status === "submitted" && <Button variant="outline" icon={<Search size={16} />} onClick={() => act("reviewing")}>검토 시작</Button>}
          {canReview && <Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => act("revision")}>보완 요청</Button>}
          {canReview && <Button variant="accent" icon={<CheckCircle2 size={16} />} onClick={() => act("done")}>검토 완료</Button>}
          {!canReview && <Button variant="secondary" onClick={onClose}>닫기</Button>}
        </div>
      </div>
    </Modal>
  );
}

/**
 * 고객이 자료를 제출하는 화면 — 이 시스템의 가장 중요한 고리다.
 * 서버가 붙어 있으면 실제 파일이 올라가고, 없으면 예전처럼 파일명·크기만 기록한다.
 */
type Picked = { name: string; size: number; blob?: File; from?: number; /** 이미 서버에 올라간 경로 — 다시 올리기 때 건너뛴다 */ path?: string };

/** 고객 자료 제출 — 파일 여러 개를 한 번에 낼 수 있다(재무제표 3년치, 여러 장 찍은 서류). 제출은 한 번으로 기록된다 */
export function UploadModal({ req, open, onClose }: { req: DocumentRequest | null; open: boolean; onClose: () => void }) {
  const session = useStore((s) => s.session);
  const upload = useStore((s) => s.uploadDocument);
  const toast = useStore((s) => s.toast);
  const onServer = useStore((s) => s.serverMode);
  const [files, setFiles] = useState<Picked[]>([]);
  const [shrinking, setShrinking] = useState(false);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  // 올리는 중 진행률 (0~1) · 실패 이유(토스트는 금방 사라져 휴대폰에서 놓치기 쉽다 — 창 안에 남긴다) · 취소
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  if (!req) return null;
  const close = () => { abort.current?.abort(); setFailed(null); setFiles([]); onClose(); };
  // 큰 휴대폰 사진은 서류가 읽히는 크기로 줄여서 올린다 (문서 파일·작은 사진은 그대로)
  const pick = async (list: FileList | File[] | null | undefined) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    setFailed(null);
    setShrinking(true);
    const out: Picked[] = [];
    for (const f of picked) {
      const { file: small, from } = await shrinkPhoto(f);
      if (small.size > MAX_UPLOAD_BYTES) { toast(`${f.name}: 50MB 를 넘는 파일은 올릴 수 없습니다.`, "error"); continue; }
      out.push({ name: small.name, size: small.size, blob: small, from });
    }
    setShrinking(false);
    setFiles((cur) => [...cur, ...out.filter((x) => !cur.some((c) => c.name === x.name && c.size === x.size))]);
  };
  // 카메라 사진은 이름이 "image.jpg" 라 담당자가 알아보기 어렵다 — 서류 이름으로 바꿔 둔다
  const pickPhoto = (f: File | undefined) => {
    if (!f) return;
    const ext = (f.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".jpg").toLowerCase();
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
    void pick([new File([f], `${req.name.replace(/[\\/:*?"<>|\s]+/g, "_")}_사진_${stamp}${ext}`, { type: f.type || "image/jpeg" })]);
  };
  const useSample = () => setFiles((cur) => [...cur, { name: `${req.name.replace(/\s+/g, "_")}${cur.length ? `_${cur.length + 1}` : ""}.xlsx`, size: 240_000 + Math.floor(Math.random() * 400_000) }]);
  const removeAt = (i: number) => setFiles((cur) => cur.filter((_, k) => k !== i));
  const submit = async () => {
    if (busy || shrinking) return;
    if (!files.length) {
      toast("제출할 파일을 선택해 주세요.", "error");
      return;
    }
    setBusy(true);

    // 서버가 있으면 실제 파일을 먼저 모두 올린다. 하나라도 안 올라가면 제출로 치지 않는다 —
    // "제출됨"인데 파일이 없으면 담당자가 헛걸음한다. 올라간 파일은 기억해 두고 다시 올리기 때 건너뛴다.
    const ready = [...files];
    if (onServer) {
      if (ready.some((f) => !f.blob && !f.path)) { toast("샘플 파일은 서버에 올릴 수 없습니다. 실제 파일을 선택해 주세요.", "error"); setBusy(false); return; }
      setFailed(null);
      for (let i = 0; i < ready.length; i += 1) {
        if (ready[i].path) continue;
        setProgress(i / ready.length);
        abort.current = new AbortController();
        const r = await uploadDocumentFile(req.companyId, req.id, uid("f"), ready[i].blob!, {
          signal: abort.current.signal,
          onProgress: (loaded, total) => setProgress((i + (total ? loaded / total : 0)) / ready.length),
        });
        abort.current = null;
        if (!r.ok) {
          setProgress(null);
          setBusy(false);
          setFiles(ready);
          if (r.cancelled) return;
          // 고른 파일은 그대로 둔다 — 연결이 돌아오면 "다시 올리기" 한 번이면 된다
          setFailed(ready.length > 1 ? `${ready[i].name}: ${r.reason ?? "파일을 올리지 못했습니다."}` : (r.reason ?? "파일을 올리지 못했습니다."));
          if (r.authLost) void useStore.getState().checkSession();
          return;
        }
        ready[i] = { ...ready[i], path: r.path };
      }
      setProgress(null);
    }

    // 막는 주체는 화면이 아니라 store다. 여기서는 결과를 보고 안내만 한다 —
    // 미리보기 중인 내부 계정이 대신 올리면 "고객이 직접 제출했다"는 기록이 거짓이 된다.
    const before = useStore.getState().docRequests.find((r) => r.id === req.id)?.files.length ?? 0;
    upload(req.id, ready.map((f) => ({ fileName: f.name, size: f.size, storagePath: f.path })), session?.userId ?? "");
    const after = useStore.getState().docRequests.find((r) => r.id === req.id)?.files.length ?? 0;
    if (after === before) {
      toast("읽기 전용 미리보기입니다. 자료 제출은 고객 계정으로만 가능합니다.", "error");
      setBusy(false);
      return;
    }
    toast(ready.length > 1 ? `파일 ${ready.length}개를 제출했습니다. 담당 컨설턴트에게 바로 전달되었습니다.` : "자료가 제출되었습니다. 담당 컨설턴트에게 바로 전달되었습니다.");
    setFiles([]);
    setBusy(false);
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title={<span className="flex items-center gap-2"><Upload size={18} /> 자료 제출</span>} size="sm" footer={
      <>
        {progress !== null
          ? <Button variant="ghost" onClick={() => abort.current?.abort()} data-testid="upload-cancel">올리기 취소</Button>
          : <Button variant="ghost" onClick={close}>취소</Button>}
        <Button variant="accent" onClick={submit} disabled={busy || shrinking} icon={<Upload size={16} />}>
          {busy ? (progress !== null ? `올리는 중 ${Math.round(progress * 100)}%` : "올리는 중…") : failed ? "다시 올리기" : files.length > 1 ? `${files.length}개 제출하기` : "제출하기"}
        </Button>
      </>
    }>
      <div className="mb-3">
        <div className="font-bold">{req.name}</div>
        {req.description && <div className="mt-0.5 text-[0.85rem] text-ink-2">{req.description}</div>}
        <div className="mt-1 text-[0.8rem] text-ink-3">제출기한 {fmtDate(req.dueDate)} ({relativeDay(req.dueDate)})</div>
      </div>
      {req.status === "revision" && req.reviewNote && (
        <div className="mb-3 rounded-xl bg-error-bg px-4 py-3 text-[0.85rem] text-error"><b>보완 요청:</b> {req.reviewNote}</div>
      )}
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors ${files.length ? "py-4" : "py-8"} ${drag ? "border-accent bg-soft/50" : "border-line-2 hover:bg-surface-2"}`}
      >
        <Upload size={files.length ? 20 : 26} className="text-ink-3" />
        {shrinking ? (
          <div className="text-[0.88rem] font-semibold text-ink-2" data-testid="shrinking">사진을 줄이는 중…</div>
        ) : (
          <div className="text-[0.88rem] text-ink-2">{files.length ? <>파일 <span className="font-semibold text-accent">더 고르기</span></> : <>파일을 끌어다 놓거나 <span className="font-semibold text-accent">클릭하여 선택</span> · 여러 개 가능</>}</div>
        )}
        <Input type="file" multiple className="hidden" onChange={(e) => { void pick(e.target.files); e.currentTarget.value = ""; }} />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5" data-testid="upload-files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
              <FileText size={16} className="shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1">
                <FileName name={f.name} />
                <span className="block text-[0.78rem] text-ink-3" data-testid="upload-size">
                  {f.from ? <>사진을 줄여서 올립니다 · {fmtSize(f.from)} → <b className="text-ink-2">{fmtSize(f.size)}</b> (글자는 그대로 읽힙니다)</> : fmtSize(f.size)}{f.path ? " · 올라감" : ""}
                </span>
              </span>
              {!busy && <button type="button" onClick={() => removeAt(i)} aria-label={`${f.name} 빼기`} className="pressable icon-btn shrink-0 text-ink-3 hover:bg-surface-2 hover:text-ink"><X size={15} /></button>}
            </li>
          ))}
        </ul>
      )}
      {progress !== null && (
        <div className="mt-2" data-testid="upload-progress">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="올리는 중" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(3, Math.round(progress * 100))}%` }} />
          </div>
        </div>
      )}
      {failed && (
        <p role="alert" data-testid="upload-error" className="mt-2 rounded-lg bg-error-bg px-3 py-2 text-[0.85rem] font-semibold text-error">{failed}</p>
      )}
      {/* 휴대폰: 서류를 바로 사진으로 — 뒤쪽 카메라가 열린다. 여러 장이면 한 장씩 더 찍는다 */}
      <label className="pressable mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-2 text-[0.9rem] font-semibold text-ink-2 hover:bg-surface-2 md:hidden" data-testid="camera-upload">
        <Camera size={18} /> {files.length ? "한 장 더 찍기" : "사진 찍어 올리기"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.currentTarget.value = ""; }} />
      </label>
      {!onServer && <button onClick={useSample} className="mt-2 text-[0.8rem] font-semibold text-ink-3 underline-offset-2 hover:text-ink hover:underline">데모용 샘플 파일 사용</button>}
      <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-3">
        {onServer
          ? "파일은 우리 회사 보관함에 안전하게 저장되고, 담당 컨설턴트와 대표만 열 수 있습니다. 다른 기업에는 보이지 않습니다. 파일 하나에 50MB 까지."
          : "지금은 데모라 파일 내용이 저장되지 않고 파일명·크기만 기록됩니다. 서버 연결 후에는 실제 파일이 보관됩니다."}
      </p>
    </Modal>
  );
}

/** 긴 파일 이름은 앞부분만 줄이고 확장자는 남긴다 — 휴대폰에서 ".xls / x"처럼 꺾이지 않게 */
function FileName({ name }: { name: string }) {
  const dot = name.lastIndexOf(".");
  const [base, ext] = dot > 0 && name.length - dot <= 6 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  return <span className="flex min-w-0 text-[0.88rem] font-semibold" title={name}><span className="truncate">{base}</span>{ext && <span className="shrink-0">{ext}</span>}</span>;
}
