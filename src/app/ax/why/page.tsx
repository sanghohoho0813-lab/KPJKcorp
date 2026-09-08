"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { Badge, Card, NextBadge, cx } from "@/components/ui/ui";

/**
 * WHY AX — 회사 맞춤 Story (14 Section)
 * 정책자금·정부지원용 장식이 아니라 실제 업무·데이터·성과 구조를 설명한다.
 */
const STORY: { n: string; title: string; body: React.ReactNode; visual?: React.ReactNode }[] = [
  {
    n: "01", title: "KPJK의 현재",
    body: <>KPJK는 기업·법인을 대상으로 경영진단, 운영개선, 법인 경영자문, 정책자금 준비, 기업부설연구소 설립 자문 등을 수행하는 경영컨설팅 회사입니다. 이 데모는 컨설턴트 3명이 6개 기업·8개 프로젝트를 동시에 관리하는 상황을 가정합니다. 프로젝트 하나는 보통 2~3개월, 자료 요청 4~6건, 미팅 3~4회, 문의 수 건으로 이루어집니다 (실제 수치는 운영 데이터로 대체).</>,
    visual: <Image src="/assets/photo_consulting.jpg" alt="대표와 컨설턴트가 자료를 검토하는 모습" width={1680} height={945} loading="eager" className="h-56 w-full rounded-xl object-cover md:h-72" />,
  },
  {
    n: "02", title: "왜 지금 바꿔야 하는가",
    body: <>고객이 5곳일 때는 담당자의 기억과 카카오톡, 개별 파일로 충분합니다. 10곳, 20곳이 되면 <b>"그 자료 받았던가?", "지금 어디까지 됐지?", "다음 연락은 언제 하기로 했지?"</b>를 확인하는 시간이 실제 컨설팅 시간을 잠식합니다. 고객도 궁금할 때마다 전화합니다. 관리 가능한 고객 수가 사람의 기억 용량에 묶이는 구조입니다.</>,
  },
  {
    n: "03", title: "현재 업무 흐름",
    body: (
      <div className="flex flex-wrap items-center gap-2 text-[0.9rem]">
        {["고객 문의(전화/소개)", "상담(메모)", "계약(문서)", "자료 요청(카톡/메일)", "고객 제출(메일/카톡)", "검토(개인 PC)", "진행(담당자 기억)", "결과 전달(메일)", "사후관리(달력)"].map((s, i) => (
          <span key={s} className="flex items-center gap-2"><span className="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold">{s}</span>{i < 8 && <ArrowRight size={14} className="text-ink-3" />}</span>
        ))}
      </div>
    ),
  },
  {
    n: "04", title: "반복되는 실제 문제 (Primary Constraint)",
    body: (
      <ul className="grid gap-2 md:grid-cols-2">
        {["필요한 자료를 찾는 시간 증가 — 카톡·메일·폴더를 뒤진다", "후속업무 누락 — 재요청·리마인드 시점을 놓친다", "진행상황 파악 어려움 — 대표가 담당자에게 물어봐야 안다", "고객의 반복적인 진행상황 문의 — 전화로 응대한다", "담당자 1인당 관리 가능한 고객 수의 한계"].map((t) => (
          <li key={t} className="flex items-start gap-2 rounded-xl border border-line px-4 py-3 text-[0.9rem]"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-error" />{t}</li>
        ))}
      </ul>
    ),
  },
  {
    n: "05", title: "AX란 무엇인가",
    body: <>회사의 일을 하나의 데이터 흐름으로 연결하고, 반복 확인은 시스템이 처리하며, 중요한 판단에는 근거와 다음 행동을 제안하도록 만드는 것입니다. <b>KPJK라면</b> — "기업고객 한 곳"을 중심으로 상담·계약·프로젝트·자료·일정·문의·결과·이력이 한 화면에 모이는 것, 그리고 고객이 직접 그 흐름에 참여하는 것입니다.</>,
  },
  {
    n: "06", title: "나쁜 프로세스는 자동화하지 않는다",
    body: (
      <div className="grid gap-2 md:grid-cols-5 text-[0.85rem]">
        {[["ELIMINATE", "같은 진행상황을 담당자·대표·고객이 각각 묻고 답하는 반복 확인 제거"], ["STANDARDIZE", "프로젝트 11단계, 자료 7상태, 문의 3상태로 표준화"], ["DIGITIZE", "Company·Project·DocRequest·Schedule·Task·Inquiry를 데이터화"], ["AUTOMATE", "제출→검토Task 자동 생성, 단계 변경→고객 알림, 누락 체크"], ["AI", "요약·브리핑·초안처럼 실제 시간을 줄이는 곳에만 (L1 Assist)"]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-2 p-3"><div className="font-bold text-accent">{k}</div><div className="mt-1 text-ink-2">{v}</div></div>
        ))}
      </div>
    ),
  },
  {
    n: "07", title: "Business AX가 바꾸는 것",
    body: (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line p-4"><div className="text-[0.78rem] font-bold text-ink-3">BEFORE</div><ul className="mt-1 space-y-1 text-[0.88rem] text-ink-2"><li>· 담당자 기억 + 카톡 + 개별 파일</li><li>· 대표는 물어봐야 현황을 안다</li><li>· 자료 재요청 시점을 놓친다</li><li>· 고객 문의는 전화로 응대</li></ul></div>
        <div className="rounded-xl border-2 border-accent bg-soft/40 p-4"><div className="text-[0.78rem] font-bold text-accent">AFTER</div><ul className="mt-1 space-y-1 text-[0.88rem]"><li>· 기업고객 카드 하나에 모든 이력</li><li>· 대표는 아침에 '오늘 먼저 확인할 것'을 근거와 함께 본다</li><li>· 기한 초과·정체는 브리핑에 자동으로 뜬다</li><li>· 문의는 Queue에 쌓이고 답변은 Portal로 돌아간다</li></ul></div>
      </div>
    ),
  },
  {
    n: "08", title: "고객 Portal이 바꾸는 것",
    body: <>고객이 로그인하면 5초 안에 <b>어디까지 진행됐는지 · 지금 무엇을 내야 하는지 · 다음 일정이 언제인지</b>를 봅니다. 요청자료는 Portal에서 바로 업로드하고, 보완 요청도 Portal에서 확인합니다. "굳이 전화해서 물어볼 필요가 없다"는 경험이 고객 만족과 담당자 시간을 동시에 만듭니다. 내부의 11단계는 고객에게 7단계로 자동 번역됩니다.</>,
  },
  {
    n: "09", title: "Closed Loop — 고객의 행동이 내부 업무를 바꾸고, 다시 고객에게 돌아온다",
    body: (
      <div className="flex flex-wrap items-center gap-2 text-[0.88rem]">
        {[["고객 Portal", "자료 제출"], ["내부 AX", "알림 + 검토 Task 자동 생성"], ["담당자", "검토 완료 / 보완 요청"], ["프로젝트", "단계 변경"], ["고객 Portal", "진행률·Timeline·알림 반영"]].map(([w, t], i) => (
          <span key={t} className="flex items-center gap-2"><span className={cx("rounded-xl px-3 py-2", i % 2 === 0 ? "bg-soft/70" : "bg-surface-2")}><span className="block text-[0.7rem] font-bold text-ink-3">{w}</span><span className="font-semibold">{t}</span></span>{i < 4 && <ArrowRight size={14} className="text-ink-3" />}</span>
        ))}
      </div>
    ),
  },
  {
    n: "10", title: "AI가 실제 하는 일",
    body: (
      <ul className="grid gap-2 md:grid-cols-2 text-[0.88rem]">
        {[["오늘의 업무 브리핑", "RULE + LLM", "기한 초과·정체·미답변을 우선순위로 정리하고 '왜?'를 붙인다"], ["상담 요약", "LLM (AI READY)", "상담 메모를 요구사항·약속·필요자료·다음 Action으로 구조화"], ["프로젝트 요약", "RULE", "어디까지 왔고 다음이 무엇인지 3문장으로"], ["자료 누락 체크", "RULE", "AI로 포장하지 않는다. IF로 충분"], ["커뮤니케이션 초안", "템플릿 (AI READY)", "재요청·일정 안내 초안. 발송은 항상 사람이"]].map(([n, m, d]) => (
          <li key={n} className="rounded-xl border border-line px-4 py-3"><div className="flex items-center gap-2 font-bold">{n}<Badge tone="info">{m}</Badge></div><div className="mt-0.5 text-ink-2">{d}</div></li>
        ))}
      </ul>
    ),
    visual: <Image src="/assets/photo_analysis.jpg" alt="컨설턴트가 분석 자료를 검토하는 모습" width={1680} height={945} loading="eager" className="h-56 w-full rounded-xl object-cover object-top md:h-72" />,
  },
  {
    n: "11", title: "데이터가 회사 자산이 되는 구조",
    body: <>모든 행동(요청·제출·검토·단계 변경·문의·답변)이 Event와 Timestamp로 남습니다. 12개월이 쌓이면 지금은 할 수 없는 판단이 가능해집니다 — <b>프로젝트 유형별 표준 소요기간, 병목 단계, 고객별 응답 패턴</b>. 이것은 다른 컨설팅 회사가 쉽게 가질 수 없는 KPJK 고유의 운영 데이터입니다. Data Moat Score 10/12 (Outcome 연결은 실운영 후 확정).</>,
  },
  {
    n: "12", title: "성과는 어떻게 증명하는가",
    body: <>Demo에서는 개선율을 만들지 않습니다. 운영 시작 후 4주간 Baseline을 측정하고, 이후 <b>자료요청→제출 소요기간 · 후속업무 누락건수 · 문의 대응시간 · 진행상황 단순문의 건수 · Portal 직접 제출 비율 · 담당자 1인당 관리 기업 수</b>를 같은 Event Log에서 계산합니다. 리포트 메뉴의 KPI 측정지점 표가 그 구조입니다.</>,
  },
  {
    n: "13", title: "정책·기술사업화 관점 (장식이 아닌 실제)",
    body: <>이 시스템은 정책자금이나 정부지원 없이도 도입할 경제적 이유가 있습니다 — 같은 인력으로 더 많은 기업을 안정적으로 관리하고 누락을 줄이는 것입니다. 실제 AX 도입·데이터 축적·운영성과가 먼저이고, 필요할 때 그 증거를 근거로 AX 도입 사례·생산성 개선을 설명할 수 있습니다. 보장은 없습니다.</>,
  },
  {
    n: "14", title: "확장 가능성과 다음 단계",
    body: (
      <div>
        <div className="grid gap-2 md:grid-cols-3 text-[0.88rem]">
          <div className="rounded-xl bg-surface-2 p-4"><div className="font-bold">1단계 · 지금</div><div className="mt-1 text-ink-2">내부 운영 통합 + 고객 Portal + Closed Loop. 실사용과 Baseline 측정.</div></div>
          <div className="rounded-xl bg-surface-2 p-4"><div className="flex items-center gap-2 font-bold">2단계 <NextBadge /></div><div className="mt-1 text-ink-2">알림 자동화, 문서 자동화, 운영 리포트, Portal Self-Service 확대, 외부 연동.</div></div>
          <div className="rounded-xl bg-surface-2 p-4"><div className="flex items-center gap-2 font-bold">3단계 · 검토</div><div className="mt-1 text-ink-2">운영 데이터가 충분히 쌓인 뒤에만 판단합니다. 지금 약속하지 않습니다.</div></div>
        </div>
        <div className="mt-4 rounded-xl bg-shell p-5 text-white">
          <div className="text-[0.78rem] font-bold tracking-widest text-highlight">우리가 얻는 것</div>
          <div className="mt-2 grid gap-1 text-[0.95rem] md:grid-cols-2"><span>확인·검색 시간 ↓</span><span>후속업무 누락 ↓</span><span>고객 응대 전화 ↓</span><span>진행 투명성 ↑</span><span>동시 관리 고객 수 ↑</span><span>회사 고유 운영 데이터 ↑</span></div>
        </div>
      </div>
    ),
  },
];

export default function WhyPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-shell text-white">
        <Image src="/assets/hero_main.jpg" alt="" fill className="object-cover opacity-40" sizes="900px" priority />
        <div className="relative p-6 md:p-10">
          <div className="text-[0.78rem] font-bold tracking-widest text-highlight">WHY AX · 기획의도</div>
          <h1 className="mt-2 text-[1.8rem] font-bold leading-tight md:text-[2.3rem]">기업고객 중심의<br />연결된 컨설팅 운영체계</h1>
          <p className="mt-3 max-w-xl text-[0.95rem] text-shell-text-2">더 많은 기능보다 더 잘 연결된 업무. AI처럼 보이는 것보다 실제로 시간을 줄이고 누락을 막는 것. 화려한 Portal보다 고객이 직접 참여하고 확인하는 Portal.</p>
        </div>
      </div>
      <div className="space-y-6">
        {STORY.map((s) => (
          <Card key={s.n} className="p-5 md:p-7">
            <div className="tnum text-[0.75rem] font-bold tracking-widest text-accent">STORY {s.n}</div>
            <h2 className="mt-1 text-[1.3rem] font-bold md:text-[1.5rem]">{s.title}</h2>
            <div className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">{s.body}</div>
            {s.visual && <div className="mt-4">{s.visual}</div>}
          </Card>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center">
        <div className="text-[1.05rem] font-bold">이 세 문장이 제품에서 체감되면 성공입니다</div>
        <div className="grid gap-2 text-[0.9rem] text-ink-2 md:grid-cols-3"><span>대표: "회사 전체 컨설팅 현황이 한눈에 보인다."</span><span>담당자: "오늘 무엇을 해야 하는지 놓치지 않는다."</span><span>고객: "굳이 전화해서 물어볼 필요가 없다."</span></div>
        <Link href="/ax/dashboard" className="pressable mt-2 inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-2.5 font-semibold text-accent-ink"><LayoutDashboard size={18} /> 대시보드로 돌아가기</Link>
      </div>
    </div>
  );
}
