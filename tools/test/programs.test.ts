// 지원사업 매칭(lib/programs) — 기업마당 응답 읽기 · 매칭 규칙. 시험용 값은 지어낸 것(실제 공고 아님).
import { bizinfoItems, matchProgram, matchPrograms, normalizeBizinfo, regionsIn, profileOfCompany } from "../../src/lib/programs";
import type { SupportProgram } from "../../src/lib/types";
let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const now = new Date("2026-10-01T09:00:00");
const at = now.toISOString();

// 1) 기업마당 응답 한 건 (필드 이름은 API 문서 기준, 값은 시험용)
const raw = { jsonArray: [
  { pblancId: "PBLN_TEST01", pblancNm: "[경기] 시험용 제조 중소기업 스마트공장 지원 공고", jrsdInsttNm: "시험부", excInsttNm: "시험재단",
    reqstBeginEndDe: "2026-09-20 ~ 2026-10-05", pblancUrl: "/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_TEST01",
    pldirSportRealmLclasCodeNm: "기술", trgetNm: "중소기업", hashtags: "2026,경기,제조", bsnsSumryCn: "<p>스마트공장&nbsp;구축 지원</p>" },
  { pblancId: "PBLN_TEST02", pblancNm: "시험용 예비창업 패키지", jrsdInsttNm: "시험부", reqstBeginEndDe: "예산 소진시까지", pldirSportRealmLclasCodeNm: "창업" },
  { pblancNm: "아이디 없는 줄" },
] };
const items = bizinfoItems(raw).map((x) => normalizeBizinfo(x, at)).filter(Boolean) as SupportProgram[];
ok(items.length === 2, "id 없는 줄은 버린다");
const a = items[0];
ok(a.id === "bz_PBLN_TEST01" && a.applyStart === "2026-09-20" && a.applyEnd === "2026-10-05", "기간 읽기 " + a.applyStart + "~" + a.applyEnd);
ok(a.url === "https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_TEST01", "상대 주소 → 기업마당 주소");
ok(a.regions.join() === "경기" && a.category === "기술", "지역 경기 · 분야 기술");
ok(a.summary === "스마트공장 구축 지원", "요약 HTML 제거");
ok(!items[1].applyEnd && items[1].periodText === "예산 소진시까지", "마감일 없으면 원문 기간");
ok(bizinfoItems({ items: { item: [{ pblancId: "x", pblancNm: "y" }] } }).length === 1, "다른 응답 모양");
ok(regionsIn("충청남도 소재 기업").join() === "충남" && regionsIn("(전남) 공고").join() === "전남" && regionsIn("전국 공모").length === 0, "지역 읽기");

// 2) 매칭
const factory = { region: "경기", industry: "제조업 금속가공", foundedYear: 2015, employees: 20, entityType: "corporation" as const };
let m = matchProgram(a, factory, now);
ok(!!m && m.reasons.some((r) => r === "지역 맞음: 경기") && m.reasons.some((r) => r.startsWith("업종 맞음: 제조")) && m.reasons.includes("마감 4일 남음"), "지역·업종·마감 근거 " + m?.reasons.join("/"));
ok(matchProgram(a, { ...factory, region: "부산" }, now) === null, "다른 지역 전용 공고는 뺀다");
ok(matchProgram(a, factory, new Date("2026-10-06T09:00:00")) === null, "마감 지난 공고는 뺀다");
ok(matchProgram(items[1], factory, now) === null, "예비창업 전용 — 이미 사업 중이면 뺀다");
ok(!!matchProgram(items[1], { region: "경기" }, now), "예비창업 — 설립 전(업력 없음)이면 보인다");
const startup7: SupportProgram = { ...a, id: "t3", title: "시험용 창업 7년 이내 기업 사업화 지원", regions: [], tags: [], summary: "" };
ok(matchProgram(startup7, factory, now) === null, "창업 7년 이내 — 업력 11년이면 뺀다");
const m7 = matchProgram(startup7, { ...factory, foundedYear: 2022 }, now);
ok(!!m7 && m7.reasons.includes("업력 7년 이내 조건: 업력 4년"), "창업 7년 이내 — 업력 4년 근거");
const small: SupportProgram = { ...a, id: "t4", title: "시험용 소상공인 판로 지원", regions: [], tags: [], summary: "", category: "내수" };
const ms = matchProgram(small, { ...factory, interests: ["내수"] }, now);
ok(!!ms && ms.cautions.some((c) => c.includes("소상공인")) && ms.reasons.includes("관심 분야: 판로·마케팅"), "소상공인 확인 필요 · 관심 분야");
const list = matchPrograms([small, a, startup7], factory, { now, strongOnly: true });
ok(list[0].program.id === a.id && !list.some((x) => x.program.id === "t3"), "근거 많은 순 · 맞지 않는 것 제외");
ok(profileOfCompany({ region: "경기", industry: "제조업", bizCategory: "제조", establishedAt: "2015-03-02", employeeBand: "10-29", employees: 0 } as never).employees === 10, "기업 → 조건(인원 구간)");
ok(profileOfCompany({ address: "경기 화성시 봉담읍", industry: "정밀부품 제조" } as never).region === "경기", "지역 칸 없으면 주소에서(경기 화성시 → 경기)");
ok(profileOfCompany({ region: "서울", address: "경기 화성시" } as never).region === "서울", "지역 칸이 있으면 그대로");
ok(profileOfCompany({ address: "충청북도 청주시" } as never).region === "충북", "주소 긴 이름(충청북도 → 충북)");
// 기업마당 공식 문서(지원사업정보 API)의 응답 예시 모양 — 접수기간 숫자 8자리, 해시태그 칸 hashTags(대문자 T), 주소 전체. 값은 시험용
{
  const off = normalizeBizinfo({ pblancId: "PBLN_TEST09", pblancNm: "시험용 기술개발 지원 공고", jrsdInsttNm: "시험부", excInsttNm: "시험원",
    reqstBeginEndDe: "20261001 ~ 20261020", hashTags: "2026,기술,경기,중소기업", pldirSportRealmLclasCodeNm: "기술",
    pblancUrl: "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_TEST09", trgetNm: "중소기업" }, at);
  ok(off?.applyStart === "2026-10-01" && off?.applyEnd === "2026-10-20", "공식 형식: 접수기간 20261001 ~ 20261020");
  ok(!!off && off.regions.includes("경기"), "공식 형식: hashTags(대문자) 의 지역 읽음");
  ok(off?.url === "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_TEST09", "공식 형식: 공고 주소 그대로");
  const alt = normalizeBizinfo({ seq: "PBLN_TEST10", title: "시험용 다른 이름 공고", link: "https://www.bizinfo.go.kr/x", author: "시험부", reqstDt: "20261101 ~ 20261130", lcategory: "금융" }, at);
  ok(alt?.id === "bz_PBLN_TEST10" && alt.agency === "시험부" && alt.applyEnd === "2026-11-30" && alt.category === "금융", "공식 형식: 다른 이름(seq·title·link·author·reqstDt·lcategory)도 읽음");
}
console.log(fail ? `\nFAIL ${fail}` : "\n전부 통과"); process.exit(fail ? 1 : 0);
