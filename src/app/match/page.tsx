"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { serverConfigured } from "@/lib/server/client";
import { CATEGORY_LABEL, PROGRAM_CATEGORIES, matchPrograms, type MatchProfile } from "@/lib/programs";
import { loadPublicPrograms, submitLeadServer, type LiveStatus } from "@/lib/programs-client";
import { REGIONS } from "@/lib/company-options";
import { uid } from "@/lib/format";
import type { Lead, ProgramCategory, SupportProgram } from "@/lib/types";
import { Button, Card, Field, Input, Textarea } from "@/components/ui/ui";
import { Chip, ChipSelect } from "@/components/ui/chips";
import { ProgramCard, MATCH_NOTE } from "@/components/domain/programs/ProgramCard";
import { Toaster } from "@/components/ui/Toaster";

const AGE_OPTS = [
  { key: "pre", label: "예비창업 (설립 전)" }, { key: "1", label: "1년 미만" }, { key: "3", label: "1~3년" },
  { key: "7", label: "3~7년" }, { key: "10", label: "7~10년" }, { key: "20", label: "10년 이상" },
];
const AGE_YEARS: Record<string, number> = { "1": 0, "3": 2, "7": 5, "10": 8, "20": 15 };
const EMP_OPTS = [{ key: "0", label: "대표 혼자" }, { key: "3", label: "2~4명" }, { key: "7", label: "5~9명" }, { key: "20", label: "10~29명" }, { key: "50", label: "30~99명" }, { key: "150", label: "100명 이상" }];
const INDUSTRY_HINTS = ["제조", "IT·소프트웨어", "식품·외식", "도소매·유통", "건설", "관광·숙박", "콘텐츠·디자인", "바이오·의료", "에너지·환경", "물류·운송"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 로그인 없이 쓰는 "우리 회사에 맞는 지원사업 찾기".
 * 가망고객이 조건을 넣으면 공고를 근거와 함께 보여 주고, 원하면 KPJK 에 상담을 남긴다 → 내부에 가망고객·연락 업무·알림.
 * 담당자가 링크를 보낼 때 ?ref=담당자 를 붙이면 그 담당자에게 배정된다.
 */
/** 칩 묶음 — <label> 로 감싸면 첫 칩 이름이 제목 전체가 된다(화면 읽기 프로그램). 그래서 묶음으로 */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">{label}</div>
      {children}
    </div>
  );
}

export default function MatchPage() {
  const hydrated = useStore((s) => s.hydrated);
  const localPrograms = useStore((s) => s.programs);
  const submitLocal = useStore((s) => s.submitLeadLocal);
  const toast = useStore((s) => s.toast);
  const [programs, setPrograms] = useState<SupportProgram[] | null>(null);
  const [live, setLive] = useState<LiveStatus>("loading");
  const [region, setRegion] = useState<string>();
  const [industry, setIndustry] = useState<string>();
  const [age, setAge] = useState<string>();
  const [emp, setEmp] = useState<string>();
  const [interests, setInterests] = useState<ProgramCategory[]>([]);
  const [shown, setShown] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [form, setForm] = useState({ companyName: "", contactName: "", phone: "", email: "", message: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  // 담당자가 보낸 링크의 ?ref= (브라우저에서만 읽는다)
  const ref = useMemo(() => (hydrated && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") ?? undefined : undefined), [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void loadPublicPrograms(localPrograms).then((x) => { setPrograms(x.programs); setLive(x.live); });
    // 처음 한 번만 — 담당자가 공고를 더해도 이 화면은 새로 열 때 반영된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const profile: MatchProfile = useMemo(() => ({
    region, industry,
    foundedYear: age && age !== "pre" ? new Date().getFullYear() - AGE_YEARS[age] : undefined,
    employees: emp ? Number(emp) : undefined,
    interests,
  }), [region, industry, age, emp, interests]);
  const matches = useMemo(() => (programs ? matchPrograms(programs, profile, { strongOnly: true }) : []), [programs, profile]);
  const urgent = matches.filter((m) => m.deadline.urgent).length;

  const send = async () => {
    if (sending) return;
    if (!form.companyName.trim() || !form.contactName.trim() || form.phone.replace(/\D/g, "").length < 9) { toast("회사명·담당자·연락처를 넣어 주세요.", "error"); return; }
    if (!consent) { toast("개인정보 수집·이용에 동의해 주세요.", "error"); return; }
    if (form.website) { setDone(true); return; } // 자동 등록 막기(사람 눈에는 안 보이는 칸)
    setSending(true);
    const lead: Lead = {
      id: uid("ld"), companyName: form.companyName.trim().slice(0, 80), contactName: form.contactName.trim().slice(0, 40), phone: form.phone.trim().slice(0, 20),
      email: form.email.trim() || undefined, region, industry,
      foundedYear: profile.foundedYear, employees: profile.employees, interests, programIds: picked.slice(0, 50),
      message: form.message.trim().slice(0, 1000) || undefined, consent: true, status: "new",
      refUserId: ref, createdAt: new Date().toISOString(),
    };
    if (serverConfigured()) {
      const r = await submitLeadServer({ ...lead, refUserId: ref && UUID.test(ref) ? ref : undefined });
      setSending(false);
      if (!r.ok) { toast("전송하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error"); return; }
    } else {
      submitLocal(lead);
      setSending(false);
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-shell text-[0.65rem] font-black text-white">KPJK</span>
          <div className="min-w-0 flex-1"><div className="text-[0.95rem] font-bold">KPJK 지원사업 찾기</div><div className="text-[0.75rem] text-ink-3">로그인 없이 · 무료</div></div>
          <Link href="/login" className="inline-flex min-h-9 items-center rounded-lg px-2 text-[0.8rem] font-semibold text-ink-3 hover:bg-surface-2 hover:text-ink">고객 로그인</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <div>
          <h1 className="text-[1.45rem] font-bold leading-tight md:text-[1.8rem]">우리 회사에 맞는<br className="sm:hidden" /> 정부지원사업 찾기</h1>
          <p className="mt-1 text-[0.9rem] text-ink-2">회사 조건을 고르면 지금 접수 중인 공고 중 검토해 볼 만한 것을 근거와 함께 보여 드립니다.</p>
        </div>

        <Card className="space-y-4 p-5" id="match-form">
          <Group label="지역 (본사 소재지)"><ChipSelect options={REGIONS} value={region} onChange={setRegion} /></Group>
          <Group label="업종"><ChipSelect options={INDUSTRY_HINTS} value={industry} onChange={setIndustry} custom customPlaceholder="예: 금속 가공, 카페" /></Group>
          <Group label="업력"><ChipSelect options={AGE_OPTS} value={age} onChange={setAge} /></Group>
          <Group label="직원 수 (대표 포함)"><ChipSelect options={EMP_OPTS} value={emp} onChange={setEmp} /></Group>
          <Group label="관심 분야 (여러 개)">
            <div className="flex flex-wrap gap-1.5">
              {PROGRAM_CATEGORIES.filter((c) => c !== "기타").map((c) => <Chip key={c} selected={interests.includes(c)} onClick={() => setInterests((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]))}>{CATEGORY_LABEL[c]}</Chip>)}
            </div>
          </Group>
          <Button variant="accent" icon={<Search size={16} />} onClick={() => { setShown(true); setTimeout(() => document.getElementById("match-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }} disabled={!programs}>
            {programs ? "맞는 공고 보기" : "공고 불러오는 중…"}
          </Button>
        </Card>

        {shown && (
          <section id="match-results" className="scroll-mt-4 space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-[1.15rem] font-bold">검토해 볼 공고 {matches.length}건</h2>
              {urgent > 0 && <span className="text-[0.85rem] font-semibold text-error">마감 임박 {urgent}건</span>}
            </div>
            <p className="text-[0.78rem] leading-relaxed text-ink-3">{MATCH_NOTE}</p>
            {matches.length === 0 ? (
              <Card className="p-5 text-[0.9rem] text-ink-2">
                {programs?.length ? "지금 조건으로 맞는 공고가 없습니다. 조건을 바꿔 보시거나, 아래로 상담을 남기시면 새 공고가 나올 때 담당 컨설턴트가 연락드립니다."
                  : live === "not_configured" || live === "error" ? "지금은 공고 목록을 불러오지 못했습니다. 아래로 상담을 남기시면 담당 컨설턴트가 직접 찾아 연락드립니다."
                  : "등록된 공고가 없습니다. 아래로 상담을 남기시면 담당 컨설턴트가 연락드립니다."}
              </Card>
            ) : (
              <div className="space-y-2.5">
                {matches.slice(0, 30).map((m) => (
                  <ProgramCard key={m.program.id} m={m} actions={
                    <Chip selected={picked.includes(m.program.id)} onClick={() => setPicked((xs) => (xs.includes(m.program.id) ? xs.filter((x) => x !== m.program.id) : [...xs, m.program.id]))}>관심 있어요</Chip>
                  } />
                ))}
              </div>
            )}

            <Card className="p-5" id="lead-form">
              {done ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center" data-testid="lead-done">
                  <CheckCircle2 size={36} className="text-success" />
                  <div className="text-[1.1rem] font-bold">상담 요청이 접수되었습니다</div>
                  <p className="text-[0.88rem] text-ink-2">KPJK 담당 컨설턴트가 영업일 기준 1일 안에 연락드립니다. 고른 공고{picked.length ? ` ${picked.length}건` : ""}과 조건을 미리 확인해 두겠습니다.</p>
                </div>
              ) : (
                <>
                  <h2 className="text-[1.1rem] font-bold">KPJK 컨설턴트에게 무료로 확인받기</h2>
                  <p className="mt-0.5 text-[0.85rem] text-ink-2">{picked.length ? `고른 공고 ${picked.length}건과` : "위"} 조건을 보고 신청 가능 여부·준비 서류를 함께 확인해 드립니다.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="회사명 *"><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} aria-label="회사명" /></Field>
                    <Field label="담당자 성함 *"><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} aria-label="담당자 성함" /></Field>
                    <Field label="연락처 *"><Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" aria-label="연락처" /></Field>
                    <Field label="이메일 (선택)"><Input inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="이메일" /></Field>
                  </div>
                  <Field label="궁금한 점 (선택)"><Textarea rows={3} className="mt-0" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="예: 내년 설비 투자 계획이 있습니다." aria-label="궁금한 점" /></Field>
                  <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="hidden" aria-hidden name="website" />
                  <label className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[0.8rem] leading-relaxed text-ink-2">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" aria-label="개인정보 수집·이용 동의" />
                    <span><b className="text-ink">[필수] 개인정보 수집·이용 동의</b> — 수집 항목: 회사명, 담당자 성함, 연락처, 이메일, 입력한 회사 조건 / 목적: 지원사업 상담 연락 / 보관: 상담 종료 후 1년 또는 삭제 요청 시까지. 동의하지 않으시면 상담 요청을 남길 수 없습니다.</span>
                  </label>
                  <Button variant="accent" className="mt-3 w-full" icon={<ArrowRight size={16} />} onClick={send} disabled={sending}>{sending ? "보내는 중…" : "상담 요청 남기기"}</Button>
                  <p className="mt-2 flex items-center gap-1 text-[0.75rem] text-ink-3"><ShieldCheck size={13} /> 입력하신 정보는 KPJK 담당자만 봅니다.</p>
                </>
              )}
            </Card>
          </section>
        )}
      </main>
      <Toaster />
    </div>
  );
}
