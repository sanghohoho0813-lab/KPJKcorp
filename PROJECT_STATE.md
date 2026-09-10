# PROJECT_STATE — KPJK Consulting AX + Client Portal

> SPEC = 어디까지 갈 것인가 / STATE = 지금 어디까지 왔는가
> Last updated: 2026-09-10 (Sidebar IA 재편)

## PROJECT FINAL OBJECTIVE
KPJK의 경영컨설팅 업무를 기억·카톡·개별파일 의존 구조에서 **기업고객 중심 통합 데이터 운영체계**로 전환. 고객 문의→상담→계약→자료요청→제출→검토→진행→결과→사후관리가 하나의 시스템에서 이어지고, 고객이 Portal로 직접 참여한다.

## 현재 상태
**Demo Ready** (First Build · 목표 대비 약 75%)

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
- [x] 상담/계약 — 구조화 요약 + AI READY, 계약 상태
- [x] Documents — KPI 4 + 필터 + 검토 Modal(검토 시작/보완 요청/검토 완료) + 안내 초안
- [x] Schedule — List(일자 그룹) + Calendar + 등록
- [x] Tasks — 오늘/미완료/초과/완료 + 상태 변경 + 자동 생성 표시 + 등록
- [x] Inquiries — Queue + 대화형 답변 + 초안 제안 + 종료
- [x] Results — 공유 목록 + 열람 횟수
- [x] AI Brief — 긴급/오늘 중 + 담당자별 + 판단 규칙 공개
- [x] Reports — KPI 측정지점 표 + 운영 현황 + Evidence Log + CSV

### PLATFORM CORE
- [x] Portal Home(5초 테스트: 진행률·현재 단계·다음 일정·요청자료·담당자) / Timeline(7 Step) / Documents(업로드·재제출·보완 사유) / Schedule / Results(열람 기록) / Inquiries(작성·추가문의) / Notifications / Me

### CLOSED LOOP (실동작 검증)
- [x] PRIMARY: Portal 업로드 → AX 알림 + 검토 Task 자동 생성 + 상태 submitted → 검토 완료/보완 요청 → Portal 상태·알림 반영 → 단계 변경 → Portal Timeline 반영
- [x] SECONDARY: Portal 문의 → AX Queue + 응대 Task → 답변 → Portal 반영 + 알림
- [x] 자료 요청 등록 / 일정 등록 / 결과자료 공유 → 고객 알림

## 진행중
- 없음 (First Build 종료)

## 미완료 (CONDITIONAL / NEXT)
- [ ] Supabase Auth · RLS · Storage (실데이터 연결)
- [ ] LLM API 연결 (AI-01 상담 요약, AI-05 톤 조정)
- [ ] 알림 발송 채널 (카카오/이메일) — NEXT-01
- [ ] AX Owner 지정 필드 (설정)
- [ ] 상담 기록 직접 작성 UI (현재 Seed 표시)

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
- 2026-09-10 Sidebar IA 재편 — 12개 메뉴를 4 Group(핵심 운영 / AI · 분석 / 시스템 / 향후 확장)으로 분류. 그룹당 아이콘 색 1계열 통일(`--nav-*`), 메뉴별 개별 색 제거. 핵심 운영 순서를 실제 흐름(고객 → 상담·계약 → 프로젝트 → 실행 → 소통 → 결과)으로 조정. Active = 좌측 Accent Bar + Pill. 향후 확장은 기본 접힘 Accordion. 모바일 더보기 Sheet도 동일 구조. Route·기능 변경 없음
- 2026-09-08 First Build 완료 (PASS 1 설계 잠금 → PASS 2 구현 → PASS 3 Red Team 1회)
