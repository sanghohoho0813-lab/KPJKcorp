"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileText, MessageSquareText, RefreshCw, Search, Upload } from "lucide-react";
import type { DocumentRequest } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtDate, fmtDateTime, fmtSize, relativeDay, uid } from "@/lib/format";
import { MAX_UPLOAD_BYTES, uploadDocument as uploadDocumentFile, DOC_BUCKET, saveToDisk } from "@/lib/server/storage";
import { Modal } from "@/components/ui/overlay";
import { Button, Field, Textarea, Input, Stat, Badge } from "@/components/ui/ui";
import { DocStatusBadge } from "./domain";

/** Internal review modal — completes the PRIMARY closed loop from the AX side. */
export function ReviewDocModal({ req, open, onClose }: { req: DocumentRequest | null; open: boolean; onClose: () => void }) {
  const session = useStore((s) => s.session);
  const review = useStore((s) => s.reviewDocument);
  const toast = useStore((s) => s.toast);
  const companies = useStore((s) => s.companies);
  const users = useStore((s) => s.users);
  const openDraft = useUi((s) => s.openDraft);
  const [note, setNote] = useState("");
  // 제출된 파일 열기. 60초짜리 임시 주소를 그때그때 받아 쓴다 — 링크가 새어 나가도 오래 못 쓴다.
  const openFile = async (f: { storagePath?: string; fileName: string }) => {
    if (!f.storagePath) return;
    const r = await saveToDisk(DOC_BUCKET, f.storagePath, f.fileName);
    if (!r.ok) useStore.getState().toast(r.reason ?? "파일을 열지 못했습니다.", "error");
  };
  const company = companies.find((c) => c.id === req?.companyId);
  const consultant = users.find((u) => u.id === req?.assigneeId);
  if (!req) return null;
  const act = (outcome: "done" | "revision" | "reviewing") => {
    if (outcome === "revision" && !note.trim()) {
      toast("보완이 필요한 내용을 적어주세요.", "error");
      return;
    }
    review(req.id, outcome, note.trim() || undefined, session?.userId ?? "u_admin");
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
export function UploadModal({ req, open, onClose }: { req: DocumentRequest | null; open: boolean; onClose: () => void }) {
  const session = useStore((s) => s.session);
  const upload = useStore((s) => s.uploadDocument);
  const toast = useStore((s) => s.toast);
  const onServer = useStore((s) => s.serverMode);
  const [file, setFile] = useState<{ name: string; size: number; blob?: File } | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!req) return null;
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) { toast("50MB 를 넘는 파일은 올릴 수 없습니다.", "error"); return; }
    setFile({ name: f.name, size: f.size, blob: f });
  };
  const useSample = () => setFile({ name: `${req.name.replace(/\s+/g, "_")}.xlsx`, size: 240_000 + Math.floor(Math.random() * 400_000) });
  const submit = async () => {
    if (busy) return;
    if (!file) {
      toast("제출할 파일을 선택해 주세요.", "error");
      return;
    }
    setBusy(true);

    // 서버가 있으면 실제 파일을 먼저 올린다. 올라가지 않으면 제출로 치지 않는다 —
    // "제출됨"인데 파일이 없으면 담당자가 헛걸음한다.
    let storagePath: string | undefined;
    if (onServer) {
      if (!file.blob) { toast("샘플 파일은 서버에 올릴 수 없습니다. 실제 파일을 선택해 주세요.", "error"); setBusy(false); return; }
      const fileId = uid("f");
      const r = await uploadDocumentFile(req.companyId, req.id, fileId, file.blob);
      if (!r.ok) { toast(r.reason ?? "파일을 올리지 못했습니다.", "error"); setBusy(false); return; }
      storagePath = r.path;
    }

    // 막는 주체는 화면이 아니라 store다. 여기서는 결과를 보고 안내만 한다 —
    // 미리보기 중인 내부 계정이 대신 올리면 "고객이 직접 제출했다"는 기록이 거짓이 된다.
    const before = useStore.getState().docRequests.find((r) => r.id === req.id)?.files.length ?? 0;
    upload(req.id, { fileName: file.name, size: file.size, storagePath }, session?.userId ?? "");
    const after = useStore.getState().docRequests.find((r) => r.id === req.id)?.files.length ?? 0;
    if (after === before) {
      toast("읽기 전용 미리보기입니다. 자료 제출은 고객 계정으로만 가능합니다.", "error");
      setBusy(false);
      return;
    }
    toast("자료가 제출되었습니다. 담당 컨설턴트에게 바로 전달되었습니다.");
    setFile(null);
    setBusy(false);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Upload size={18} /> 자료 제출</span>} size="sm" footer={
      <>
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button variant="accent" onClick={submit} disabled={busy} icon={<Upload size={16} />}>{busy ? "올리는 중…" : "제출하기"}</Button>
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
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${drag ? "border-accent bg-soft/50" : "border-line-2 hover:bg-surface-2"}`}
      >
        <Upload size={26} className="text-ink-3" />
        {file ? (
          <div>
            <div className="font-semibold">{file.name}</div>
            <div className="text-[0.8rem] text-ink-3">{fmtSize(file.size)}</div>
          </div>
        ) : (
          <div className="text-[0.88rem] text-ink-2">파일을 끌어다 놓거나 <span className="font-semibold text-accent">클릭하여 선택</span></div>
        )}
        <Input type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {!onServer && <button onClick={useSample} className="mt-2 text-[0.8rem] font-semibold text-ink-3 underline-offset-2 hover:text-ink hover:underline">데모용 샘플 파일 사용</button>}
      <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-3">
        {onServer
          ? "파일은 우리 회사 보관함에 안전하게 저장되고, 담당 컨설턴트와 대표만 열 수 있습니다. 다른 기업에는 보이지 않습니다. 한 번에 50MB 까지."
          : "지금은 데모라 파일 내용이 저장되지 않고 파일명·크기만 기록됩니다. 서버 연결 후에는 실제 파일이 보관됩니다."}
      </p>
    </Modal>
  );
}
