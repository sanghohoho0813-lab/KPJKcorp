import { chromium } from 'playwright';
const [,, out, w, cols, ...files] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await b.newPage({ viewport: { width: +w * +cols + 20, height: 800 } });
const html=`<body style="margin:0;background:#333;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:4px;font:14px sans-serif;color:#fff">${files.map(f=>`<div><div>${f.split('/').pop()}</div><img src="file://${f}" style="width:${w}px"></div>`).join('')}</body>`; (await import('node:fs')).writeFileSync(out+'.html', html); await p.goto('file://'+out+'.html');
await p.waitForTimeout(800);
await p.screenshot({ path: out, fullPage: true });
await b.close();
