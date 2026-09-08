# DECISIONS — KPJK Consulting AX + Client Portal

큰 결정만 기록한다. WHY / WHY NOT / REVISIT WHEN 포함.

---

## #1 데이터 계층: 로컬 Demo Store (zustand + localStorage), Supabase는 CONDITIONAL
- DECISION: 첫 빌드는 브라우저 로컬 Store로 동작. 모든 Action은 `src/lib/store.ts`에 집중.
- WHY: 실데이터·Auth·API Key가 없는 상태에서도 Closed Loop를 실제로 눌러볼 수 있어야 한다. UI는 Repository 교체만으로 Live 전환 가능.
- WHY NOT Supabase 즉시: 사용자 SQL 실행·ENV 설정이 Hard Blocker가 되어 첫 실행이 멈춘다.
- REVISIT WHEN: 실제 고객 1곳 Pilot 결정 시 → migrations + RLS + Storage 추가.

## #2 색상: Master Prompt §21(차콜 + 오렌지) 채택, Mockup의 Teal/Navy 미채택
- DECISION: Theme 기본값 `KPJK Signature` (Onyx Gold Seed → #171B20 / #343B44 / #D47A4A).
- WHY: Master Prompt가 브랜드 컬러를 명시했고, 제공된 사진 자산(넥타이·룰 라인·차트 컬러)이 동일한 오렌지 계열이라 일관성이 맞는다. Mockup은 Layout/Density/Badge 언어 기준으로만 사용.
- WHY NOT Mockup 색: Mockup은 미래AI랩 범용 템플릿 톤이며 KPJK 브랜드 지시와 충돌.
- REVISIT WHEN: KPJK가 실제 CI 가이드를 제공할 때.

## #3 Canonical 9 Theme + Signature 1 = 총 10 Theme
- DECISION: v3.0의 9 Canonical Theme를 전부 구현하고 KPJK Signature를 10번째 기본값으로 추가.
- WHY: v3.0 Q-1 규칙 준수. Signature는 Onyx Gold를 브랜드 Hue로 미세조정한 것이므로 "9개 중 1개 Seed 조정" 원칙에 부합.

## #4 Dual Progress: 내부 11단계 → 고객 7단계 단일 매핑 함수
- DECISION: `stageToCustomerStep()` 하나로 매핑. 별도 고객 상태 저장 없음.
- WHY: SSOT 원칙 — 같은 데이터에서 파생. 상태 불일치 원천 차단.

## #5 AI: 5개 기능 중 3개 RULE, 2개 LLM AI READY. 외부 LLM 호출 없음
- DECISION: 브리핑·프로젝트 요약·누락 체크는 규칙으로 실제 동작. 상담 요약·초안 문장화만 LLM 대상으로 표시.
- WHY: Master Prompt §9 및 v3.0 §6 — Rule로 충분한 곳에 AI 포장 금지. API Key는 사용자만 제공 가능(Hard Blocker이므로 대기하지 않음).
- REVISIT WHEN: ANTHROPIC/OPENAI API Key 제공 시 → AI-01 상담 요약부터 연결.

## #6 파일 저장: 메타(파일명·크기·버전)만 기록
- DECISION: 업로드 시 파일 내용은 저장하지 않는다. 화면에 명시.
- WHY: 실제 저장소 없이 고객 파일을 브라우저에 담는 것은 위험. Closed Loop 검증에는 메타로 충분.
- REVISIT WHEN: Supabase Storage 도입 시.

## #7 Demo 날짜: 상대 날짜 Seed + 20시간 경과 시 자동 Reseed
- DECISION: Seed는 "오늘" 기준 상대값으로 생성. 저장된 Seed가 20시간 이상 지나면 자동 재생성(세션·설정 유지).
- WHY: 시연이 며칠 뒤에 열려도 "오늘 마감/기한 초과"가 살아 있어야 한다.
- TRADE-OFF: 하루 이상 지나면 시연 중 만든 Action이 초기화됨. 데모 단계에서는 허용.

## #8 Demo 기업명: 중립 샘플명(에이정밀·비앤테크·씨엠푸드·디원건설·이플러스바이오·에프물류)
- DECISION: Master Prompt §25의 A/B/C 원칙을 유지하되 제품처럼 보이도록 가상의 회사명 부여. 카드에 A~F 코드 표시.
- WHY: "A기업"만으로는 시연 몰입도가 떨어짐. 실제 기업과 무관함을 DEMO Badge로 명시.

## #9 Device Preview: 별도 Route 없이 현재 Route를 `?preview=1` iframe으로 표시
- DECISION: Desktop→Mobile(390×780 Frame), Mobile→PC(1280 scale). iframe 내부는 Preview 버튼·튜토리얼 숨김.
- WHY: v3.0 Device Preview Safety Contract — 재귀 금지, 동일 Route/Data/State, 404 없음.

## #10 Consultant Role: Demo에서는 전체 열람 + "내 담당" 필터 기본
- DECISION: 직원 화면은 브리핑·KPI·목록을 담당 기준으로 계산하되 다른 고객 열람은 막지 않는다.
- WHY: 소규모 컨설팅사에서 담당 외 고객을 완전히 숨기면 실무 협업이 막힌다. 고객(Client) Role만 엄격 격리.
- REVISIT WHEN: 실제 RLS 설계 시 KPJK 대표와 정책 확정.

## #11 NOT BUILDING (이번 단계 제외) — Master Prompt §18 그대로
정책자금 추천 / 자동 자금조달 / 법률·세무 자동판단 / 상품 자동추천 / 멀티테넌트 / 외부 구독결제 / Benchmark DB / 자체 ML / Native App / 외부 ERP·CRM API / 대량 자동발송 / L4.
추가 제외: 실제 파일 저장, 이메일·카톡 발송(초안 복사까지만), 전자서명 연동.

## #12 기술스택: Next.js 16 + TypeScript + Tailwind 4 + zustand
- WHY: v3.0 기본 권장 스택. Next 16의 React Compiler 기본 활성으로 수동 memo 최소화.
- NOTE: `next/font/google`은 프록시 환경에서 실패 가능성이 있어 Pretendard CDN + 시스템 폰트 Fallback 사용.
