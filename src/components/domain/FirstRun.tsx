"use client";

import Link from "next/link";
import { ArrowRight, Check, Rocket } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { Card, cx } from "@/components/ui/ui";
import { CoachCard } from "@/components/domain/Coach";

/**
 * 처음 시작하기 — 기업고객이 하나도 없을 때 대시보드 맨 위.
 *
 * 빈 화면에 "실증 14일을 시작할까요?"부터 보이면 무엇을 먼저 해야 하는지 알 수 없다.
 * 실제 첫 사용 순서(회사 정보 → 도입 전 기준선 → 첫 기업 → Portal 계정 → 실증)를
 * 한 장으로 보여 주고, 기업이 하나라도 생기면 평소의 코치 카드로 돌아간다.
 */
type Step = { key: string; title: string; desc: string; href: string; done: boolean };

function useFirstRunSteps(): Step[] | null {
  const st = useStore();
  const role = st.session?.role;
  const companies = st.companies.filter((c) => !c.archived);
  if (companies.length > 0 || st.settings.sprintStartedAt) return null;

  const org = st.settings.org;
  const steps: Step[] = [];
  // 회사 정보 입력은 데이터 섹션(대표 계정)에서만 가능하다 — 같은 권한으로 가른다
  if (can(role, "data.manage"))
    steps.push({ key: "org", title: "회사 정보 입력", desc: "대표자·사업자등록번호를 넣으면 인쇄물과 리포트에 우리 회사 이름으로 나갑니다.", href: "/ax/settings?open=data", done: !!(org?.ceo || org?.bizNo) });
  if (can(role, "baseline.write"))
    steps.push({ key: "baseline", title: "도입 전 기준선 조사 (3~5분)", desc: "쓰기 시작하기 전에 지금의 업무 방식을 한 번 기록해 둡니다. 나중에는 만들 수 없는 값입니다.", href: "/ax/baseline", done: (st.settings.baselineSurveys ?? []).some((x) => x.phase === "before" && !x.draft) });
  if (can(role, "company.create"))
    steps.push({ key: "company", title: "첫 기업고객 등록", desc: "상담·프로젝트·자료·일정이 모두 이 기업 아래로 연결됩니다.", href: "/ax/clients?new=1", done: false });
  if (can(role, "user.manage"))
    steps.push({ key: "portal", title: "담당자 Portal 계정 만들기", desc: "기업을 등록한 뒤 만듭니다. 고객이 자료를 내고 진행 상황을 보는 입구입니다.", href: "/ax/settings?open=users", done: st.users.some((u) => u.role === "client" && u.active !== false) });
  if (can(role, "sprint.manage"))
    steps.push({ key: "sprint", title: "AX 실증 14일 시작", desc: "위 단계를 마친 뒤 시작하면 하루 1~3개 미션이 실제 업무 순서대로 나옵니다.", href: "/ax/coach", done: false });
  return steps.length ? steps : null;
}

export function FirstRunOrCoach() {
  const steps = useFirstRunSteps();
  if (!steps) return <CoachCard />;
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <Card className="coach-box coach-glow anim-rise overflow-hidden">
      <div className="px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink"><Rocket size={20} /></span>
          <h2 className="min-w-0 flex-1 text-[1.1rem] font-bold">처음 시작하기</h2>
          <span className="tnum shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[0.8rem] font-bold text-ink-2">{done} / {steps.length}</span>
        </div>
        <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-2">아직 기업고객이 없습니다. 아래 순서대로 하면 첫 고객이 Portal에서 자료를 내는 데까지 갑니다.</p>
      </div>
      <ol className="mt-4 divide-y divide-line border-t border-line">
        {steps.map((s, i) => {
          const isNext = s.key === next?.key;
          return (
            <li key={s.key}>
              <Link href={s.href} className={cx("pressable flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2/60", isNext && "bg-soft/50")}>
                <span className={cx("tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.85rem] font-bold", s.done ? "bg-success text-white" : isNext ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-3")}>
                  {s.done ? <Check size={16} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx("block font-semibold", s.done && "text-ink-3 line-through")}>{s.title}</span>
                  <span className="mt-0.5 block text-[0.82rem] leading-relaxed text-ink-2">{s.desc}</span>
                </span>
                {!s.done && <ArrowRight size={16} className={cx("shrink-0", isNext ? "arrow-slide text-accent" : "text-ink-3")} />}
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
