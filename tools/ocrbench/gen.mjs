// 시험용 사업자등록증 그림 만들기 — 값은 전부 지어낸 것(검증번호만 규칙에 맞춤)
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'fs';
const OUT = '/var/tmp/ocrbench/docs'; fs.mkdirSync(OUT, { recursive: true });
const rnd = (n) => Math.floor(Math.random() * n);
let seed = 7; Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const biz = (mid) => { for (;;) { const d = [rnd(9) + 1, rnd(10), rnd(10), ...mid.split('').map(Number), rnd(10), rnd(10), rnd(10), rnd(10)]; const w = [1, 3, 7, 1, 3, 7, 1, 3, 5]; let s = 0; for (let i = 0; i < 9; i++) s += d[i] * w[i]; s += Math.floor(d[8] * 5 / 10); const c = (10 - s % 10) % 10; const all = [...d, c].join(''); return `${all.slice(0, 3)}-${all.slice(3, 5)}-${all.slice(5)}`; } };
const corp = (pre) => { const d = (pre + Array.from({ length: 6 }, () => rnd(10)).join('')).split('').map(Number); let s = 0; for (let i = 0; i < 12; i++) s += d[i] * (i % 2 === 0 ? 1 : 2); return `${d.join('').slice(0, 6)}-${d.join('').slice(6)}${(10 - s % 10) % 10}`; };
const CO = [
  ['주식회사 한빛테크', '김민수', '제조업', '전자부품', '도매 및 소매업', '전자부품 도매'],
  ['주식회사 새봄푸드', '박지영', '음식점업', '한식 일반 음식점업', null, null],
  ['주식회사 다온물류', '최현우', '운수업', '화물자동차 운송업', '창고업', '보관 및 창고업'],
  ['주식회사 미래솔루션', '정수빈', '정보통신업', '응용 소프트웨어 개발 및 공급업', '서비스업', '컴퓨터 시스템 통합 자문'],
  ['유한회사 바른건축', '윤태호', '건설업', '실내건축 공사업', null, null],
  ['주식회사 늘푸른바이오', '강서연', '제조업', '건강기능식품 제조', '도매 및 소매업', '건강기능식품 도매'],
  ['주식회사 엔씨에스글로벌', '임재혁', '도매 및 소매업', '상품 종합 도매업', '서비스업', '무역 대리'],
  ['주식회사 하늘커피', '염승훈', '음식점업', '커피 전문점', '도매 및 소매업', '원두 도매'],
];
const SOLE = [
  ['한빛상회', '이영희', '소매업', '전자상거래 소매업', '1985 년 05 월 20 일'],
  ['다정한 꽃집', '송민지', '소매업', '꽃 소매업', '1990 년 11 월 03 일'],
  ['정밀공업사', '한동욱', '제조업', '금속 가공', '1972 년 02 월 14 일'],
  ['봄날베이커리', '오은비', '제조업', '제과점업', '1993 년 07 월 29 일'],
];
const ADDR = ['서울특별시 강남구 테헤란로 123, 4층 (역삼동)', '경기도 성남시 분당구 판교역로 235 (삼평동)', '부산광역시 해운대구 센텀중앙로 79', '경기도 남양주시 오남읍 진건오남로 812', '인천광역시 연수구 송도과학로 32', '대구광역시 수성구 달구벌대로 2311', '충청북도 청주시 흥덕구 오송읍 오송생명로 123', '경상남도 창원시 의창구 중앙대로 151'];
const TAX = ['역삼세무서장', '성남세무서장', '해운대세무서장', '남양주세무서장', '남인천세무서장', '수성세무서장', '청주세무서장', '창원세무서장'];
const date = () => `${2010 + rnd(15)} 년 ${String(1 + rnd(12)).padStart(2, '0')} 월 ${String(1 + rnd(28)).padStart(2, '0')} 일`;
const docs = [];
CO.forEach((c, i) => docs.push({ kind: 'corp', name: c[0], ceo: c[1], cat: c[2], item: c[3], cat2: c[4], item2: c[5], bizNo: biz(['81', '86', '87'][i % 3]), corpNo: corp(['110111', '131111', '284111', '180111'][i % 4]), open: date(), addr: ADDR[i % ADDR.length], tax: TAX[i % TAX.length] }));
SOLE.forEach((c, i) => docs.push({ kind: 'sole', name: c[0], ceo: c[1], cat: c[2], item: c[3], birth: c[4], bizNo: biz(String(10 + rnd(80)).padStart(2, '0')), open: date(), addr: ADDR[(i + 3) % ADDR.length], tax: TAX[(i + 3) % TAX.length] }));
const sp = (s) => s.split('').join(' ');
const css = (font) => `@import url('/var/tmp/ocrbench/node_modules/@fontsource/${font}/korean-400.css');@import url('/var/tmp/ocrbench/node_modules/@fontsource/${font}/korean-700.css');
body{margin:0;background:#fff;font-family:'${font === 'nanum-gothic' ? 'Nanum Gothic' : 'Nanum Myeongjo'}';color:#222}
.page{width:595px;height:842px;position:relative;padding:60px 56px;box-sizing:border-box;font-size:12.5px}
h1{font-size:30px;letter-spacing:10px;text-align:center;margin:40px 0 4px}.sub{text-align:center;font-size:15px;margin-bottom:10px}
.no{text-align:center;font-size:17px;margin-bottom:26px}.row{display:flex;margin:9px 0}.k{width:120px;letter-spacing:2px}.v{flex:1}
.wm{position:absolute;left:170px;top:330px;width:260px;height:260px;border-radius:50%;border:16px solid rgba(80,150,110,.18);box-sizing:border-box}
.kind{display:grid;grid-template-columns:120px 1fr 1fr;row-gap:4px;margin:12px 0}.box{border:1px solid #333;padding:0 2px;margin-right:4px}
.foot{position:absolute;left:0;right:0;bottom:120px;text-align:center}.foot b{display:block;font-size:22px;letter-spacing:8px;margin-top:10px}`;
const html = (d, font, wm) => `<html><head><style>${css(font)}</style></head><body><div class="page">${wm ? '<div class="wm"></div>' : ''}
<h1>사업자등록증</h1><div class="sub">( ${d.kind === 'corp' ? '법인사업자' : '일반과세자'} )</div><div class="no">등록번호 : ${d.bizNo}</div>
${d.kind === 'corp'
    ? `<div class="row"><span class="k">${sp('법인명')}(${sp('단체명')})</span><span class="v">: ${d.name}</span></div>
<div class="row"><span class="k">${sp('대표자')}</span><span class="v">: ${d.ceo}</span></div>
<div class="row"><span class="k">${sp('개업연월일')}</span><span class="v">: ${d.open} &nbsp;&nbsp;&nbsp; 법인등록번호 : ${d.corpNo}</span></div>
<div class="row"><span class="k">${sp('사업장 소재지')}</span><span class="v">: ${d.addr}</span></div>
<div class="row"><span class="k">${sp('본점 소재지')}</span><span class="v">: ${d.addr}</span></div>`
    : `<div class="row"><span class="k">${sp('상호')}</span><span class="v">: ${d.name}</span></div>
<div class="row"><span class="k">${sp('성명')}</span><span class="v">: ${d.ceo} &nbsp;&nbsp;&nbsp; ${sp('생년월일')} : ${d.birth}</span></div>
<div class="row"><span class="k">${sp('개업연월일')}</span><span class="v">: ${d.open}</span></div>
<div class="row"><span class="k">${sp('사업장 소재지')}</span><span class="v">: ${d.addr}</span></div>`}
<div class="kind"><span>${sp('사업의 종류')} :</span><span><span class="box">업태</span>${d.cat}</span><span><span class="box">종목</span>${d.item}</span>
${d.cat2 ? `<span></span><span>${d.cat2}</span><span>${d.item2}</span>` : ''}</div>
<div class="row"><span class="k">${sp('발급사유')}</span><span class="v">: 신규발급</span></div>
<div class="row" style="margin-top:20px"><span>사업자 단위 과세 적용사업자 여부 : 여( ) 부(V)</span></div>
<div class="foot">2024 년 07 월 04 일<b>${sp(d.tax)}</b></div></div></body></html>`;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const truth = [];
let n = 0;
for (const [i, d] of docs.entries()) {
  const font = i % 2 ? 'nanum-myeongjo' : 'nanum-gothic';
  for (const [w, wm, rot] of [[620, true, 0], [1000, i % 3 === 0, i % 2 ? 0.6 : 0]]) {
    const scale = w / 595;
    const p = await b.newPage({ viewport: { width: 595, height: 842 }, deviceScaleFactor: scale });
    fs.writeFileSync('/var/tmp/ocrbench/tmp.html', html(d, font, wm));
    await p.goto('file:///var/tmp/ocrbench/tmp.html'); await p.waitForTimeout(400);
    if (rot) await p.evaluate((r) => { document.querySelector('.page').style.transform = `rotate(${r}deg)`; }, rot);
    const f = `doc${String(++n).padStart(2, '0')}_${d.kind}_${w}${wm ? '_wm' : ''}${rot ? '_rot' : ''}.jpg`;
    await p.screenshot({ path: `${OUT}/${f}`, type: 'jpeg', quality: w < 700 ? 70 : 85 });
    await p.close();
    truth.push({ file: f, name: d.name, ceo: d.ceo, bizNo: d.bizNo, corpNo: d.corpNo, establishedAt: d.open.replace(/ 년 | 월 /g, '-').replace(/ 일/, ''), ceoBirth: d.birth ? d.birth.replace(/ 년 | 월 /g, '-').replace(/ 일/, '') : undefined, address: d.addr, bizCategory: d.cat, bizItem: d.item, bizItemsExtra: d.cat2 ? `${d.cat2} — ${d.item2}` : undefined });
  }
}
// 텍스트 PDF 1장 (홈택스 원본처럼 글자가 들어 있는 PDF)
{ const d = docs[0]; const p = await b.newPage(); fs.writeFileSync('/var/tmp/ocrbench/tmp.html', html(d, 'nanum-gothic', true)); await p.goto('file:///var/tmp/ocrbench/tmp.html'); await p.waitForTimeout(400);
  await p.pdf({ path: `${OUT}/doc99_corp_textpdf.pdf`, width: '595px', height: '842px', printBackground: true }); await p.close();
  truth.push({ ...truth[0], file: 'doc99_corp_textpdf.pdf' }); }
fs.writeFileSync('/var/tmp/ocrbench/truth.json', JSON.stringify(truth, null, 1));
console.log('made', truth.length);
await b.close();
