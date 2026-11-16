import { useCallback, useEffect, useState } from "react";
import type { Site } from "../../../app/model";
import { intake } from "../../../app/ingest";
import { useApp, won, when, errMsg } from "../state";
import { SAMPLES } from "../samples";
import { Badge, Button, Card, Empty, Field, Modal, Note } from "./kit";

interface Row { site: Site; files: number; runs: number; last?: string; open: number; total: number }

async function siteRows(svc: ReturnType<typeof useApp>["svc"]): Promise<Row[]> {
  const out: Row[] = [];
  for (const s of await svc.repo.listSites()) {
    const [files, runs, cases] = await Promise.all([svc.repo.listFiles(s.id), svc.repo.listRuns(s.id), svc.repo.listCases(s.id)]);
    const live = cases.filter((c) => c.present);
    out.push({ site: s, files: files.filter((f) => f.active).length, runs: runs.length, last: runs[runs.length - 1]?.at, open: live.filter((c) => c.status === "open" || c.status === "checking" || c.status === "on_hold").length, total: live.length });
  }
  return out;
}

export function Home() {
  const { svc, go, toast, user } = useApp();
  const [rows, setRows] = useState<Row[]>();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => setRows(await siteRows(svc)), [svc]);
  useEffect(() => {
    let alive = true;
    (async () => { const r = await siteRows(svc); if (alive) setRows(r); })();
    return () => { alive = false; };
  }, [svc]);

  const loadSample = async (key: string) => {
    const s = SAMPLES.find((x) => x.key === key)!;
    setBusy(key);
    try {
      const site = await svc.createSite({ name: s.name, status: s.status, contractAmount: s.contractAmount, vat: s.vat, changes: s.changes, memo: s.story });
      for (const f of s.files) await svc.addFile(site, await intake(new Uint8Array(f.bytes), f.display), f.kind, f.round, user || "시연");
      toast(`예시 현장 ${key} 를 만들었습니다 — 파일 ${s.files.length}개`, "success");
      go({ page: "site", id: site.id, tab: "upload" });
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(""); }
  };

  const reset = async () => {
    if (!confirm("이 브라우저에 저장된 시연 자료(현장 · 파일 · 판단 · 기록)를 모두 지울까요?")) return;
    await svc.repo.clearAll();
    toast("시연 자료를 모두 지웠습니다");
    await load();
  };

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <h1>정산 전에, 서류끼리 맞지 않는 곳을 먼저 찾습니다</h1>
          <p>계약 내역서 · 변경 내역서 · 정산서 · 매입 장부를 그대로 올리면, 서로 맞지 않는 숫자와 확인이 필요한 곳을 <b>원본 위치와 계산 과정</b>까지 보여 드립니다. 판단은 대표님과 담당자가 합니다.</p>
          <ol className="steps">
            <li><b>1</b> 현장을 만들고 파일을 올립니다</li>
            <li><b>2</b> 프로그램이 읽은 표와 항목 연결을 확인 · 고칩니다</li>
            <li><b>3</b> 확인할 결과를 원본과 함께 보고, 처리 상태를 기록합니다</li>
            <li><b>4</b> 보고서로 남깁니다(인쇄 · PDF)</li>
          </ol>
        </div>
        <div className="hero-side">
          <Note tone="neutral">이 시연판은 <b>가상(합성) 공사자료</b>로 만들었습니다. 실제 현장 자료에서의 정확도는 아직 측정 전입니다. 올린 파일은 <b>이 브라우저 안에서만</b> 분석하며 서버 · 외부 · AI 서비스로 보내지 않습니다.</Note>
          <div className="row gap">
            <Button kind="primary" onClick={() => loadSample("A")} disabled={!!busy} testId="sample-A">{busy === "A" ? "만드는 중…" : "예시 현장 A 로 시작"}</Button>
            <Button onClick={() => loadSample("B")} disabled={!!busy} testId="sample-B" title={SAMPLES.find((s) => s.key === "B")?.story}>{busy === "B" ? "만드는 중…" : "예시 현장 B 추가"}</Button>
            <Button onClick={() => setCreating(true)} testId="new-site">새 현장 만들기</Button>
          </div>
        </div>
      </section>

      <Card title="현장" right={rows?.length ? <Button kind="ghost" small onClick={reset}>시연 자료 모두 지우기</Button> : undefined}>
        {!rows ? <p className="muted">불러오는 중…</p> : !rows.length ? (
          <Empty title="아직 현장이 없습니다">위의 "예시 현장 A 로 시작"을 누르면 가상 공사자료로 바로 해 볼 수 있습니다.</Empty>
        ) : (
          <div className="site-grid">
            {rows.map((r) => (
              <button key={r.site.id} className="site-card" onClick={() => go({ page: "site", id: r.site.id, tab: r.runs ? "findings" : "upload" })} data-testid="site-card">
                <div className="row between"><strong>{r.site.name}</strong><Badge tone={r.site.status === "completed" ? "success" : "info"}>{r.site.status === "completed" ? "준공" : "진행 중"}</Badge></div>
                <div className="muted small">계약금액 {r.site.contractAmount ? won(r.site.contractAmount) : "입력 안 함"} · 파일 {r.files}개</div>
                <div className="row gap small">
                  {r.runs ? <><span>분석 {r.runs}회 · 마지막 {when(r.last!)}</span><Badge tone={r.open ? "warning" : "success"}>확인할 결과 {r.open}/{r.total}</Badge></> : <span className="muted">아직 분석 전</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
      {creating && <NewSite onClose={() => setCreating(false)} onCreated={(s) => go({ page: "site", id: s.id, tab: "upload" })} />}
    </div>
  );
}

function NewSite({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Site) => void }) {
  const { svc, toast } = useApp();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState<"excluded" | "included">("excluded");
  const [status, setStatus] = useState<"completed" | "progress">("completed");
  const submit = async () => {
    try {
      const a = amount.replace(/[^\d]/g, "");
      const s = await svc.createSite({ name, client: client || undefined, status, contractAmount: a ? Number(a) : undefined, vat, changes: [] });
      onCreated(s);
    } catch (e) { toast(errMsg(e), "error"); }
  };
  return (
    <Modal title="새 현장 만들기" onClose={onClose}>
      <div className="form">
        <Field label="현장 이름"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: ○○빌딩 3층 사무실 인테리어" autoFocus data-testid="site-name" /></Field>
        <Field label="발주처(선택)" hint="가리고 싶으면 비워 두셔도 됩니다"><input value={client} onChange={(e) => setClient(e.target.value)} /></Field>
        <Field label="계약금액(원)" hint="합계 대조(D02)에 씁니다. 모르면 비워 두세요"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="예: 125,000,000" /></Field>
        <div className="row gap">
          <Field label="부가세"><select value={vat} onChange={(e) => setVat(e.target.value as "excluded" | "included")}><option value="excluded">별도(공급가액)</option><option value="included">포함</option></select></Field>
          <Field label="현장 상태"><select value={status} onChange={(e) => setStatus(e.target.value as "completed" | "progress")}><option value="completed">준공(끝난 현장)</option><option value="progress">진행 중</option></select></Field>
        </div>
        <div className="row end gap"><Button onClick={onClose}>닫기</Button><Button kind="primary" onClick={submit} testId="site-create">만들기</Button></div>
      </div>
    </Modal>
  );
}
