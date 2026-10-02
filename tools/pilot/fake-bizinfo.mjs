// 시험용 가짜 기업마당 — 공식 문서(지원사업정보 API)의 JSON 모양 그대로, 값은 지어낸 것.
// 사용: node tools/pilot/fake-bizinfo.mjs 4010   → BIZINFO_API_BASE=http://127.0.0.1:4010/api BIZINFO_API_KEY=test 로 앱 실행
import http from 'http';
const port = Number(process.argv[2] || 4010);
const ALL = '2026,서울,경기,인천,부산,대구,대전,광주,울산,세종,강원,충북,충남,전북,전남,경북,경남,제주';
const d = (n) => { const t = new Date(Date.now() + n * 864e5 + 9 * 3600e3); return t.toISOString().slice(0, 10).replace(/-/g, ''); };
const items = [];
for (let i = 0; i < 900; i++) {
  const kind = i % 4;
  items.push({
    pblancId: `PBLN_FAKE${String(i).padStart(5, '0')}`,
    pblancNm: kind === 0 ? `[경기] 화성시 시험용 제조기업 지원 ${i}` : kind === 1 ? `시험용 전국 수출 지원 ${i}` : kind === 2 ? `2026년 경북 시험용 TIPS ${i}` : `시험용 마감된 공고 ${i}`,
    jrsdInsttNm: kind === 0 ? '경기도' : kind === 2 ? '경상북도' : '중소벤처기업부',
    excInsttNm: '시험원', pldirSportRealmLclasCodeNm: kind === 1 ? '수출' : '기술', trgetNm: kind === 2 ? '창업벤처' : '중소기업',
    reqstBeginEndDe: kind === 3 ? `${d(-30)} ~ ${d(-2)}` : `${d(-3)} ~ ${d(5 + (i % 20))}`,
    hashTags: ALL, bsnsSumryCn: '<p>시험용 사업 개요입니다.&nbsp;실제 공고가 아닙니다.</p>',
    pblancUrl: `https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_FAKE${i}`,
  });
}
let hits = 0;
http.createServer((req, res) => {
  hits++;
  const u = new URL(req.url, 'http://x');
  if (u.searchParams.get('crtfcKey') !== 'test') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"error":"인증키 오류"}'); return; }
  const n = Number(u.searchParams.get('searchCnt') || 100);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ jsonArray: items.slice(0, n || items.length) }));
}).listen(port, '127.0.0.1', () => console.log(`fake bizinfo on ${port} (${items.length} items)`));
process.on('SIGTERM', () => { console.log('hits', hits); process.exit(0); });
