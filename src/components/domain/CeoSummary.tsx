"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, ClipboardCopy, FileText } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { buildCeoSummary, type SummaryLine } from "@/lib/ceo-summary";
import { daysBetween } from "@/lib/format";
import { Badge, Button, Card, SectionTitle, cx } from "@/components/ui/ui";

const DOT: Record<SummaryLine["tone"], string> = {
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-error",
  info: "bg-ink-3",
};

/**
 * 대표자용 요약 카드 — 계약 별지 제1호 모듈5.
 * 컨설턴트가 보면 "내 담당 요약"이 된다. 같은 규칙, 좁은 범위.
 */
export function CeoSummaryCard({ className }: { className?: string }) {
  const st = useStore();
  const toast = useStore((s) => s.toast);
  const tick = useNow(60000);
  const [copied, setCopied] = useState(false);
  const isAdmin = st.session?.role === "admin";
  const assigneeId = st.session?.role === "consultant" ? st.session.userId : undefined;

  const summary = useMemo(() => {
    if (!tick) return null;   // 하이드레이션 전에는 시각이 없어 세지 않는다
    return buildCeoSummary({
      now: tick, companies: st.companies, projects: st.projects, docRequests: st.docRequests, schedules: st.schedules,
      tasks: st.tasks, inquiries: st.inquiries, approvals: st.approvals, activities: st.activities, assigneeId, isAdmin,
    });
  }, [tick, st.companies, st.projects, st.docRequests, st.schedules, st.tasks, st.inquiries, st.approvals, st.activities, assigneeId, isAdmin]);

  const copy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.text);
      setCopied(true);
      toast("요약을 복사했습니다. 단톡방에 그대로 붙여넣으시면 됩니다.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast("복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.", "error");
    }
  };

  return (
    <Card className={cx("p-5", className)} id="ceo-summary">
      <SectionTitle action={<Button size="sm" variant="ghost" icon={<ClipboardCopy size={14} />} onClick={copy}>{copied ? "복사됨" : "복사"}</Button>}>
        <span className="flex items-center gap-2"><FileText size={18} className="text-accent" /> {isAdmin ? "대표자용 요약" : "내 담당 요약"}</span>
      </SectionTitle>
      {!summary ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <ul className="divide-y divide-line">
          {summary.lines.map((l) => (
            <li key={l.key}>
              <Link href={l.href} className="pressable -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-surface-2/70">
                <span className={cx("mt-[0.55rem] h-2 w-2 shrink-0 rounded-full", DOT[l.tone])} />
                <span className="min-w-0 flex-1 text-[0.9rem] leading-relaxed">{l.text}</span>
                <ChevronRight size={16} className="mt-1 shrink-0 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[0.75rem] text-ink-3">시스템 기록을 그대로 센 문장입니다. 추정이나 평가는 넣지 않습니다.</p>
    </Card>
  );
}

/**
 * 운영 현황 — 계약 별지 제1호 모듈1 이 이름을 들어 약정한 여섯 가지 상태.
 * 위의 큰 숫자 카드는 "지금 문제인 것"이고, 이 줄은 "지금 규모가 얼마인가"다.
 */
export function OpsStrip() {
  const st = useStore();
  const tick = useNow(60000);
  const assigneeId = st.session?.role === "consultant" ? st.session.userId : undefined;
  if (!tick) return <div className="h-[92px] animate-pulse rounded-2xl bg-surface-2" />;
  const nowIso = tick.toISOString();
  const active = st.projects.filter((p) => !p.archived && !["done", "aftercare"].includes(p.stage) && (!assigneeId || p.consultantId === assigneeId));
  const delayed = active.filter((p) => daysBetween(p.stageChangedAt, nowIso) >= 7 || daysBetween(nowIso, p.dueDate) < 0).length;
  const companies = st.companies.filter((c) => !c.archived && (!assigneeId || c.consultantId === assigneeId)).length;
  const missing = st.docRequests.filter((d) => (d.status === "requested" || d.status === "revision") && (!assigneeId || d.assigneeId === assigneeId)).length;
  const week = st.schedules.filter((s) => (!assigneeId || s.assigneeId === assigneeId) && s.start >= nowIso && daysBetween(nowIso, s.start) <= 7).length;
  const follow = st.tasks.filter((t) => (t.status === "todo" || t.status === "doing") && (!assigneeId || t.assigneeId === assigneeId)).length;
  const items = [
    { label: "진행 프로젝트", n: active.length, href: "/ax/projects" },
    { label: "기업고객", n: companies, href: "/ax/clients" },
    { label: "요청자료 미제출", n: missing, href: "/ax/documents" },
    { label: "7일 내 일정", n: week, href: "/ax/schedule" },
    { label: "지연", n: delayed, href: "/ax/projects?filter=delayed", hot: delayed > 0 },
    { label: "후속업무", n: follow, href: "/ax/tasks" },
  ];
  return (
    <Card className="p-4" id="ops-strip">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[0.95rem] font-bold">운영 현황</span>
        <Badge>{assigneeId ? "내 담당 기준" : "회사 전체"}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {items.map((it) => (
          <Link key={it.label} href={it.href} className="pressable min-w-0 rounded-xl bg-surface-2 px-3 py-2.5 hover:bg-line/60">
            {/* 폰에서는 세 칸이라 이름이 잘린다 — 자르지 않고 두 줄로. 숫자 줄은 칸마다 같은 높이에 맞춘다 */}
            <div className="flex min-h-[2.1em] items-start text-[0.75rem] font-semibold leading-tight text-ink-3 md:min-h-0">{it.label}</div>
            <div className={cx("tnum mt-0.5 text-[1.35rem] font-bold leading-tight", it.hot && "text-error")}>{it.n}</div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
