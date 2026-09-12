# QA_REPORT — KPJK Consulting AX + Client Portal

## 0-E. 고도화 5차 검증 (2026-09-11)

| 항목 | 결과 |
|---|---|
| TypeScript / ESLint | PASS (0 / 0) |
| Production build | PASS — 30 routes |
| 가로 overflow (390 / 768 / 1440 × 29 Route) | **0건** |
| Runtime pageerror | **0건** |
| 코치 박스 강조 + 3초 glow | PASS (`coachGlow 3s`) |
| 모션 끄기 시 glow 정지 | PASS (`animationName: none`) |
| 심사 관점 설명 (자금조달 · 전후 비교 · 소급 불가) | PASS |
| Baseline 입력 → 전후 비교 표시 | PASS |
| 회귀 (Coach 6단계 · AI Action · 견적 · 매출기회) | PASS |

전후 비교 실측 예: 자료요청→제출 7일(입력) → 7.8일(실측) `+0.8일` · 주간 후속 누락 4건(입력) → 2건(실측) `-2건`.
차이는 자동 계산하지만 표본 수를 함께 표시하고 성과로 단정하지 않는다.

모바일 세로 길이 (390px): 코치 4813 → **4050px**, 리포트 4956 → **4193px** (근거 4가지를 모바일에서 접음).

---

## 0-D. 고도화 4차 검증 (2026-09-11)

| 항목 | 결과 |
|---|---|
| TypeScript / ESLint | PASS (0 / 0) |
| Production build | PASS — 30 routes |
| 가로 overflow (390 / 768 / 1440 × 29 Route) | **0건** |
| Runtime pageerror | **0건** (전 시나리오) |
| 사이드바 항목 수 | 13 → **9** (3그룹 + 하단 Utility 4) |
| 첫 화면 KPI 수 | 6 → **4** |
| AX Coach / Evidence | PASS (아래) |
| 회귀 (AI Action · 견적 7단계 · 매출기회 5단계) | PASS |

AX Coach 자동 시나리오:
1. 실증 시작 전 대시보드에 시작 안내 카드 노출
2. 실증 시작 → Day 1 / 14 표시, 오늘의 미션 카드 렌더
3. 코치 화면에 Evidence 6영역 + 남은 미션 + 가장 부족한 영역
4. 브리핑 실행 버튼 사용 → AI 추천 활용 영역이 0 → 1로 반영, 미션 자동 완료
5. 리포트 첫 탭이 실증 진행, 실증 일차 표시
6. 업무함 탭에서 문의 콘솔 임베드 동작

모바일 세로 길이 (390px):

| 화면 | 이전 | 이후 |
|---|---|---|
| 대시보드 | 4285px | **3464px** |
| AI 브리핑 | 5942px | **4653px** |
| AX 코치 | 3447px | **3197px** |

수정 이력 (이번 회차):
- **P0** 브리핑에서 단계 변경·기회 등록 모달이 열리지 않음. `ai_action_taken`에 projectId를 넣어 기록하는 순간 정체 판정이 풀려 항목이 언마운트됐다 → 해당 Event에서 projectId 제외
- **P1** 모바일 세로 스크롤 과다 → 긴 목록에 MoreButton 적용, 코치 미션은 모바일에서 1개만 크게
- **P2** 설명성 메뉴(Why AX)가 운영 메뉴와 같은 무게 → 하단 Utility로 이동하고 글자·아이콘 한 단계 축소

---

## 0-C. 고도화 3차 검증 (2026-09-11)

| 항목 | 결과 |
|---|---|
| TypeScript / ESLint | PASS (0 / 0) |
| Production build | PASS — 29 routes |
| 가로 overflow (390 / 768 / 1440 × 27 Route) | **0건** |
| Runtime pageerror | **0건** |
| 견적 워크플로 7단계 | PASS |
| 회귀 (AI Action 7종 · 매출기회 Loop 5단계) | PASS |
| 모바일 (견적 목록·작성·상세 모달, Portal 제안 카드) | PASS — overflow 0, 회신 버튼 52px, Overlay cleanup 0 |

견적 자동 시나리오:
1. 할인 15% 견적 작성 → 작성 화면에서 승인 필요 경고 노출
2. 상세에서 발송 버튼 0개 / 승인 요청 버튼 1개 (할인 견적은 발송 불가)
3. 대표 승인 → 발송 버튼 열림 → 발송 → 회신 확인 Task 자동 생성
4. 고객 Portal에 제안 노출 → 수락 회신 → 상태 반영
5. 내부에서 계약 전환 → 계약 탭에 생성
6. 리포트 매출 축에 견적 지표 반영
7. 브리핑 견적 회신 대기 항목 + 완료 되돌리기 동작

수정 이력 (이번 회차):
- **P0** 대표가 할인을 승인해도 발송 버튼이 열리지 않음. 승인 완료 상태를 구분하지 못하고 `discountPct > 0`만 보고 있었음 → `approvalId` 유무로 판정하도록 수정, 승인 완료 안내 추가
- **P1** 모바일에서 Portal 관리자 미리보기 바의 배지가 글자 단위로 세로 분해됨 → `shrink-0 whitespace-nowrap` + 좁은 화면 라벨 축약

---

## 0-B. 고도화 2차 검증 (2026-09-11)

| 항목 | 결과 |
|---|---|
| TypeScript / ESLint | PASS (0 / 0) |
| Production build | PASS — 29 routes |
| 가로 overflow (390 / 768 / 1440 × 26 Route) | **0건** |
| Runtime pageerror | **0건** (전 시나리오) |
| AI Action 7종 실행 | PASS (아래) |
| 매출기회 Loop 회귀 | PASS (5단계 전부 유지) |
| 모바일 탭 영역 / 모달 / Overlay cleanup | PASS |

AI Action 자동 시나리오:
1. 안내 초안 — 브리핑에서 바로 열리고 본문 185자 자동 생성
2. 단계 변경 — 모달에서 다음 단계 선택 → 실행 + 고객 Portal 반영 안내
3. 후속 업무 등록 모달 진입
4. 완료 처리 — 실행 후 해당 항목이 브리핑에서 내려감 (2건 → 0건)
5. 매출기회 등록 — 추천 근거 노출 → 등록 → 기회 목록에 `규칙 발견` 소스 + 상담연락 Task 자동 생성
6. 상담 기록 작성 — 구조화 요약 저장 + 다음 Action이 후속 업무로 자동 등록
7. Evidence Log에 상담 기록 반영

모바일 측정: 액션 버튼 높이 40px·화면 밖 이탈 0, 초안 모달 390×568(overflow 0), 상담 기록 모달 저장 버튼 노출 확인, 모달 닫은 뒤 `[role=dialog]` 0 / `scroll-lock` 0.

수정 이력 (이번 회차):
- **P1** 브리핑 모바일에서 KPI 타일 7개가 4줄을 차지해 정작 목록이 첫 화면 밖으로 밀림 → 모바일은 한 줄 칩으로 대체
- **P2** 항목 제목이 `왜?` 버튼에 밀려 잘림 → 제목을 전폭으로 두고 `왜?`를 실행 버튼 줄로 이동
- **P2** 실행 후 "처리 완료" 표시용 로컬 state가 실제로는 도달하지 않는 죽은 코드 → 제거 (항목이 사라지는 것 자체가 신호)

---

## 0. 고도화 1차 검증 (2026-09-11)

| 항목 | 결과 |
|---|---|
| TypeScript / ESLint | PASS (0 / 0) |
| Production build | PASS — 29 routes, exit 0 |
| 가로 overflow (390 / 768 / 1440 × 26 Route) | **0건** |
| Runtime pageerror (전 시나리오) | **0건** |
| TERTIARY Closed Loop 자동 시나리오 | PASS (아래 5단계 전부) |
| 설문 제출 → 저장 → 리포트 반영 | PASS |
| Theme 뿌연 현상 (Burgundy / Plum) | 해소 확인 (스크린샷 육안) |
| 모바일 하단바 중첩 (설문 제출바 vs Bottom Nav) | 발견 → `--bottomnav-h` 도입으로 수정, 재측정 겹침 0 |

TERTIARY 자동 시나리오:
1. 관리자 미리보기로 고객 Portal 진입 → 추천 3건 노출 → 상담 요청 → 내 요청 목록 반영
2. 내부 AX 매출기회에 `고객 상담요청` 소스로 생성 확인
3. 담당자 상담연락 Task 자동 생성 확인
4. 담당자 확인 → 대표 승인 요청 → 대표 승인 → 제안·견적 발송 Task 자동 생성 확인
5. 설문 20문항 전부 클릭 제출 → 리포트 운영 사용량 축에 반영

수정 이력 (이번 회차):
- **P1** 설문 하단 제출바가 모바일 Bottom Nav에 가려짐 → `--bottomnav-h` CSS 변수로 오프셋, 겹침 0 재확인
- **P2** 화면 제목과 사이드바 라벨 불일치(`상담 / 계약` vs `상담 · 계약`) → 제목 통일
- **P2** 모바일 단계 요약 타일이 2열이라 세로가 길어짐 → 3열로 압축

---

# (First Build 최초 검증 기록)

> 2026-09-08 · Next.js 16.3 / React 19 / Tailwind 4 · 검증 도구: tsc, eslint, `next build`, Playwright(Chromium) 자동 시나리오 + 스크린샷 육안 검토

## 1. 요약

| 항목 | 결과 |
|---|---|
| TypeScript | PASS (0 errors) |
| ESLint (next core-web-vitals + ts + React Compiler rules) | PASS (0 problems) |
| Production build (`next build`) | PASS — 26 routes, exit 0 |
| Strategic P0 | **0** |
| Product P0 | **0** (발견 3건 → 전부 수정) |
| Product P1 | **0** (발견 9건 → 전부 수정) |
| Responsive (360/390/430/768/1024/1280/1440/1920) | PASS — Horizontal overflow 0 (6폭 × 6 Route 자동 측정 + 1440 육안) |
| Hydration / Runtime error | PASS — 전 Route 전체 로드 시 pageerror 0 |
| Primary Closed Loop | PASS (자동 시나리오) |
| Secondary Closed Loop | PASS (자동 시나리오) |
| Theme 10종 | 구현 완료. Residual Accent 육안 검증: KPJK Signature + Burgundy Slate (2/10). 나머지 8종은 Token 기반이라 구조적으로 동일 — 전수 육안 검증은 납품 전 1회 권장 |
| Red Team | 1회 실행 (§6) |

**Strategy Score (self-assessed): 87 / 100** · **Product Score (self-assessed): Business AX 87 · Portal 85 · 전체 86 / 100**
First Build 목표(최종 MVP의 70~80%)는 충족. Strategy 90 미만의 차이는 전부 *실운영 후에만 채워지는 항목*(Baseline, Adoption Proof, Unit Economics)이며 설계 측 항목은 완료 — §7 참고.

## 2. Acceptance Journey (Master Prompt §30)

| Test | 시나리오 | 결과 |
|---|---|---|
| TEST 01 INTERNAL | 대표 로그인 → Dashboard → Today Brief → 에이정밀 카드 → 프로젝트 상세 → 자료 요청 생성 → 일정 확인 | PASS |
| TEST 02 CUSTOMER | 비앤테크 담당자 로그인 → 현재 프로젝트 → 요청자료 → 파일 업로드(메타) | PASS |
| TEST 03 CLOSED LOOP | AX 자료관리에 '제출완료' 도착 → 검토 완료 → Portal '확인완료' + 알림 → 단계 변경(자료요청→자료접수) → Portal Timeline 반영 | PASS |
| TEST 04 COMMUNICATION | Portal 문의 작성 → AX Queue(자동 Task) → 초안 제안 → 답변 등록 → Portal '답변 완료' + 알림 | PASS |
| TEST 05 MOBILE 390 | 로그인 → 진행현황 → 자료제출 → 일정 → 문의 → 완료 (Bottom Nav) | PASS |

Unified U-7 Whole-Hybrid Run 추가 항목: Tutorial(AX 5·Portal 3) Spotlight 실동작 + 종료 후 Overlay 잔존 0 / Settings Theme·Font·Role 즉시 반영 / Desktop→Mobile Preview(재귀 0, 상하단 잘림 0) / Mobile→PC Preview / 시연 모드 10 Step Route 자동 이동 / Demo Reset / Surface 왕복(AX→Portal→AX) — 모두 PASS.

## 3. 발견 → 수정 이력

### P0 (완료 보고 금지 항목)
1. **Store 미하이드레이션으로 로그인 버튼 영구 비활성** — `onRehydrateStorage`가 생성 중인 store 바인딩을 참조(TDZ). 상태 객체의 action으로 교체 → 수정.
2. **Device Preview iframe 백지** — CDN 폰트 `<link rel=stylesheet>`가 렌더 블로킹, 샌드박스에서 연결 리셋. 폰트를 mount 후 비동기 로드(`FontLoader`)로 변경 → 수정. (프로덕션에서도 CDN 지연이 첫 화면을 막지 않게 됨)
3. **/portal Hydration mismatch** — zustand persist가 클라이언트 첫 렌더 전에 동기 복원 → SSR Skeleton과 불일치. `skipHydration` + mount 후 `rehydrate()` → 수정. 전 Route 전체 로드 재검증 pageerror 0.

### P1
4. AX Header 1440px 이하에서 2줄 wrap (19px root) → 항목 nowrap + lg/xl/2xl 3단계 노출 규칙.
5. Portal Header 1440px 이하 wrap → 동일 처리.
6. 첫 실행 튜토리얼이 800ms 후 홈 Route로 강제 이동 → 사용자가 다른 화면에 있으면 모달이 닫힘. **홈 Route에서만 자동 실행**으로 변경.
7. `truncate` 요소가 flex item일 때 min-width:auto로 행이 늘어나 360/390에서 가로 overflow → `.truncate{min-width:0}` + grid/card 하한 → 6폭 × 6 Route 재측정 0.
8. 자료관리 SegmentedControl 360px overflow → 가로 스크롤 허용.
9. 완료된 자료의 마감일이 "30일 지남"(빨강)으로 표시 → 대기 상태에서만 기한 강조.
10. 설정 Permission Matrix 3열이 잘림 / Theme 이름 truncate → compact table + 반응형 grid.
11. "마지막 업데이트"가 7월(Seed 정렬 문제) → Seed Activity 최신순 정렬.
12. "전체 리마인드" 버튼이 토스트만 표시(죽은 버튼에 가까움) → 리마인드 대상 목록 Modal + 건별 안내 초안.

### P2 (수정)
- 리포트 Target 열 "DO NOT INVENT"(내부 용어) → "실측 후 설정" / Why AX Story 01 데모 수치를 KPJK 사실처럼 표현 → "이 데모는 …을 가정" / 업무 기한 시각 00:00→18:00 / "어제" 기한을 미강조 → "1일 지남" / 사진 PNG 1.9MB → JPEG 140KB / 날짜 포맷 타임존을 로컬로 통일 / Portal 시작일에 시각 표시 제거 / PageHeader 배지 wrap.

## 4. Responsive · Theme · Interaction

- 검증 폭: 360, 390, 430, 768, 1024, 1280, 1440, 1920 — `documentElement.scrollWidth > clientWidth` 자동 측정 0건.
- Mobile ≠ 축소 Desktop: AX 하단 Nav(오늘/고객/프로젝트/자료/더보기 Sheet), Portal 하단 Nav(홈/진행현황/자료제출/문의/MY), 날짜·시각은 압축형으로 유지(삭제 아님), Timeline은 세로형으로 재배치.
- Theme: Token 6종 + Neutral/Semantic 고정. Burgundy 전환 시 본문·표·폼 Neutral 유지, Error Red는 의미 색만 확인.
- Overlay: Modal/Drawer/Sheet/Tutorial/Preview 종료 후 `[role=dialog]` 0, `body.scroll-lock` 0 자동 확인 (6개 지점).
- Hover/Pressed: Card·Row·Button·Tab·Nav에 transition 140~220ms, `prefers-reduced-motion`/설정 Off 시 1ms.

## 5. Data / AI / Proof 상태

| 영역 | 상태 |
|---|---|
| Data Source | DEMO (localStorage). Seed 20시간 후 자동 갱신. Repository 분리로 Supabase 교체 지점 명확 |
| AI-01 상담 요약 | AI READY (LLM) — 구조화 요약 표시, 설명 Modal |
| AI-02 브리핑 | RULE 실동작 (7 규칙, 근거 2~4개) + LLM AI READY |
| AI-03 프로젝트 요약 | RULE 실동작 |
| AI-04 누락 체크 | RULE 실동작 (AI 아님으로 명시) |
| AI-05 초안 | 템플릿 실동작 (복사만, 자동 발송 없음) |
| Evidence | 18종 Event Append-only, CSV Export |
| KPI | 9개 측정지점 정의, Demo 값 표시, Baseline "측정 필요", Target "실측 후 설정" |

## 6. PASS 3 — Red Team (1회)

| 관점 | 발견 | 조치 |
|---|---|---|
| 회의적 대표 | "없어도 돌아가는 것 아닌가?" → Capital Independence: 동일 인력으로 관리 고객 수 확대·누락 감소가 경제적 이유 | Why AX §13에 명시 |
| AX 컨설턴트 | 가짜 AI 여부 → 5개 중 3개 규칙, 2개 AI READY로 정직 표시 | 유지 |
| 직원 | 튜토리얼이 작업 중 화면을 가로챔 | 홈 Route에서만 자동 (P1 #6) |
| 직원 | "전체 리마인드"가 실제 동작 없음 | 대상 목록 Modal (P1 #12) |
| 고객 | 내부 용어 노출 여부 → Portal은 "검토하고 있습니다" 식 문장, 상태 라벨 고객용 별도 | 유지 |
| 심사자 | Demo 수치를 사실처럼 표현한 문장 (Why AX §01) | 데모 가정으로 수정 |
| 심사자 | 개선율·보장 표현 | 없음 확인 |
| 투자/성장 | 확장 과장 여부 → NEXT 5개는 KPJK 운영 직결 항목만, Industry SaaS 미추진 | 유지 |
| UX | 헤더 wrap, truncate overflow, 완료 자료 빨강 기한 | 수정 (P1 #4~#9) |
| QA | 하이드레이션·iframe 백지·TDZ | 수정 (P0 #1~#3) |
| 보안 | 고객 데이터 격리가 필터 기반 | Demo 한계로 설정 화면에 명시, RLS는 CONDITIONAL |

미수정 P2는 RECOMMENDATIONS.md에 기록하고 중단.

## 7. Score 세부 (self-assessed)

Strategy: Problem 14/15 · Process 9/10 · Data 13/15 · AI Fit 9/10 · Proof 13/15 · Customer/Platform 9/10 · Scale/UE 8/10 · Moat 4/5 · Adoption 4/5 (AX Owner 미구현) · Financeability 4/5 = **87**
Product: Shell 14/15 · Business AX 17/20 · Portal 17/20 · Cross-Surface 14/15 · Visual/Interaction 12/15 · Theme 8/10 (전수 육안 미실시) · Story 5/5 = **87** (Portal 단독 85)

납품 권장선(Product 98+)까지 남은 것: Theme 10종 × 4 Surface 전수 육안 검증, 상담 기록 직접 작성 UI, AX Owner 필드, 실데이터 1곳 반영.

## 8. 환경 특이사항
- 샌드박스에서 `cdn.jsdelivr.net` 연결 리셋 → 폰트는 시스템 스택으로 렌더. 프로덕션에서는 Pretendard 적용.
- Next dev 모드의 "N" 배지는 프로덕션 빌드에 없음.

---

## 9. 자체 점검 회차 (2026-09-11, 고도화 6차)

기능 추가 없이 "이미 만든 것에 결함이 없는가"만 본 회차. Playwright로 측정한 값만 적는다.

### 9.1 색 대비 (WCAG 2.1 AA, 흰 배경 기준)

| 대상 | 이전 | 이후 |
|---|---|---|
| accent 글자 — Navy Gold | 2.24 | 4.62 |
| accent 글자 — Onyx / Navy / KPJK | 2.97 / 3.00 / 3.14 | 4.68 / 4.69 / 4.63 |
| accent 글자 — 나머지 6종 | 3.19 ~ 5.43 | 4.60 ~ 5.43 |
| `--sem-success` | 4.25 | 5.74 |
| `--sem-warning` | 3.64 | 5.57 |
| `--sem-error` | 4.87 | 5.94 |
| `--neutral-text-3` (각주·단위) | 3.12 | 4.79 |

AA 미달 텍스트 노드: `/ax/coach` 12 → 3, `/ax/dashboard` → 1, `/ax/reports` → 1 (남은 건 4.09~4.48로 경계값).
10종 테마 결과가 서로 같아졌다 = 대비가 더 이상 테마 선택에 좌우되지 않는다.

### 9.2 모바일 (390px)

| 항목 | 이전 | 이후 |
|---|---|---|
| 필터 칩 높이 | 31px | 40px (데스크톱 31px 유지) |
| 업무 체크박스 터치영역 | 28px | 44px (보이는 크기는 24px 그대로) |
| 일정 제목 | 196px에서 잘림 | 2줄 표시 |
| 승인 대기 제목·요약 | 272px에서 잘림 | 2줄 표시 |
| 기업 상세 매출기회 서비스명 | 66px로 압착 | 전폭 |
| 가로 스크롤 | 0 | 0 |

### 9.3 기능 결함

| 발견 | 조치 |
|---|---|
| 실증 15일차 이후에도 "Day 14 / 14"에서 멈춤 | `finished` 상태 + 경과일 + 리포트 유도 배너 |
| 유효기간 지난 견적에 수락 버튼만 노출 | 내부·고객 양쪽에 경과일 안내 (상태 자동 변경은 하지 않음) |
| `useAfterValues`가 렌더 중 `new Date()` 참조 | `useNow`로 교체, 하이드레이션 전에는 "수집 중" |
| 견적 상세에서 early return 뒤 Hook 호출 | Hook을 early return 앞으로 이동 |
| 코치 메시지에 미션 수 14 하드코딩 | `missions.length` 참조 |

### 9.4 회귀

tsc 0 · eslint 0 · build 30 routes · 가로 오버플로 0 (390/768/1440 × 29 route) · pageerror 0 ·
회귀 스위트 5종(qa · act · quote · loop · coach) 전부 통과.

---

## 10. 글자 크기 · 레이아웃 회귀 (2026-09-12, 고도화 7차)

### 10.1 글자 크기 4단계

| 단계 | root font | 사이드바 폭 |
|---|---|---|
| 기본 (s) | 19px | 285px |
| 크게 (m) | 21px | 315px |
| 더 크게 (l) | 23px | 344px (상한) |
| 최대 (xl) | 25px | 344px (상한) |

`s`에서 "작게" 버튼, `xl`에서 "크게" 버튼이 비활성 — 범위 밖으로 나가지 않는다.

### 10.2 가로 오버플로 (4단계 × 화면폭 전수)

| 화면 | 폭 | 결과 |
|---|---|---|
| AX 17 route | 360 / 390 / 768 | 4단계 모두 0 |
| AX 11 route | 1280 / 1440 | 4단계 모두 0 |
| Portal 9 route | 390 / 1440 | s · xl 모두 0 |

수정 과정에서 나온 실제 결함 4건 — 헤더 우측 묶음이 큰 글씨에서 밀려남(+177), Portal 헤더가 줄지 않음(+26),
기업 상세 액션 버튼이 안 감김(+70), 배지 라벨이 화면을 밀어냄(+8). 전부 조치 후 0.

### 10.3 모션

| 클래스 | ON | 모션 줄이기 ON |
|---|---|---|
| `.anim-page` (라우트 전환) | pageIn 260ms | none |
| `.nav-bar-in` (활성 메뉴 바) | barIn 240ms | none |
| `.progress > span::after` (sheen) | barSheen 2.4s ×2 | none |
| `.coach-glow` | coachGlow 3s | none |

### 10.4 회귀

tsc 0 · eslint 0 · build 30 routes · pageerror 0 · 회귀 스위트 5종 통과.
act/quote 스위트의 "완료 처리" 단계는 그날 시드에 기한 초과 업무가 없으면 SKIP으로 처리하도록 수정
(날짜가 바뀌면 시드가 달라지는데 테스트가 항목 제목을 하드코딩하고 있었다. 변경 전 커밋에서도 동일하게 재현됨 = 회귀 아님).

---

## 11. 기성고 2단계 대응 검증 (2026-09-12, 고도화 8차)

전부 실제 구동으로 확인. 로그는 localStorage의 store 상태를 직접 읽어 대조했다.

### 11.1 인증 · 권한

| 검증 | 결과 |
|---|---|
| 잘못된 비밀번호 | 거절 — "아이디 또는 비밀번호가 올바르지 않습니다. (1/5)" |
| 존재하지 않는 계정 | 거절 |
| 실패가 Event로 기록 | `sign_in_failed` 생성 확인 |
| 올바른 자격증명 | `/ax/dashboard` 진입, 세션 `{userId:"u_admin",role:"admin",signedInAt:…}` |
| 로그인 Event | "로그인: 김영돈 대표이사" |
| 헤더 대표/직원 토글 | 제거됨 |
| 설정 Role 미리보기 | 제거됨 |
| 컨설턴트 계정의 승인 버튼 | 0개 |
| **내부 계정이 Portal에서 자료 제출** | **차단 — 파일 16건 그대로, `permission_denied` 기록: "권한 없음으로 거절: 자료 제출 (매출채권 연령표)"** |
| 고객 계정의 같은 행동 | 정상 (16 → 17건) |
| 고객의 `/ax/dashboard` 접근 | `/portal`로 차단 |
| 권한표 | 정책 모듈에서 18행 생성 |

차단이 화면이 아니라 store 액션에서 일어난다는 근거: UI 가드를 제거하고 액션을 호출했을 때 데이터가 변하지 않았고 `permission_denied` Event가 남았다.

### 11.2 기업고객 · 프로젝트 CRUD

| 검증 | 결과 |
|---|---|
| 기업고객 등록 버튼 | 노출 (`company.create` 보유 시) |
| 필수값 검증 | "기업명은 필수입니다" 표시, 저장 차단 |
| 기업 생성 | 6 → 7개사, code=G 자동 부여, 상세로 이동 |
| 생성 Event | "기업고객 등록: 테스트정공(주)" |
| 기업 수정 | 업종 변경 반영 |
| 수정 Event | "기업정보 수정: 테스트정공(주) — 업종" (변경 필드까지 기록) |
| 프로젝트 생성 | 8 → 9건, stage=consult, type=정책자금 |
| 생성 Event | "프로젝트 등록: 에이정밀(주) — 시험 정책자금 프로젝트" |
| 프로젝트 수정 | 이름 변경 반영, Event "프로젝트 수정: … — 프로젝트명" |

### 11.3 일정 · 업무 수정/삭제

| 검증 | 결과 |
|---|---|
| 일정 수정 | "씨엠푸드 자문계약 서명 확인" → "일정 수정 테스트", Event 기록 |
| 일정 삭제 | 13 → 12건, Event 기록 |
| 업무 수정 | 제목·우선순위(urgent) 반영, Event에 변경 필드 기록 |
| 업무 삭제 | 12 → 11건, Event 기록 |

### 11.4 회귀

tsc 0 · eslint 0 · build 30 routes · pageerror 0.
회귀 스위트 5종 통과 — quote/loop 스위트는 Portal 단계를 고객 계정 로그인으로 바꿔야 통과한다
(미리보기 읽기 전용화에 따른 **의도된** 변경이며, 이 수정 자체가 차단이 실제로 동작한다는 증거다).
가로 오버플로 0 (글자 4단계 × 360/390/768/1280/1440 × AX 17 route · Portal 9 route).
