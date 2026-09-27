// 타이틀·설명 카드 — 앱과 같은 Pretendard, KPJK Signature 색으로 그린다
const BASE = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1440px;height:810px;overflow:hidden;font-family:"Pretendard Variable",Pretendard,sans-serif;-webkit-font-smoothing:antialiased;word-break:keep-all}
.dark{background:radial-gradient(1200px 700px at 78% 10%,#2a2f37 0%,#171b20 60%);color:#fff}
.light{background:#fafaf8;color:#171b20}
.in{opacity:0;transform:translateY(14px);animation:in .7s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes in{to{opacity:1;transform:none}}
.eb{font-size:17px;font-weight:700;letter-spacing:.16em;color:#e8b89a}
.logo{display:inline-flex;align-items:center;justify-content:center;width:62px;height:62px;border-radius:16px;background:#fff;color:#171b20;font-weight:900;font-size:17px;letter-spacing:.02em}
`;
const d = (i, step = 0.16, start = 0.15) => `animation-delay:${(start + i * step).toFixed(2)}s`;

export function titleCard({ eyebrow, title, sub, foot }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
  .wrap{height:810px;padding:0 120px;display:flex;flex-direction:column;justify-content:center}
  h1{font-size:70px;font-weight:800;line-height:1.18;letter-spacing:-.025em;margin-top:26px}
  h1 em{font-style:normal;color:#e8a06a}
  p.sub{margin-top:30px;font-size:24px;line-height:1.55;color:rgba(255,255,255,.72);font-weight:500;max-width:1050px}
  .foot{position:absolute;left:120px;bottom:54px;font-size:17px;color:rgba(255,255,255,.62);font-weight:500}
  .bar{width:64px;height:5px;border-radius:3px;background:#d47a4a;margin-top:34px}
  </style></head><body class="dark"><div class="wrap">
    <div class="in" style="${d(0)}"><span class="logo">KPJK</span></div>
    <div class="eb in" style="${d(1)};margin-top:30px">${eyebrow}</div>
    <h1 class="in" style="${d(2)}">${title}</h1>
    <div class="bar in" style="${d(3)}"></div>
    ${sub ? `<p class="sub in" style="${d(4)}">${sub}</p>` : ''}
  </div>${foot ? `<div class="foot in" style="${d(6)}">${foot}</div>` : ''}</body></html>`;
}

/** 도입 전 업무 흐름 — Why AX 화면의 "현재 업무 흐름"과 같은 7단계 */
export function problemCard({ heading, steps, conclusion, note, issues }) {
  const chips = steps.map((s, i) => `
    <div class="step in" style="${d(i, 0.22, 0.5)}"><div class="nm">${s[0]}</div><div class="tool">${s[1]}</div></div>
    ${i < steps.length - 1 ? `<div class="arr in" style="${d(i, 0.22, 0.6)}">→</div>` : ''}`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
  .wrap{height:810px;padding:78px 96px 0}
  .eb{color:#b75b2a}
  .iss{margin-top:40px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .is{background:#fff;border:1.5px solid #f0d5cf;border-radius:14px;padding:16px 18px;font-size:19px;font-weight:650;line-height:1.4;display:flex;gap:10px;align-items:flex-start}
  .is i{flex-shrink:0;width:9px;height:9px;border-radius:50%;background:#b3261e;margin-top:9px}
  h2{font-size:50px;font-weight:800;letter-spacing:-.02em;margin-top:18px}
  .flow{display:flex;align-items:center;gap:10px;margin-top:62px}
  .step{flex:1;min-width:0;background:#fff;border:1.5px solid #e2e5e9;border-radius:16px;padding:20px 10px 18px;text-align:center;box-shadow:0 1px 2px rgba(23,27,32,.04),0 6px 18px rgba(23,27,32,.05)}
  .nm{font-size:21px;font-weight:750;letter-spacing:-.01em}
  .tool{margin-top:10px;display:inline-block;font-size:15.5px;font-weight:700;color:#a8322a;background:#fbe9e7;border-radius:999px;padding:4px 11px}
  .arr{font-size:24px;color:#9aa2ab;font-weight:700}
  .con{margin-top:54px;font-size:34px;font-weight:750;line-height:1.45;letter-spacing:-.015em}
  .con b{color:#b75b2a}
  .note{margin-top:18px;font-size:19px;color:#5c6570;font-weight:500}
  </style></head><body class="light"><div class="wrap">
    <div class="eb in" style="${d(0)}">BEFORE</div>
    <h2 class="in" style="${d(1)}">${heading}</h2>
    <div class="flow">${chips}</div>
    <div class="con in" style="${d(0, 0, 0.6 + steps.length * 0.22 + 0.4)}">${conclusion}</div>
    ${note ? `<div class="note in" style="${d(0, 0, 0.6 + steps.length * 0.22 + 0.9)}">${note}</div>` : ''}
    ${issues ? `<div class="iss">${issues.map((t, i) => `<div class="is in" style="${d(i, 0.15, 0.6 + steps.length * 0.22 + 1.0)}"><i></i>${t}</div>`).join('')}</div>` : ''}
  </div></body></html>`;
}

export function endCard({ title, items, foot }) {
  const li = items.map((t, i) => `<div class="it in" style="${d(i, 0.18, 0.55)}"><span class="ck">✓</span>${t}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
  .wrap{height:810px;padding:0 120px;display:flex;flex-direction:column;justify-content:center}
  h1{font-size:58px;font-weight:800;letter-spacing:-.02em;margin-top:24px}
  .items{margin-top:44px;display:flex;flex-direction:column;gap:18px}
  .it{font-size:27px;font-weight:600;color:rgba(255,255,255,.9);display:flex;align-items:center;gap:16px}
  .ck{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#d47a4a;color:#fff;font-size:18px;font-weight:800}
  .foot{position:absolute;left:120px;right:120px;bottom:52px;font-size:16px;color:rgba(255,255,255,.58);font-weight:500;line-height:1.6}
  </style></head><body class="dark"><div class="wrap">
    <div class="in" style="${d(0)}"><span class="logo">KPJK</span></div>
    <h1 class="in" style="${d(1)}">${title}</h1>
    <div class="items">${li}</div>
  </div>${foot ? `<div class="foot in" style="${d(0, 0, 0.55 + items.length * 0.18 + 0.4)}">${foot}</div>` : ''}</body></html>`;
}

/** 휴대폰 화면 — 실제 앱을 390px 폭 iframe 으로 띄운다 */
export function phoneCard({ src, heading, lines }) {
  const li = (lines || []).map((t, i) => `<div class="ln in" style="${d(i, 0.2, 0.7)}">${t}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
  body{display:flex;align-items:center;justify-content:center;gap:90px;padding:0 110px}
  .phone{width:390px;height:760px;border-radius:52px;background:#15181c;padding:12px;box-shadow:0 30px 80px rgba(23,27,32,.28),0 0 0 2px #2a2f37 inset;flex-shrink:0}
  .screen{width:366px;height:736px;border-radius:41px;overflow:hidden;background:#fff;position:relative}
  iframe{width:390px;height:790px;border:0;transform:scale(.9385);transform-origin:0 0}
  .txt{flex:1;max-width:560px}
  .eb{color:#b75b2a}
  h2{font-size:46px;font-weight:800;letter-spacing:-.02em;line-height:1.25;margin-top:16px}
  .ln{margin-top:20px;font-size:23px;font-weight:600;color:#3d454e;line-height:1.5}
  </style></head><body class="light">
    <div class="phone in" style="${d(0)}"><div class="screen"><iframe id="f" src="${src}"></iframe></div></div>
    <div class="txt"><div class="eb in" style="${d(1)}">MOBILE</div><h2 class="in" style="${d(2)}">${heading}</h2>${li}</div>
  </body></html>`;
}
