"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { DUE_QUICK, dueFromQuick, guessCompany, guessTaskType, type DueQuick } from "@/lib/quick-task";
import { Button, SegmentedControl, cx } from "@/components/ui/ui";

/**
 * 업무 한 줄 등록 — 적고 Enter. 창을 열지 않는다.
 * 기업 이름이 들어 있으면 그 기업에 붙이고, 낱말로 업무 유형을 고른다. 담당자는 나, 기한은 고른 날 18:00.
 * companyId를 주면(기업 상세) 그 기업으로 고정한다.
 */
export function QuickTaskBar({ companyId, projectId, className }: { companyId?: string; projectId?: string; className?: string }) {
  const session = useStore((s) => s.session);
  const companies = useStore((s) => s.companies);
  const create = useStore((s) => s.createTask);
  const toast = useStore((s) => s.toast);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<DueQuick>("today");
  // 자동으로 붙은 기업을 사용자가 뺐으면 같은 글자에서는 다시 붙이지 않는다
  const [unlinked, setUnlinked] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const guessed = useMemo(() => (companyId ? companyId : unlinked ? undefined : guessCompany(title, companies)), [companyId, unlinked, title, companies]);
  const type = guessTaskType(title);
  const company = companies.find((c) => c.id === guessed);

  const submit = () => {
    const t = title.trim();
    if (!t) { ref.current?.focus(); return; }
    if (!session) return;
    create({ title: t, type, dueDate: dueFromQuick(due), priority: "normal", assigneeId: session.userId, companyId: guessed, projectId }, session.userId);
    toast(`업무를 추가했습니다${company && !companyId ? ` · ${company.name}` : ""}`);
    setTitle("");
    setUnlinked(false);
    ref.current?.focus();
  };

  return (
    <div className={cx("rounded-2xl border border-line bg-surface p-2.5 md:p-3", className)} data-testid="quick-task">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Plus size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            ref={ref}
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (!e.target.value) setUnlinked(false); }}
            // 한글 조합 중 Enter는 글자 확정이다 — 그때 등록하면 마지막 글자가 두 번 들어간다
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
            placeholder={companyId ? "이 기업 할 일을 적고 Enter" : "할 일을 적고 Enter — 기업 이름을 넣으면 자동으로 연결"}
            aria-label="새 업무 제목"
            enterKeyHint="done"
            maxLength={120}
            className="h-11 w-full rounded-[10px] border border-line-2 bg-surface pl-9 pr-3 text-[0.95rem] text-ink placeholder:text-ink-3 focus:border-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl size="sm" value={due} onChange={setDue} options={DUE_QUICK} />
          <Button size="sm" variant="accent" onClick={submit} className="ml-auto shrink-0 sm:ml-0">추가</Button>
        </div>
      </div>
      {title.trim() && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[0.8rem] text-ink-3" data-testid="quick-task-guess">
          {company && !companyId ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2 py-0.5 font-semibold text-accent-strong">
              {company.name}
              <button type="button" onClick={() => setUnlinked(true)} aria-label="기업 연결 빼기" className="-mr-1 rounded-full p-0.5 hover:bg-accent/15"><X size={12} /></button>
            </span>
          ) : !companyId ? <span>기업 연결 없음 (내부 업무)</span> : null}
          <span>· {type}</span>
          <span>· 나에게 · {DUE_QUICK.find((d) => d.key === due)?.label} 18:00까지</span>
        </div>
      )}
    </div>
  );
}
