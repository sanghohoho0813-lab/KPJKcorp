"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Cable, CheckCircle2, ChevronRight, Repeat2, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi, NEXT_FEATURES } from "@/lib/ui-store";
import { AUTO_RULES, ruleOn, ruleDays } from "@/lib/rules";
import { openOnly } from "@/lib/programs-client";
import { INSIGHTS, type InsightTopic } from "@/lib/ax-insight";
import { AxInsightModal } from "@/components/ai/AxInsight";
import { Badge, Card, PageHeader, SectionTitle, cx } from "@/components/ui/ui";

/**
 * AI · API 기술 로드맵 — 실사자·대표가 20~30초 안에 "지금 무엇이 돌아가고, 다음에 무엇이 붙는지"를 읽는 화면.
 * 현재(작동 중) · 다음(AI READY) · 확장(연결 예정)을 색과 표시로 분명히 나눈다.
 * "현재" 칸의 숫자는 지금 이 화면에 들어 있는 데이터에서 바로 센다 — 지어낸 실적이 아니다.
 */
const STAGES = [
  {
    key: "now", label: "현재", tag: "작동 중", icon: <CheckCircle2 size={18} />,
    title: "업무가 데이터와 규칙으로 돌아가는 구조",
    flow: ["기업 데이터", "업무 규칙", "상태 변화", "자동 업무", "고객 Portal", "고객 행동", "내부 상태 재반영"],
    note: "고객 행동이 내부 업무가 되고, 처리 결과가 다시 고객 화면에 반영되는 닫힌 순환 — 이 핵심 구조는 특허 출원을 완료했습니다 (출원번호 10-2026-0177079).",
  },
  {
    key: "next", label: "다음", tag: "AI READY · LLM 연결 전", icon: <Sparkles size={18} />,
    title: "쌓인 기록을 LLM이 읽고 담당자의 판단을 돕는다",
    flow: ["LLM 상담 요약", "문서 초안", "리스크 · 누락 분석", "맞춤 업무 브리핑", "담당자 판단 보조"],
    note: "각 화면에 연결 지점(AI READY)이 이미 있습니다. LLM은 요약 · 초안 · 근거 설명에만 쓰고, 판단과 발송은 사람이 합니다.",
  },
  {
    key: "ext", label: "확장", tag: "연결 예정", icon: <Cable size={18} />,
    title: "외부 서비스와 연결해 표준화하고 다른 컨설팅사로",
    flow: ["전자계약 · 회계 · 캘린더 API", "실제 운영 데이터 축적", "컨설팅 업무 표준화", "동종업계 컨설턴트용 구독형 SaaS"],
    note: "먼저 KPJK 고객에게 적용해 데이터를 쌓고, 반복 검증된 업무 규칙만 표준으로 만든 뒤 확장합니다.",
  },
] as const;

const TONE = {
  now: { ring: "border-success/35", head: "bg-success-bg/60 text-success", tag: "bg-success text-white", chip: "border-success/30 bg-surface text-ink" },
  next: { ring: "border-[color:var(--nav-ai-ink)]/30", head: "bg-[color:var(--nav-ai)]/10 text-[color:var(--nav-ai-ink)]", tag: "border border-[color:var(--nav-ai-ink)]/45 text-[color:var(--nav-ai-ink)]", chip: "border-[color:var(--nav-ai-ink)]/25 bg-surface text-ink" },
  ext: { ring: "border-dashed border-line-2", head: "bg-surface-2 text-ink-2", tag: "border border-dashed border-line-2 text-ink-3", chip: "border-dashed border-line-2 bg-surface text-ink-2" },
} as const;

const TOPICS: InsightTopic[] = ["dashboard", "brief", "tasks", "client", "consultations", "projects", "documents", "programs", "growth", "opportunities", "schedule", "reports"];

export default function RoadmapPage() {
  const st = useStore();
  const openNext = useUi((s) => s.openNext);
  const [topic, setTopic] = useState<InsightTopic | null>(null);

  // 현재 작동 근거 — 지금 이 화면의 데이터에서 바로 센다
  const proof = useMemo(() => {
    const autoTasks = st.tasks.filter((t) => t.source === "auto" || t.ruleKey).length;
    const clientActs = st.activities.filter((a) => a.actorRole === "client").length;
    const reflected = st.activities.filter((a) => ["document_reviewed", "document_revision_requested", "project_stage_changed", "result_shared", "inquiry_answered"].includes(a.type)).length;
    return [
      { label: "활동 기록 (Evidence)", value: st.activities.length, sub: "모든 행동이 남는 기록" },
      { label: "자동 생성 업무", value: autoTasks, sub: "제출 · 문의 · 시간 규칙" },
      { label: "고객 행동", value: clientActs, sub: "접속 · 제출 · 문의 · 열람" },
      { label: "고객 화면 반영", value: reflected, sub: "검토 · 단계 · 결과 · 답변" },
      { label: "접수 중 지원사업 공고", value: openOnly(st.programs).length, sub: "기업마당 API 수집분" },
    ];
  }, [st.tasks, st.activities, st.programs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI · API 기술 로드맵"
        badge={<Badge tone="info">기술 발전 방향</Badge>}
        desc="지금 실제로 작동하는 구조 → LLM 연결 → 외부 API · 구독형 SaaS. 단계마다 작동 중인 것과 계획을 구분해 표시합니다."
      />

      {/* 1. 3단계 한눈에 */}
      <div className="grid gap-4 xl:grid-cols-3" data-testid="roadmap-stages">
        {STAGES.map((s, i) => {
          const t = TONE[s.key];
          return (
            <div key={s.key} className="relative">
              <Card className={cx("h-full overflow-hidden border", t.ring)}>
                <div className={cx("flex items-center gap-2 px-5 py-3", t.head)}>
                  {s.icon}
                  <span className="text-[1.05rem] font-extrabold text-ink">{i + 1}. {s.label}</span>
                  <span className={cx("ml-auto rounded-md px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide", t.tag)}>{s.tag}</span>
                </div>
                <div className="p-5">
                  <div className="mb-3 font-bold">{s.title}</div>
                  <ol className="space-y-1">
                    {s.flow.map((f, j) => (
                      <li key={f}>
                        <div className={cx("rounded-lg border px-3 py-2 text-[0.9rem] font-semibold", t.chip)}>{f}</div>
                        {j < s.flow.length - 1 && <div className="flex justify-center py-0.5 text-ink-3"><ArrowDown size={14} /></div>}
                      </li>
                    ))}
                    {s.key === "now" && (
                      <li className="flex items-center justify-center gap-1.5 pt-1 text-[0.75rem] font-semibold text-success"><Repeat2 size={14} /> 다시 처음으로 — 닫힌 순환</li>
                    )}
                  </ol>
                  <p className="mt-3 text-[0.8rem] leading-relaxed text-ink-2">{s.note}</p>
                </div>
              </Card>
              {i < STAGES.length - 1 && (
                <div aria-hidden className="absolute -right-3.5 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink-3 xl:flex"><ArrowRight size={15} /></div>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. 현재 작동 근거 */}
      <Card className="p-5">
        <SectionTitle action={<span className="text-[0.75rem] text-ink-3">{st.serverMode ? "서버 운영 데이터 기준" : "데모 샘플 데이터 기준"} · 이 화면을 연 순간의 숫자</span>}>현재 작동하고 있다는 근거</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5" data-testid="roadmap-proof">
          {proof.map((p) => (
            <div key={p.label} className="rounded-xl border border-line px-3.5 py-3">
              <div className="text-[0.78rem] font-semibold text-ink-2">{p.label}</div>
              <div className="tnum mt-1 text-[1.6rem] font-extrabold leading-none">{p.value.toLocaleString("ko-KR")}</div>
              <div className="mt-1 text-[0.72rem] text-ink-3">{p.sub}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[0.85rem] font-bold">지금 켜져 있는 시간 규칙 (설정에서 기준일 조정)</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {AUTO_RULES.map((r) => {
            const on = ruleOn(st.settings.autoRules, r.key);
            return (
              <span key={r.key} title={r.why} className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.8rem] font-semibold", on ? "border-success/30 bg-success-bg/50 text-ink" : "border-line text-ink-3 line-through")}>
                <span className={cx("h-1.5 w-1.5 rounded-full", on ? "bg-success" : "bg-ink-3")} />{r.label(ruleDays(st.settings.autoRules, r.key))}
              </span>
            );
          })}
        </div>
      </Card>

      {/* 3. 고객 Portal 장기 방향 */}
      <Card className="p-5">
        <SectionTitle>고객 Portal의 장기 방향 — 기업성장 관리 플랫폼</SectionTitle>
        <p className="-mt-1 mb-4 max-w-3xl text-[0.9rem] text-ink-2">
          컨설턴트에게 계속 묻게 만드는 서비스가 아니라, 기업 대표가 자기 회사 상태를 직접 이해하고 할 수 있는 일은 스스로 실행하며,
          전문가가 필요한 부분만 KPJK와 연결되는 구조를 지향합니다.
        </p>
        <div className="flex flex-col gap-1.5 md:flex-row md:items-stretch" data-testid="roadmap-portal-flow">
          {[
            { t: "현재 회사 상태", d: "업력 · 진행 과제 · 단계" },
            { t: "재무 · 업무 정보", d: "연도별 매출 · 요청자료 · 일정" },
            { t: "지금 할 일", d: "제출 · 확인 · 답변" },
            { t: "다음 성장 과제", d: "성장 체크리스트 · 검토 과제" },
          ].map((x, i, a) => (
            <div key={x.t} className="flex flex-1 flex-col md:flex-row md:items-center">
              <div className="flex-1 rounded-xl border border-line bg-surface-2/50 px-4 py-3">
                <div className="text-[0.72rem] font-bold text-ink-3">STEP {i + 1}</div>
                <div className="font-bold">{x.t}</div>
                <div className="text-[0.8rem] text-ink-2">{x.d}</div>
              </div>
              {i < a.length - 1 && <div className="flex justify-center px-1.5 py-0.5 text-ink-3"><ArrowRight size={16} className="hidden md:block" /><ArrowDown size={14} className="md:hidden" /></div>}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-line px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 font-bold"><UserRound size={16} className="text-info" /> 대표가 직접 하는 것</div>
            <ul className="space-y-1 text-[0.85rem] text-ink-2">
              <li>· 회사 기본 정보 · 연도별 매출 확인</li>
              <li>· 요청 자료를 휴대폰으로 바로 제출</li>
              <li>· 성장 체크리스트로 다음 할 일 확인</li>
              <li>· 우리 회사 조건에 맞는 지원사업 공고 확인</li>
            </ul>
          </div>
          <div className="rounded-xl border border-accent/30 bg-soft/40 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 font-bold"><Users size={16} className="text-accent" /> 전문가가 필요한 부분만 KPJK와 연결</div>
            <ul className="space-y-1 text-[0.85rem] text-ink-2">
              <li>· 검토해 볼 성장 과제에 &lsquo;상담 요청&rsquo; → 담당자 업무로 자동 연결</li>
              <li>· 진단 · 신청서 · 법인 정비처럼 판단이 필요한 일</li>
              <li>· 결과 보고와 사후관리</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 4. AI 적용 원칙 */}
        <Card className="p-5">
          <SectionTitle>AI 적용 원칙</SectionTitle>
          <ul className="space-y-2 text-[0.88rem] text-ink-2">
            {[
              ["판단 보조까지", "자격 · 자금 · 법률 판단을 자동으로 확정하지 않습니다. AI는 담당자의 판단을 돕는 보조입니다."],
              ["사람이 확인 후 발송", "안내 문구 · 초안은 담당자가 고친 뒤 직접 보냅니다. 자동 발송은 하지 않습니다."],
              ["근거를 함께", "우선순위 · 매칭 · 제안에는 어떤 데이터에서 나왔는지 근거를 붙입니다."],
              ["규칙으로 충분한 곳은 규칙으로", "기한 비교 · 누락 체크처럼 정확해야 하는 일은 AI로 포장하지 않고 규칙으로 처리합니다."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2.5"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-success" /><span><b className="text-ink">{t}</b> — {d}</span></li>
            ))}
          </ul>
        </Card>

        {/* 5. 확장 항목 상세 */}
        <Card className="p-5">
          <SectionTitle action={<span className="rounded-md border border-dashed border-line-2 px-1.5 py-0.5 text-[0.68rem] font-bold text-ink-3">연결 예정</span>}>확장 항목 상세</SectionTitle>
          <div className="space-y-1.5">
            {NEXT_FEATURES.map((f) => (
              <button key={f.key} type="button" onClick={() => openNext(f.key)} className="pressable flex w-full items-center gap-3 rounded-xl border border-dashed border-line-2 px-3.5 py-2.5 text-left hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{f.title}</span>
                  <span className="block truncate text-[0.8rem] text-ink-3">{f.desc}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-3" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* 6. 화면별 */}
      <Card className="p-5">
        <SectionTitle>화면별 AI · 자동화 — 현재 / 다음 단계 / API 확장</SectionTitle>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {TOPICS.map((k) => (
            <button key={k} type="button" onClick={() => setTopic(k)} data-testid={`roadmap-topic-${k}`} className="pressable flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-left hover:bg-surface-2">
              <Sparkles size={15} className="shrink-0 text-[color:var(--nav-ai-ink)]" />
              <span className="min-w-0 flex-1 truncate font-semibold">{INSIGHTS[k].title}</span>
              <span className="tnum shrink-0 rounded-full bg-success-bg px-1.5 text-[0.7rem] font-bold text-success">작동 {INSIGHTS[k].now.length}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[0.78rem] text-ink-3">각 화면 오른쪽 위의 <b>AI · 자동화 적용</b> 버튼에서도 같은 설명을 볼 수 있습니다. 기술 기획의도는 <Link href="/ax/why" className="underline">Why AX</Link>에 있습니다.</p>
      </Card>
      {topic && <AxInsightModal topic={topic} open onClose={() => setTopic(null)} />}
    </div>
  );
}
