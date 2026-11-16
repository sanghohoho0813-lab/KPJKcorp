import { useState } from "react";
import type { FileKind, StoredFile } from "../../../app/model";
import { intake, type Intake } from "../../../app/ingest";
import { describeReport, PII_LABEL } from "../../../engine/privacy/scan";
import { useApp, won, when, errMsg } from "../state";
import type { SiteCtx } from "./Site";
import { Badge, Button, Card, Field, Modal, Note } from "./kit";

const SLOTS: { kind: FileKind; label: string; hint: string; required?: boolean }[] = [
  { kind: "contract", label: "계약 내역서", hint: "발주처에 낸 최종 내역서(표지 · 집계표 포함). 엑셀 원본이 가장 좋습니다", required: true },
  { kind: "change", label: "변경 내역서", hint: "변경 계약 · 추가 견적(차수별)" },
  { kind: "settlement", label: "정산서", hint: "최종 정산서 · 기성 내역" },
  { kind: "cost", label: "매입 · 지급 장부(선택)", hint: "세금계산서 목록 · 거래명세서 목록 · 지급 내역 — 중복 가능성 점검(D10)에 씁니다" },
];
const FORMAT: Record<string, string> = { xlsx: "엑셀(.xlsx)", xls: "엑셀 97~2003(.xls)", csv: "CSV", html: "웹 내려받기(HTML 표)" };

export function Upload({ ctx }: { ctx: SiteCtx }) {
  const { svc, user, toast } = useApp();
  const { data, reload } = ctx;
  const [pii, setPii] = useState<{ x: Intake; kind: FileKind; round?: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [rounds, setRounds] = useState(() => Math.max(1, ...data.files.filter((f) => f.kind === "change").map((f) => f.round ?? 1)));

  const store = async (x: Intake, kind: FileKind, round: number | undefined, allowBlock: boolean) => {
    await svc.addFile(data.site, x, kind, round, user || "(이름 없음)", allowBlock);
    toast(`${x.fileName} — ${FORMAT[x.format] ?? x.format}로 읽었습니다${x.pii.level === "warn" || x.pii.level === "block" ? " · 개인정보를 지우고 저장했습니다" : ""}`, "success");
    await reload();
  };

  const pick = async (kind: FileKind, round: number | undefined, file: File | undefined) => {
    if (!file) return;
    setBusy(`${kind}${round ?? ""}`);
    try {
      const x = await intake(new Uint8Array(await file.arrayBuffer()), file.name);
      if (x.pii.level === "block") { setPii({ x, kind, round }); return; }
      await store(x, kind, round, false);
    } catch (e) { toast(`${file.name}: ${errMsg(e)}`, "error"); } finally { setBusy(""); }
  };

  const slot = (kind: FileKind, label: string, hint: string, round?: number, required?: boolean) => {
    const files = data.files.filter((f) => f.kind === kind && (f.round ?? 0) === (round ?? 0));
    const active = files.find((f) => f.active);
    const id = `${kind}${round ?? ""}`;
    return (
      <div className="slot" key={id} data-testid={`slot-${id}`}>
        <div className="slot-head">
          <div><strong>{label}{round ? ` ${round}차` : ""}</strong>{required && <Badge tone="accent">필수</Badge>}<div className="muted small">{hint}</div></div>
          <label className={`btn btn-${active ? "secondary" : "primary"} btn-sm file-btn`}>
            {busy === id ? "읽는 중…" : active ? "다른 파일로 바꾸기" : "파일 올리기"}
            <input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,.htm,.html" onChange={(e) => { void pick(kind, round, e.target.files?.[0]); e.target.value = ""; }} data-testid={`file-${id}`} />
          </label>
        </div>
        {active ? <FileLine f={active} /> : <div className="muted small">아직 없음</div>}
        {files.filter((f) => !f.active).length > 0 && <div className="muted small">이전 파일 {files.filter((f) => !f.active).length}개는 쉬게 했습니다(기록은 남아 있음)</div>}
      </div>
    );
  };

  return (
    <div className="stack">
      <SiteInfo ctx={ctx} />
      <Card title="자료 올리기" right={<span className="muted small">.xlsx · .xls · CSV · 웹 내려받기(HTML) — 변환하지 않고 그대로</span>}>
        <Note tone="neutral">파일은 <b>이 브라우저 안에서만</b> 읽습니다. 원본 파일은 저장하지 않고, 읽은 값만 이 브라우저에 저장합니다. 주민등록번호 · 휴대전화 · 계좌 · 이름은 저장하기 전에 지우거나 가명으로 바꿉니다.</Note>
        <div className="slots">
          {slot("contract", SLOTS[0].label, SLOTS[0].hint, undefined, true)}
          {Array.from({ length: rounds }, (_, i) => slot("change", SLOTS[1].label, SLOTS[1].hint, i + 1))}
          <div className="row"><Button kind="ghost" small onClick={() => setRounds((r) => r + 1)}>+ 변경 차수 추가</Button></div>
          {slot("settlement", SLOTS[2].label, SLOTS[2].hint)}
          {slot("cost", SLOTS[3].label, SLOTS[3].hint)}
        </div>
      </Card>
      {pii && (
        <Modal title="개인정보가 들어 있습니다" onClose={() => setPii(null)}>
          <Note tone="error"><b>{pii.x.fileName}</b>에 주민 · 외국인등록번호 또는 카드번호로 보이는 값이 있습니다. 원칙은 <b>자료를 준 곳에 그 열을 지운 파일을 다시 받는 것</b>입니다.</Note>
          <ul className="list small">{describeReport(pii.x.pii).map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="small muted">보고서에는 원래 값이 없습니다(위치 · 모양만). "지우고 사용"을 고르면 그 값들을 지운 뒤에만 저장 · 분석합니다.</p>
          <div className="row end gap">
            <Button onClick={() => setPii(null)} testId="pii-cancel">올리지 않기</Button>
            <Button kind="danger" onClick={async () => { try { await store(pii.x, pii.kind, pii.round, true); } catch (e) { toast(errMsg(e), "error"); } setPii(null); }} testId="pii-sanitize">개인정보를 지우고 사용</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FileLine({ f }: { f: StoredFile }) {
  const piiText = f.pii.level === "none" ? <Badge tone="success">개인정보 없음</Badge>
    : f.pii.level === "info" ? <Badge tone="neutral" title="회사 전화 · 사업자번호 등은 그대로 둡니다">회사 정보만</Badge>
      : <Badge tone="warning" title={Object.entries(f.pii.counts).map(([k, n]) => `${PII_LABEL[k as keyof typeof PII_LABEL]} ${n}`).join(" · ")}>개인정보 지움 · 칸 {f.pii.changedCells}개</Badge>;
  return (
    <div className="file-line" data-testid="file-line">
      <span className="file-name">{f.fileName}</span>
      <Badge tone="neutral">{FORMAT[f.format] ?? f.format}</Badge>
      {piiText}
      <span className="muted small" title={`SHA-256 ${f.sha256}`}>{(f.size / 1024).toFixed(1)}KB · 지문 {f.sha256.slice(0, 10)}… · {when(f.uploadedAt)} {f.uploadedBy}</span>
    </div>
  );
}

function SiteInfo({ ctx }: { ctx: SiteCtx }) {
  const { svc, toast } = useApp();
  const s = ctx.data.site;
  const [amount, setAmount] = useState(s.contractAmount ? String(s.contractAmount) : "");
  const [vat, setVat] = useState(s.vat);
  const [status, setStatus] = useState(s.status);
  const [changes, setChanges] = useState(s.changes.length ? s.changes : [{ round: 1 }]);
  const parse = (v: string) => { const d = v.replace(/[^\d]/g, ""); return d ? Number(d) : undefined; };
  const save = async () => {
    await svc.repo.saveSite({ ...s, contractAmount: parse(amount), vat, status, changes: changes.filter((c) => c.prevAmount !== undefined || c.newAmount !== undefined) });
    toast("현장 정보를 저장했습니다 — 다시 분석하면 반영됩니다", "success");
    await ctx.reload();
  };
  return (
    <Card title="현장 정보" right={<Button small onClick={save} testId="site-save">저장</Button>}>
      <div className="grid4">
        <Field label="계약금액(원)" hint={amount ? won(parse(amount)) : "합계 대조에 씁니다"}><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" /></Field>
        <Field label="부가세"><select value={vat} onChange={(e) => setVat(e.target.value as typeof vat)}><option value="excluded">별도(공급가액)</option><option value="included">포함</option></select></Field>
        <Field label="현장 상태"><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="completed">준공</option><option value="progress">진행 중</option></select></Field>
      </div>
      {changes.map((c, i) => (
        <div className="grid4" key={c.round}>
          <Field label={`변경 ${c.round}차 — 직전 계약금액`}><input value={c.prevAmount ?? ""} onChange={(e) => setChanges(changes.map((x, j) => (j === i ? { ...x, prevAmount: parse(e.target.value) } : x)))} inputMode="numeric" /></Field>
          <Field label={`변경 ${c.round}차 — 변경 계약금액`} hint="변경 대조(D03)에 씁니다"><input value={c.newAmount ?? ""} onChange={(e) => setChanges(changes.map((x, j) => (j === i ? { ...x, newAmount: parse(e.target.value) } : x)))} inputMode="numeric" /></Field>
        </div>
      ))}
    </Card>
  );
}
