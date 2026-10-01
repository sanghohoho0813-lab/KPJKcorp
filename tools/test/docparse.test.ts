// 사업자등록증 · 등기부 글자에서 기업 정보 읽기. 값은 전부 지어낸 시험용이다(실제 고객 서류를 저장소에 두지 않는다).
// 글자 모양은 2026-10-01 실제 그림 PDF 를 글자 인식했을 때 나온 깨짐을 그대로 흉내 냈다.
import { parseBusinessDoc, parseExtracted, findBizKinds, bizNoValid, corpNoValid, parseKindLines } from "../../src/lib/docparse";
import { industryOf } from "../../src/lib/company-options";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  → 기대 ${JSON.stringify(want)} / 실제 ${JSON.stringify(got)}`}`);
  if (!ok) fail++;
};

// 1) 그림 PDF → 글자 인식 (한글+영문) — 라벨 받침 깨짐, 상자 라벨 깨짐, 두 칸
const OCR_A = `0 국세청
사업자등록증
( 범인사업자 )
등록번호 : 123-86-45677
법인멍(단체멍) : 주식회사테스트상사
대 _표 . 자 : 홍걸동
개 업 연 월 일 : 2021 년 03 월 15 일    법인 등록번호 : 110111-7654323
사 업 장 소 재 지 ： 경기도 테스트시 가나읍 다라로12번길 3-4
본 점 소 재 지 : 경기도테스트시 가나읍.다라로12번길 3-4
사 업 의 FF ：[얼테| 음식점업       [종목| 커피 전문점
도매 및 소매업                   상품 종합 도매업
발 급 사 유 : 신규발급
사업자 단위 과세 적용사업자 여부: 여( ) 부(*)
남양주세무서 장`;
const a = parseBusinessDoc(OCR_A);
eq("종류: 사업자등록증", a.source, "bizReg");
eq("상호: '법인멍(단체멍)' 이어도 읽는다", a.name, "주식회사테스트상사");
eq("사업자번호", a.bizNo, "123-86-45677");
eq("법인번호", a.corpNo, "110111-7654323");
eq("개업일", a.establishedAt, "2021-03-15");
eq("대표자: '대 _표 . 자'", a.ceo, "홍걸동");
eq("주업태: 깨진 상자 라벨 제거", a.bizCategory, "음식점업");
eq("주종목", a.bizItem, "커피 전문점");
eq("그 외 업태·종목: 둘째 줄", a.bizItemsExtra, "도매 및 소매업 — 상품 종합 도매업");
eq("주소", a.address, "경기도 테스트시 가나읍 다라로12번길 3-4");

// 2) 같은 그림을 한글 전용으로 다시 읽은 결과 — 이름은 맞고 숫자 한 자리가 틀렸다
const OCR_B = OCR_A.replace("홍걸동", "홍길동").replace("123-86-45677", "123-86-48677");
const m = parseExtracted(OCR_A, OCR_B);
eq("합치기: 이름은 한글 전용 결과", m.ceo, "홍길동");
eq("합치기: 숫자는 첫 번째 결과(두 번째가 틀려도)", m.bizNo, "123-86-45677");
eq("합치기: 두 번째가 없으면 첫 번째 그대로", parseExtracted(OCR_A).ceo, "홍걸동");

eq("검증번호: 맞는 번호", [bizNoValid("123-86-45677"), corpNoValid("110111-7654323")], [true, true]);
eq("검증번호: 한 자리 틀리면 걸림", [bizNoValid("123-86-48677"), corpNoValid("110111-7654328")], [false, false]);
// 첫 번째가 번호를 틀리고 두 번째가 맞게 읽은 경우 → 검증번호가 맞는 쪽
eq("합치기: 번호는 검증번호가 맞는 쪽", parseExtracted(OCR_A.replace("123-86-45677", "123-86-45877"), OCR_A).bizNo, "123-86-45677");
// 첫 번째가 날짜를 뭉갰으면 두 번째
eq("합치기: 날짜 보완", parseExtracted(OCR_A.replace("2021 년 03 월 15 일", "2021803815"), OCR_A).establishedAt, "2021-03-15");

// 줄바꿈된 종목 · 칸 사이가 두 칸뿐인 텍스트 PDF · 개인 "상호" · 주소 손질
eq("종목 줄바꿈 이어 붙이기", parseBusinessDoc(`사업자등록증\n사업의종류:  [업태] 정보통신업     [종목] 응용 소프트웨어 개발 및 공\n급업\n서비스업     컴퓨터 시스템 통합 자문\n발급사유 : 신규`).bizItem, "응용 소프트웨어 개발 및 공급업");
eq("개인: 상호", parseBusinessDoc(`사업자등록증\n( 일반과세자 )\n등록번호 : 123-45-67890\n상호            : 한빛상회\n성명 : 이영희\n`).name, "한빛상회");
eq("법인명 괄호 없이", parseBusinessDoc(`사업자등록증\n법인명 : 주식회사 테스트\n`).name, "주식회사 테스트");
eq("주소: 앞 부호·도/시 띄어쓰기·읍", parseBusinessDoc(`사업자등록증\n사업장소재지 : 、：충청북도청주시 흥덕구 오송음 오송생명로 123\n`).address, "충청북도 청주시 흥덕구 오송읍 오송생명로 123");

eq("대표자: 낱자 띄움 붙이기", [parseBusinessDoc("사업자등록증\n대 표 자 : 정 수빈\n").ceo, parseBusinessDoc("사업자등록증\n대 표 자 : 강서 연\n").ceo, parseBusinessDoc("사업자등록증\n성 명 : 이영희     생년월일 : 1985 년 05 월 20 일\n").ceo], ["정수빈", "강서연", "이영희"]);

// 3) 라벨이 완전히 뭉개져도 "주식회사 …" 줄로 상호를 찾는다
const NOLABEL = `사업자등록증\n등록번호 : 123-86-45677\n@#$ : 주식회사 테스트상사\n대 표 자 : 홍길동\n남양주세무서장`;
eq("상호: 라벨 없을 때 회사 형태 낱말로", parseBusinessDoc(NOLABEL).name, "주식회사 테스트상사");

// 4) 글자 인식이 한글 이름을 영문 조각으로 읽은 경우 버린다 / 진짜 영문 이름은 받는다
eq("대표자: 'dss' 같은 조각은 버림", parseBusinessDoc(OCR_A.replace("홍걸동", "dss")).ceo, undefined);
eq("대표자: 영문 두 낱말은 받음", parseBusinessDoc(OCR_A.replace("홍걸동", "John Smith")).ceo, "John Smith");

// 5) 텍스트 PDF (홈택스) — 칸 사이를 넓은 공백으로 남긴다
const PDF_TEXT = `사업자등록증\n(법인사업자)\n등록번호 : 123-86-45677\n법인명(단체명) : 주식회사 테스트상사\n대 표 자 : 홍길동\n개업연월일 : 2021 년 03 월 15 일\n사업의 종류 : 업태 제조업     종목 자동차부품\n도매 및 소매업     부품 도매\n발급사유 : 신규발급`;
const p = parseBusinessDoc(PDF_TEXT);
eq("텍스트 PDF: 주업태·주종목", [p.bizCategory, p.bizItem], ["제조업", "자동차부품"]);
eq("텍스트 PDF: 그 외", p.bizItemsExtra, "도매 및 소매업 — 부품 도매");

// 6) 옛 양식 (개인) — 줄마다 "업태 : … 종목 : …"
eq("옛 양식", (({ category, item }) => ({ category, item }))(findBizKinds("업 태 : 서비스 종 목 : 소프트웨어 개발\n업 태 : 도매 종 목 : 전자상거래\n발급사유 : 정정")), { category: "서비스, 도매", item: "소프트웨어 개발, 전자상거래" });
eq("그 외 줄 되읽기", parseKindLines("도매 및 소매업 — 상품 종합 도매업\n서비스"), [{ category: "도매 및 소매업", item: "상품 종합 도매업" }, { category: "서비스" }]);

// 7) 등기부는 업태를 읽지 않는다(그런 칸이 없다)
const REG = `등기사항전부증명서(말소사항 포함)\n등기번호 000123\n상 호 주식회사 테스트상사\n본 점 서울특별시 테스트구 가나로 1\n회사성립연월일 2015 년 05 월 01 일\n목 적 1. 소프트웨어 개발\n대표이사 홍길동 800101-1******`;
const r = parseBusinessDoc(REG);
eq("등기부: 종류", r.source, "corpReg");
eq("등기부: 상호", r.name, "주식회사 테스트상사");
eq("등기부: 대표 생년월일(뒷자리 버림)", r.ceoBirth, "1980-01-01");
eq("등기부: 업태 없음", r.bizCategory, undefined);

// 8) 업태 → 업종 칩
eq("업종: 음식점업 → 숙박·음식", industryOf("음식점업, 도매 및 소매업"), "숙박·음식");
eq("업종: 주업태 기준 (도매 먼저면 도매·소매)", industryOf("도매 및 소매업, 음식점업"), "도매·소매");
eq("업종: 제조업", industryOf("제조업"), "제조업");
eq("업종: 모르는 업태는 비움", industryOf("기타"), undefined);

if (fail) { console.log(`\n${fail}건 실패`); process.exit(1); }
console.log("\n전부 통과");
