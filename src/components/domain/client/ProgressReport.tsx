"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Copy, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { daysFromTo, todayYmd } from "@/lib/vault";
import { buildReport, isReport, lastReportFor, localDay, md, reportBody, reportFrom, reportTitle, type ReportRange } from "@/lib/progress-report";
import type { Company } from "@/lib/types";
import { Button, SegmentedControl, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { NoticeBody } from "@/components/domain/Notices";

/**
 * 경과 보고 (내부) — 기간을 고르면 고객에게 이미 보이는 기록으로 줄이 채워진다.
 * 담당자는 뺄 줄을 끄고 한마디를 더해 고객 화면(공지 · 홈 맨 위)에 보내거나, 카톡용으로 복사한다.
 */
export function ProgressReportModal({ company, open, onClose }: { company: Company; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Inner company={company} onClose={onClose} />;
}

function Inner({ company: c, onClose }: { company: Company; onClose: () => void }) {
  const st = useStore();
  const me = st.session?.userId ?? "";
  const today = todayYmd();
  const last = useMemo(() => lastReportFor(st.notices, c.id), [st.notices, c.id]);
  const [range, setRange] = useState<ReportRange>(last && daysFromTo(localDay(last.publishedAt), today) <= 45 ? "since" : "2w");
  const [view, setView] = useState<"pick" | "preview">("pick");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [pinned, setPinned] = useState(true);

  const from = reportFrom(range, today, last?.publishedAt);
  const sections = useMemo(
    () => buildReport({ company: c, projects: st.projects, docRequests: st.docRequests, results: st.results, schedules: st.schedules, inquiries: st.inquiries }, from, today),
    [c, st.projects, st.docRequests, st.results, st.schedules, st.inquiries, from, today],
  );
  const signer = st.users.find((u) => u.id === c.consultantId) ?? st.users.find((u) => u.id === me);
  const title = reportTitle(from, today);
  const body = reportBody({ company: c, from, to: today, sections, skip: off, note, signature: signer ? `담당 ${signer.name} ${signer.title}`.trim() : undefined });
  const picked = sections.reduce((n, s) => n + s.lines.filter((l) => !off.has(l.key)).length, 0);
  const canSend = picked > 0 || !!note.trim();

  const toggle = (key: string, on: boolean) => setOff((s) => { const n = new Set(s); if (on) n.delete(key); else n.add(key); return n; });
  const copy = async () => {
    const text = `${title}\n\n${body}\n\n자세히 보기: ${window.location.origin}/portal/schedule#notices`;
    try { await navigator.clipboard.writeText(text); st.toast("경과 보고를 복사했습니다. 카카오톡·문자에 붙여 넣으세요."); }
    catch { st.toast("복사하지 못했습니다. 미리 보기 글을 길게 눌러 직접 복사해 주세요.", "error"); }
  };
  const send = () => {
    if (!canSend) return;
    const before = st.notices.filter((n) => n.companyId === c.id && n.pinned && isReport(n));
    const id = st.createNotice({ companyId: c.id, title, body, pinned }, me);
    if (!id) return;
    // 홈 맨 위에는 가장 최근 경과 보고 하나만
    if (pinned) for (const n of before) st.updateNotice(n.id, { pinned: false }, me);
    // '경과 보고 N일 공백' 규칙 업무는 보냈으니 끝
    if (can(st.session?.role, "task.update")) for (const t of st.tasks) if (t.companyId === c.id && t.ruleKey?.startsWith("progress_report:") && (t.status === "todo" || t.status === "doing")) st.updateTaskStatus(t.id, "done", me);
    st.toast(`경과 보고를 보냈습니다. 고객 화면 '일정 · 공지'${pinned ? "와 홈 맨 위" : ""}에 보이고 알림이 갑니다.`);
    onClose();
  };

  const ranges: { key: ReportRange; label: string }[] = [
    ...(last ? [{ key: "since" as const, label: "지난 보고 이후" }] : []),
    { key: "2w", label: "최근 2주" },
    { key: "1m", label: "최근 한 달" },
  ];

  return (
    <Modal open onClose={onClose} size="lg"
      title={<span className="flex items-center gap-2"><ClipboardList size={18} className="text-accent" /> 경과 보고</span>}
      footer={<>
        <Button variant="ghost" className="max-sm:hidden" onClick={onClose}>닫기</Button>
        <Button variant="outline" className="max-sm:flex-1" icon={<Copy size={15} />} onClick={copy} disabled={!canSend}>카톡용 복사</Button>
        <Button variant="accent" className="max-sm:flex-1" icon={<Send size={15} />} onClick={send} disabled={!canSend}>고객에게 보내기</Button>
      </>}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="report-range">
        <SegmentedControl size="sm" value={range} onChange={(k) => { setRange(k); setOff(new Set()); }} options={ranges} />
        <span className="text-[0.8rem] text-ink-3">
          {md(from)} ~ 오늘 · {last ? `지난 보고 ${md(localDay(last.publishedAt))} (${daysFromTo(localDay(last.publishedAt), today)}일 전)` : "보낸 경과 보고 없음"}
        </span>
      </div>
      <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
        고객에게 이미 보이는 기록으로만 채웠습니다<span className="max-sm:hidden">(진행 단계·요청자료·결과자료·일정·문의 답변)</span>. 내부 메모·업무·수금은 넣지 않습니다.
      </p>

      <div className="mt-3" data-testid="report-view">
        <SegmentedControl value={view} onChange={setView} options={[{ key: "pick", label: `내용 고르기 ${picked}` }, { key: "preview", label: "고객 화면 미리 보기" }]} />
      </div>

      {view === "pick" ? (
        <div className="mt-3 space-y-3" data-testid="report-lines">
          {sections.length === 0 && (
            <p className="rounded-xl bg-surface-2 px-4 py-5 text-center text-[0.86rem] text-ink-2">
              이 기간에 고객에게 보여 줄 기록이 없습니다. 기간을 넓히거나, 아래 한마디만 적어 보낼 수 있습니다.
            </p>
          )}
          {sections.map((s) => (
            <section key={s.key} data-report-section={s.key}>
              <h4 className="mb-1 text-[0.82rem] font-bold text-ink-2">{s.title}</h4>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {s.lines.map((l) => {
                  const on = !off.has(l.key);
                  return (
                    <li key={l.key}>
                      <label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5" data-line={l.key}>
                        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={on} onChange={(e) => toggle(l.key, e.target.checked)} aria-label={l.text} />
                        <span className={cx("min-w-0 flex-1 text-[0.9rem] leading-snug", !on && "text-ink-3 line-through")}>{l.text}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <label className="block">
            <span className="mb-1 block text-[0.82rem] font-bold text-ink-2">담당자 한마디 <span className="font-normal text-ink-3">(선택)</span></span>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 이번 주 안에 원가 분석 초안을 정리해 중간 보고 때 함께 보겠습니다." aria-label="담당자 한마디" />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[0.86rem]">
            <input type="checkbox" className="h-4 w-4" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            고객 홈 맨 위에 고정 <span className="text-ink-3">(지난 경과 보고 고정은 풀림)</span>
          </label>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-surface-2 p-3" data-testid="report-preview">
          <div className="mx-auto max-w-sm rounded-xl border border-accent/30 bg-surface px-4 py-3 shadow-sm">
            <div className="font-bold leading-snug">{title}</div>
            <div className="mt-0.5 text-[0.75rem] text-ink-3">오늘 · {c.name}</div>
            <NoticeBody text={body} className="mt-2" />
          </div>
        </div>
      )}
    </Modal>
  );
}
