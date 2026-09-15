"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Briefcase, Building2, CalendarDays, CheckSquare, ClipboardList, FileText, FileUp, MessageSquare, Receipt, Search, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { useEscape, useScrollLock } from "@/lib/hooks";
import { KIND_LABEL, KIND_ORDER, search, type SearchHit, type SearchKind } from "@/lib/search";
import { cx } from "@/components/ui/ui";

const KIND_ICON: Record<SearchKind, React.ReactNode> = {
  company: <Building2 size={15} />,
  project: <Briefcase size={15} />,
  doc: <FileUp size={15} />,
  task: <CheckSquare size={15} />,
  schedule: <CalendarDays size={15} />,
  consultation: <ClipboardList size={15} />,
  quote: <Receipt size={15} />,
  contract: <FileText size={15} />,
  inquiry: <MessageSquare size={15} />,
};

/** 헤더에 놓이는 검색 버튼 — 누르거나 ⌘K / Ctrl+K 로 연다. */
export function SearchTrigger({ compact }: { compact?: boolean }) {
  const open = useUi((s) => s.openSearch);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open]);

  if (compact) {
    return (
      <button onClick={open} aria-label="검색" className="pressable rounded-lg p-2 text-ink-2 hover:bg-surface-2">
        <Search size={20} />
      </button>
    );
  }
  return (
    <button
      onClick={open}
      className="pressable flex h-9 w-[220px] items-center gap-2 rounded-[10px] border border-line-2 bg-surface px-3 text-left text-[0.85rem] text-ink-3 hover:border-accent hover:bg-surface-2 xl:w-[280px]"
      aria-label="검색 열기"
    >
      <Search size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">기업 · 프로젝트 · 자료 · 업무 검색</span>
      <kbd className="hidden shrink-0 rounded-md border border-line bg-surface-2 px-1.5 text-[0.68rem] font-semibold text-ink-3 xl:inline">⌘K</kbd>
    </button>
  );
}

/**
 * 검색 팔레트. 결과는 종류별로 묶여서 나오고, 방향키로 고르고 Enter로 이동한다.
 * 결과가 5개를 넘는 종류는 "해당 화면에서 더 보기"를 안내한다 — 여기서 다 보여주려 하지 않는다.
 */
export function GlobalSearch() {
  const open = useUi((s) => s.searchOpen);
  const close = useUi((s) => s.closeSearch);
  const st = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useScrollLock(open);
  useEscape(close, open);

  // 열릴 때 입력창에 포커스, 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const hits = useMemo(
    () => search({ companies: st.companies, projects: st.projects, docRequests: st.docRequests, tasks: st.tasks, schedules: st.schedules, consultations: st.consultations, quotes: st.quotes, contracts: st.contracts, inquiries: st.inquiries }, q),
    [q, st.companies, st.projects, st.docRequests, st.tasks, st.schedules, st.consultations, st.quotes, st.contracts, st.inquiries],
  );

  const go = (h: SearchHit) => {
    close();
    setQ("");
    setCursor(0);
    router.push(h.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!hits.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const h = hits[cursor]; if (h) go(h); }
  };

  // 선택 항목이 보이도록 스크롤
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open || typeof document === "undefined") return null;

  const grouped = KIND_ORDER.map((k) => ({ kind: k, items: hits.filter((h) => h.kind === k) })).filter((g) => g.items.length > 0);
  let idx = -1;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[8vh] md:pt-[14vh]" role="dialog" aria-modal="true" aria-label="전역 검색">
      <div className="anim-fade absolute inset-0 bg-black/45" onClick={close} />
      <div className="anim-pop relative flex w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={onKey}
            placeholder="기업명, 프로젝트, 자료, 업무, 담당자, 사업자번호…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[1rem] text-ink outline-none placeholder:text-ink-3"
            aria-label="검색어"
          />
          {q && (
            <button onClick={() => { setQ(""); setCursor(0); inputRef.current?.focus(); }} aria-label="지우기" className="pressable rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
              <X size={16} />
            </button>
          )}
          <button onClick={close} className="pressable hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[0.7rem] font-semibold text-ink-3 md:inline">ESC</button>
        </div>

        <div ref={listRef} className="thin-scroll max-h-[60vh] overflow-y-auto">
          {q.trim() === "" ? (
            <div className="px-5 py-8 text-center text-[0.88rem] text-ink-3">
              두 글자만 입력해도 됩니다. <br className="md:hidden" />
              <span className="hidden md:inline">↑↓ 로 고르고 Enter 로 이동합니다.</span>
            </div>
          ) : hits.length === 0 ? (
            <div className="px-5 py-8 text-center text-[0.88rem] text-ink-3">
              &ldquo;{q}&rdquo; 에 해당하는 항목이 없습니다.
              <div className="mt-1 text-[0.78rem]">보관된 기업·프로젝트와 완료된 업무는 검색에 나오지 않습니다.</div>
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.kind} className="py-1.5">
                <div className="px-4 pb-1 pt-1.5 text-[0.7rem] font-bold tracking-[0.12em] text-ink-3">{KIND_LABEL[g.kind]}</div>
                {g.items.map((h) => {
                  idx += 1;
                  const i = idx;
                  const active = i === cursor;
                  return (
                    <button
                      key={h.id}
                      data-idx={i}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(h)}
                      className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors", active ? "bg-soft" : "hover:bg-surface-2")}
                    >
                      <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2")}>{KIND_ICON[h.kind]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.92rem] font-semibold">{h.title}</span>
                        <span className="block truncate text-[0.78rem] text-ink-3">{h.sub}</span>
                      </span>
                      {active && <kbd className="hidden shrink-0 rounded-md border border-line bg-surface px-1.5 text-[0.68rem] font-semibold text-ink-3 md:inline">↵</kbd>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
