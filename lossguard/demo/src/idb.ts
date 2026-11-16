import type { Company, FindingCase, Judgment, Run, Site, StoredFile, StoredWorkbook } from "../../app/model";
import type { Repo } from "../../app/store";

/**
 * 브라우저 안 저장소(IndexedDB) — 이 컴퓨터의 이 브라우저에만 남는다. 서버로 보내지 않는다.
 * 원본 파일 바이트는 저장하지 않고, 개인정보를 지운 "읽은 값"만 저장한다(app/ingest.ts).
 */
const DB = "lossguard-demo";
const STORES = ["company", "sites", "files", "books", "judgments", "runs", "cases"] as const;
type Store = (typeof STORES)[number];

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
}

export async function openIdb(): Promise<IdbRepo> {
  const db = await new Promise<IDBDatabase>((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
  return new IdbRepo(db);
}

export class IdbRepo implements Repo {
  constructor(private db: IDBDatabase) {}
  private async all<T>(s: Store): Promise<T[]> { return req(this.db.transaction(s).objectStore(s).getAll()) as Promise<T[]>; }
  private async get<T>(s: Store, k: string): Promise<T | undefined> { return req(this.db.transaction(s).objectStore(s).get(k)) as Promise<T | undefined>; }
  private async put(s: Store, entries: [string, unknown][]): Promise<void> {
    const tx = this.db.transaction(s, "readwrite");
    for (const [k, v] of entries) tx.objectStore(s).put(v, k);
    await new Promise<void>((ok, no) => { tx.oncomplete = () => ok(); tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error); });
  }
  private async del(s: Store, keys: string[]): Promise<void> {
    const tx = this.db.transaction(s, "readwrite");
    for (const k of keys) tx.objectStore(s).delete(k);
    await new Promise<void>((ok, no) => { tx.oncomplete = () => ok(); tx.onerror = () => no(tx.error); });
  }
  getCompany() { return this.get<Company>("company", "me"); }
  saveCompany(c: Company) { return this.put("company", [["me", c]]); }
  async listSites() { return (await this.all<Site>("sites")).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); }
  saveSite(s: Site) { return this.put("sites", [[s.id, s]]); }
  async deleteSite(id: string) {
    const files = (await this.all<StoredFile>("files")).filter((f) => f.siteId === id).map((f) => f.id);
    await this.del("files", files); await this.del("books", files);
    await this.del("runs", (await this.all<Run>("runs")).filter((r) => r.siteId === id).map((r) => r.id));
    await this.del("cases", (await this.all<FindingCase>("cases")).filter((c) => c.siteId === id).map((c) => `${c.siteId}|${c.key}`));
    await this.del("judgments", (await this.all<Judgment>("judgments")).filter((j) => j.siteId === id && j.scope === "site").map((j) => j.id));
    await this.del("sites", [id]);
  }
  async listFiles(siteId: string) { return (await this.all<StoredFile>("files")).filter((f) => f.siteId === siteId).sort((a, b) => (a.uploadedAt < b.uploadedAt ? -1 : 1)); }
  async saveFile(f: StoredFile, wb?: StoredWorkbook) { await this.put("files", [[f.id, f]]); if (wb) await this.put("books", [[f.id, wb]]); }
  getWorkbook(id: string) { return this.get<StoredWorkbook>("books", id); }
  async listJudgments(companyId: string) { return (await this.all<Judgment>("judgments")).filter((j) => j.companyId === companyId).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.version - b.version)); }
  saveJudgments(js: Judgment[]) { return this.put("judgments", js.map((j) => [j.id, j])); }
  async listRuns(siteId: string) { return (await this.all<Run>("runs")).filter((r) => r.siteId === siteId).sort((a, b) => a.no - b.no); }
  saveRun(r: Run) { return this.put("runs", [[r.id, r]]); }
  async listCases(siteId: string) { return (await this.all<FindingCase>("cases")).filter((c) => c.siteId === siteId); }
  saveCases(cs: FindingCase[]) { return this.put("cases", cs.map((c) => [`${c.siteId}|${c.key}`, c])); }
  async clearAll() { for (const s of STORES) { const tx = this.db.transaction(s, "readwrite"); tx.objectStore(s).clear(); await new Promise<void>((ok) => { tx.oncomplete = () => ok(); }); } }
}
