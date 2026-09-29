"use client";

import { Repeat, Play } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { AUTO_RULES, ruleDays, ruleOn } from "@/lib/rules";
import { Button, cx } from "@/components/ui/ui";

/**
 * 자동 업무 규칙 — 무엇이 언제 만들어지는지 보여주고, 대표가 켜고 끈다.
 * 알림 채널(카카오·이메일)을 붙이기 전에 규칙부터 확정해 두는 것이 순서다.
 */
export function AutoRulesPanel() {
  const st = useStore();
  const setRule = useStore((s) => s.setAutoRule);
  const setDays = useStore((s) => s.setAutoRuleDays);
  const sync = useStore((s) => s.syncRuleTasks);
  const toast = useStore((s) => s.toast);
  const manage = can(st.session?.role, "rules.manage");
  const enabled = (k: string) => ruleOn(st.settings.autoRules, k);
  const madeCount = (k: string) => st.tasks.filter((t) => t.ruleKey?.startsWith(k + ":")).length;

  return (
    <div>
      <p className="mb-3 text-[0.82rem] leading-relaxed text-ink-3">
        사건이 아니라 <b className="text-ink-2">시간이 흘러서</b> 생기는 일들입니다. 앱을 열 때와 10분마다 확인해 아직 없는 업무만 만듭니다.
        같은 대상에 같은 규칙으로 두 번 만들지 않습니다.
      </p>
      <div className="divide-y divide-line rounded-xl border border-line">
        {AUTO_RULES.map((r) => {
          const on = enabled(r.key);
          const n = madeCount(r.key);
          const days = ruleDays(st.settings.autoRules, r.key);
          return (
            <div key={r.key} className={cx("flex items-start gap-3 px-4 py-3", !on && "opacity-60")}>
              <button
                role="switch"
                aria-checked={on}
                aria-label={`${r.label(days)} ${on ? "끄기" : "켜기"}`}
                disabled={!manage}
                onClick={() => { setRule(r.key, !on); toast(`${r.label(days)} 규칙을 ${on ? "껐습니다" : "켰습니다"}.`); }}
                className={cx("pressable relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors after:absolute after:-inset-2 after:content-[''] disabled:cursor-not-allowed", on ? "bg-accent" : "bg-line-2")}
              >
                <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "left-[22px]" : "left-0.5")} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.label(days)}</span>
                  {n > 0 && <span className="tnum rounded-full bg-surface-2 px-2 text-[0.72rem] font-bold text-ink-2">생성 {n}건</span>}
                </div>
                <div className="mt-0.5 text-[0.82rem] text-ink-2">{r.when(days)}</div>
                <div className="mt-0.5 text-[0.78rem] text-ink-3">{r.why}</div>
                {/* 기준일 — 운영해 보고 회사에 맞게 고친다. 기본값에는 "기본" 표시 */}
                {manage && on && (
                  <div role="group" aria-label={`${r.short} 규칙 기준일`} className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[0.75rem] font-semibold text-ink-3">기준</span>
                    {r.days.options.map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={d === days}
                        onClick={() => { if (d === days) return; setDays(r.key, d); toast(`기준을 ${r.label(d)}(으)로 바꿨습니다. 이미 만든 업무는 그대로 둡니다.`); }}
                        className={cx("pressable tnum h-8 min-w-[2.75rem] rounded-full border px-2.5 text-[0.78rem] font-semibold", d === days ? "border-accent bg-accent text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2")}
                      >
                        {d}일{d === r.days.default ? " · 기본" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" icon={<Play size={14} />} onClick={() => { const n = sync(); toast(n ? `규칙에 따라 업무 ${n}건을 만들었습니다.` : "새로 만들 업무가 없습니다. 조건에 맞는 건이 이미 업무함에 있습니다."); }}>
          지금 확인
        </Button>
        <span className="flex items-center gap-1 text-[0.78rem] text-ink-3"><Repeat size={13} /> 규칙이 만든 업무는 업무함에서 <b className="text-ink-2">규칙</b> 배지로 구분됩니다.</span>
      </div>
      {!manage && <p className="mt-2 text-[0.78rem] text-ink-3">켜고 끄거나 기준일을 바꾸는 것은 대표 계정에서만 가능합니다.</p>}
      {manage && <p className="mt-2 text-[0.78rem] text-ink-3">켜기·끄기와 기준 변경은 누가 언제 바꿨는지 실증 기록에 남습니다.</p>}
    </div>
  );
}
