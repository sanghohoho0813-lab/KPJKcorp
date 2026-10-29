// 「기술시험 및 개선결과보고서」 PDF · Word — 같은 원고(content.mjs) · 같은 숫자(results.json)에서 만든다.
//   node tools/appeal-test/report/build.mjs <증빙 폴더> <그림 폴더> <출력 폴더> <글꼴 폴더(NotoSansKR-400/500/700/800.ttf)>
import fs from 'node:fs';
import path from 'node:path';
import { pages } from './content.mjs';
const [E, IMG, OUT, FONTS] = process.argv.slice(2).map((x) => path.resolve(x));
const R = JSON.parse(fs.readFileSync(`${E}/results.json`, 'utf-8'));
const P = pages(R);
const NAME = 'KPJK_기술시험_및_개선결과보고서';
fs.mkdirSync(`${OUT}/img`, { recursive: true });
for (const f of fs.readdirSync(IMG)) fs.copyFileSync(`${IMG}/${f}`, `${OUT}/img/${f}`);
const NAVY = '#142850';

// ---------------------------------------------------------------- HTML → PDF
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
function block(b) {
  if (b.title) return `<header class="cover"><div class="eyebrow">${esc(b.meta[0])}</div><h1>${esc(b.title)}</h1><div class="sub">${esc(b.sub)}</div><div class="meta">${esc(b.meta[1])} · (주)KPJK코퍼레이션</div></header>`;
  if (b.h) return b.big ? `<h2 class="pageh">${esc(b.h)}</h2>` : `<h3 class="${b.small ? 'h4' : ''}">${esc(b.h)}</h3>`;
  if (b.p) return `<p>${rich(b.p)}</p>`;
  if (b.small) return `<p class="small">${rich(b.small)}</p>`;
  if (b.ul) return `<ul>${b.ul.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>`;
  if (b.note) return `<div class="note">${rich(b.note)}</div>`;
  if (b.flow) return `<div class="flow">${b.flow.map((x, i) => `<span class="fb"><i>${i + 1}</i>${esc(x)}</span>`).join('<span class="arr">→</span>')}</div>`;
  if (b.grid) return `<div class="grid">${b.grid.map((x) => `<div><b>${esc(x[0])}</b>${esc(x[1])}</div>`).join('')}</div>`;
  if (b.stats) return `<div class="stats">${b.stats.map((x) => `<div><b>${esc(x.v)}</b><span>${esc(x.l)}</span></div>`).join('')}</div>`;
  if (b.code) return `<figure class="code"><pre>${b.code.map(esc).join('\n')}</pre><figcaption>${esc(b.cap)}</figcaption></figure>`;
  if (b.imgs) return `<div class="imgs c${b.cols}">${b.imgs.map((x) => `<figure><img src="${x.src}"><figcaption>${esc(x.cap)}</figcaption></figure>`).join('')}</div>`;
  if (b.table) {
    const t = b.table;
    return `<table class="${t.small ? 'sm' : ''}${t.total ? ' total' : ''}"><colgroup>${t.cols.map((c) => `<col style="width:${c[1]}%">`).join('')}</colgroup><thead><tr>${t.cols.map((c) => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${rich(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  throw new Error('모르는 블록 ' + JSON.stringify(b).slice(0, 80));
}
const font = (w) => `@font-face{font-family:'Noto Sans KR';font-weight:${w};src:url('file://${FONTS}/NotoSansKR-${w}.ttf')}`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${NAME}</title><style>
${[400, 500, 700, 800].map(font).join('\n')}
@page{size:A4;margin:14mm 15mm 15mm 15mm}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:#1d2330;font-family:'Noto Sans KR',sans-serif;font-size:10.2pt;line-height:1.55;word-break:keep-all;overflow-wrap:break-word}
section.page{break-after:page}
section.page:last-child{break-after:auto}
header.cover{border-top:5px solid ${NAVY};padding-top:4mm;margin-bottom:3mm}
.eyebrow{font-size:9.4pt;font-weight:700;color:${NAVY};letter-spacing:.02em}
h1{font-size:21pt;font-weight:800;color:${NAVY};margin:1.5mm 0 1mm;letter-spacing:-.01em}
.sub{font-size:12pt;font-weight:500;color:#2b3446}
.meta{font-size:9pt;color:#5a6478;margin-top:1.5mm}
h2.pageh{font-size:16pt;font-weight:800;color:${NAVY};margin:0 0 3.5mm;padding-bottom:2mm;border-bottom:2px solid ${NAVY}}
h3{font-size:12.2pt;font-weight:700;color:${NAVY};margin:3.1mm 0 1.3mm}
h3.h4{font-size:11pt;margin:3.6mm 0 1.4mm}
p{margin:0 0 2mm}
p.small{font-size:8.8pt;color:#4d5668;margin:1.6mm 0 0}
ul{margin:0 0 1mm;padding-left:5mm}
li{margin:0 0 1.2mm}
b{font-weight:700;color:#101828}
table{width:100%;border-collapse:collapse;margin:1mm 0 1.5mm;font-size:9.5pt;line-height:1.45}
table.sm{font-size:8.7pt}
th{background:#eef2f8;color:${NAVY};font-weight:700;text-align:left;padding:1.6mm 2mm;border-top:1.5px solid ${NAVY};border-bottom:1px solid #b9c3d3}
td{padding:1.5mm 2mm;border-bottom:1px solid #d9dee7;vertical-align:top}
td:first-child{font-weight:700;color:#1b2740}
table.total tr:last-child td{font-weight:800;color:${NAVY};border-top:1.5px solid ${NAVY};background:#f6f8fb}
.flow{display:flex;align-items:center;flex-wrap:nowrap;gap:1.2mm;margin:1.5mm 0 0}
.fb{flex:1;border:1.4px solid ${NAVY};border-radius:2mm;padding:1.6mm 1.5mm;text-align:center;font-weight:700;color:${NAVY};font-size:9.6pt;line-height:1.3}
.fb i{display:block;font-style:normal;font-size:8pt;color:#5a6478;font-weight:500}
.arr{color:${NAVY};font-weight:700}
.stats{display:flex;gap:3mm;margin:0 0 1mm}
.stats div{flex:1;border:1px solid #c9d1de;border-top:3px solid ${NAVY};padding:2mm 3mm}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.4mm;margin:1.6mm 0 0}
.grid div{border:1px solid #d3d9e3;border-radius:1.2mm;padding:1.3mm 2.2mm;font-size:8.9pt;line-height:1.35}
.grid b{color:${NAVY};margin-right:1.6mm}
.stats b{display:block;font-size:18pt;font-weight:800;color:${NAVY};line-height:1.2}
.stats span{font-size:8.4pt;color:#3c4558;white-space:nowrap}
.imgs{display:grid;gap:2.5mm;margin:1mm 0 2mm;align-items:start}
.imgs.c4{grid-template-columns:repeat(4,1fr)}
.imgs.c2{grid-template-columns:1fr 1fr}
.imgs.c1{grid-template-columns:1fr}
figure{margin:0}
.imgs img{width:100%;display:block;border:1px solid #cfd6e1;border-radius:1mm}
figcaption{font-size:7.9pt;color:#4d5668;margin-top:.8mm;line-height:1.35}
.note{border-left:3px solid ${NAVY};background:#f4f6fa;padding:2mm 3mm;font-size:8.9pt;margin-top:2.5mm}
figure.code{margin:2.5mm 0 0}
pre{margin:0;background:#f4f6fa;border:1px solid #d9dee7;padding:2mm 2.5mm;font-family:'DejaVu Sans Mono','Noto Sans KR',monospace;font-size:7.3pt;line-height:1.5;white-space:pre}
</style></head><body>
${P.map((pg) => `<section class="page">${pg.map(block).join('\n')}</section>`).join('\n')}
</body></html>`;
fs.writeFileSync(`${OUT}/${NAME}.html`, html);
const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const SANDBOX = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const br = await pw.chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync(SANDBOX) ? SANDBOX : undefined) });
const pg = await br.newPage();
await pg.goto('file://' + `${OUT}/${NAME}.html`, { waitUntil: 'load' });
await pg.evaluate(() => document.fonts.ready);
const missing = await pg.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src));
if (missing.length) throw new Error('그림 없음 ' + missing.join(', '));
await pg.pdf({ path: `${OUT}/${NAME}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-family:'Noto Sans KR',sans-serif;font-size:7.5pt;color:#6b7486;padding:0 15mm;display:flex;justify-content:space-between"><span>(주)KPJK코퍼레이션 · 기술시험 및 개선결과보고서 · 코드 버전 ${R.commitShort}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` });
await br.close();

// ---------------------------------------------------------------- DOCX
// docx(npm) — 저장소 의존성에 넣지 않는다. 이 컴퓨터에 깔린 것을 찾아 쓴다(DOCX_PATH 로 지정 가능)
const { createRequire } = await import('node:module');
const D = (() => {
  for (const base of [process.env.DOCX_PATH, '/opt/node-tools/node_modules', '/opt/node22/lib/node_modules', process.cwd() + '/node_modules'].filter(Boolean)) {
    try { return createRequire(base + '/')('docx'); } catch { /* 다음 */ }
  }
  throw new Error('docx 모듈을 찾지 못했습니다 — DOCX_PATH 로 위치를 알려 주세요');
})();
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, ImageRun, AlignmentType, Footer, PageNumber, LevelFormat, VerticalAlign, TableLayoutType } = D;
const FONT = { ascii: 'Noto Sans KR', eastAsia: 'Noto Sans KR', hAnsi: 'Noto Sans KR', cs: 'Noto Sans KR' };
const NV = '142850';
const W = 11906 - 2 * 850;                       // A4 폭 - 좌우 여백(15mm) = 본문 폭(DXA)
const runs = (s, o = {}) => String(s).split(/(\*\*.+?\*\*)/).filter(Boolean).map((part) => new TextRun({ text: part.replace(/^\*\*|\*\*$/g, ''), bold: o.bold || /^\*\*/.test(part), size: o.size, color: o.color, font: o.font ?? FONT }));
const para = (s, o = {}) => String(s).split('\n').map((line) => new Paragraph({ children: runs(line, o), spacing: { after: o.after ?? 60, lineRule: 'auto', line: o.line ?? 300 }, alignment: o.align, keepNext: o.keepNext }));
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const line = (c = 'D9DEE7', sz = 4) => ({ style: BorderStyle.SINGLE, size: sz, color: c });
function cell(text, w, o = {}) {
  return new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: o.vAlign ?? VerticalAlign.TOP, margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    borders: o.borders ?? { top: o.top ?? line(), bottom: line(), left: none, right: none },
    children: Array.isArray(text) ? text : para(text, { size: o.size, bold: o.bold, color: o.color, after: 10, lineRule: 'auto', line: 255, align: o.align }) });
}
const gap = () => Object.assign(new Paragraph({ children: [new TextRun({ text: '', size: 8 })], spacing: { before: 0, after: 60, lineRule: 'auto', line: 120 } }), { _gap: true });   // 표 뒤 작은 간격(빈 줄 높이를 줄임)
const pxOf = (file) => { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const docBlocks = [];
P.forEach((pgBlocks, pi) => {
  pgBlocks.forEach((b, bi) => {
    const first = bi === 0 && pi > 0;
    const out = [];
    if (b.title) {
      out.push(new Paragraph({ children: runs(b.meta[0], { size: 19, bold: true, color: NV }), border: { top: { style: BorderStyle.SINGLE, size: 24, color: NV, space: 8 } }, spacing: { after: 60 } }));
      out.push(new Paragraph({ children: runs(b.title, { size: 44, bold: true, color: NV }), spacing: { after: 40 } }));
      out.push(new Paragraph({ children: runs(b.sub, { size: 24, color: '2B3446' }), spacing: { after: 40 } }));
      out.push(new Paragraph({ children: runs(`${b.meta[1]} · (주)KPJK코퍼레이션`, { size: 18, color: '5A6478' }), spacing: { after: 120 } }));
    } else if (b.h) {
      out.push(new Paragraph({ children: runs(b.h, { size: b.big ? 32 : b.small ? 22 : 25, bold: true, color: NV }), keepNext: true, pageBreakBefore: first, spacing: { before: b.big ? 0 : 150, after: b.big ? 140 : 60 },
        border: b.big ? { bottom: { style: BorderStyle.SINGLE, size: 12, color: NV, space: 4 } } : undefined }));
    } else if (b.p) out.push(...para(b.p, { size: 20 }));
    else if (b.small) out.push(...para(b.small, { size: 17, color: '4D5668' }));
    else if (b.ul) b.ul.forEach((x) => out.push(new Paragraph({ children: runs(x, { size: 19 }), numbering: { reference: 'dot', level: 0 }, spacing: { after: 50, lineRule: 'auto', line: 290 } })));
    else if (b.note) out.push(new Paragraph({ children: runs(b.note, { size: 17 }), shading: { type: ShadingType.CLEAR, fill: 'F4F6FA', color: 'auto' }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: NV, space: 6 } }, spacing: { before: 120, after: 60, lineRule: 'auto', line: 280 } }));
    else if (b.code) {
      b.code.forEach((l) => out.push(new Paragraph({ children: [new TextRun({ text: l, size: 13, font: { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: 'Noto Sans KR' } })], shading: { type: ShadingType.CLEAR, fill: 'F4F6FA', color: 'auto' }, spacing: { after: 0, lineRule: 'auto', line: 240 } })));
      out.push(...para(b.cap, { size: 15, color: '4D5668', after: 80 }));
    } else if (b.flow) {
      const k = b.flow.length, aw = 300, bw = Math.floor((W - aw * (k - 1)) / k);
      const cols = []; b.flow.forEach((_, i) => { cols.push(bw); if (i < k - 1) cols.push(aw); });
      const cells = []; b.flow.forEach((x, i) => {
        cells.push(cell([new Paragraph({ alignment: AlignmentType.CENTER, children: runs(String(i + 1), { size: 15, color: '5A6478' }), spacing: { after: 0 } }), new Paragraph({ alignment: AlignmentType.CENTER, children: runs(x, { size: 18, bold: true, color: NV }), spacing: { after: 0 } })], bw,
          { vAlign: VerticalAlign.CENTER, borders: { top: line(NV, 10), bottom: line(NV, 10), left: line(NV, 10), right: line(NV, 10) } }));
        if (i < k - 1) cells.push(cell([new Paragraph({ alignment: AlignmentType.CENTER, children: runs('→', { size: 20, bold: true, color: NV }) })], aw, { vAlign: VerticalAlign.CENTER, borders: { top: none, bottom: none, left: none, right: none } }));
      });
      out.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED, rows: [new TableRow({ children: cells })] }));
      out.push(gap());
    } else if (b.grid) {
      const w = Math.floor(W / 3); const rows = [];
      for (let i = 0; i < b.grid.length; i += 3) rows.push(new TableRow({ children: b.grid.slice(i, i + 3).map((x) => cell([new Paragraph({ children: [...runs(x[0] + '  ', { size: 17, bold: true, color: NV }), ...runs(x[1], { size: 17 })], spacing: { after: 0 } })], w, { borders: { top: line('D3D9E3'), bottom: line('D3D9E3'), left: line('D3D9E3'), right: line('D3D9E3') } })) }));
      out.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [w, w, w], layout: TableLayoutType.FIXED, rows }));
    } else if (b.stats) {
      const w = Math.floor(W / b.stats.length);
      out.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: b.stats.map(() => w), layout: TableLayoutType.FIXED, rows: [new TableRow({ children: b.stats.map((x) =>
        cell([new Paragraph({ children: runs(x.v, { size: 34, bold: true, color: NV }), spacing: { after: 0 } }), ...para(x.l, { size: 17, color: '3C4558', after: 0 })], w, { borders: { top: line(NV, 18), bottom: line('C9D1DE'), left: line('C9D1DE'), right: line('C9D1DE') } })) })] }));
    } else if (b.imgs) {
      const per = Math.floor(W / b.cols), maxPx = Math.floor((per - 160) / 15);   // DXA → px(96dpi): 1px = 15 DXA
      const row = b.imgs.map((x) => {
        const file = `${OUT}/${x.src}`; const { w, h } = pxOf(file);
        const dw = maxPx, dh = Math.round((h * dw) / w);
        return cell([new Paragraph({ children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width: dw, height: dh } })], spacing: { after: 30 } }), ...para(x.cap, { size: 15, color: '4D5668', after: 0, lineRule: 'auto', line: 240 })], per, { borders: { top: none, bottom: none, left: none, right: none } });
      });
      out.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: b.imgs.map(() => per), layout: TableLayoutType.FIXED, rows: [new TableRow({ children: row })] }));
    } else if (b.table) {
      const t = b.table, ws = t.cols.map((c) => Math.round((W * c[1]) / 100)); ws[ws.length - 1] = W - ws.slice(0, -1).reduce((a, x) => a + x, 0);
      const sz = t.small ? 16 : 18;
      const head = new TableRow({ tableHeader: true, children: t.cols.map((c, i) => cell(c[0], ws[i], { fill: 'EEF2F8', bold: true, color: NV, size: sz, top: line(NV, 12) })) });
      const body = t.rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, ws[i], { size: sz, bold: i === 0 || (t.total && ri === t.rows.length - 1), color: i === 0 ? '1B2740' : undefined, fill: t.total && ri === t.rows.length - 1 ? 'F6F8FB' : undefined })) }));
      out.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: ws, layout: TableLayoutType.FIXED, rows: [head, ...body] }));
      out.push(gap());
    }
    if (bi === pgBlocks.length - 1 && out.at(-1)?._gap) out.pop();   // 쪽 끝의 간격은 빼서 빈 쪽이 생기지 않게
    if (first && !b.h) docBlocks.push(new Paragraph({ pageBreakBefore: true, children: [] }));   // 제목으로 시작하지 않는 쪽
    docBlocks.push(...out);
  });
});
const doc = new Document({
  creator: '(주)KPJK코퍼레이션', title: '기술시험 및 개선결과보고서', description: `코드 버전 ${R.commit}`,
  styles: { default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { lineRule: 'auto', line: 300 } } } } },
  numbering: { config: [{ reference: 'dot', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 800, bottom: 850, left: 850, right: 850, footer: 400 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `(주)KPJK코퍼레이션 · 기술시험 및 개선결과보고서 · 코드 버전 ${R.commitShort}   `, size: 15, color: '6B7486', font: FONT }), new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 15, color: '6B7486', font: FONT })] })] }) },
    children: docBlocks,
  }],
});
fs.writeFileSync(`${OUT}/${NAME}.docx`, await Packer.toBuffer(doc));
console.log('PDF', `${OUT}/${NAME}.pdf`); console.log('DOCX', `${OUT}/${NAME}.docx`);
