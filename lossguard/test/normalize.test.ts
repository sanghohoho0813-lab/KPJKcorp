// 정규화 — 숫자 표기 · 규격 · 단위 · 이름(같은 뜻 낱말 · 꼬리표 · 괄호 규격) · 번호
import { parseNum } from "../engine/normalize/number";
import { specTokens, numsOverlap, specNumSim } from "../engine/normalize/spec";
import { compactText, headerKey } from "../engine/normalize/text";
import { makeNormalizer, stripNumbering, numberingOfNoCell } from "../engine/normalize/name";
import { pairScore } from "../engine/match/match";
import pack from "../packs/construction-interior/index";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const T = (v: string) => ({ v, t: "text" as const });

// 숫자
ok(parseNum(T("1,234,500")) === 1234500, "쉼표 숫자");
ok(parseNum(T("(1,000)")) === -1000, "괄호 = 음수");
ok(parseNum(T("△1,000")) === -1000 && parseNum(T("▲ 500")) === -500, "△ ▲ = 음수");
ok(parseNum(T("-")) === 0, "- = 0");
ok(parseNum(T("₩12,000")) === 12000 && parseNum(T("12,000원")) === 12000, "₩ · 원");
ok(parseNum(T("9.5T")) === undefined && parseNum(T("600*600")) === undefined, "규격은 숫자가 아님(엄격)");
ok(parseNum(T("1식"), true) === 1 && parseNum(T("1식")) === undefined, "수량 칸만 단위 글자 허용");
ok(parseNum(T("2구 콘센트"), true) === undefined, "이름 글자는 숫자가 아님");
ok(parseNum({ v: "3.5", t: "num", n: 3.5 }) === 3.5, "숫자 칸");
ok(parseNum(T("１２，０００")) === 12000, "전각 숫자 · 쉼표");

// 규격
ok(JSON.stringify(specTokens("600*600").nums) === JSON.stringify(specTokens("600×600").nums) && specTokens("600x600").nums.join() === "600,600", "규격 600*600 = 600×600 = 600x600");
ok(specTokens("9.5T").nums.join() === "9.5" && specTokens("T9.5").nums.join() === "9.5", "9.5T = T9.5");
ok(numsOverlap(["9.5"], ["12.5"]) === 0 && numsOverlap(["600", "600"], ["600", "600"]) === 1 && numsOverlap([], ["1"]) === undefined, "규격 겹침");
ok(specNumSim(["600", "600"], ["300", "600"]) === 0 && specNumSim(["65"], ["0.8", "65"]) === 0.7 && specNumSim(["600", "600"], ["600", "600"]) === 1, "규격 비교: 숫자 하나 공유(600x600 ↔ 300x600)는 다른 규격 · 포함은 0.7");

// 글자
ok(compactText("석고 보드 (9.5T)") === "석고보드9.5t", "압축 글자");
ok(compactText("㎡") === "m2" && compactText("m²") === "m2", "호환 문자 ㎡ · m²");
ok(headerKey("Q'TY") === "qty" && headerKey("U/PRICE") === "uprice" && headerKey("품   명") === "품명", "머리글 비교 글자");

// 번호
ok(stripNumbering("1. 가설공사").style === "digit" && stripNumbering("1-1 바닥").style === "dash" && stripNumbering("가. 철거").style === "hangul", "번호 모양");
ok(stripNumbering("Ⅱ. 기계 · 전기").style === "roman" && stripNumbering("(3) 마감").style === "paren", "로마 숫자 · 괄호 번호");
ok(numberingOfNoCell("1") === "digit" && numberingOfNoCell("1-2") === "dash" && numberingOfNoCell("가") === "hangul" && numberingOfNoCell("콘센트") === undefined, "번호 칸");

// 이름 · 단위
const n = makeNormalizer(pack);
const a = n.name("경량철골 천정틀", "M-BAR", "㎡");
const b = n.name("천장 경량철골틀 엠바", "", "M2");
ok(a.unit === "m2" && b.unit === "m2", "단위 ㎡ = M2");
ok(n.unit("EA") === n.unit("개") && n.unit("식") === n.unit("LS"), "단위 EA = 개, 식 = LS");
ok(n.name("(변경) 석고보드 [수정]", "9.5T", "㎡").compact === "석고보드", "꼬리표 지우기");
ok(n.name("석고보드(9.5T)", "", "㎡").specNums.join() === "9.5", "괄호 안 규격 → 규격 숫자");
ok(n.name("천장몰딩", "", "M").canon === n.name("천정 몰딩", "", "M").canon, "같은 뜻 낱말 천장 = 천정");
const plain = makeNormalizer(pack, { synonyms: false });
ok(plain.name("천장몰딩", "", "M").canon !== plain.name("천정 몰딩", "", "M").canon, "사전을 끄면 다르게 본다(빼고 돌리기 시험용)");

// 연결 점수
const sc = (x: [string, string, string, number], y: [string, string, string, number]) => pairScore(n.name(x[0], x[1], x[2]), n.name(y[0], y[1], y[2]), x[3], y[3], 1, pack, {}).score;
ok(sc(["석고보드", "9.5T", "㎡", 6800], ["석고보드", "9.5T", "㎡", 6800]) === 1, "같은 항목 = 1");
ok(sc(["석고보드", "9.5T", "㎡", 6800], ["석고보드", "12.5T", "㎡", 8200]) <= 0.5, "규격이 다른 같은 이름은 자동 연결 안 됨");
ok(sc(["포세린 타일", "600x600", "㎡", 58000], ["포세린 타일", "300x600", "㎡", 58000]) <= 0.5, "숫자 하나를 공유하는 다른 규격(600x600 ↔ 300x600)도 자동 연결 안 됨");
ok(sc(["양변기", "원피스", "조", 420000], ["양변기(원피스)", "", "조", 420000]) >= pack.params.tAuto, "숫자 없는 규격이 이름 괄호로 간 경우");
ok(sc(["기존 천정 철거", "텍스 포함", "㎡", 9000], ["천정기존철거", "텍스 포함", "M2", 9000]) >= pack.params.tAuto, "낱말 순서 + 띄어쓰기");
ok(sc(["LED 다운라이트", "6인치 15W", "개", 38000], ["콘센트", "2구", "개", 24000]) < pack.params.tReview, "다른 항목은 연결 후보도 아님");
{ const s = sc(["바닥 보양", "하드보드", "㎡", 4500], ["바닥 보양", "하드보드", "평", 4500]); ok(s < pack.params.tAuto && s >= pack.params.tReview, `환산 단위(평 ↔ ㎡)는 자동 연결하지 않고 확인 대기로 (${s})`); }

process.exit(fail ? 1 : 0);
