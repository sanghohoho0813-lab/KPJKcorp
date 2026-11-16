import type { Company, FindingCase, Judgment, Run, Site, StoredFile, StoredWorkbook } from "./model";

/**
 * 저장소 약속 — 화면과 로직은 이 약속만 안다.
 *  · 시연: 브라우저 안 IndexedDB(demo/src/idb.ts) — 이 컴퓨터 밖으로 나가지 않는다
 *  · 시험: MemoryRepo(아래)
 *  · 나중(KPJK 포털): 서버 저장소 + 회사별 권한(명세 §M 설계 — 지금 만들지 않는다)
 */
export interface Repo {
  getCompany(): Promise<Company | undefined>;
  saveCompany(c: Company): Promise<void>;
  listSites(): Promise<Site[]>;
  saveSite(s: Site): Promise<void>;
  deleteSite(id: string): Promise<void>;
  listFiles(siteId: string): Promise<StoredFile[]>;
  saveFile(f: StoredFile, wb?: StoredWorkbook): Promise<void>;
  getWorkbook(fileId: string): Promise<StoredWorkbook | undefined>;
  listJudgments(companyId: string): Promise<Judgment[]>;
  saveJudgments(js: Judgment[]): Promise<void>;
  listRuns(siteId: string): Promise<Run[]>;
  saveRun(r: Run): Promise<void>;
  listCases(siteId: string): Promise<FindingCase[]>;
  saveCases(cs: FindingCase[]): Promise<void>;
  clearAll(): Promise<void>;
}

export class MemoryRepo implements Repo {
  company?: Company;
  sites = new Map<string, Site>();
  files = new Map<string, StoredFile>();
  books = new Map<string, StoredWorkbook>();
  judgments = new Map<string, Judgment>();
  runs = new Map<string, Run>();
  cases = new Map<string, FindingCase>();
  async getCompany() { return this.company; }
  async saveCompany(c: Company) { this.company = c; }
  async listSites() { return [...this.sites.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); }
  async saveSite(s: Site) { this.sites.set(s.id, s); }
  async deleteSite(id: string) {
    this.sites.delete(id);
    for (const [k, f] of this.files) if (f.siteId === id) { this.files.delete(k); this.books.delete(k); }
    for (const [k, r] of this.runs) if (r.siteId === id) this.runs.delete(k);
    for (const [k, c] of this.cases) if (c.siteId === id) this.cases.delete(k);
    for (const [k, j] of this.judgments) if (j.siteId === id && j.scope === "site") this.judgments.delete(k);
  }
  async listFiles(siteId: string) { return [...this.files.values()].filter((f) => f.siteId === siteId).sort((a, b) => (a.uploadedAt < b.uploadedAt ? -1 : 1)); }
  async saveFile(f: StoredFile, wb?: StoredWorkbook) { this.files.set(f.id, f); if (wb) this.books.set(f.id, wb); }
  async getWorkbook(id: string) { return this.books.get(id); }
  async listJudgments(companyId: string) { return [...this.judgments.values()].filter((j) => j.companyId === companyId).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.version - b.version)); }
  async saveJudgments(js: Judgment[]) { for (const j of js) this.judgments.set(j.id, j); }
  async listRuns(siteId: string) { return [...this.runs.values()].filter((r) => r.siteId === siteId).sort((a, b) => a.no - b.no); }
  async saveRun(r: Run) { this.runs.set(r.id, r); }
  async listCases(siteId: string) { return [...this.cases.values()].filter((c) => c.siteId === siteId); }
  async saveCases(cs: FindingCase[]) { for (const c of cs) this.cases.set(`${c.siteId}|${c.key}`, c); }
  async clearAll() { this.company = undefined; for (const m of [this.sites, this.files, this.books, this.judgments, this.runs, this.cases]) m.clear(); }
}
