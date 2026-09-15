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
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (typeof item !== "object" || item === null || !("str" in item)) continue;
      const it = item as { str: string; transform: number[]; hasEOL?: boolean };
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; }
      line += (line && !line.endsWith(" ") ? " " : "") + it.str;
      lastY = y;
      if (it.hasEOL) { lines.push(line); line = ""; lastY = null; }
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
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  await task.destroy();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

async function ocrImage(input: Blob, onProgress?: ProgressFn): Promise<string> {
  onProgress?.(0, "한글 인식 준비 중 — 처음 한 번은 언어 데이터를 내려받아 시간이 걸립니다");
  let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("kor+eng", undefined, {
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status === "recognizing text") onProgress?.(m.progress ?? 0, "글자 읽는 중");
      },
    });
  } catch {
    // 언어 데이터·인식 모듈은 인터넷에서 받는다. 못 받으면 왜 안 되는지 말한다 — "파일을 읽지 못했습니다"로 뭉개지 않는다.
    throw new Error("사진 글자 인식 모듈을 내려받지 못했습니다. 인터넷 연결을 확인하거나, PDF 파일 또는 글자 붙여넣기로 시도해 보세요.");
  }
  try {
    const { data } = await worker.recognize(input);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

/** 한글이 20자 이상이면 텍스트 PDF로 본다 */
function hasEnoughText(text: string) {
  return (text.match(/[가-힣]/g) ?? []).length >= 20;
}

export async function extractTextFromFile(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  if (file.size > MAX_DOC_BYTES) throw new Error("15MB를 넘는 파일은 읽지 않습니다.");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    onProgress?.(0, "PDF 여는 중");
    const { text, pages } = await extractPdfText(file, onProgress);
    if (hasEnoughText(text)) return { text, method: "pdf_text", pages };
    onProgress?.(0, "스캔본으로 보입니다 — 첫 장을 글자 인식으로 읽습니다");
    const png = await renderPdfFirstPage(file);
    if (!png) return { text, method: "pdf_text", pages };
    return { text: await ocrImage(png, onProgress), method: "ocr", pages };
  }
  if (!/^image\//.test(file.type)) throw new Error("PDF 또는 사진(JPG·PNG)만 읽을 수 있습니다.");
  onProgress?.(0, "사진 여는 중");
  return { text: await ocrImage(file, onProgress), method: "ocr" };
}
