/**
 * 올린 파일에서 글자를 뽑는다.
 *
 *  - PDF: 내장 텍스트를 먼저 읽는다. 홈택스·인터넷등기소 PDF는 텍스트라 거의 정확하다.
 *         글자가 거의 없으면 스캔본으로 보고 첫 장을 그림으로 만들어 OCR로 넘긴다.
 *  - 사진(JPG·PNG): 한국어 OCR. 흐리거나 기울면 못 읽는다 — 그 사실을 숨기지 않는다.
 *
 * 두 라이브러리 모두 실제로 쓸 때만 내려받는다(동적 import). 등록 화면을 여는 것만으로는 용량이 늘지 않는다.
 * OCR 언어 데이터는 tesseract.js 기본 CDN에서 처음 한 번 내려받는다 — 오프라인에서는 사진 인식이 되지 않는다.
 */

export type ExtractMethod = "pdf_text" | "ocr";

export interface ExtractResult {
  text: string;
  method: ExtractMethod;
  pages?: number;
  /** 한글 전용으로 한 번 더 읽은 결과 (사람 이름·상호·주소용). 숫자는 text 쪽이 정확하다 */
  alt?: string;
}

export interface ExtractOptions {
  /** 사진 글자 인식일 때 한글 전용으로 한 번 더 읽는다 — 약 4초 더 걸리지만 이름 받침 오류가 줄어든다 */
  namePass?: boolean;
}

export type ProgressFn = (ratio: number, label: string) => void;

export const EXTRACT_METHOD_LABEL: Record<ExtractMethod | "paste", string> = {
  pdf_text: "PDF 글자 추출",
  ocr: "사진 글자 인식(OCR)",
  paste: "붙여넣기",
};

export const ACCEPT_DOC = ".pdf,image/png,image/jpeg,image/webp";
export const MAX_DOC_BYTES = 15 * 1024 * 1024;

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc && !pdfjs.GlobalWorkerOptions.workerPort) {
    // 워커를 번들에 포함한다 — CDN 의존 없음. Next(Turbopack)는 new URL(..., import.meta.url)을 정적 자산으로 처리한다.
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  }
  return pdfjs;
}

async function extractPdfText(file: File, onProgress?: ProgressFn): Promise<{ text: string; pages: number }> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: buf });
  const doc = await task.promise;
  const maxPages = Math.min(doc.numPages, 10);
  const chunks: string[] = [];
  for (let i = 1; i <= maxPages; i += 1) {
    onProgress?.(i / maxPages, `PDF ${i}/${maxPages}쪽 읽는 중`);
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // 같은 줄(y 좌표가 같은 글자)은 붙이고, 줄이 바뀌면 개행한다 — 라벨과 값을 한 줄로 유지하기 위해서다.
    // 같은 줄 안에서 글자 사이가 크게 벌어지면(사업자등록증의 업태 | 종목 두 칸) 공백 여러 개로 남긴다 — 칸을 나눌 근거다.
    let lastY: number | null = null;
    let lastEnd: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (typeof item !== "object" || item === null || !("str" in item)) continue;
      const it = item as { str: string; transform: number[]; width?: number; hasEOL?: boolean };
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; lastEnd = null; }
      const x = it.transform[4];
      const fontH = Math.abs(it.transform[3]) || 10;
      const wide = lastEnd !== null && x - lastEnd > fontH * 2.5;
      line += line ? (wide ? "     " : line.endsWith(" ") ? "" : " ") : "";
      line += it.str;
      lastY = y;
      lastEnd = typeof it.width === "number" ? x + it.width : null;
      if (it.hasEOL) { lines.push(line); line = ""; lastY = null; lastEnd = null; }
    }
    if (line) lines.push(line);
    chunks.push(lines.join("\n"));
  }
  const pages = doc.numPages;
  await task.destroy();
  return { text: chunks.join("\n"), pages };
}

async function renderPdfFirstPage(file: File): Promise<Blob | null> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: buf });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  // 본문 글자 높이가 30px 안팎이 되도록(인식률이 가장 좋은 크기) 3배로 그린다. A4 기준 가로 약 1,790px
  const viewport = page.getViewport({ scale: 3 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  await task.destroy();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/**
 * 글자 인식 전 손질 — 작은 사진은 키우고, 흑백으로 바꿔 명암을 넓힌다.
 *
 * 왜: 화면 캡처·저해상도 PDF는 글자가 10px 안팎이라 한글 받침이 뭉개진다("명"→"멍", "염"→"열").
 * 3배로 키우고 회색조 명암만 넓히면 같은 문서에서 상호·대표자명이 바로 읽혔다(2026-10-01 실측).
 * 검은/흰색 두 값으로 자르는(이진화) 방법은 가는 획이 끊겨 오히려 나빠서 쓰지 않는다.
 */
async function prepareForOcr(input: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return input;
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(input); } catch { return input; }
  const TARGET = 1800;
  const scale = bmp.width < TARGET ? Math.min(3, TARGET / bmp.width) : 1;
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  if (w * h > 40_000_000) { bmp.close(); return input; }        // 너무 큰 사진은 그대로
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) { bmp.close(); return input; }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = g; hist[g | 0] += 1;
  }
  // 위아래 1% 를 버리고 명암을 0~255 로 넓힌다
  const total = w * h; let acc = 0; let lo = 0; let hi = 255;
  for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= total * 0.01) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v -= 1) { acc += hist[v]; if (acc >= total * 0.01) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? input), "image/png"));
}

/**
 * 두 번 읽는 이유 (2026-10-01 실제 사업자등록증으로 확인):
 *  - 한글+영문 모델은 숫자(사업자·법인번호)를 정확히 읽지만 이름 받침을 자주 틀린다("염"→"열").
 *  - 한글 전용 모델은 이름·상호를 정확히 읽지만 숫자 한 자리를 틀렸다.
 * 그래서 숫자는 첫 번째, 이름·주소·업태는 두 번째 결과를 쓴다(docparse.parseExtracted).
 */
async function ocrImage(raw: Blob, onProgress?: ProgressFn, opts: ExtractOptions = {}): Promise<{ text: string; alt?: string }> {
  const input = await prepareForOcr(raw);
  onProgress?.(0, "한글 인식 준비 중 — 처음 한 번은 언어 데이터를 내려받아 시간이 걸립니다");
  let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
  let label = "글자 읽는 중";
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("kor+eng", undefined, {
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status === "recognizing text") onProgress?.(m.progress ?? 0, label);
      },
    });
  } catch {
    // 언어 데이터·인식 모듈은 인터넷에서 받는다. 못 받으면 왜 안 되는지 말한다 — "파일을 읽지 못했습니다"로 뭉개지 않는다.
    throw new Error("사진 글자 인식 모듈을 내려받지 못했습니다. 인터넷 연결을 확인하거나, PDF 파일 또는 글자 붙여넣기로 시도해 보세요.");
  }
  try {
    const { data } = await worker.recognize(input);
    const text = data.text ?? "";
    if (!opts.namePass) return { text };
    try {
      label = "이름·주소 한 번 더 확인 중";
      await worker.reinitialize("kor");
      const second = await worker.recognize(input);
      return { text, alt: second.data.text ?? "" };
    } catch {
      return { text };   // 두 번째가 실패해도 첫 번째 결과는 쓴다
    }
  } finally {
    await worker.terminate();
  }
}

/** 한글이 20자 이상이면 텍스트 PDF로 본다 */
function hasEnoughText(text: string) {
  return (text.match(/[가-힣]/g) ?? []).length >= 20;
}

export async function extractTextFromFile(file: File, onProgress?: ProgressFn, opts: ExtractOptions = {}): Promise<ExtractResult> {
  if (file.size > MAX_DOC_BYTES) throw new Error("15MB를 넘는 파일은 읽지 않습니다.");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    onProgress?.(0, "PDF 여는 중");
    const { text, pages } = await extractPdfText(file, onProgress);
    if (hasEnoughText(text)) return { text, method: "pdf_text", pages };
    onProgress?.(0, "스캔본으로 보입니다 — 첫 장을 글자 인식으로 읽습니다");
    const png = await renderPdfFirstPage(file);
    if (!png) return { text, method: "pdf_text", pages };
    return { ...(await ocrImage(png, onProgress, opts)), method: "ocr", pages };
  }
  if (!/^image\//.test(file.type)) throw new Error("PDF 또는 사진(JPG·PNG)만 읽을 수 있습니다.");
  onProgress?.(0, "사진 여는 중");
  return { ...(await ocrImage(file, onProgress, opts)), method: "ocr" };
}
