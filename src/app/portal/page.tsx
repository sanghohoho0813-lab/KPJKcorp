"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bell, CalendarDays, FileCheck2, FolderUp, MessageSquare, Briefcase, Sparkles } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { CUSTOMER_STEPS, customerStageMessage, stageProgress, stageToCustomerStep } from "@/lib/stages";
import { OPP_STATUS, recommendServices } from "@/lib/services";
import { daysBetween, fmtDate, fmtRelative, fmtTime, relativeDay } from "@/lib/format";
import type { DocumentRequest } from "@/lib/types";
import { Badge, Button, Card, IconTile, Progress, cx } from "@/components/ui/ui";
import { UploadModal } from "@/components/domain/DocActions";
import { DocStatusBadge } from "@/components/domain/domain";

export default function PortalHome() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const [upload, setUpload] = useState<DocumentRequest | null>(null);
  const c = st.companies.find((x) => x.id === companyId);
  if (!c) return null;
  const isClient = st.session?.role === "client";
  const displayName = isClient ? `${user?.name} ${user?.title}` : `${c.contactName} ${c.contactTitle}`;
  const now = new Date().toISOString();

  const projects = st.projects.filter((p) => p.companyId === c.id && p.clientVisible && !p.archived).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const active = projects.filter((p) => !["done", "aftercare"].includes(p.stage));
  const main = active[0] ?? projects[0];
  const docs = st.docRequests.filter((d) => d.companyId === c.id && d.status !== "planned");
  const todo = docs.filter((d) => d.status === "requested" || d.status === "revision").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next = st.schedules.filter((s) => s.companyId === c.id && s.visibleToClient && s.start >= now).sort((a, b) => a.start.localeCompare(b.start))[0];
  const notifs = st.notifications.filter((n) => n.audience === "client" && n.companyId === c.id).slice(0, 3);
  const openIq = st.inquiries.filter((i) => i.companyId === c.id && i.status === "open").length;
  const results = st.results.filter((r) => r.companyId === c.id).length;
  const step = main ? stageToCustomerStep(main.stage) : 0;
  const consultant = st.users.find((u) => u.id === c.consultantId);
  const myOpps = st.opportunities.filter((o) => o.companyId === c.id && o.status !== "dropped");
  const recos = recommendServices({
    company: c,
    projects: st.projects.filter((p) => p.companyId === c.id),
    contracts: st.contracts.filter((x) => x.companyId === c.id),
    existing: new Set(st.opportunities.filter((o) => o.companyId === c.id).map((o) => o.serviceKey)),
  }, 2);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="p-5 md:p-7" id="tut-p-progress">
        <div className="text-[0.9rem] text-ink-2">안녕하세요, <b className="text-ink">{c.name} {displayName}</b>님.</div>
        {main ? (
          <div className="mt-2 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <Badge tone="accent">{main.name}</Badge>
              <h1 className="mt-2 text-[1.6rem] font-bold md:text-[2rem]">현재 프로젝트 진행률</h1>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="tnum whitespace-nowrap text-[3rem] font-bold leading-none text-accent md:text-[3.6rem]">{stageProgress(main.stage)}%</span><span className="text-[1rem] font-semibold text-ink-2">{CUSTOMER_STEPS[step].label} 단계 진행 중</span></div>
              <Progress value={stageProgress(main.stage)} className="mt-4" height={12} />
              <div className="mt-2 flex justify-between gap-3 text-[0.8rem] font-semibold text-ink-2"><span className="whitespace-nowrap">{CUSTOMER_STEPS[0].label} 완료</span><span>{next ? `${next.title.replace(c.name, "").trim()} 예정` : "완료 예정"}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-2 p-4"><div className="text-[0.75rem] font-bold text-ink-3">현재 단계</div><div className="mt-1 text-[1.2rem] font-bold">{CUSTOMER_STEPS[step].label}</div><div className="mt-1 text-[0.82rem] text-ink-2">{customerStageMessage(main.stage)}</div></div>
              <div className="rounded-xl bg-surface-2 p-4"><div className="text-[0.75rem] font-bold text-ink-3">다음 일정</div><div className="mt-1 text-[1.2rem] font-bold">{next ? fmtDate(next.start) : "-"}</div><div className="mt-1 text-[0.82rem] text-ink-2">{next ? `${next.title.replace(c.name, "").trim()} ${fmtTime(next.start)}${next.location ? ` · ${next.location}` : ""}` : "예정된 일정이 없습니다"}</div></div>
              <div className="rounded-xl bg-surface-2 p-4"><div className="text-[0.75rem] font-bold text-ink-3">요청자료</div><div className="mt-1 text-[1.2rem] font-bold">{todo.length ? `${todo.length}건 남음` : "모두 제출"}</div>{todo[0] && <Button size="sm" variant="accent" className="mt-2" onClick={() => setUpload(todo[0])}>자료 제출하기</Button>}</div>
              <div className="rounded-xl bg-surface-2 p-4"><div className="text-[0.75rem] font-bold text-ink-3">담당 컨설턴트</div><div className="mt-1 text-[1.2rem] font-bold">{consultant?.name} {consultant?.title}</div><Link href="/portal/inquiries" className="link-more link-accent mt-1">문의 남기기 <ArrowRight size={14} /></Link></div>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-ink-2">진행 중인 프로젝트가 없습니다. 궁금한 점은 문의하기를 이용해 주세요.</div>
        )}
      </Card>

      {/* Quick actions — 5초 안에: 어디까지 / 해야 할 일 / 다음 일정 */}
      <div id="tut-p-actions" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { href: "/portal/projects", label: "내 진행현황", icon: <Briefcase size={20} />, color: "var(--mod-overview)", sub: main ? `${CUSTOMER_STEPS[step].label} 단계` : "-" },
          { href: "/portal/documents", label: "요청자료 제출", icon: <FolderUp size={20} />, color: "var(--mod-doc)", sub: todo.length ? `${todo.length}건 제출 필요` : "모두 제출", hot: todo.length > 0 },
          { href: "/portal/schedule", label: "일정 확인", icon: <CalendarDays size={20} />, color: "var(--mod-schedule)", sub: next ? relativeDay(next.start) : "예정 없음" },
          { href: "/portal/inquiries", label: "문의하기", icon: <MessageSquare size={20} />, color: "var(--mod-customer)", sub: openIq ? `답변 대기 ${openIq}건` : "담당자에게 질문" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className={cx("card card-hover flex flex-col gap-3 p-4", a.hot && "border-accent")}>
            <IconTile color={a.color}>{a.icon}</IconTile>
            <div><div className="text-[1rem] font-bold">{a.label}</div><div className={cx("text-[0.8rem]", a.hot ? "font-semibold text-accent" : "text-ink-3")}>{a.sub}</div></div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[1.1rem] font-bold">지금 해야 할 일</h2><Link href="/portal/documents" className="link-more">전체 보기 →</Link></div>
          {todo.length === 0 ? <div className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-[0.9rem] font-semibold text-success"><FileCheck2 size={18} /> 지금 제출할 자료가 없습니다.</div> : (
            <div className="space-y-2">
              {todo.slice(0, 3).map((d) => {
                const overdue = daysBetween(d.dueDate, now) > 0;
                return (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><DocStatusBadge status={d.status} client /><span className="truncate font-semibold">{d.name}</span></div><div className={cx("mt-0.5 text-[0.8rem]", overdue ? "font-semibold text-error" : "text-ink-3")}>기한 {fmtDate(d.dueDate)} ({relativeDay(d.dueDate)}){d.status === "revision" && d.reviewNote ? ` · ${d.reviewNote}` : ""}</div></div>
                    <Button size="sm" variant={d.status === "revision" ? "outline" : "accent"} onClick={() => setUpload(d)}>{d.status === "revision" ? "재제출" : "업로드"}</Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[1.1rem] font-bold"><Bell size={18} className="text-ink-3" /> 최근 안내</h2><Link href="/portal/notifications" className="link-more">전체 보기 →</Link></div>
          {notifs.length === 0 ? <div className="text-[0.9rem] text-ink-3">새 안내가 없습니다.</div> : (
            <div className="divide-y divide-line">
              {notifs.map((n) => (
                <Link key={n.id} href={n.href} className="block py-2.5"><div className="flex items-center gap-2">{!n.read && <span className="h-2 w-2 rounded-full bg-accent" />}<span className="font-semibold">{n.title}</span></div><div className="mt-0.5 text-[0.82rem] text-ink-2">{n.body}</div><div className="text-[0.75rem] text-ink-3">{fmtRelative(n.at)}</div></Link>
              ))}
            </div>
          )}
          {results > 0 && <Link href="/portal/results" className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2.5 text-[0.88rem] font-semibold"><span className="flex items-center gap-2"><FileCheck2 size={16} className="text-success" /> 완료자료 {results}건</span><ArrowRight size={14} /></Link>}
        </Card>
      </div>

      {/* 추가서비스 — 강매가 아니라 "지금 상황에서 검토 대상" 수준으로만 */}
      {(recos.length > 0 || myOpps.length > 0) && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[1.1rem] font-bold"><Sparkles size={18} className="text-accent" /> 함께 검토해볼 수 있는 것</h2>
            <Link href="/portal/services" className="link-more whitespace-nowrap">전체 보기 →</Link>
          </div>
          {myOpps.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {myOpps.slice(0, 2).map((o) => (
                <div key={o.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 text-[0.88rem]">
                  <span className="min-w-0 flex-1 truncate font-semibold">{o.serviceName}</span>
                  <Badge tone={OPP_STATUS[o.status].tone}>{OPP_STATUS[o.status].clientLabel}</Badge>
                </div>
              ))}
            </div>
          )}
          {recos.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {recos.map(({ service, reason }) => (
                <Link key={service.key} href="/portal/services" className="card card-hover block p-4">
                  <div className="font-bold">{service.name}</div>
                  <div className="mt-1 text-[0.82rem] leading-relaxed text-ink-2">{reason}</div>
                  <div className="mt-2 text-[0.82rem] font-semibold text-accent">관심 표시하기 →</div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {projects.length > 1 && (
        <Card className="p-5">
          <h2 className="mb-3 text-[1.1rem] font-bold">전체 프로젝트</h2>
          <div className="divide-y divide-line">
            {projects.map((p) => (
              <Link key={p.id} href={`/portal/projects?p=${p.id}`} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><div className="font-semibold">{p.name}</div><div className="text-[0.8rem] text-ink-3">{fmtDate(p.startDate, { year: true })} 시작</div></div>
                <Badge tone={["done", "aftercare"].includes(p.stage) ? "success" : "accent"}>{CUSTOMER_STEPS[stageToCustomerStep(p.stage)].label}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
      <UploadModal req={upload} open={!!upload} onClose={() => setUpload(null)} />
    </div>
  );
}
