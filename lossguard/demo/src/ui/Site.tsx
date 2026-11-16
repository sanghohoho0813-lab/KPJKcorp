import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalysisView, Judgment } from "../../../app/model";
import type { SiteData } from "../../../app/service";
import type { RunDiff } from "../../../app/diff";
import { diffIsEmpty } from "../../../app/diff";
import { useApp, won, errMsg } from "../state";
import { Badge, Button, Modal, Note } from "./kit";
import { Upload } from "./Upload";
import { Structure } from "./Structure";
import { Links } from "./Links";
import { Findings } from "./Findings";
import { Compare } from "./Compare";
import { History, DiffView } from "./History";
import { ReportView } from "./Report";

export const TABS = [
  { key: "upload", label: "자료 올리기", n: 1 },
  { key: "structure", label: "문서 읽기 확인", n: 2 },
  { key: "links", label: "항목 연결", n: 3 },
  { key: "findings", label: "확인할 결과", n: 4 },
  { key: "compare", label: "나란히 비교", n: 5 },
  { key: "history", label: "기록", n: 6 },
  { key: "report", label: "보고서", n: 7 },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

export interface SiteCtx { data: SiteData; view?: AnalysisView; reload: () => Promise<void>; analyze: () => Promise<void>; pending: Pending }
export interface Pending { judgments: number; files: number; any: boolean }

/** 마지막 분석 뒤에 바뀐 것(사람 판단 · 파일) — 다시 분석해야 결과에 반영된다 */
function pendingOf(d: SiteData): Pending {
  const last = d.runs[d.runs.length - 1];
  if (!last) return { judgments: 0, files: d.files.some((f) => f.active) ? 1 : 0, any: d.files.some((f) => f.active) };
  const used = new Set(last.judgmentIds);
  const now = d.judgments.filter((j: Judgment) => j.status === "active" && (j.scope === "company" || j.siteId === d.site.id));
  const nowIds = new Set(now.map((j) => j.id));
  const judgments = now.filter((j) => !used.has(j.id)).length + [...used].filter((id) => !nowIds.has(id)).length;
  const act = d.files.filter((f) => f.active).map((f) => f.id).sort().join(",");
  const files = act === last.files.map((f) => f.id).sort().join(",") ? 0 : 1;
  return { judgments, files, any: judgments + files > 0 };
}

export function SitePage({ siteId, tab }: { siteId: string; tab?: string }) {
  const { svc, go, user, toast } = useApp();
  const [data, setData] = useState<SiteData>();
  const [view, setView] = useState<AnalysisView>();
  const [diff, setDiff] = useState<RunDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current: TabKey = (TABS.find((t) => t.key === tab)?.key ?? "upload") as TabKey;

  const reload = useCallback(async () => {
    try { setData(await svc.load(siteId)); } catch (e) { setError(errMsg(e)); }
  }, [svc, siteId]);

  useEffect(() => {
    (async () => {
      try {
        const d = await svc.load(siteId);
        setData(d);
        const last = d.runs[d.runs.length - 1];
        if (last) setView(svc.preview(d, last.judgmentIds));
      } catch (e) { setError(errMsg(e)); }
    })();
  }, [svc, siteId]);

  const analyze = useCallback(async () => {
    if (!user.trim()) { toast("오른쪽 위 '확인자'에 이름을 적어 주세요 — 누가 분석했는지 기록에 남깁니다.", "error"); return; }
    setBusy(true);
    try {
      const r = await svc.analyze(siteId, user);
      setView(r.view);
      await reload();
      if (r.diff) setDiff(r.diff);
      else toast(`분석했습니다 — 확인할 결과 ${r.view.result.findings.length}건`, "success");
      if (current === "upload") go({ page: "site", id: siteId, tab: "findings" });
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  }, [svc, siteId, user, toast, reload, current, go]);

  const pending = useMemo(() => (data ? pendingOf(data) : { judgments: 0, files: 0, any: false }), [data]);
  if (error) return <Note tone="error">{error}</Note>;
  if (!data) return <p className="muted">불러오는 중…</p>;
  const site = data.site;
  const ctx: SiteCtx = { data, view, reload, analyze, pending };
  const last = data.runs[data.runs.length - 1];
  const liveCases = data.cases.filter((c) => c.present);

  return (
    <div className="stack">
      <div className="site-head no-print">
        <div>
          <button className="crumb" onClick={() => go({ page: "home" })}>← 현장 목록</button>
          <h1 data-testid="site-title">{site.name}</h1>
          <div className="row gap small muted">
            <Badge tone={site.status === "completed" ? "success" : "info"}>{site.status === "completed" ? "준공" : "진행 중"}</Badge>
            <span>계약금액 {site.contractAmount ? won(site.contractAmount) : "입력 안 함"} ({site.vat === "excluded" ? "부가세 별도" : "부가세 포함"})</span>
            {last && <span>분석 {last.no}회</span>}
          </div>
        </div>
        <div className="analyze-box">
          {pending.any && last && <span className="pending" data-testid="pending">바뀐 내용 {pending.judgments + pending.files}건 — 다시 분석하면 반영됩니다</span>}
          <Button kind="primary" onClick={analyze} disabled={busy || !data.files.some((f) => f.active)} testId="analyze">{busy ? "분석 중…" : last ? "다시 분석" : "분석하기"}</Button>
        </div>
      </div>
      <nav className="tabs no-print" role="tablist">
        {TABS.map((t) => {
          const count = t.key === "findings" ? liveCases.filter((c) => c.status === "open").length : t.key === "links" ? (view?.snapshot.counts.review ?? 0) : 0;
          return (
            <button key={t.key} role="tab" aria-selected={current === t.key} className={current === t.key ? "on" : ""} onClick={() => go({ page: "site", id: siteId, tab: t.key })} data-testid={`tab-${t.key}`}>
              <span className="tab-n">{t.n}</span>{t.label}{count > 0 && <span className="tab-count">{count}</span>}
            </button>
          );
        })}
      </nav>
      {!view && current !== "upload" && current !== "history" ? (
        <Note tone="info">아직 분석하지 않았습니다. 자료를 올린 뒤 오른쪽 위의 <b>분석하기</b>를 눌러 주세요.</Note>
      ) : (
        <>
          {current === "upload" && <Upload ctx={ctx} />}
          {current === "structure" && view && <Structure ctx={ctx} view={view} />}
          {current === "links" && view && <Links ctx={ctx} view={view} />}
          {current === "findings" && view && <Findings ctx={ctx} view={view} />}
          {current === "compare" && view && <Compare ctx={ctx} view={view} />}
          {current === "history" && <History ctx={ctx} />}
          {current === "report" && view && <ReportView ctx={ctx} view={view} />}
        </>
      )}
      {diff && (
        <Modal title="다시 분석했습니다 — 바뀐 것" onClose={() => setDiff(null)} wide>
          {diffIsEmpty(diff) ? <Note tone="neutral">이전 분석과 결과 · 연결 · 열 지정이 모두 같습니다(같은 자료 · 같은 판단이면 결과도 같습니다).</Note> : <DiffView diff={diff} files={data.files} />}
          <div className="row end"><Button kind="primary" onClick={() => setDiff(null)} testId="diff-close">확인</Button></div>
        </Modal>
      )}
    </div>
  );
}
