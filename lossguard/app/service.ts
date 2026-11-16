import type { IndustryPack, LeafRole, GroupKey, Line, RawWorkbook } from "../engine/types";
import { ENGINE_VERSION } from "../engine/version";
import type { AnalysisView, CaseStatus, Clock, Company, FindingCase, Judgment, Run, Site, StoredFile } from "./model";
import type { Repo } from "./store";
import { runAnalysis } from "./analysis";
import { addJudgment, lineSnap, nameKey } from "./judgments";
import { addNote, reconcile, transition, type StepInput } from "./workflow";
import { diffRuns, type RunDiff } from "./diff";
import { storable, type Intake } from "./ingest";

/**
 * 제품 동작 한 곳 — 화면(시연 · 나중의 포털)과 시험이 같은 함수를 부른다.
 * 분석은 사용자가 "분석"을 누를 때만 기록(Run)한다. 사람 판단은 즉시 저장되지만, 결과에는 다음 분석부터 반영된다.
 */
export const systemClock: Clock = { now: () => new Date().toISOString(), id: () => crypto.randomUUID() };

export interface SiteData { site: Site; files: StoredFile[]; books: Map<string, RawWorkbook>; judgments: Judgment[]; runs: Run[]; cases: FindingCase[] }

export class LossGuardService {
  constructor(public repo: Repo, public pack: IndustryPack, public clock: Clock = systemClock) {}

  async company(name = "우리 회사"): Promise<Company> {
    const c = await this.repo.getCompany();
    if (c) return c;
    const n: Company = { id: this.clock.id(), name, createdAt: this.clock.now() };
    await this.repo.saveCompany(n);
    return n;
  }

  async createSite(input: Omit<Site, "id" | "companyId" | "createdAt">): Promise<Site> {
    if (!input.name.trim()) throw new Error("현장 이름을 적어 주세요.");
    const c = await this.company();
    const s: Site = { ...input, name: input.name.trim(), id: this.clock.id(), companyId: c.id, createdAt: this.clock.now() };
    await this.repo.saveSite(s);
    return s;
  }

  async load(siteId: string): Promise<SiteData> {
    const site = (await this.repo.listSites()).find((s) => s.id === siteId);
    if (!site) throw new Error("현장을 찾지 못했습니다.");
    const files = await this.repo.listFiles(siteId);
    const books = new Map<string, RawWorkbook>();
    for (const f of files) { const b = await this.repo.getWorkbook(f.id); if (b) books.set(f.id, b.workbook); }
    return { site, files, books, judgments: await this.repo.listJudgments(site.companyId), runs: await this.repo.listRuns(siteId), cases: await this.repo.listCases(siteId) };
  }

  /** 파일 저장 — 같은 종류 · 차수의 이전 파일은 쉬게 한다(지우지 않음) */
  async addFile(site: Site, x: Intake, kind: StoredFile["kind"], round: number | undefined, by: string, allowSanitizeBlock = false): Promise<StoredFile> {
    const s = storable(x, allowSanitizeBlock);
    const files = await this.repo.listFiles(site.id);
    for (const f of files) if (f.active && f.kind === kind && (f.round ?? 0) === (round ?? 0)) await this.repo.saveFile({ ...f, active: false });
    const f: StoredFile = {
      id: this.clock.id(), siteId: site.id, kind, round, fileName: x.fileName, size: x.size, sha256: x.sha256, format: x.format,
      uploadedAt: this.clock.now(), uploadedBy: by.trim() || "(이름 없음)",
      pii: { level: x.pii.level, counts: x.pii.counts, changedCells: s.changedCells, pseudonyms: s.pseudonyms }, active: true,
    };
    await this.repo.saveFile(f, { fileId: f.id, workbook: { ...s.workbook, fileName: x.fileName } });
    return f;
  }

  async setFileActive(f: StoredFile, active: boolean) { await this.repo.saveFile({ ...f, active }); }

  /** 지금의 판단으로 분석만 해 본다(기록하지 않음) */
  preview(d: SiteData, judgmentIds?: string[]): AnalysisView {
    const js = judgmentIds ? d.judgments.map((j) => ({ ...j, status: judgmentIds.includes(j.id) ? ("active" as const) : ("withdrawn" as const) })) : d.judgments;
    return runAnalysis({ site: d.site, files: d.files.filter((f) => d.books.has(f.id)).map((f) => ({ file: f, workbook: d.books.get(f.id)! })), judgments: js, pack: this.pack });
  }

  /** 분석 실행 · 기록 — 이전 분석과의 비교와 결과 처리 목록을 함께 돌려준다 */
  async analyze(siteId: string, by: string): Promise<{ view: AnalysisView; run: Run; diff?: RunDiff; cases: FindingCase[] }> {
    const d = await this.load(siteId);
    if (!d.files.some((f) => f.active && f.kind === "contract") && !d.files.some((f) => f.active && f.kind === "cost")) throw new Error("계약 내역서(또는 매입 · 지급 자료)를 먼저 올려 주세요.");
    const view = this.preview(d);
    const prev = d.runs[d.runs.length - 1];
    const used = d.judgments.filter((j) => j.status === "active" && (j.scope === "company" || j.siteId === siteId));
    const run: Run = {
      id: this.clock.id(), siteId, no: (prev?.no ?? 0) + 1, at: this.clock.now(), by: by.trim() || "(이름 없음)",
      engine: view.result.versions.engine, pack: view.result.versions.pack, inputHash: view.result.versions.inputHash,
      files: d.files.filter((f) => f.active).map((f) => ({ id: f.id, fileName: f.fileName, sha256: f.sha256, kind: f.kind, round: f.round })),
      judgmentIds: used.map((j) => j.id), rulesApplied: view.rules.applied.length, snapshot: view.snapshot,
    };
    await this.repo.saveRun(run);
    const cases = reconcile(d.cases, siteId, view.snapshot, run.no, this.clock);
    await this.repo.saveCases(cases);
    return { view, run, diff: prev ? diffRuns(prev.snapshot, run.snapshot) : undefined, cases };
  }

  private source(d: SiteData, extra: Partial<Judgment["source"]> = {}): Judgment["source"] {
    const last = d.runs[d.runs.length - 1];
    return { siteName: d.site.name, runNo: last?.no, engine: ENGINE_VERSION, pack: `${this.pack.key}@${this.pack.version}`, ...extra };
  }

  private async save(r: { judgment: Judgment; superseded: Judgment[] }) { await this.repo.saveJudgments([...r.superseded, r.judgment]); return r.judgment; }

  /** 열 지정 고치기(현장 판단) */
  async judgeColumns(d: SiteData, fileId: string, sheet: string, columns: { col: number; role: LeafRole; group?: GroupKey }[], before: { col: number; role: LeafRole; group?: GroupKey }[], by: string, note?: string): Promise<Judgment> {
    const f = d.files.find((x) => x.id === fileId);
    const r = addJudgment(d.judgments, d.site, { type: "column", fileId, sheet, columns, before }, "site", by, this.source(d, { fileName: f?.fileName, fileHash: f?.sha256, sheet }), this.clock, note);
    return this.save(r);
  }

  /** 두 줄이 같은 항목인가(현장 판단) — company=true 면 같은 회사의 다른 현장에도 쓰는 이름 규칙을 함께 남긴다 */
  async judgeLink(d: SiteData, a: { fileId: string; line: Line }, b: { fileId: string; line: Line }, same: boolean, by: string, company: boolean, note?: string): Promise<Judgment[]> {
    const fb = d.files.find((x) => x.id === b.fileId);
    const out: Judgment[] = [];
    const src = this.source(d, { fileName: fb?.fileName, fileHash: fb?.sha256, sheet: b.line.sheet, row: b.line.row });
    out.push(await this.save(addJudgment(d.judgments, d.site, { type: "link", same, a: lineSnap(a.fileId, a.line), b: lineSnap(b.fileId, b.line) }, "site", by, src, this.clock, note)));
    if (company) {
      const ak = nameKey(this.pack, a.line.name, a.line.spec, a.line.unit), bk = nameKey(this.pack, b.line.name, b.line.spec, b.line.unit);
      const payload = { type: "nameRule" as const, same, aKey: ak, bKey: bk, a: { name: a.line.name, spec: a.line.spec, unit: a.line.unit }, b: { name: b.line.name, spec: b.line.spec, unit: b.line.unit } };
      out.push(await this.save(addJudgment(d.judgments, d.site, payload, "company", by, src, this.clock, note)));
    }
    return out;
  }

  /** 판단 거두기 — 지우지 않고 "거둠" 판을 하나 더 남긴다(누가 · 언제) */
  async withdraw(d: SiteData, j: Judgment, by: string, note?: string): Promise<Judgment> {
    const r = addJudgment(d.judgments, d.site, j.payload, j.scope, by, { ...j.source, runNo: d.runs[d.runs.length - 1]?.no }, this.clock, note ?? "판단을 거둠");
    const w: Judgment = { ...r.judgment, status: "withdrawn" };
    await this.repo.saveJudgments([...r.superseded, w]);
    return w;
  }

  async step(siteId: string, key: string, to: CaseStatus, s: StepInput): Promise<FindingCase> {
    const c = (await this.repo.listCases(siteId)).find((x) => x.key === key);
    if (!c) throw new Error("결과를 찾지 못했습니다.");
    const n = transition(c, to, s, this.clock);
    await this.repo.saveCases([n]);
    return n;
  }

  async note(siteId: string, key: string, by: string, text: string): Promise<FindingCase> {
    const c = (await this.repo.listCases(siteId)).find((x) => x.key === key);
    if (!c) throw new Error("결과를 찾지 못했습니다.");
    const n = addNote(c, by, text, this.clock);
    await this.repo.saveCases([n]);
    return n;
  }
}
