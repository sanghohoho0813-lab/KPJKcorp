"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { clearDraft, listDrafts, onDraftsChange, type DraftInfo } from "@/lib/drafts";
import { CompanyModal } from "@/components/domain/CompanyForm";
import { Confirm } from "@/components/ui/overlay";
import { fmtDateTime } from "@/lib/format";

/**
 * 작성 중인 기업 등록이 있으면 화면 아래에 "이어서 쓰기"를 띄운다.
 * 창을 내려뒀거나 실수로 닫았거나, 브라우저를 새로 열어도 여기서 그대로 이어진다.
 */
export function DraftDock() {
  const me = useStore((s) => s.session?.userId);
  const formOpen = useUi((s) => s.companyFormOpen);
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [open, setOpen] = useState<DraftInfo | null>(null);
  const [discard, setDiscard] = useState<DraftInfo | null>(null);

  useEffect(() => {
    if (!me) return;
    const read = () => setDrafts(listDrafts(me).filter((d) => d.kind === "company"));
    read();
    return onDraftsChange(read);
  }, [me]);

  const d = drafts[0];
  return (
    <>
      {d && !formOpen && !open && (
        <div className="fixed bottom-[calc(var(--bottomnav-h)+64px)] right-4 z-[45] flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-full border border-accent/40 bg-surface py-1 pl-1 pr-1.5 shadow-xl lg:bottom-6" data-testid="draft-dock">
          <button type="button" onClick={() => setOpen(d)} className="pressable flex min-h-9 min-w-0 items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-[0.85rem] font-semibold text-accent-ink"
            title={`${fmtDateTime(d.savedAt)} 임시 저장`}>
            <PencilLine size={15} className="shrink-0" />
            <span className="min-w-0 truncate">{d.id === "new" ? "기업 등록" : "기업정보 수정"} 작성 중 · {d.label ?? ""}</span>
            <span className="shrink-0 underline-offset-2">이어서 쓰기</span>
          </button>
          {drafts.length > 1 && <span className="px-1 text-[0.75rem] font-semibold text-ink-3">+{drafts.length - 1}</span>}
          <button type="button" onClick={() => setDiscard(d)} aria-label="작성 중인 내용 버리기" className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink">
            <X size={16} />
          </button>
        </div>
      )}
      <CompanyModal open={!!open} companyId={open && open.id !== "new" ? open.id : null} onClose={() => setOpen(null)} onCreated={(id) => router.push(`/ax/clients/${id}`)} />
      <Confirm open={!!discard} onClose={() => setDiscard(null)} danger confirmText="버리기"
        title="작성 중인 내용을 버릴까요?" desc={`${discard?.label ?? ""} — 임시 저장된 입력이 지워집니다. 되돌릴 수 없습니다.`}
        onConfirm={() => { if (discard) clearDraft(discard.key); }} />
    </>
  );
}
