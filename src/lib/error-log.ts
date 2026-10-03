/**
 * 화면 오류 기록 — 이 브라우저에만 최근 20건.
 * 실사·운영 중에 화면이 깨졌을 때 "무엇이, 어느 화면에서, 언제" 났는지를 개발자 도구 없이
 * 설정 › 데이터에서 복사해 전달할 수 있게 한다. 서버로 보내지 않는다(개인정보·고객 데이터가 섞일 수 있다).
 */
export type ErrorEntry = {
  at: string;
  /** render: 화면 그리기 중(오류 화면이 뜸) · event: 버튼 등 동작 중 · chunk: 새 버전 배포 뒤 옛 화면 */
  kind: "render" | "event" | "chunk";
  path: string;
  message: string;
  digest?: string;
};

const KEY = "kpjk-error-log";
const MAX = 20;

/** 새 버전이 배포된 뒤, 열려 있던 옛 화면이 없어진 파일을 부르다 나는 오류 */
export function isChunkError(err: unknown): boolean {
  const s = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? "");
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(s);
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

export function readErrors(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as ErrorEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordError(kind: ErrorEntry["kind"], err: unknown, digest?: string): void {
  try {
    const entry: ErrorEntry = {
      at: new Date().toISOString(),
      kind: isChunkError(err) ? "chunk" : kind,
      path: location.pathname + location.search,
      message: messageOf(err).slice(0, 400),
      ...(digest ? { digest } : {}),
    };
    const list = readErrors();
    // 같은 화면·같은 오류가 몇 초 안에 반복되면(다시 그리기) 한 번만 남긴다
    const last = list[0];
    if (last && last.message === entry.message && last.path === entry.path && Date.now() - new Date(last.at).getTime() < 5000) return;
    localStorage.setItem(KEY, JSON.stringify([entry, ...list].slice(0, MAX)));
    window.dispatchEvent(new Event("kpjk-error-log"));
  } catch {
    // 저장소가 막힌 브라우저 — 기록만 못 할 뿐 화면은 계속 동작해야 한다
  }
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("kpjk-error-log"));
  } catch {}
}

/** 개발자에게 그대로 붙여 넣을 수 있는 글 */
export function errorReport(list: ErrorEntry[]): string {
  const head = `KPJK AX 화면 오류 ${list.length}건 · ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`;
  const rows = list.map((e) => `- ${e.at} [${e.kind}] ${e.path}\n  ${e.message}${e.digest ? ` (번호 ${e.digest})` : ""}`);
  return [head, ...rows].join("\n");
}
