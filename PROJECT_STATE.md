# PROJECT_STATE — KPJK Consulting AX + Client Portal

> SPEC = 어디까지 갈 것인가 / STATE = 지금 어디까지 왔는가
> Last updated: 2026-09-11 (코치 강조 · 도입 전후 비교 · 심사 관점 설명)

## PROJECT FINAL OBJECTIVE
KPJK의 경영컨설팅 업무를 기억·카톡·개별파일 의존 구조에서 **기업고객 중심 통합 데이터 운영체계**로 전환. 고객 문의→상담→계약→자료요청→제출→검토→진행→결과→사후관리가 하나의 시스템에서 이어지고, 고객이 Portal로 직접 참여한다.

## 현재 상태
**Server Ready** (서버 연결 코드·스키마·권한 완료 / 대표님 PC 에서 첫 연결 확인 대기)

## STRATEGIC GATES
| Gate | 상태 |
|---|---|
| PRIMARY CONSTRAINT | 잠김 (SPEC §1) — 핵심 기능의 60~70% 이상이 Constraint 직결 (Client Card·Brief·Doc Center·Portal·Closed Loop) |
| MONEY KPI / BASELINE | 측정지점 3종(Efficiency/Customer/Scale) 정의 + Event Log 기록 구조 완료. **BASELINE: REQUIRED / UNKNOWN**. 개선율 미표시 |
| DATA FOUNDATION | SSOT Entity 15종, Repository 분리(seed/store). Activity Append-only |
| AI / LOGIC | AI-02·03·04·05 규칙/템플릿으로 실동작. AI-01 AI READY. 외부 LLM 미연결 (Hard Blocker: API Key) |
| PROOF | Evidence Log(Activity) + CSV Export + KPI 측정지점 표. Demo 값에 성과 표현 없음 |
| ADOPTION READINESS | 직원 이익: 아침 브리핑·자동 검토 Task·문의 Queue. 고객 이익: 5초 현황·직접 제출. AX Owner 필드는 미구현(설정에 추가 예정) |
| RISK / GOVERNANCE | 모든 AI L1. 고객 Role 데이터 격리(companyId 필터). 실제 RLS는 CONDITIONAL |
| PLATFORM READINESS | Portal HIGH(구현) / Industry Platform LOW(NOT BUILDING) |
| EVIDENCE | 18종 Event Type 기록. Portal login/download까지 포함 |
| RED TEAM | 1회 실행 (QA_REPORT.md §Red Team) |

## 완료 (First Build)
### SYSTEM CORE
- [x] App Shell — AX Sidebar 280px / Header(Live Clock·Role Switch·Surface Switch·Device Preview·Presentation·Tutorial·Notifications) / Mobile Bottom Nav + 더보기 Sheet
- [x] Portal Shell — Header / Mobile Bottom Nav(홈·진행현황·자료제출·문의·MY) / 관리자 미리보기 Bar
- [x] Settings — Theme 10종(KPJK Signature + Canonical 9) 실동작, Font Scale 3단, Motion, Role Preview, Permission Matrix, Demo Reset, Tutorial Replay, Data Source, AI 상태, 기술자산, NEXT
- [x] Tutorial — AX 5 Step / Portal 3 Step, 실제 Route 이동 + Spotlight, Overlay cleanup
- [x] Presentation Mode — 10 Step Guided Demo (AX↔Portal 자동 이동)
- [x] Why AX — 14 Section 회사 맞춤 Story + 사진 2장 + Dashboard 복귀 CTA
- [x] Device Preview — Desktop→Mobile(390×780), Mobile→PC(1280 scale), 재귀 금지, 동일 Route/Data
- [x] Surface Switch — AX [고객 화면 보기] ↔ Portal [Business AX 보기] 왕복, 기업 변경
- [x] Live Clock (초 단위), Demo Badge, NEXT Sheet(5개), Toast, Modal/Drawer/Sheet Escape

### BUSINESS CORE
- [x] Dashboard — KPI 6 + Today Brief(규칙 엔진, 왜?) + 먼저 확인할 기업 + 최근 프로젝트 + 이번 주 일정 + 최근 문의
- [x] Enterprise Client Card — Header/Quick Status/9 Tab(Overview·상담·계약·프로젝트·요청자료·일정·문의·결과자료·History)
- [x] Projects — Board(8 컬럼)/List, Detail(Dual Progress 11↔7, 요약, 누락 체크, 이력, 단계 변경, 자료 요청, 일정/업무 등록, 결과자료 공유)
- [x] 상담 · 견적 · 계약 — 구조화 요약 + AI READY, 상담 기록 직접 작성(다음 Action → 후속 업무 자동 등록), **견적 작성·할인 승인·발송·계약 전환**
- [x] Documents — KPI 4 + 필터 + 검토 Modal(검토 시작/보완 요청/검토 완료) + 안내 초안
- [x] Schedule — List(일자 그룹) + Calendar + 등록
- [x] Tasks — 오늘/미완료/초과/완료 + 상태 변경 + 자동 생성 표시 + 등록
- [x] Inquiries — Queue + 대화형 답변 + 초안 제안 + 종료
- [x] Results — 공유 목록 + 열람 횟수
- [x] AI Brief — 긴급/오늘 중 + 담당자별 + 판단 규칙 공개 + **항목별 즉시 실행 버튼**(초안·업무·일정·단계변경·기회등록·완료처리)
- [x] Reports — KPI 측정지점 표 + 운영 현황 + Evidence Log + CSV

### PLATFORM CORE
- [x] Portal Home(5초 테스트: 진행률·현재 단계·다음 일정·요청자료·담당자) / Timeline(7 Step) / Documents(업로드·재제출·보완 사유) / Schedule / Results(열람 기록) / Inquiries(작성·추가문의) / Notifications / Me

### AX 실증 (2026-09-11 추가)
- [x] AX 코치 — 14일 스프린트, 오늘의 미션 1~3개, 코치 한 줄 지시, 실증 시작/초기화
- [x] 미션 14종 — 전부 실제 업무. Event 기록 여부로 자동 완료 판정
- [x] Evidence Coverage 6영역 — Activity Log 실측 건수 / 14일 목표 건수
- [x] 도입 전후 비교 — 대표가 입력한 Before 6항목 ↔ 시스템 실측 After, 차이 자동 계산 (표본 수 병기)
- [x] 왜 이 기록이 필요한가 — 자금조달·투자 심사 관점 설명을 코치/리포트에서 공유
- [x] 리포트 첫 탭 "실증 진행" — Coverage + 미션 진행 + AX 코치 연결
- [x] `ai_action_taken` / `evidence_exported` Event — 추천 후 실행, 내보내기 기록

### 매출 · 승인 (2026-09-11 추가)
- [x] Opportunity — 고객 관심표시/상담요청, 내부 등록, 규칙 발견 4개 소스. 6단계 파이프라인
- [x] 대표 승인 Workflow — 제안 승인 / 할인 승인 / 고객 약속 3종. 승인은 대표 계정에서만, 결정 시 후속 Task 자동 생성
- [x] 할인 승인 요청 진입점 — 상담·계약 화면의 계약별 요청 모달 (금액·할인율·사유)
- [x] Portal 함께 검토 — 서비스 7종 카탈로그 + 규칙 기반 추천 + 근거 문장 노출 + 내 요청 현황
- [x] AX 고도화 설문 — 9섹션 20문항 전부 클릭형, 자유입력 1개, `SurveyResponse`로 저장

### CLOSED LOOP (실동작 검증)
- [x] PRIMARY: Portal 업로드 → AX 알림 + 검토 Task 자동 생성 + 상태 submitted → 검토 완료/보완 요청 → Portal 상태·알림 반영 → 단계 변경 → Portal Timeline 반영
- [x] SECONDARY: Portal 문의 → AX Queue + 응대 Task → 답변 → Portal 반영 + 알림
- [x] QUATERNARY: 견적 작성 → (할인 시) 대표 승인 → 발송 + 회신 확인 Task → 고객 Portal 수락/보류 → 후속 Task → 계약 전환 + 매출기회 자동 종료
- [x] TERTIARY: Portal 관심표시 → 기회 생성 + 상담연락 Task → 담당자 확인 → 대표 승인 요청 → 승인 → 제안 Task 자동 생성 + 기회 단계 이동
- [x] 자료 요청 등록 / 일정 등록 / 결과자료 공유 → 고객 알림

## 진행중
- 없음 (고도화 1차 종료). 다음 작업은 `BACKLOG.md` 상단부터.

## 미완료 (CONDITIONAL / NEXT)
- [ ] Supabase Auth · RLS · Storage (실데이터 연결)
- [ ] LLM API 연결 (AI-01 상담 요약, AI-05 톤 조정)
- [ ] 알림 발송 채널 (카카오/이메일) — NEXT-01
- [ ] AX Owner 지정 필드 (설정)

## 현재 Demo 기능 / 실제 연결된 기능
- Demo: 전부 (브라우저 로컬 Store). 파일은 메타만 기록
- Live: 없음

## 알려진 문제
- Next dev 모드에서 화면 좌하단 "N" Dev 배지가 모바일 Bottom Nav와 겹침 (production build에서는 없음)
- 20시간 경과 시 자동 Reseed → 시연 중 만든 Action 초기화 (DECISIONS #7)
- Pretendard 폰트는 첫 화면 이후 비동기 로드 (CDN 실패 시 시스템 폰트 유지, 화면은 막히지 않음)
- 첫 로드 시 Skeleton이 아주 짧게 보임 — SSR/클라이언트 일치를 위한 의도된 동작 (persist skipHydration)
- 파일은 메타만 저장, 결과자료 "열람"은 기록만 남김 (실제 파일 저장소 없음 — CONDITIONAL)

## 다음 최우선 작업
1. KPJK 대표 시연 → 실제 업무 흐름과 11단계/자료 상태 명칭 확정
2. Baseline 측정 항목 확정 (SPEC §1 KPI 3종)
3. Supabase 전환 결정 시 migrations + RLS + Storage

## USER ACTION QUEUE
- [OPTIONAL] ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 제공 시 AI-01 실제 연결
- [OPTIONAL] KPJK 실제 CI(로고·색) 제공 시 Signature Theme 조정
- [OPTIONAL] Vercel 배포: `npm run build` 통과 확인됨, 환경변수 불필요

## 최근 주요 변경
- 2026-09-22 고도화 15차 — 첫 사용 경험(기업 0개일 때 대시보드 5단계 "처음 시작하기" 체크리스트, 권한별 단계, 등록 창·설정 섹션이 열린 채로 진입), 목록 4곳의 진짜 빈 상태 + 다음 행동 버튼, 설정 모바일 접이식(10,494px → 1,198px), 폰 손가락 타깃 36px 미만 0개, 업무함·기업 상세의 세로 눌림 버그 수정, 서버 모드 샘플 복원 숨김
- 2026-09-17 고도화 14차 — 도입 전 기준선 조사(7단계 15문항, 자유입력 1개 빼고 전부 클릭 · 중간저장 · 결과 4묶음 요약 · 복사 · A4 1장 인쇄). 기존 Baseline 6개 자동 연결 + 진행상황 문의 지표 추가. 조직 공용 설정이 서버로 동기화되지 않던 문제와 인쇄물 빈 페이지 문제 수정\n- 2026-09-16 고도화 13차 — **서버 연결(Supabase)**: 표 19개 + 접근권한(RLS) 32항목 검증 통과, Supabase Auth 로그인·계정관리·비밀번호 재설정, 스토어 set() 한 곳을 감싼 자동 동기화(화면·액션 코드 무변경), 파일 실제 업로드/다운로드(버킷 2개), 컨설턴트 열람 범위 전환, 설치 안내서. 환경변수가 없으면 기존 데모 모드 그대로\n- 2026-09-15 고도화 12차 — 기업고객 등록을 클릭 위주로 재설계(칩 10종·자동 서식·필수 2개), 사업자등록증·등기부등본 PDF/사진/붙여넣기 → 기본 정보 자동 채우기(pdfjs-dist + tesseract.js, 확인 후 반영, 파일 미저장), 기업 정보 16개 확장 필드, 샘플 6개 지우기/다시 보기(직접 등록 데이터 보존, 삭제 시 운영 모드 자동 켬)
- 2026-09-15 고도화 11차 — 운영 모드(자동 초기화 중지)·백업 내보내기/가져오기, 견적서·실증 리포트 인쇄(브라우저 PDF), 모바일 빠른 승인, Portal 다음 예정 표시
- 2026-09-15 고도화 10차 — 전역 검색(⌘K, 9종), 견적 수정·계약 직접 등록·결과자료 회수, 시간 규칙 5종 자동 업무 + 규칙 설정 화면, 설문 응답 집계
- 2026-09-12 고도화 9차 — 사용자 계정 관리(생성·수정·중지·비밀번호 재설정), 자료요청 수정·취소, 상담기록 수정·삭제, 기업·프로젝트 보관(하드 삭제 대신)
- 2026-09-12 고도화 8차 — 기업고객·프로젝트 등록/수정 신설, 자격증명 로그인(역할 전환 버튼 제거), 권한을 정책 모듈로 통합해 쓰기 액션 25곳에서 강제, 고객 Portal 미리보기 읽기 전용화, 일정·업무 수정/삭제
- 2026-09-12 고도화 7차 — 글자 크기 4단계(현재 크기가 최소값) + 헤더 스테퍼, 사이드바 로고 재구성(KPJK CORPORATION / Business AX), 메뉴 위치 하향, 테마 2종 제거(8종), 모션 레이어 확장
- 2026-09-11 고도화 6차(자체 점검) — 색 대비 전면 교정(accent 10종 · 상태색 · 보조 텍스트), 실증 14일 종료 상태 신설, 견적 유효기간 경과 안내, 모바일 터치 타깃/제목 잘림 수정, 렌더 중 시각 참조·조건부 Hook 제거
- 2026-09-11 고도화 5차 — AX 코치 박스 강조(연한 brand tint + 3초 주기 glow, 모션 끄기 존중), 자금조달·투자 심사 관점 부연설명, 도입 전후 비교(Baseline 입력 + 실측 대비)
- 2026-09-11 고도화 4차 — AX Coach / Evidence 모듈 신설(14일 실증, 미션 14개, Coverage 6영역, 리포트 실증 탭). 사이드바 13 → 9개(3그룹 + Utility), 문의를 업무함 탭으로 통합, 대시보드 KPI 6 → 4. 모바일 세로 길이 축소(MoreButton), 기능적 모션(CountUp · stagger · pop-in)
- 2026-09-11 고도화 3차 — 견적 워크플로(상담 → 견적 → 계약) 신설. 할인은 승인 전 발송 차단, 고객 Portal 회신, 계약 전환 시 기회 자동 종료. 브리핑에 견적 회신 대기 규칙 + 완료 되돌리기. 리포트 매출 축에 견적 4지표
- 2026-09-11 고도화 2차 — AI 브리핑을 "말하는 화면"에서 "처리하는 화면"으로 전환(항목별 실행 버튼 7종), 이탈 위험·재상담 규칙 2종 추가, 상담 기록 직접 작성 UI. 브리핑 모바일 레이아웃 압축
- 2026-09-11 고도화 1차 — 매출기회 Closed Loop(TERTIARY), 대표 승인 Workflow, AX 고도화 설문, 테마 뿌연 현상 제거, 모바일 가로스크롤 전면 제거, 대시보드 우선순위 재구성, 리포트 4축 Evidence. 상세는 `BACKLOG.md`
- 2026-09-10 Sidebar IA 재편 — 12개 메뉴를 4 Group(핵심 운영 / AI · 분석 / 시스템 / 향후 확장)으로 분류. 그룹당 아이콘 색 1계열 통일(`--nav-*`), 메뉴별 개별 색 제거. 핵심 운영 순서를 실제 흐름(고객 → 상담·계약 → 프로젝트 → 실행 → 소통 → 결과)으로 조정. Active = 좌측 Accent Bar + Pill. 향후 확장은 기본 접힘 Accordion. 모바일 더보기 Sheet도 동일 구조. Route·기능 변경 없음
- 2026-09-08 First Build 완료 (PASS 1 설계 잠금 → PASS 2 구현 → PASS 3 Red Team 1회)
