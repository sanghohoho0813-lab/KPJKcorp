"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Database, HelpCircle, Palette, RotateCcw, ShieldCheck, Sparkles, Award, Play } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi, NEXT_FEATURES } from "@/lib/ui-store";
import { THEMES } from "@/lib/themes";
import { fmtDateTime } from "@/lib/format";
import { Badge, Button, Card, DemoBadge, NextBadge, PageHeader, SectionTitle, SegmentedControl, cx, AiReadyBadge } from "@/components/ui/ui";
import { Confirm } from "@/components/ui/overlay";

const PERMS: { feature: string; admin: string; consultant: string; client: string }[] = [
  { feature: "전체 기업고객 · 프로젝트", admin: "✓", consultant: "△ 담당 중심", client: "×" },
  { feature: "상담 · 계약 기록", admin: "✓", consultant: "✓", client: "× (계약 상태만)" },
  { feature: "자료 요청 · 검토", admin: "✓", consultant: "✓", client: "△ 본인 회사 제출/확인" },
  { feature: "일정", admin: "✓", consultant: "✓", client: "△ 고객 공개 일정만" },
  { feature: "업무 · 후속관리", admin: "✓", consultant: "△ 담당 업무", client: "×" },
  { feature: "문의 답변", admin: "✓", consultant: "✓", client: "△ 본인 문의 작성/확인" },
  { feature: "결과자료 공유", admin: "✓", consultant: "✓", client: "△ 본인 회사 열람" },
  { feature: "매출기회 등록 · 단계 이동", admin: "✓", consultant: "✓ 담당 고객", client: "△ 관심 표시 · 상담 요청" },
  { feature: "대표 승인 (할인 · 제안 · 약속)", admin: "✓ 승인 / 반려", consultant: "△ 요청만 가능", client: "×" },
  { feature: "AI 브리핑 · 리포트", admin: "✓ 전체", consultant: "△ 담당 기준", client: "×" },
  { feature: "설정 · 테마", admin: "✓", consultant: "✓", client: "× (내 정보만)" },
  { feature: "타 기업 데이터", admin: "✓", consultant: "✓", client: "× 절대 불가" },
];

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const session = useStore((s) => s.session);
  const login = useStore((s) => s.login);
  const resetDemo = useStore((s) => s.resetDemo);
  const toast = useStore((s) => s.toast);
  const seededAt = useStore((s) => s.seededAt);
  const activities = useStore((s) => s.activities);
  const openTutorial = useUi((s) => s.openTutorial);
  const openPresentation = useUi((s) => s.openPresentation);
  const openAi = useUi((s) => s.openAi);
  const openNext = useUi((s) => s.openNext);
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [permTab, setPermTab] = useState<"admin" | "consultant" | "client">(session?.role === "consultant" ? "consultant" : "admin");

  return (
    <div>
      <PageHeader title="설정" desc="화면 · 권한 · 데모 · 데이터 · AI 상태를 관리합니다. 모든 설정은 즉시 반영됩니다." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle><span className="flex items-center gap-2"><Palette size={18} className="text-ink-3" /> 화면</span></SectionTitle>
          <div className="mb-2 text-[0.85rem] font-semibold text-ink-2">테마 (KPJK Signature + Canonical 9)</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-5">
            {THEMES.map((t) => {
              const active = settings.theme === t.key;
              return (
                <button key={t.key} onClick={() => { setSettings({ theme: t.key }); toast(`테마: ${t.name}`); }} className={cx("pressable rounded-xl border-2 p-2.5 text-left transition-colors", active ? "border-accent bg-soft/50" : "border-line hover:border-line-2")} aria-pressed={active}>
                  <div className="flex gap-1">{t.colors.map((c, i) => <span key={i} className="h-5 flex-1 rounded-sm" style={{ background: c }} />)}</div>
                  <div className="mt-1.5 flex items-center justify-between gap-1"><span className="text-[0.75rem] font-bold leading-tight">{t.name}</span>{active && <Check size={14} className="text-accent" />}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div><div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">글자 크기</div><SegmentedControl value={settings.fontScale} onChange={(k) => setSettings({ fontScale: k })} options={[{ key: "small", label: "작게" }, { key: "base", label: "기본" }, { key: "large", label: "크게" }]} /></div>
            <div><div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">모션 줄이기</div><SegmentedControl value={settings.reduceMotion ? "on" : "off"} onChange={(k) => setSettings({ reduceMotion: k === "on" })} options={[{ key: "off", label: "Off" }, { key: "on", label: "On" }]} /></div>
          </div>
          <div className="mt-4 text-[0.78rem] text-ink-3">테마는 Sidebar·CTA·강조색만 바꾸며 본문·표·폼의 가독성은 항상 고정됩니다. 오류/위험 색은 의미상 고정입니다.</div>
        </Card>

        <Card className="p-5">
          <SectionTitle><span className="flex items-center gap-2"><ShieldCheck size={18} className="text-ink-3" /> 사용자 / 권한</span></SectionTitle>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-[0.85rem] font-semibold text-ink-2">Role 미리보기</span>
            <SegmentedControl value={session?.role === "consultant" ? "consultant" : "admin"} onChange={(k) => { login(k === "admin" ? "u_admin" : "u_park"); toast(k === "admin" ? "대표 화면으로 전환" : "직원(박성훈 이사) 화면으로 전환"); }} options={[{ key: "admin", label: "대표" }, { key: "consultant", label: "직원" }]} />
            <Button size="sm" variant="outline" onClick={() => router.push("/portal")}>고객 화면 보기</Button>
          </div>
          <div className="mb-2 text-[0.85rem] font-semibold text-ink-2">Permission Matrix</div>
          <div className="mb-2 md:hidden"><SegmentedControl size="sm" value={permTab} onChange={setPermTab} options={[{ key: "admin", label: "대표" }, { key: "consultant", label: "직원" }, { key: "client", label: "고객" }]} /></div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="tbl tbl-compact">
              <thead><tr><th className="w-[34%]">기능</th><th className={cx("md:table-cell", permTab !== "admin" && "hidden")}>대표/관리자</th><th className={cx("md:table-cell", permTab !== "consultant" && "hidden")}>컨설턴트</th><th className={cx("md:table-cell", permTab !== "client" && "hidden")}>기업고객</th></tr></thead>
              <tbody>{PERMS.map((p) => <tr key={p.feature}><td className="font-semibold">{p.feature}</td><td className={cx("md:table-cell", permTab !== "admin" && "hidden")}>{p.admin}</td><td className={cx("md:table-cell", permTab !== "consultant" && "hidden")}>{p.consultant}</td><td className={cx("md:table-cell", permTab !== "client" && "hidden", p.client.startsWith("×") && "text-error")}>{p.client}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-3 text-[0.78rem] text-ink-3">실제 운영 시 Supabase Auth + RLS(사용자별로 볼 수 있는 데이터를 나누는 보안기능)로 전환합니다. 고객은 타 기업 데이터에 절대 접근할 수 없습니다.</div>
        </Card>

        <Card className="p-5">
          <SectionTitle><span className="flex items-center gap-2"><HelpCircle size={18} className="text-ink-3" /> 데모</span></SectionTitle>
          <div className="mb-3 flex flex-wrap items-center gap-2"><DemoBadge /><span className="text-[0.85rem] text-ink-2">현재 상태: <b>DEMO</b> · Live 전환은 실데이터/Auth 연결 후</span></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<HelpCircle size={16} />} onClick={() => openTutorial("ax")}>튜토리얼 다시 보기</Button>
            <Button variant="outline" icon={<Play size={16} />} onClick={openPresentation}>시연 모드</Button>
            <Button variant="danger" icon={<RotateCcw size={16} />} onClick={() => setConfirm(true)}>데모 초기화</Button>
          </div>
          <div className="mt-3 text-[0.78rem] text-ink-3">데모 초기화는 Action 상태·고객 제출·문의·알림을 초기값으로 되돌립니다. 마지막 Seed: {fmtDateTime(seededAt)} · 20시간이 지나면 날짜가 오늘 기준으로 자동 갱신됩니다.</div>
        </Card>

        <Card className="p-5">
          <SectionTitle><span className="flex items-center gap-2"><Database size={18} className="text-ink-3" /> 데이터</span></SectionTitle>
          <div className="grid gap-2 text-[0.88rem] md:grid-cols-2">
            <div className="rounded-xl bg-surface-2 p-3"><div className="text-[0.75rem] font-bold text-ink-3">Data Source</div><div className="font-semibold">Demo Repository (브라우저 로컬 저장)</div></div>
            <div className="rounded-xl bg-surface-2 p-3"><div className="text-[0.75rem] font-bold text-ink-3">마지막 업데이트</div><div className="font-semibold tnum">{activities[0] ? fmtDateTime(activities[0].at) : "-"}</div></div>
            <div className="rounded-xl bg-surface-2 p-3"><div className="text-[0.75rem] font-bold text-ink-3">SSOT Entity</div><div className="font-semibold">Company · Project · DocumentRequest · Schedule · Task · Inquiry · Activity</div></div>
            <div className="rounded-xl bg-surface-2 p-3"><div className="text-[0.75rem] font-bold text-ink-3">교체 지점</div><div className="font-semibold">src/lib/store.ts Action → Supabase</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => toast("CSV 가져오기는 실데이터 연결 단계에서 활성화됩니다.", "info")}>CSV 가져오기</Button>
            <Button size="sm" variant="ghost" onClick={() => toast("필드 구조: PROJECT_SPEC.md §4 Data Model 참고", "info")}>필드 구조 보기</Button>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle><span className="flex items-center gap-2"><Sparkles size={18} className="text-accent" /> AI</span></SectionTitle>
          <div className="space-y-2 text-[0.88rem]">
            {[
              { k: "brief", n: "AI-02 오늘의 업무 브리핑", m: "RULE + LLM", s: "규칙 동작 중" },
              { k: "consult", n: "AI-01 상담 요약", m: "LLM", s: "AI READY" },
              { k: "project", n: "AI-03 프로젝트 요약", m: "RULE", s: "규칙 동작 중" },
              { k: "missing", n: "AI-04 자료 누락 체크", m: "RULE", s: "동작 중 (AI 아님)" },
              { k: "draft", n: "AI-05 커뮤니케이션 초안", m: "템플릿", s: "동작 중" },
            ].map((a) => (
              <div key={a.k} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5"><div><div className="font-semibold">{a.n}</div><div className="text-[0.75rem] text-ink-3">{a.m} · {a.s}</div></div><AiReadyBadge label="설명" onClick={() => openAi({ title: a.n, key: a.k })} /></div>
            ))}
          </div>
          <div className="mt-3 text-[0.78rem] text-ink-3">외부 LLM API 미연결 상태. 모든 AI 기능은 L1 Assist이며 경영·법률 판단을 자동 확정하지 않습니다. API Key 연결 시 상담 요약부터 실제 연결합니다.</div>
        </Card>

        <Card className="p-5">
          <SectionTitle><span className="flex items-center gap-2"><Award size={18} className="text-ink-3" /> 기술 · 사업화 자산</span></SectionTitle>
          <div className="grid gap-2 text-[0.88rem] md:grid-cols-2">
            {[["특허", "해당없음"], ["벤처기업확인", "해당없음"], ["연구개발", "해당없음"], ["인증", "해당없음"]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5"><span className="font-semibold">{k}</span><Badge>{v}</Badge></div>
            ))}
          </div>
          <div className="mt-3 text-[0.78rem] text-ink-3">실제 존재하는 자산만 표시합니다. 출원·확인이 이루어지면 이 곳에 정확한 상태를 기록합니다.</div>
        </Card>

        <Card className="p-5 xl:col-span-2">
          <SectionTitle action={<NextBadge />}>향후 확장 (NEXT)</SectionTitle>
          <div className="grid gap-2 md:grid-cols-5">
            {NEXT_FEATURES.map((f) => (
              <button key={f.key} onClick={() => openNext(f.key)} className="pressable rounded-xl border border-dashed border-line-2 p-3 text-left hover:bg-surface-2"><div className="text-[0.88rem] font-bold">{f.title}</div><div className="mt-1 line-clamp-2 text-[0.75rem] text-ink-3">{f.desc}</div></button>
            ))}
          </div>
        </Card>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={() => { resetDemo(); toast("데모 데이터를 초기화했습니다."); }} title="데모 초기화" desc="모든 Action 상태, 고객 제출, 문의, 알림을 초기 상태로 되돌립니다. 테마·글자 설정은 유지됩니다." confirmText="초기화" danger />
    </div>
  );
}
