import type { Activity, Approval, Company, Consultation, Contract, DocumentRequest, Inquiry, Notification, Opportunity, Project, Quote, ResultFile, Schedule, SurveyResponse, Task, User, Notice, CompanyVault, CompanyFile, JournalEntry, Payment, SupportProgram, Lead } from "../types";
import { addDays, iso } from "../format";

/**
 * DEMO SEED — 실제 고객 데이터가 아닌 중립 샘플.
 * 모든 날짜는 "오늘" 기준 상대값으로 생성되어 시연이 항상 현재처럼 보인다.
 * 실데이터 연결 시 이 파일만 교체한다 (UI 재작성 없음).
 */
/** 샘플 내용의 판 — 샘플을 고치면 올린다. 데모 브라우저에 저장된 예전 샘플이 다음 접속 때 새 샘플로 바뀐다. */
export const SEED_REV = "2026-10-06";

export interface SeedData {
  users: User[];
  companies: Company[];
  consultations: Consultation[];
  contracts: Contract[];
  projects: Project[];
  docRequests: DocumentRequest[];
  schedules: Schedule[];
  tasks: Task[];
  inquiries: Inquiry[];
  results: ResultFile[];
  opportunities: Opportunity[];
  quotes: Quote[];
  approvals: Approval[];
  surveys: SurveyResponse[];
  notices: Notice[];
  companyVaults: CompanyVault[];
  companyFiles: CompanyFile[];
  journal: JournalEntry[];
  payments: Payment[];
  activities: Activity[];
  notifications: Notification[];
  /** 지원사업 공고 — 데모에도 지어낸 공고는 넣지 않는다(빈 목록에서 시작) */
  programs: SupportProgram[];
  leads: Lead[];
}

export function buildSeed(now = new Date()): SeedData {
  const d = (days: number, hour?: number, minute = 0) => iso(addDays(now, days, hour, minute));

  // 데모 비밀번호 — 내부 kpjk2026! / 고객 client2026! (해시는 auth.ts의 salt 기준)
  // 운영 전환 시 이 시드는 통째로 제거되고 실제 계정으로 대체된다.
  const users: User[] = [
    { id: "u_admin", name: "김영돈", role: "admin", title: "대표이사", email: "ceo@kpjk.co.kr", phone: "010-0000-0001" , passwordHash: "5c43dd980fab03054d3d1ff85be0c5ab7764e1edb89d9e6899bd7a5fdbd68f95", active: true },
    { id: "u_park", name: "박성훈", role: "consultant", title: "이사", email: "park@kpjk.co.kr", phone: "010-0000-0002" , passwordHash: "83a1abfc84a8496f17ab5573591903563b4dd6bf01012dbf0b10f7a3cd767a75", active: true },
    { id: "u_lee", name: "이주연", role: "consultant", title: "수석 컨설턴트", email: "lee@kpjk.co.kr", phone: "010-0000-0003" , passwordHash: "780b602c8eff17d0fd1dfabc3a6c1ef72be20600fac61bd4fdda311301274b59", active: true },
    { id: "u_jung", name: "정민재", role: "consultant", title: "컨설턴트", email: "jung@kpjk.co.kr", phone: "010-0000-0004" , passwordHash: "f6600e07506173e38415a202293da29148d0670c096b18586e0a302229b30b6d", active: true },
    { id: "c_a", name: "김민석", role: "client", title: "대표이사", email: "ceo@a-precision.demo", companyId: "co_a" , passwordHash: "1a5e3d3ab33a7695598ba364c68301e2f305cc4583c2043cc4c434d489c2bb72", active: true },
    { id: "c_b", name: "최수진", role: "client", title: "경영지원팀장", email: "choi@bntech.demo", companyId: "co_b" , passwordHash: "8db443b0b697bc3ef929656a1404791a6af7fac66b091dde5abba5302a05adda", active: true },
    { id: "c_c", name: "한도윤", role: "client", title: "대표이사", email: "han@cmfood.demo", companyId: "co_c" , passwordHash: "d78444076ba691b08525ec3eb3c15e6863df6567af1f51d326a6bf3a7f891b52", active: true },
    { id: "c_d", name: "오세훈", role: "client", title: "관리이사", email: "oh@d1const.demo", companyId: "co_d" , passwordHash: "f6d6adfbdcbd2af1221b6bf4ad3a57ccd948a28c4f89f165c4d76f105bb8800c", active: true },
    { id: "c_e", name: "서지혜", role: "client", title: "대표이사", email: "seo@eplusbio.demo", companyId: "co_e" , passwordHash: "123a1bc30697964171d8745f27186e25438db1315624a1feda0edce7fd4fae34", active: true },
    { id: "c_f", name: "윤태호", role: "client", title: "대표이사", email: "yoon@flogis.demo", companyId: "co_f" , passwordHash: "9a6f27ad00a70bad34346492be53f35a07398b4684fe379284f5d2ce7c06827f", active: true },
  ];

  const companies: Company[] = [
    { sample: true, id: "co_a", code: "A", name: "에이정밀(주)", ceo: "김민석", industry: "정밀부품 제조", bizNo: "000-81-00001", contactName: "김민석", contactTitle: "대표이사", contactPhone: "010-1000-0001", contactEmail: "ceo@a-precision.demo", address: "경기 화성시", employees: 118, revenue: "420억", firstConsultDate: d(-46), consultantId: "u_park", memo: "2세 승계 준비 중. 원가구조 개선과 조직 재정비가 핵심 관심사.",
      // 고객 화면 "우리 회사 한눈에" 예시 — 샘플 회사의 예시 수치(화면에 "샘플 회사 · 예시 수치"로 표시)
      entityType: "corporation", establishedAt: "2009-04-01", bizCategory: "제조업", bizItem: "정밀기계부품", region: "경기",
      contractStartedAt: d(-40).slice(0, 10),
      financials: [
        { year: now.getFullYear() - 3, revenue: 36_100_000_000, operatingProfit: 1_820_000_000, source: "재무제표(예시)" },
        { year: now.getFullYear() - 2, revenue: 38_900_000_000, operatingProfit: 2_050_000_000, source: "재무제표(예시)" },
        { year: now.getFullYear() - 1, revenue: 42_000_000_000, operatingProfit: 2_310_000_000, source: "재무제표(예시)" },
      ] },
    { sample: true, id: "co_b", code: "B", name: "비앤테크(주)", ceo: "최민호", industry: "IT 솔루션", bizNo: "000-81-00002", contactName: "최수진", contactTitle: "경영지원팀장", contactPhone: "010-1000-0002", contactEmail: "choi@bntech.demo", address: "서울 구로구", employees: 42, revenue: "68억", firstConsultDate: d(-21), consultantId: "u_lee", memo: "연구소 설립 후 R&D 세액공제 활용 희망. 담당자가 실무 총괄." },
    { sample: true, id: "co_c", code: "C", name: "씨엠푸드(주)", ceo: "한도윤", industry: "식품 제조", bizNo: "000-81-00003", contactName: "한도윤", contactTitle: "대표이사", contactPhone: "010-1000-0003", contactEmail: "han@cmfood.demo", address: "충북 청주시", employees: 65, revenue: "150억", firstConsultDate: d(-62), consultantId: "u_park", memo: "신공장 증설 자금 준비. 대표가 직접 의사결정, 빠른 회신 선호." },
    { sample: true, id: "co_d", code: "D", name: "디원건설(주)", ceo: "오세훈", industry: "종합건설", bizNo: "000-81-00004", contactName: "오세훈", contactTitle: "관리이사", contactPhone: "010-1000-0004", contactEmail: "oh@d1const.demo", address: "대전 유성구", employees: 88, revenue: "260억", firstConsultDate: d(-70), consultantId: "u_jung", memo: "현장 중심 조직. 내부 의사결정이 느린 편이라 후속연락 주기 관리 필요." },
    { sample: true, id: "co_e", code: "E", name: "이플러스바이오(주)", ceo: "서지혜", industry: "바이오 소재", bizNo: "000-81-00005", contactName: "서지혜", contactTitle: "대표이사", contactPhone: "010-1000-0005", contactEmail: "seo@eplusbio.demo", address: "인천 송도", employees: 27, revenue: "35억", firstConsultDate: d(-3), consultantId: "u_lee", memo: "지인 소개로 문의. 벤처확인·법인 정관 정비 관심." },
    { sample: true, id: "co_f", code: "F", name: "에프물류(주)", ceo: "윤태호", industry: "물류·운송", bizNo: "000-81-00006", contactName: "윤태호", contactTitle: "대표이사", contactPhone: "010-1000-0006", contactEmail: "yoon@flogis.demo", address: "경기 이천시", employees: 54, revenue: "92억", firstConsultDate: d(-120), consultantId: "u_jung", memo: "운영개선 컨설팅 완료. 사후관리 중, 만족도 높음. 추천 고객 가능성." },
  ];

  const projects: Project[] = [
    { id: "pj_a1", companyId: "co_a", name: "경영진단 컨설팅", type: "경영진단", consultantId: "u_park", startDate: d(-40), dueDate: d(14), stage: "review", description: "원가구조·조직·재무 3개 축 진단 후 개선 로드맵 제시", stageChangedAt: d(-2), clientVisible: true },
    { id: "pj_b1", companyId: "co_b", name: "기업부설연구소 설립 자문", type: "연구소", consultantId: "u_lee", startDate: d(-18), dueDate: d(21), stage: "doc_request", description: "연구전담요원 요건 검토, 연구공간 구획, 신고서류 준비", stageChangedAt: d(-6), clientVisible: true },
    { id: "pj_c1", companyId: "co_c", name: "정책자금 준비 컨설팅", type: "정책자금", consultantId: "u_park", startDate: d(-55), dueDate: d(7), stage: "drafting", description: "신공장 증설 자금 — 사업계획서 및 기관 제출자료 준비", stageChangedAt: d(-4), clientVisible: true },
    { id: "pj_c2", companyId: "co_c", name: "법인 경영자문", type: "법인자문", consultantId: "u_park", startDate: d(-5), dueDate: d(60), stage: "contract", description: "가지급금·배당·정관 정비 연간 자문", stageChangedAt: d(-1), clientVisible: true },
    { id: "pj_d1", companyId: "co_d", name: "기업 운영개선 컨설팅", type: "운영개선", consultantId: "u_jung", startDate: d(-60), dueDate: d(10), stage: "in_progress", description: "현장-본사 보고체계 표준화 및 원가 누락 개선", stageChangedAt: d(-9), clientVisible: true },
    { id: "pj_e1", companyId: "co_e", name: "법인 경영자문", type: "법인자문", consultantId: "u_lee", startDate: d(-3), dueDate: d(45), stage: "consult", description: "벤처기업확인·정관 정비·초기 세무 구조 자문", stageChangedAt: d(-3), clientVisible: true },
    { id: "pj_f1", companyId: "co_f", name: "기업 운영개선 컨설팅", type: "운영개선", consultantId: "u_jung", startDate: d(-115), dueDate: d(-30), stage: "aftercare", description: "배차·정산 프로세스 개선. 완료 후 3개월 사후관리", stageChangedAt: d(-48), clientVisible: true },
    { id: "pj_a2", companyId: "co_a", name: "기업인증 자문 (메인비즈)", type: "기업인증", consultantId: "u_park", startDate: d(-80), dueDate: d(-20), stage: "done", description: "메인비즈 인증 신청 자문. 완료.", stageChangedAt: d(-20), clientVisible: true },
  ];

  const consultations: Consultation[] = [
    {
      id: "cs_a1", companyId: "co_a", projectId: "pj_a1", date: d(-46, 14), consultantId: "u_park", type: "초기상담", channel: "방문",
      notes: "김민석 대표와 초기 상담. 2세 승계를 3년 내 준비 중이며 원가구조가 불투명한 점을 가장 큰 고민으로 언급. 조직도상 관리자 역할 중복. 재무제표는 회계법인에서 관리 중. 진단 범위를 원가·조직·재무 3개 축으로 제안, 대표 동의. 자료는 경영지원팀 통해 제출하기로 함.",
      summary: { core: ["2세 승계 3년 내 준비", "원가구조 불투명이 최대 고민", "관리자 역할 중복"], requirements: ["원가·조직·재무 통합 진단", "개선 로드맵 우선순위 제시"], promises: ["진단 범위 제안서 1주 내 송부", "자료 요청 목록 정리"], documents: ["최근 3년 재무제표", "월별 매출·원가 현황", "조직도/인원현황", "주요 거래처 목록"], nextAction: "제안서 송부 및 계약 협의" },
    },
    {
      id: "cs_a2", companyId: "co_a", projectId: "pj_a1", date: d(-12, 10), consultantId: "u_park", type: "후속상담", channel: "화상",
      notes: "제출자료 1차 검토 결과 공유. 매출채권 연령표가 누락되어 보완 요청. 대표 미팅을 2주 후로 잡기로 함.",
      summary: { core: ["1차 검토 결과 공유", "매출채권 연령표 보완 필요"], requirements: ["대표 보고 시 원가 개선안 우선"], promises: ["대표 미팅 일정 확정"], documents: ["매출채권 연령표"], nextAction: "보완자료 접수 후 결과안 작성" },
    },
    {
      id: "cs_b1", companyId: "co_b", projectId: "pj_b1", date: d(-21, 15), consultantId: "u_lee", type: "초기상담", channel: "방문",
      notes: "최수진 팀장과 상담. 개발인력 8명 중 연구전담요원 요건 충족자 확인 필요. 별도 연구공간 구획 가능. 설립 후 세액공제 활용이 목표.",
      summary: { core: ["연구소 설립 목적은 R&D 세액공제", "개발인력 8명, 요건 검토 필요"], requirements: ["연구전담요원 요건 검토", "연구공간 구획 자문"], promises: ["요건 체크리스트 송부"], documents: ["연구인력 명단 및 학력·경력", "4대보험 가입자 명부", "사무실 평면도", "사업자등록증"], nextAction: "자료 요청 및 요건 검토" },
    },
    {
      id: "cs_c1", companyId: "co_c", projectId: "pj_c1", date: d(-62, 11), consultantId: "u_park", type: "초기상담", channel: "방문",
      notes: "한도윤 대표. 신공장 증설에 약 30억 필요. 기존 거래은행 한도 소진. 정책자금 활용 방안 논의. 사업계획서 작성 지원 요청.",
      summary: { core: ["신공장 증설 자금 필요", "기존 은행 한도 소진"], requirements: ["정책자금 적합 기관 검토", "사업계획서 작성 지원"], promises: ["기관별 요건 비교표 제공"], documents: ["재무제표 3년", "증설 계획 및 견적", "부채현황", "고용현황"], nextAction: "자료 접수 후 기관 적합성 검토" },
    },
    {
      id: "cs_c2", companyId: "co_c", projectId: "pj_c2", date: d(-5, 16), consultantId: "u_park", type: "후속상담", channel: "전화",
      notes: "정책자금 건 진행 중 가지급금 이슈 언급. 연간 법인자문 계약 제안, 대표 긍정적. 계약서 송부 예정.",
      summary: { core: ["가지급금 정리 필요", "연간 자문 제안에 긍정적"], requirements: ["가지급금·배당·정관 정비"], promises: ["계약서 송부"], documents: [], nextAction: "계약서 송부 및 서명" },
    },
    {
      id: "cs_d1", companyId: "co_d", projectId: "pj_d1", date: d(-70, 14), consultantId: "u_jung", type: "초기상담", channel: "방문",
      notes: "오세훈 이사. 현장별 보고가 카톡/전화로 이루어져 본사 원가 집계가 늦음. 표준 보고 양식과 주간 회의체 도입 논의.",
      summary: { core: ["현장 보고 비표준화", "원가 집계 지연"], requirements: ["보고체계 표준화", "원가 누락 개선"], promises: ["현황 진단 후 개선안 제시"], documents: ["현장별 원가 보고 샘플", "조직도", "월별 손익"], nextAction: "자료 요청" },
    },
    {
      id: "cs_e1", companyId: "co_e", projectId: "pj_e1", date: d(-3, 10), consultantId: "u_lee", type: "초기상담", channel: "화상",
      notes: "서지혜 대표. 창업 2년차. 벤처기업확인과 정관 정비, 초기 세무 구조 관심. 투자 유치 전 준비 필요.",
      summary: { core: ["창업 2년차, 투자 유치 준비", "벤처확인·정관 정비 관심"], requirements: ["벤처기업확인 요건 검토", "정관 정비"], promises: ["자문 범위 제안"], documents: ["사업자등록증", "정관", "주주명부"], nextAction: "제안서 송부" },
    },
  ];

  const contracts: Contract[] = [
    { id: "ct_a1", companyId: "co_a", projectId: "pj_a1", title: "경영진단 컨설팅 계약", status: "signed", sentAt: d(-42), signedAt: d(-40), period: "2개월", scope: "원가·조직·재무 진단 및 개선 로드맵" },
    { id: "ct_a2", companyId: "co_a", projectId: "pj_a2", title: "메인비즈 인증 자문 계약", status: "signed", sentAt: d(-82), signedAt: d(-80), period: "2개월", scope: "메인비즈 인증 신청 자문" },
    { id: "ct_b1", companyId: "co_b", projectId: "pj_b1", title: "기업부설연구소 설립 자문 계약", status: "signed", sentAt: d(-19), signedAt: d(-18), period: "6주", scope: "요건 검토·서류 준비·신고 대행 지원" },
    { id: "ct_c1", companyId: "co_c", projectId: "pj_c1", title: "정책자금 준비 컨설팅 계약", status: "signed", sentAt: d(-57), signedAt: d(-55), period: "2개월", scope: "사업계획서 및 제출자료 준비" },
    { id: "ct_c2", companyId: "co_c", projectId: "pj_c2", title: "법인 경영자문 연간 계약", status: "sent", sentAt: d(-1), period: "12개월", scope: "가지급금·배당·정관 정비 및 분기 자문" },
    { id: "ct_d1", companyId: "co_d", projectId: "pj_d1", title: "기업 운영개선 컨설팅 계약", status: "signed", sentAt: d(-62), signedAt: d(-60), period: "10주", scope: "보고체계 표준화 및 원가 누락 개선" },
    { id: "ct_f1", companyId: "co_f", projectId: "pj_f1", title: "기업 운영개선 컨설팅 계약", status: "signed", sentAt: d(-117), signedAt: d(-115), period: "3개월", scope: "배차·정산 프로세스 개선" },
  ];

  const docRequests: DocumentRequest[] = [
    // A — review stage
    { id: "dr_a1", projectId: "pj_a1", companyId: "co_a", name: "최근 3년 재무제표", description: "결산 재무제표 원본 (감사보고서 포함)", requestedAt: d(-38), dueDate: d(-30), status: "done", assigneeId: "u_park", submittedAt: d(-33), reviewedAt: d(-31), files: [{ id: "f_a1", fileName: "재무제표_3개년.pdf", size: 2_450_000, uploadedAt: d(-33), uploadedBy: "c_a", version: 1 }] },
    { id: "dr_a2", projectId: "pj_a1", companyId: "co_a", name: "월별 매출·원가 현황", description: "최근 24개월 월별 매출액과 제조원가 내역", requestedAt: d(-38), dueDate: d(-28), status: "done", assigneeId: "u_park", submittedAt: d(-29), reviewedAt: d(-27), files: [{ id: "f_a2", fileName: "월별_매출원가_24M.xlsx", size: 860_000, uploadedAt: d(-29), uploadedBy: "c_a", version: 1 }] },
    { id: "dr_a3", projectId: "pj_a1", companyId: "co_a", name: "조직도 및 인원현황", description: "부서별 인원, 직급, 담당업무", requestedAt: d(-38), dueDate: d(-28), status: "done", assigneeId: "u_park", submittedAt: d(-30), reviewedAt: d(-27), files: [{ id: "f_a3", fileName: "조직도_인원현황.pdf", size: 540_000, uploadedAt: d(-30), uploadedBy: "c_a", version: 1 }] },
    { id: "dr_a4", projectId: "pj_a1", companyId: "co_a", name: "주요 거래처 목록", description: "매출 상위 20개 거래처와 거래조건", requestedAt: d(-38), dueDate: d(-25), status: "done", assigneeId: "u_park", submittedAt: d(-26), reviewedAt: d(-24), files: [{ id: "f_a4", fileName: "거래처목록_TOP20.xlsx", size: 120_000, uploadedAt: d(-26), uploadedBy: "c_a", version: 1 }] },
    { id: "dr_a5", projectId: "pj_a1", companyId: "co_a", name: "인건비 상세내역", description: "직급별·부서별 인건비 및 상여 내역", requestedAt: d(-14), dueDate: d(-5), status: "reviewing", assigneeId: "u_park", submittedAt: d(-6), files: [{ id: "f_a5", fileName: "인건비_상세.xlsx", size: 410_000, uploadedAt: d(-6), uploadedBy: "c_a", version: 1 }] },
    { id: "dr_a6", projectId: "pj_a1", companyId: "co_a", name: "매출채권 연령표", description: "거래처별 미수금 연령 분석표 (30/60/90일)", requestedAt: d(-12), dueDate: d(2), status: "revision", assigneeId: "u_park", submittedAt: d(-8), reviewedAt: d(-7), reviewNote: "거래처별 구분 없이 합계만 제출되어 거래처 단위 연령 구분이 필요합니다.", files: [{ id: "f_a6", fileName: "매출채권_연령표.xlsx", size: 95_000, uploadedAt: d(-8), uploadedBy: "c_a", version: 1 }] },
    // B — doc_request stage
    { id: "dr_b1", projectId: "pj_b1", companyId: "co_b", name: "연구인력 명단 및 학력·경력", description: "연구전담요원 후보자의 학력·경력 증빙 포함", requestedAt: d(-6), dueDate: d(0, 18), status: "requested", assigneeId: "u_lee", files: [] },
    { id: "dr_b2", projectId: "pj_b1", companyId: "co_b", name: "4대보험 가입자 명부", description: "최근 월 기준 가입자 명부", requestedAt: d(-6), dueDate: d(1), status: "requested", assigneeId: "u_lee", files: [] },
    { id: "dr_b3", projectId: "pj_b1", companyId: "co_b", name: "사무실 평면도", description: "연구공간 구획 검토용 평면도", requestedAt: d(-6), dueDate: d(3), status: "requested", assigneeId: "u_lee", files: [] },
    { id: "dr_b4", projectId: "pj_b1", companyId: "co_b", name: "사업자등록증", description: "최신 사업자등록증 사본", requestedAt: d(-6), dueDate: d(-2), status: "submitted", assigneeId: "u_lee", submittedAt: d(-3), files: [{ id: "f_b4", fileName: "사업자등록증.pdf", size: 210_000, uploadedAt: d(-3), uploadedBy: "c_b", version: 1 }] },
    { id: "dr_b5", projectId: "pj_b1", companyId: "co_b", name: "연구개발 계획서 초안", description: "설립 신고 시 첨부할 연구 계획 초안 (양식 제공 예정)", requestedAt: d(-6), dueDate: d(10), status: "planned", assigneeId: "u_lee", files: [] },
    // C — drafting
    { id: "dr_c1", projectId: "pj_c1", companyId: "co_c", name: "재무제표 3년", description: "결산 재무제표", requestedAt: d(-52), dueDate: d(-45), status: "done", assigneeId: "u_park", submittedAt: d(-47), reviewedAt: d(-45), files: [{ id: "f_c1", fileName: "재무제표.pdf", size: 1_900_000, uploadedAt: d(-47), uploadedBy: "c_c", version: 1 }] },
    { id: "dr_c2", projectId: "pj_c1", companyId: "co_c", name: "증설 계획 및 견적서", description: "신공장 증설 계획서와 설비 견적", requestedAt: d(-52), dueDate: d(-40), status: "done", assigneeId: "u_park", submittedAt: d(-42), reviewedAt: d(-40), files: [{ id: "f_c2", fileName: "증설계획_견적.pdf", size: 3_200_000, uploadedAt: d(-42), uploadedBy: "c_c", version: 1 }] },
    { id: "dr_c3", projectId: "pj_c1", companyId: "co_c", name: "부채현황", description: "금융기관별 차입금 현황", requestedAt: d(-52), dueDate: d(-40), status: "done", assigneeId: "u_park", submittedAt: d(-41), reviewedAt: d(-39), files: [{ id: "f_c3", fileName: "부채현황.xlsx", size: 88_000, uploadedAt: d(-41), uploadedBy: "c_c", version: 1 }] },
    { id: "dr_c4", projectId: "pj_c1", companyId: "co_c", name: "고용현황", description: "최근 1년 고용 증감 현황", requestedAt: d(-52), dueDate: d(-38), status: "done", assigneeId: "u_park", submittedAt: d(-39), reviewedAt: d(-37), files: [{ id: "f_c4", fileName: "고용현황.xlsx", size: 64_000, uploadedAt: d(-39), uploadedBy: "c_c", version: 1 }] },
    // D — in_progress, one overdue
    { id: "dr_d1", projectId: "pj_d1", companyId: "co_d", name: "현장별 원가 보고 샘플", description: "최근 3개월 현장별 보고 양식 샘플", requestedAt: d(-58), dueDate: d(-50), status: "done", assigneeId: "u_jung", submittedAt: d(-52), reviewedAt: d(-50), files: [{ id: "f_d1", fileName: "현장보고_샘플.zip", size: 5_100_000, uploadedAt: d(-52), uploadedBy: "c_d", version: 1 }] },
    { id: "dr_d2", projectId: "pj_d1", companyId: "co_d", name: "조직도", description: "본사·현장 조직도", requestedAt: d(-58), dueDate: d(-50), status: "done", assigneeId: "u_jung", submittedAt: d(-51), reviewedAt: d(-49), files: [{ id: "f_d2", fileName: "조직도.pdf", size: 320_000, uploadedAt: d(-51), uploadedBy: "c_d", version: 1 }] },
    { id: "dr_d3", projectId: "pj_d1", companyId: "co_d", name: "월별 손익", description: "최근 12개월 월별 손익", requestedAt: d(-58), dueDate: d(-48), status: "done", assigneeId: "u_jung", submittedAt: d(-49), reviewedAt: d(-47), files: [{ id: "f_d3", fileName: "월별손익.xlsx", size: 150_000, uploadedAt: d(-49), uploadedBy: "c_d", version: 1 }] },
    { id: "dr_d4", projectId: "pj_d1", companyId: "co_d", name: "표준 보고양식 적용 결과 (2주차)", description: "신규 보고양식으로 작성한 2주차 현장 보고", requestedAt: d(-12), dueDate: d(-2), status: "requested", assigneeId: "u_jung", files: [] },
    // F — aftercare
    { id: "dr_f1", projectId: "pj_f1", companyId: "co_f", name: "배차 일지 3개월", description: "", requestedAt: d(-110), dueDate: d(-100), status: "done", assigneeId: "u_jung", submittedAt: d(-103), reviewedAt: d(-100), files: [{ id: "f_f1", fileName: "배차일지.xlsx", size: 700_000, uploadedAt: d(-103), uploadedBy: "c_f", version: 1 }] },
    { id: "dr_f2", projectId: "pj_f1", companyId: "co_f", name: "정산 내역", description: "", requestedAt: d(-110), dueDate: d(-100), status: "done", assigneeId: "u_jung", submittedAt: d(-102), reviewedAt: d(-100), files: [{ id: "f_f2", fileName: "정산내역.xlsx", size: 420_000, uploadedAt: d(-102), uploadedBy: "c_f", version: 1 }] },
  ];

  const schedules: Schedule[] = [
    { id: "sc_1", companyId: "co_a", projectId: "pj_a1", title: "에이정밀 대표 미팅 (중간 보고)", type: "meeting", start: d(0, 14), end: d(0, 15, 30), location: "에이정밀 본사 회의실", assigneeId: "u_park", visibleToClient: true, memo: "원가 개선안 우선 설명" },
    { id: "sc_2", companyId: "co_e", projectId: "pj_e1", title: "이플러스바이오 2차 상담", type: "consult", start: d(0, 16, 30), end: d(0, 17, 30), location: "화상 (Zoom)", assigneeId: "u_lee", visibleToClient: true },
    { id: "sc_3", companyId: "co_b", projectId: "pj_b1", title: "비앤테크 연구인력 명단 제출기한", type: "doc_due", start: d(0, 18), assigneeId: "u_lee", visibleToClient: true },
    { id: "sc_4", companyId: "co_c", projectId: "pj_c1", title: "씨엠푸드 사업계획서 내부 마감", type: "internal_due", start: d(2, 18), assigneeId: "u_park", visibleToClient: false },
    { id: "sc_5", companyId: "co_c", projectId: "pj_c1", title: "씨엠푸드 대표 결과보고", type: "report", start: d(5, 10), end: d(5, 12), location: "씨엠푸드 청주 본사", assigneeId: "u_park", visibleToClient: true },
    { id: "sc_6", companyId: "co_d", projectId: "pj_d1", title: "디원건설 후속연락 (보고양식 적용 확인)", type: "followup", start: d(1, 10), assigneeId: "u_jung", visibleToClient: false },
    { id: "sc_7", companyId: "co_a", projectId: "pj_a1", title: "에이정밀 매출채권 연령표 보완 기한", type: "doc_due", start: d(2, 18), assigneeId: "u_park", visibleToClient: true },
    { id: "sc_8", companyId: "co_b", projectId: "pj_b1", title: "비앤테크 연구공간 현장 확인", type: "meeting", start: d(4, 14), end: d(4, 15), location: "비앤테크 구로 사무실", assigneeId: "u_lee", visibleToClient: true },
    { id: "sc_9", companyId: "co_f", projectId: "pj_f1", title: "에프물류 사후관리 정기 점검", type: "followup", start: d(6, 11), assigneeId: "u_jung", visibleToClient: true },
    { id: "sc_10", companyId: "co_a", projectId: "pj_a1", title: "에이정밀 최종 결과보고", type: "report", start: d(12, 14), end: d(12, 16), location: "에이정밀 본사", assigneeId: "u_park", visibleToClient: true },
    { id: "sc_11", companyId: "co_c", projectId: "pj_c2", title: "씨엠푸드 자문계약 서명 확인", type: "followup", start: d(0, 11), assigneeId: "u_park", visibleToClient: false },
    { id: "sc_12", title: "주간 프로젝트 리뷰 (내부)", type: "internal_due", start: d(3, 9), end: d(3, 10), location: "KPJK 회의실", assigneeId: "u_admin", visibleToClient: false },
    { id: "sc_13", companyId: "co_d", projectId: "pj_d1", title: "디원건설 개선안 중간 보고", type: "meeting", start: d(8, 14), end: d(8, 15, 30), location: "디원건설 대전 본사", assigneeId: "u_jung", visibleToClient: true },
  ];

  const tasks: Task[] = [
    { id: "tk_1", companyId: "co_b", projectId: "pj_b1", title: "비앤테크 미제출 자료 후속 연락", type: "후속연락", dueDate: d(0, 18), assigneeId: "u_lee", status: "todo", priority: "urgent", createdAt: d(-1), memo: "연구인력 명단 오늘 마감" },
    { id: "tk_2", companyId: "co_d", projectId: "pj_d1", title: "디원건설 보고양식 2주차 자료 독촉", type: "후속연락", dueDate: d(-1, 18), assigneeId: "u_jung", status: "todo", priority: "urgent", createdAt: d(-3), memo: "마감 2일 지남" },
    { id: "tk_3", companyId: "co_a", projectId: "pj_a1", title: "에이정밀 인건비 상세내역 검토", type: "자료검토", dueDate: d(0, 18), assigneeId: "u_park", status: "doing", priority: "normal", createdAt: d(-5), source: "auto" },
    { id: "tk_4", companyId: "co_a", projectId: "pj_a1", title: "에이정밀 대표 미팅 사전자료 준비", type: "미팅준비", dueDate: d(0, 18), assigneeId: "u_park", status: "doing", priority: "urgent", createdAt: d(-2) },
    { id: "tk_5", companyId: "co_c", projectId: "pj_c2", title: "씨엠푸드 자문계약서 서명 확인", type: "후속연락", dueDate: d(0, 18), assigneeId: "u_park", status: "todo", priority: "normal", createdAt: d(-1) },
    { id: "tk_6", companyId: "co_c", projectId: "pj_c1", title: "씨엠푸드 사업계획서 재무 파트 작성", type: "보고서", dueDate: d(2, 18), assigneeId: "u_park", status: "doing", priority: "normal", createdAt: d(-4) },
    { id: "tk_7", companyId: "co_b", projectId: "pj_b1", title: "비앤테크 사업자등록증 확인", type: "자료검토", dueDate: d(1, 18), assigneeId: "u_lee", status: "todo", priority: "low", createdAt: d(-3), source: "auto" },
    { id: "tk_8", companyId: "co_e", projectId: "pj_e1", title: "이플러스바이오 자문 제안서 작성", type: "내부작업", dueDate: d(1, 18), assigneeId: "u_lee", status: "doing", priority: "normal", createdAt: d(-2) },
    { id: "tk_9", companyId: "co_a", projectId: "pj_a1", title: "에이정밀 진행상황 문의 답변", type: "문의응대", dueDate: d(0, 18), assigneeId: "u_park", status: "todo", priority: "urgent", createdAt: d(-1), source: "auto" },
    { id: "tk_10", companyId: "co_f", projectId: "pj_f1", title: "에프물류 사후관리 점검 체크리스트 준비", type: "내부작업", dueDate: d(5, 18), assigneeId: "u_jung", status: "todo", priority: "low", createdAt: d(-1) },
    { id: "tk_11", companyId: "co_d", projectId: "pj_d1", title: "디원건설 개선안 초안 정리", type: "보고서", dueDate: d(6, 18), assigneeId: "u_jung", status: "todo", priority: "normal", createdAt: d(-2) },
    { id: "tk_12", companyId: "co_a", projectId: "pj_a2", title: "에이정밀 메인비즈 인증서 수령 확인", type: "후속연락", dueDate: d(-18, 18), assigneeId: "u_park", status: "done", priority: "normal", createdAt: d(-22), completedAt: d(-18) },
  ];

  const inquiries: Inquiry[] = [
    {
      id: "iq_1", companyId: "co_a", projectId: "pj_a1", title: "결과보고 일정이 언제쯤 확정될까요?", category: "일정", createdAt: d(-1, 17, 20), createdBy: "c_a", status: "open", assigneeId: "u_park",
      messages: [{ id: "m_1", authorId: "c_a", authorRole: "client", body: "안녕하세요. 중간 보고 후 최종 결과보고 일정이 언제쯤 확정되는지 궁금합니다. 내부 임원회의 일정을 맞추려고 합니다.", createdAt: d(-1, 17, 20) }],
    },
    {
      id: "iq_2", companyId: "co_b", projectId: "pj_b1", title: "연구인력 명단에 계약직도 포함하나요?", category: "자료", createdAt: d(-4, 11), createdBy: "c_b", status: "answered", assigneeId: "u_lee",
      messages: [
        { id: "m_2", authorId: "c_b", authorRole: "client", body: "연구인력 명단 작성 시 계약직 개발자도 포함해야 하는지 문의드립니다.", createdAt: d(-4, 11) },
        { id: "m_3", authorId: "u_lee", authorRole: "consultant", body: "네, 포함해 주세요. 다만 연구전담요원 요건은 정규직 기준으로 검토되므로 고용형태를 별도 열로 표기해 주시면 됩니다.", createdAt: d(-4, 14, 30) },
      ],
    },
    {
      id: "iq_3", companyId: "co_c", projectId: "pj_c1", title: "사업계획서 초안을 미리 볼 수 있을까요?", category: "결과물", createdAt: d(-6, 9), createdBy: "c_c", status: "answered", assigneeId: "u_park",
      messages: [
        { id: "m_4", authorId: "c_c", authorRole: "client", body: "결과보고 전에 사업계획서 초안을 미리 검토하고 싶습니다.", createdAt: d(-6, 9) },
        { id: "m_5", authorId: "u_park", authorRole: "consultant", body: "네, 재무 파트 작성이 끝나는 대로 완료자료 메뉴에 초안을 공유드리겠습니다. 이번 주 내로 예상합니다.", createdAt: d(-6, 10, 15) },
      ],
    },
    {
      id: "iq_4", companyId: "co_f", projectId: "pj_f1", title: "정산 양식 수정 관련", category: "기타", createdAt: d(-15), createdBy: "c_f", status: "closed", assigneeId: "u_jung",
      messages: [
        { id: "m_6", authorId: "c_f", authorRole: "client", body: "정산 양식에 차량번호 열을 추가해도 될까요?", createdAt: d(-15) },
        { id: "m_7", authorId: "u_jung", authorRole: "consultant", body: "네, 추가하셔도 집계 로직에 영향 없습니다.", createdAt: d(-15, 15) },
      ],
    },
  ];

  const results: ResultFile[] = [
    { id: "rs_1", projectId: "pj_f1", companyId: "co_f", name: "운영개선 최종 보고서", kind: "보고서", sharedAt: d(-30), sharedBy: "u_jung", size: 4_800_000, description: "배차·정산 프로세스 개선 최종 보고서 및 적용 가이드" },
    { id: "rs_2", projectId: "pj_f1", companyId: "co_f", name: "정산 표준 양식 v2", kind: "체크리스트", sharedAt: d(-30), sharedBy: "u_jung", size: 180_000, description: "개선된 정산 표준 양식 (엑셀)" },
    { id: "rs_3", projectId: "pj_a2", companyId: "co_a", name: "메인비즈 인증 신청서 최종본", kind: "제안서", sharedAt: d(-22), sharedBy: "u_park", size: 2_100_000, description: "제출 완료본" },
    { id: "rs_4", projectId: "pj_a1", companyId: "co_a", name: "경영진단 중간 보고 자료", kind: "분석자료", sharedAt: d(-1), sharedBy: "u_park", size: 3_400_000, description: "원가·조직 1차 분석 결과 (대표 미팅용)" },
  ];

  const activities: Activity[] = [
    { id: "ac_1", type: "consultation_logged", companyId: "co_a", projectId: "pj_a1", actorId: "u_park", actorRole: "consultant", at: d(-46, 15), text: "에이정밀 초기상담 기록" },
    { id: "ac_2", type: "contract_signed", companyId: "co_a", projectId: "pj_a1", actorId: "c_a", actorRole: "client", at: d(-40, 10), text: "경영진단 컨설팅 계약 서명 완료" },
    { id: "ac_3", type: "project_created", companyId: "co_a", projectId: "pj_a1", actorId: "u_park", actorRole: "consultant", at: d(-40, 11), text: "프로젝트 생성: 경영진단 컨설팅" },
    { id: "ac_4", type: "document_requested", companyId: "co_a", projectId: "pj_a1", actorId: "u_park", actorRole: "consultant", at: d(-38, 9), text: "자료 4건 요청 (재무제표 외)" },
    { id: "ac_5", type: "document_uploaded", companyId: "co_a", projectId: "pj_a1", actorId: "c_a", actorRole: "client", at: d(-33, 14), text: "고객 제출: 최근 3년 재무제표" },
    { id: "ac_6", type: "document_reviewed", companyId: "co_a", projectId: "pj_a1", actorId: "u_park", actorRole: "consultant", at: d(-31, 10), text: "검토 완료: 최근 3년 재무제표" },
    { id: "ac_7", type: "project_stage_changed", companyId: "co_a", projectId: "pj_a1", actorId: "u_park", actorRole: "consultant", at: d(-24, 16), text: "단계 변경: 자료접수 → 검토", meta: { from: "doc_received", to: "review" } },
    { id: "ac_8", type: "document_revision_requested", companyId: "co_a", projectId: "pj_a1", actorId: "u_park", actorRole: "consultant", at: d(-7, 11), text: "보완 요청: 매출채권 연령표" },
    { id: "ac_9", type: "result_shared", companyId: "co_a", projectId: "pj_a1", actorId: "u_park", actorRole: "consultant", at: d(-1, 18), text: "결과자료 공유: 경영진단 중간 보고 자료" },
    { id: "ac_10", type: "inquiry_created", companyId: "co_a", projectId: "pj_a1", actorId: "c_a", actorRole: "client", at: d(-1, 17, 20), text: "고객 문의: 결과보고 일정이 언제쯤 확정될까요?" },
    { id: "ac_11", type: "consultation_logged", companyId: "co_b", projectId: "pj_b1", actorId: "u_lee", actorRole: "consultant", at: d(-21, 16), text: "비앤테크 초기상담 기록" },
    { id: "ac_12", type: "contract_signed", companyId: "co_b", projectId: "pj_b1", actorId: "c_b", actorRole: "client", at: d(-18, 11), text: "연구소 설립 자문 계약 서명" },
    { id: "ac_13", type: "document_requested", companyId: "co_b", projectId: "pj_b1", actorId: "u_lee", actorRole: "consultant", at: d(-6, 10), text: "자료 5건 요청" },
    { id: "ac_14", type: "document_uploaded", companyId: "co_b", projectId: "pj_b1", actorId: "c_b", actorRole: "client", at: d(-3, 15), text: "고객 제출: 사업자등록증" },
    { id: "ac_15", type: "inquiry_answered", companyId: "co_b", projectId: "pj_b1", actorId: "u_lee", actorRole: "consultant", at: d(-4, 14, 30), text: "문의 답변: 연구인력 명단 계약직 포함 여부" },
    { id: "ac_16", type: "project_stage_changed", companyId: "co_c", projectId: "pj_c1", actorId: "u_park", actorRole: "consultant", at: d(-4, 9), text: "단계 변경: 진행 → 결과작성", meta: { from: "in_progress", to: "drafting" } },
    { id: "ac_17", type: "contract_sent", companyId: "co_c", projectId: "pj_c2", actorId: "u_park", actorRole: "consultant", at: d(-1, 15), text: "법인 경영자문 계약서 송부" },
    { id: "ac_18", type: "document_requested", companyId: "co_d", projectId: "pj_d1", actorId: "u_jung", actorRole: "consultant", at: d(-12, 10), text: "자료 요청: 표준 보고양식 적용 결과 (2주차)" },
    { id: "ac_19", type: "project_stage_changed", companyId: "co_d", projectId: "pj_d1", actorId: "u_jung", actorRole: "consultant", at: d(-9, 14), text: "단계 변경: 검토 → 진행", meta: { from: "review", to: "in_progress" } },
    { id: "ac_20", type: "consultation_logged", companyId: "co_e", projectId: "pj_e1", actorId: "u_lee", actorRole: "consultant", at: d(-3, 11), text: "이플러스바이오 초기상담 기록" },
    { id: "ac_21", type: "project_stage_changed", companyId: "co_f", projectId: "pj_f1", actorId: "u_jung", actorRole: "consultant", at: d(-28, 10), text: "단계 변경: 완료 → 사후관리", meta: { from: "done", to: "aftercare" } },
    { id: "ac_22", type: "result_shared", companyId: "co_f", projectId: "pj_f1", actorId: "u_jung", actorRole: "consultant", at: d(-30, 17), text: "결과자료 공유: 운영개선 최종 보고서" },
    { id: "ac_23", type: "portal_login", companyId: "co_a", actorId: "c_a", actorRole: "client", at: d(-1, 17, 10), text: "고객 Portal 접속" },
    { id: "ac_24", type: "portal_login", companyId: "co_b", actorId: "c_b", actorRole: "client", at: d(-3, 14, 50), text: "고객 Portal 접속" },
    { id: "ac_25", type: "document_uploaded", companyId: "co_a", projectId: "pj_a1", actorId: "c_a", actorRole: "client", at: d(-6, 9, 40), text: "고객 제출: 인건비 상세내역" },
    { id: "ac_26", type: "task_created", companyId: "co_a", projectId: "pj_a1", actorId: "u_admin", actorRole: "system", at: d(-6, 9, 40), text: "자동 생성: 인건비 상세내역 검토 Task" },
  ];

  const notifications: Notification[] = [
    { id: "nt_1", audience: "client", companyId: "co_a", title: "결과자료가 공유되었습니다", body: "경영진단 중간 보고 자료를 완료자료에서 확인하세요.", at: d(-1, 18), read: false, href: "/portal/results" },
    { id: "nt_2", audience: "client", companyId: "co_a", title: "보완 요청: 매출채권 연령표", body: "거래처 단위 연령 구분이 필요합니다. 기한은 모레입니다.", at: d(-7, 11), read: true, href: "/portal/documents" },
    { id: "nt_3", audience: "client", companyId: "co_b", title: "자료 제출 기한 안내", body: "연구인력 명단 및 학력·경력 자료의 제출 기한이 오늘 18:00입니다.", at: d(0, 8), read: false, href: "/portal/documents" },
    { id: "nt_4", audience: "client", companyId: "co_b", title: "문의 답변이 등록되었습니다", body: "연구인력 명단 계약직 포함 여부에 대한 답변을 확인하세요.", at: d(-4, 14, 30), read: true, href: "/portal/inquiries" },
    { id: "nt_5", audience: "internal", companyId: "co_a", title: "새 문의: 에이정밀", body: "결과보고 일정이 언제쯤 확정될까요?", at: d(-1, 17, 20), read: false, href: "/ax/inquiries" },
    { id: "nt_6", audience: "internal", companyId: "co_b", title: "새 자료 도착: 비앤테크", body: "사업자등록증이 제출되었습니다.", at: d(-3, 15), read: true, href: "/ax/documents" },
    { id: "nt_7", audience: "internal", companyId: "co_d", title: "자료 기한 초과: 디원건설", body: "표준 보고양식 적용 결과 (2주차) 마감 2일 지남", at: d(0, 7), read: false, href: "/ax/documents" },
  ];

  /* ---------- 회사별 이야기 보강 — 6개가 서로 다른 단계에 있게 ----------
   *  A 에이정밀   : 검토(중간 보고 직전) · 승계 준비
   *  B 비앤테크   : 자료수집 — 고객 회신 대기
   *  C 씨엠푸드   : 결과작성 — 사업계획서 초안 공유, 연간 자문 계약 진행
   *  D 디원건설   : 진행 중 — 자료 지연 · 매출 감소 · 중도금 연체(경고 예시)
   *  E 이플러스바이오: 상담 초기 — 제안·승인 대기, 첫 자료 요청
   *  F 에프물류   : 완료 → 사후관리 — 추가 과제(인사노무) 탐색
   * 숫자는 모두 샘플 회사의 예시 값이다(화면에 "샘플"·"예시"로 표시). 실제 고객·실적이 아니다. */
  const Y = now.getFullYear();
  const fin = (rows: [number, number, number?][]) => rows.map(([year, revenue, operatingProfit]) => ({ year, revenue, ...(operatingProfit !== undefined ? { operatingProfit } : {}), source: "재무제표(예시)" }));
  const more: Record<string, Partial<Company>> = {
    co_a: { corpNo: "000000-0000001" },
    co_b: { entityType: "corporation", establishedAt: "2017-03-15", bizCategory: "정보통신업", bizItem: "응용 소프트웨어 개발", region: "서울", corpNo: "000000-0000002", contractStartedAt: d(-18).slice(0, 10),
      financials: fin([[Y - 3, 5_100_000_000, 310_000_000], [Y - 2, 5_900_000_000, 420_000_000], [Y - 1, 6_800_000_000, 560_000_000]]) },
    co_c: { entityType: "corporation", establishedAt: "2012-06-01", bizCategory: "제조업", bizItem: "소스·간편식 제조", region: "충북", corpNo: "000000-0000003", contractStartedAt: d(-55).slice(0, 10),
      financials: fin([[Y - 3, 12_800_000_000, 610_000_000], [Y - 2, 14_100_000_000, 720_000_000], [Y - 1, 15_000_000_000, 790_000_000]]) },
    co_d: { entityType: "corporation", establishedAt: "2004-09-20", bizCategory: "건설업", bizItem: "건축공사업", region: "대전", corpNo: "000000-0000004", contractStartedAt: d(-60).slice(0, 10),
      financials: fin([[Y - 3, 28_100_000_000, 1_120_000_000], [Y - 2, 27_400_000_000, 830_000_000], [Y - 1, 26_000_000_000, 540_000_000]]) },
    co_e: { entityType: "corporation", establishedAt: "2024-05-10", bizCategory: "제조업", bizItem: "바이오 소재", region: "인천", corpNo: "000000-0000005",
      financials: fin([[Y - 1, 3_500_000_000]]) },
    co_f: { entityType: "corporation", establishedAt: "2010-02-01", bizCategory: "운수 및 창고업", bizItem: "화물자동차 운송", region: "경기", corpNo: "000000-0000006", contractStartedAt: d(-115).slice(0, 10),
      financials: fin([[Y - 3, 8_100_000_000, 290_000_000], [Y - 2, 8_600_000_000, 350_000_000], [Y - 1, 9_200_000_000, 470_000_000]]) },
  };
  for (const c of companies) Object.assign(c, more[c.id] ?? {});
  // 서류 확인 기록 — 담당자가 서류에서 회사 정보를 읽어 반영한 기록(파일 자체는 넣지 않는다). D·E는 아직 확인 전
  const docRead = (days: number, corp = true) => ({
    bizReg: { fileName: "사업자등록증.pdf", size: 210_000, readAt: d(days), method: "pdf_text" as const, fields: ["bizNo", "ceo", "address", "bizCategory", "bizItem"] },
    ...(corp ? { corpReg: { fileName: "법인등기부등본.pdf", size: 480_000, readAt: d(days), method: "pdf_text" as const, fields: ["corpNo", "establishedAt"] } } : {}),
  });
  const docsOf: Record<string, Company["docs"]> = { co_a: docRead(-38), co_c: docRead(-50), co_f: docRead(-112), co_b: docRead(-3, false) };
  for (const c of companies) if (docsOf[c.id]) c.docs = docsOf[c.id];

  // 계약 금액·종료일 — 종료일이 가까운 계약은 "계약 만료 전 갱신 협의" 규칙 업무가 실제로 만들어진다
  const ctMore: Record<string, Partial<Contract>> = {
    ct_a1: { amount: 18_000_000, endDate: d(20).slice(0, 10) }, ct_a2: { amount: 6_000_000, endDate: d(-20).slice(0, 10) },
    ct_b1: { amount: 7_500_000, endDate: d(40).slice(0, 10) }, ct_c1: { amount: 15_000_000, endDate: d(9).slice(0, 10) },
    ct_c2: { amount: 12_000_000 }, ct_d1: { amount: 20_000_000, endDate: d(12).slice(0, 10) }, ct_f1: { amount: 16_000_000, endDate: d(-30).slice(0, 10) },
  };
  for (const k of contracts) Object.assign(k, ctMore[k.id] ?? {});

  consultations.push(
    { id: "cs_b2", companyId: "co_b", projectId: "pj_b1", date: d(-9, 11), consultantId: "u_lee", type: "후속상담", channel: "전화",
      notes: "최수진 팀장 통화. 연구전담요원 후보 5명 중 2명의 재직증명·학위증명 회신이 늦어지는 중. 평면도는 이번 주 안에 전달 예정. 계약직 개발자 포함 여부 재확인.",
      summary: { core: ["후보 5명 중 2명 증빙 회신 지연", "평면도 이번 주 전달 예정"], requirements: ["증빙 회신 일정 확정"], promises: ["누락 증빙 목록 다시 정리해 송부"], documents: ["재직증명서", "학위증명서", "사무실 평면도"], nextAction: "누락 증빙 회신 확인 후 요건 판정" } },
    { id: "cs_c3", companyId: "co_c", projectId: "pj_c1", date: d(-20, 15), consultantId: "u_park", type: "대표미팅", channel: "방문",
      notes: "기관별 요건 비교표 설명. 시설자금 위주로 준비하기로 결정. 사업계획서 목차 합의, 재무 파트는 회계법인 자료 수령 후 작성.",
      summary: { core: ["시설자금 중심으로 준비 결정", "사업계획서 목차 합의"], requirements: ["재무 추정은 보수적으로"], promises: ["초안 2주 내 공유"], documents: ["회계법인 결산 확정본"], nextAction: "사업계획서 초안 작성" } },
    { id: "cs_d2", companyId: "co_d", projectId: "pj_d1", date: d(-30, 10), consultantId: "u_jung", type: "정기미팅", channel: "방문",
      notes: "표준 보고양식 1주차 적용 점검. 현장 3곳 중 2곳은 양식대로 제출, 1곳은 기존 카톡 보고 유지. 현장소장 대상 10분 설명회 필요. 원가 집계 누락 항목(장비 임차료) 확인.",
      summary: { core: ["3곳 중 2곳 표준양식 적용", "장비 임차료 원가 누락 확인"], requirements: ["현장소장 설명회", "누락 항목 집계 기준 정리"], promises: ["설명 자료 1장 제공"], documents: ["2주차 적용 결과"], nextAction: "2주차 적용 결과 수령 후 개선안 정리" } },
    { id: "cs_f1", companyId: "co_f", projectId: "pj_f1", date: d(-122, 14), consultantId: "u_jung", type: "초기상담", channel: "방문",
      notes: "윤태호 대표. 배차는 담당자 기억에, 정산은 월말 수기 대사에 의존. 정산 오류로 화주 문의가 잦음. 배차·정산 프로세스 개선 요청.",
      summary: { core: ["배차가 담당자 기억에 의존", "월말 정산 수기 대사로 오류 잦음"], requirements: ["배차·정산 표준 프로세스"], promises: ["현황 진단 후 개선안"], documents: ["배차 일지 3개월", "정산 내역"], nextAction: "계약 및 자료 요청" } },
    { id: "cs_f2", companyId: "co_f", projectId: "pj_f1", date: d(-28, 16), consultantId: "u_jung", type: "정기미팅", channel: "화상",
      notes: "사후관리 1차 점검. 정산 표준양식 v2 정착. 정산 관련 화주 문의 감소 체감. 인력 54명으로 늘며 근로계약·취업규칙 정비 필요성 언급.",
      summary: { core: ["정산 표준양식 정착", "인력 증가로 인사노무 정비 필요"], requirements: ["근로계약·취업규칙 점검"], promises: ["인사노무 점검 범위 안내"], documents: ["사후관리 운영 지표"], nextAction: "2차 정기 점검 및 인사노무 제안 검토" } },
  );

  docRequests.push(
    { id: "dr_c5", projectId: "pj_c1", companyId: "co_c", name: "정책자금 신청서 날인본", description: "최종 신청서에 대표이사 날인 (초안 확정 후 양식 제공)", requestedAt: d(-2), dueDate: d(6), status: "planned", assigneeId: "u_park", files: [] },
    { id: "dr_d5", projectId: "pj_d1", companyId: "co_d", name: "9월 현장 원가 집계표", description: "표준양식으로 집계한 9월 현장별 원가", requestedAt: d(-10), dueDate: d(-1), status: "submitted", assigneeId: "u_jung", submittedAt: d(-2), files: [{ id: "f_d5", fileName: "9월_현장원가_집계.xlsx", size: 230_000, uploadedAt: d(-2), uploadedBy: "c_d", version: 1 }] },
    { id: "dr_e1", projectId: "pj_e1", companyId: "co_e", name: "사업자등록증", description: "최신 사업자등록증 사본", requestedAt: d(-2), dueDate: d(4, 18), status: "requested", assigneeId: "u_lee", files: [] },
    { id: "dr_e2", projectId: "pj_e1", companyId: "co_e", name: "정관", description: "현재 정관 전문 (최근 변경분 포함)", requestedAt: d(-2), dueDate: d(4, 18), status: "requested", assigneeId: "u_lee", files: [] },
    { id: "dr_e3", projectId: "pj_e1", companyId: "co_e", name: "주주명부", description: "주주별 주식 수 · 지분율", requestedAt: d(-2), dueDate: d(4, 18), status: "submitted", assigneeId: "u_lee", submittedAt: d(-1, 15), files: [{ id: "f_e3", fileName: "주주명부_2026.pdf", size: 180_000, uploadedAt: d(-1, 15), uploadedBy: "c_e", version: 1 }] },
    { id: "dr_f3", projectId: "pj_f1", companyId: "co_f", name: "사후관리 운영 지표 (3개월)", description: "월별 정산 오류 건수 · 배차 지연 건수 — 개선 후 변화 확인용", requestedAt: d(-5), dueDate: d(5), status: "requested", assigneeId: "u_jung", files: [] },
  );

  schedules.push(
    { id: "sc_14", companyId: "co_e", projectId: "pj_e1", title: "이플러스바이오 정관·사업자등록증 제출기한", type: "doc_due", start: d(4, 18), assigneeId: "u_lee", visibleToClient: true },
    { id: "sc_15", companyId: "co_d", projectId: "pj_d1", title: "디원건설 현장소장 표준양식 설명회", type: "meeting", start: d(3, 16), end: d(3, 16, 30), location: "디원건설 대전 본사 (화상 병행)", assigneeId: "u_jung", visibleToClient: true },
    { id: "sc_16", companyId: "co_b", projectId: "pj_b1", title: "비앤테크 연구전담요원 증빙 회신 기한", type: "doc_due", start: d(2, 18), assigneeId: "u_lee", visibleToClient: true },
  );

  tasks.push(
    { id: "tk_13", companyId: "co_e", projectId: "pj_e1", title: "이플러스바이오 주주명부 검토", type: "자료검토", dueDate: d(1, 18), assigneeId: "u_lee", status: "todo", priority: "normal", createdAt: d(-1, 15), source: "auto" },
    { id: "tk_14", companyId: "co_d", projectId: "pj_d1", title: "디원건설 문의 답변 — 휴대폰 보고 입력", type: "문의응대", dueDate: d(0, 18), assigneeId: "u_jung", status: "todo", priority: "urgent", createdAt: d(-2, 9), source: "auto" },
    { id: "tk_15", companyId: "co_d", projectId: "pj_d1", title: "디원건설 9월 현장 원가 집계표 검토", type: "자료검토", dueDate: d(1, 18), assigneeId: "u_jung", status: "doing", priority: "normal", createdAt: d(-2, 10), source: "auto" },
    { id: "tk_16", companyId: "co_b", projectId: "pj_b1", title: "비앤테크 연구공간 현장 확인 준비", type: "미팅준비", dueDate: d(3, 18), assigneeId: "u_lee", status: "todo", priority: "normal", createdAt: d(-1) },
    { id: "tk_17", companyId: "co_c", projectId: "pj_c1", title: "씨엠푸드 사업계획서 초안 공유", type: "보고서", dueDate: d(-2, 18), assigneeId: "u_park", status: "done", priority: "normal", createdAt: d(-8), completedAt: d(-2, 17) },
    { id: "tk_18", companyId: "co_f", projectId: "pj_f1", title: "에프물류 인사노무 점검 범위 안내", type: "후속연락", dueDate: d(4, 18), assigneeId: "u_jung", status: "todo", priority: "low", createdAt: d(-2) },
  );

  inquiries.push(
    { id: "iq_5", companyId: "co_d", projectId: "pj_d1", title: "현장 보고를 휴대폰으로 입력할 수 있나요?", category: "기타", createdAt: d(-2, 8, 40), createdBy: "c_d", status: "open", assigneeId: "u_jung",
      messages: [{ id: "m_8", authorId: "c_d", authorRole: "client", body: "현장소장님들이 엑셀 양식을 PC에서만 작성할 수 있어 보고가 늦어집니다. 휴대폰으로 입력하는 방법이 있을까요?", createdAt: d(-2, 8, 40) }] },
    { id: "iq_6", companyId: "co_e", projectId: "pj_e1", title: "벤처기업확인을 받으면 무엇이 달라지나요?", category: "진행상황", createdAt: d(-2, 10), createdBy: "c_e", status: "answered", assigneeId: "u_lee",
      messages: [
        { id: "m_9", authorId: "c_e", authorRole: "client", body: "벤처기업확인을 받으면 회사 입장에서 무엇이 달라지는지, 지금 준비해야 할 것이 있는지 궁금합니다.", createdAt: d(-2, 10) },
        { id: "m_10", authorId: "u_lee", authorRole: "consultant", body: "확인 유형별 요건이 달라 먼저 회사 현황을 보고 맞는 유형을 정리해 드리겠습니다. 정관·주주명부·사업자등록증을 요청자료에 올려 주시면 사전 점검표로 안내드리겠습니다.", createdAt: d(-2, 14) },
      ] },
    { id: "iq_7", companyId: "co_f", projectId: "pj_f1", title: "사후관리 기간이 끝난 뒤에도 문의할 수 있나요?", category: "기타", createdAt: d(-7, 15), createdBy: "c_f", status: "answered", assigneeId: "u_jung",
      messages: [
        { id: "m_11", authorId: "c_f", authorRole: "client", body: "사후관리 기간이 끝난 뒤에도 정산 양식 관련해서 문의드려도 될까요?", createdAt: d(-7, 15) },
        { id: "m_12", authorId: "u_jung", authorRole: "consultant", body: "네, 이 화면의 문의하기로 계속 남겨 주시면 됩니다. 기간 종료 전 2차 점검에서 이후 관리 방법도 함께 정리하겠습니다.", createdAt: d(-7, 17) },
      ] },
  );

  results.push(
    { id: "rs_5", projectId: "pj_c1", companyId: "co_c", name: "정책자금 사업계획서 초안 v1", kind: "보고서", sharedAt: d(-2, 17), sharedBy: "u_park", size: 2_700_000, description: "재무 파트 제외 초안 — 대표 검토용. 의견은 문의하기로 남겨 주세요." },
    { id: "rs_6", projectId: "pj_b1", companyId: "co_b", name: "연구소 설립 요건 체크리스트", kind: "체크리스트", sharedAt: d(-15, 10), sharedBy: "u_lee", size: 160_000, description: "연구전담요원 · 연구공간 · 신고서류 요건 점검표" },
    { id: "rs_7", projectId: "pj_d1", companyId: "co_d", name: "현장 보고 표준양식 v1", kind: "체크리스트", sharedAt: d(-35, 15), sharedBy: "u_jung", size: 140_000, description: "현장별 주간 원가·공정 보고 표준양식과 작성 예시" },
    { id: "rs_8", projectId: "pj_e1", companyId: "co_e", name: "벤처기업확인 사전 점검표", kind: "체크리스트", sharedAt: d(-1, 16), sharedBy: "u_lee", size: 120_000, description: "확인 유형별 요건과 준비 서류 — 상담 내용 기준 1차 점검" },
  );

  activities.push(
    { id: "ac_b1", type: "portal_login", companyId: "co_b", actorId: "c_b", actorRole: "client", at: d(-1, 9, 5), text: "고객 Portal 접속" },
    { id: "ac_b2", type: "result_downloaded", companyId: "co_b", projectId: "pj_b1", actorId: "c_b", actorRole: "client", at: d(-14, 9), text: "결과자료 열람: 연구소 설립 요건 체크리스트" },
    { id: "ac_b3", type: "result_shared", companyId: "co_b", projectId: "pj_b1", actorId: "u_lee", actorRole: "consultant", at: d(-15, 10), text: "결과자료 공유: 연구소 설립 요건 체크리스트" },
    { id: "ac_b4", type: "consultation_logged", companyId: "co_b", projectId: "pj_b1", actorId: "u_lee", actorRole: "consultant", at: d(-9, 11, 30), text: "후속상담 기록 (전화)" },
    { id: "ac_c1", type: "consultation_logged", companyId: "co_c", projectId: "pj_c1", actorId: "u_park", actorRole: "consultant", at: d(-62, 12), text: "씨엠푸드 초기상담 기록" },
    { id: "ac_c2", type: "contract_signed", companyId: "co_c", projectId: "pj_c1", actorId: "c_c", actorRole: "client", at: d(-55, 10), text: "정책자금 준비 컨설팅 계약 서명" },
    { id: "ac_c3", type: "document_uploaded", companyId: "co_c", projectId: "pj_c1", actorId: "c_c", actorRole: "client", at: d(-47, 14), text: "고객 제출: 재무제표 3년" },
    { id: "ac_c4", type: "result_shared", companyId: "co_c", projectId: "pj_c1", actorId: "u_park", actorRole: "consultant", at: d(-2, 17), text: "결과자료 공유: 정책자금 사업계획서 초안 v1" },
    { id: "ac_c5", type: "portal_login", companyId: "co_c", actorId: "c_c", actorRole: "client", at: d(-1, 10, 40), text: "고객 Portal 접속" },
    { id: "ac_c6", type: "result_downloaded", companyId: "co_c", projectId: "pj_c1", actorId: "c_c", actorRole: "client", at: d(-1, 10, 42), text: "결과자료 열람: 정책자금 사업계획서 초안 v1" },
    { id: "ac_d1", type: "contract_signed", companyId: "co_d", projectId: "pj_d1", actorId: "c_d", actorRole: "client", at: d(-60, 15), text: "운영개선 컨설팅 계약 서명" },
    { id: "ac_d2", type: "result_shared", companyId: "co_d", projectId: "pj_d1", actorId: "u_jung", actorRole: "consultant", at: d(-35, 15), text: "결과자료 공유: 현장 보고 표준양식 v1" },
    { id: "ac_d3", type: "result_downloaded", companyId: "co_d", projectId: "pj_d1", actorId: "c_d", actorRole: "client", at: d(-34, 8, 30), text: "결과자료 열람: 현장 보고 표준양식 v1" },
    { id: "ac_d4", type: "inquiry_created", companyId: "co_d", projectId: "pj_d1", actorId: "c_d", actorRole: "client", at: d(-2, 8, 40), text: "고객 문의: 현장 보고를 휴대폰으로 입력할 수 있나요?" },
    { id: "ac_d5", type: "document_uploaded", companyId: "co_d", projectId: "pj_d1", actorId: "c_d", actorRole: "client", at: d(-2, 10), text: "고객 제출: 9월 현장 원가 집계표" },
    { id: "ac_d6", type: "task_created", companyId: "co_d", projectId: "pj_d1", actorId: "u_admin", actorRole: "system", at: d(-2, 10), text: "자동 생성: 9월 현장 원가 집계표 검토 Task" },
    { id: "ac_e1", type: "inquiry_created", companyId: "co_e", projectId: "pj_e1", actorId: "c_e", actorRole: "client", at: d(-2, 10), text: "고객 문의: 벤처기업확인을 받으면 무엇이 달라지나요?" },
    { id: "ac_e2", type: "inquiry_answered", companyId: "co_e", projectId: "pj_e1", actorId: "u_lee", actorRole: "consultant", at: d(-2, 14), text: "문의 답변: 벤처기업확인 관련" },
    { id: "ac_e3", type: "document_requested", companyId: "co_e", projectId: "pj_e1", actorId: "u_lee", actorRole: "consultant", at: d(-2, 15), text: "자료 3건 요청 (사업자등록증 · 정관 · 주주명부)" },
    { id: "ac_e4", type: "document_uploaded", companyId: "co_e", projectId: "pj_e1", actorId: "c_e", actorRole: "client", at: d(-1, 15), text: "고객 제출: 주주명부" },
    { id: "ac_e5", type: "task_created", companyId: "co_e", projectId: "pj_e1", actorId: "u_admin", actorRole: "system", at: d(-1, 15), text: "자동 생성: 주주명부 검토 Task" },
    { id: "ac_e6", type: "result_shared", companyId: "co_e", projectId: "pj_e1", actorId: "u_lee", actorRole: "consultant", at: d(-1, 16), text: "결과자료 공유: 벤처기업확인 사전 점검표" },
    { id: "ac_f1", type: "contract_signed", companyId: "co_f", projectId: "pj_f1", actorId: "c_f", actorRole: "client", at: d(-115, 11), text: "운영개선 컨설팅 계약 서명" },
    { id: "ac_f2", type: "consultation_logged", companyId: "co_f", projectId: "pj_f1", actorId: "u_jung", actorRole: "consultant", at: d(-28, 17), text: "사후관리 1차 정기 점검 기록" },
    { id: "ac_f3", type: "result_downloaded", companyId: "co_f", projectId: "pj_f1", actorId: "c_f", actorRole: "client", at: d(-29, 9), text: "결과자료 열람: 운영개선 최종 보고서" },
    { id: "ac_f4", type: "portal_login", companyId: "co_f", actorId: "c_f", actorRole: "client", at: d(-5, 13), text: "고객 Portal 접속" },
    { id: "ac_f5", type: "document_requested", companyId: "co_f", projectId: "pj_f1", actorId: "u_jung", actorRole: "consultant", at: d(-5, 10), text: "자료 요청: 사후관리 운영 지표 (3개월)" },
    { id: "ac_a27", type: "result_downloaded", companyId: "co_a", projectId: "pj_a2", actorId: "c_a", actorRole: "client", at: d(-21, 9), text: "결과자료 열람: 메인비즈 인증 신청서 최종본" },
  );

  notifications.push(
    { id: "nt_8", audience: "client", companyId: "co_c", title: "결과자료가 공유되었습니다", body: "정책자금 사업계획서 초안 v1을 완료자료에서 확인하세요.", at: d(-2, 17), read: true, href: "/portal/results" },
    { id: "nt_9", audience: "client", companyId: "co_d", title: "자료 기한이 지났습니다", body: "표준 보고양식 적용 결과 (2주차) — 기한이 지났습니다. 올려 주시면 바로 검토합니다.", at: d(0, 7), read: false, href: "/portal/documents" },
    { id: "nt_10", audience: "client", companyId: "co_e", title: "새 자료 요청 3건", body: "사업자등록증 · 정관 · 주주명부를 요청자료에서 올려 주세요.", at: d(-2, 15), read: true, href: "/portal/documents" },
    { id: "nt_11", audience: "client", companyId: "co_f", title: "새 자료 요청: 사후관리 운영 지표", body: "다음 정기 점검 전에 올려 주세요.", at: d(-5, 10), read: false, href: "/portal/documents" },
    { id: "nt_12", audience: "internal", companyId: "co_d", title: "새 문의: 디원건설", body: "현장 보고를 휴대폰으로 입력할 수 있나요?", at: d(-2, 8, 40), read: false, href: "/ax/inquiries" },
    { id: "nt_13", audience: "internal", companyId: "co_e", title: "새 자료 도착: 이플러스바이오", body: "주주명부가 제출되었습니다.", at: d(-1, 15), read: false, href: "/ax/documents" },
  );

  activities.sort((a, b) => b.at.localeCompare(a.at));
  notifications.sort((a, b) => b.at.localeCompare(a.at));
  /* ---------- 매출기회 (고객 관심 → 내부 기회) ---------- */
  const opportunities: Opportunity[] = [
    {
      id: "op_1", companyId: "co_b", serviceKey: "kpjk_특허자본", serviceName: "특허자본", source: "portal_interest", status: "interest",
      assigneeId: "u_lee", createdAt: d(-1, 14), createdBy: "c_b", updatedAt: d(-1, 14),
      note: "연구소 설립 마무리되면 이어서 검토하고 싶습니다.",
      reason: "고객이 컨설팅 분야에서 직접 선택",
      history: [{ at: d(-1, 14), status: "interest", by: "c_b" }],
    },
    {
      id: "op_2", companyId: "co_a", serviceKey: "kpjk_가지급금", serviceName: "가지급금", source: "portal_request", status: "contacted",
      assigneeId: "u_park", createdAt: d(-5, 10), createdBy: "c_a", updatedAt: d(-3, 11),
      note: "정리 방법이 어떤 것들이 있는지 궁금합니다.",
      reason: "고객이 컨설팅 분야에서 직접 선택",
      history: [{ at: d(-5, 10), status: "interest", by: "c_a" }, { at: d(-3, 11), status: "contacted", by: "u_park", note: "전화 통화 완료. 잔액·발생 경위 자료 요청 예정." }],
    },
    {
      id: "op_3", companyId: "co_f", serviceKey: "kpjk_인사노무", serviceName: "인사노무", source: "rule", status: "interest",
      assigneeId: "u_jung", createdAt: d(-2, 9), createdBy: "system", updatedAt: d(-2, 9),
      reason: "상시 인력 54명 규모로, 근로계약·취업규칙 현황을 점검해볼 수 있습니다.",
      history: [{ at: d(-2, 9), status: "interest", by: "system" }],
    },
    {
      id: "op_4", companyId: "co_e", serviceKey: "corp_cleanup", serviceName: "법인 정비 (가지급금 · 정관 · 주식)", source: "internal", status: "approval_pending",
      assigneeId: "u_lee", createdAt: d(-4, 15), createdBy: "u_lee", updatedAt: d(-1, 9),
      note: "초기 상담에서 정관 정비 필요성 확인. 연간 자문 범위로 제안 예정.",
      history: [{ at: d(-4, 15), status: "interest", by: "u_lee" }, { at: d(-2, 10), status: "contacted", by: "u_lee" }, { at: d(-1, 9), status: "approval_pending", by: "u_lee" }],
    },
    {
      id: "op_5", companyId: "co_c", serviceKey: "ip", serviceName: "특허 · 지식재산", source: "internal", status: "won",
      assigneeId: "u_park", createdAt: d(-30, 11), createdBy: "u_park", updatedAt: d(-18, 16),
      note: "공정 개선 건으로 출원 1건 진행.",
      history: [{ at: d(-30, 11), status: "interest", by: "u_park" }, { at: d(-27, 10), status: "contacted", by: "u_park" }, { at: d(-24, 14), status: "approval_pending", by: "u_park" }, { at: d(-22, 9), status: "proposed", by: "u_admin" }, { at: d(-18, 16), status: "won", by: "u_park" }],
    },
  ];

  /* ---------- 견적 (상담 → 견적 → 계약) ---------- */
  const quotes: Quote[] = [
    {
      id: "qt_1", companyId: "co_e", projectId: "pj_e1", opportunityId: "op_4",
      title: "법인 경영자문 연간 계약", scope: "정관 정비 · 주주명부 정리 · 분기 자문 4회", period: "12개월",
      items: [
        { name: "정관 및 주주명부 정비", amount: 4000000 },
        { name: "분기 자문 (4회)", amount: 4800000 },
        { name: "벤처기업확인 연계 검토", amount: 1200000, note: "요건 진단 범위" },
      ],
      discountPct: 0, validUntil: d(14), status: "draft", createdBy: "u_lee", createdAt: d(-1, 11),
    },
    {
      id: "qt_2", companyId: "co_a", projectId: "pj_a1",
      title: "경영진단 2차 — 원가 개선 실행지원", scope: "개선안 실행 동행 · 월 2회 점검 · 성과 리포트", period: "4개월",
      items: [
        { name: "실행 동행 (월 2회 × 4개월)", amount: 9600000 },
        { name: "성과 측정 리포트", amount: 2400000 },
      ],
      discountPct: 0, validUntil: d(10), status: "sent", createdBy: "u_park", createdAt: d(-6, 15), sentAt: d(-5, 10),
    },
    {
      id: "qt_3", companyId: "co_b", projectId: "pj_b1",
      title: "연구소 사후관리 자문", scope: "연구노트 관리 · 변경신고 · 인력 요건 점검", period: "12개월",
      items: [{ name: "연간 사후관리 자문", amount: 6000000 }],
      discountPct: 0, validUntil: d(-2), status: "accepted", createdBy: "u_lee", createdAt: d(-20, 14), sentAt: d(-18, 9), respondedAt: d(-12, 16),
    },
  ];

  /* ---------- 대표 승인 대기 ---------- */
  const approvals: Approval[] = [
    {
      id: "ap_1", kind: "opportunity", title: "이플러스바이오(주) 법인 정비 연간 자문 제안",
      summary: "창업 2년차. 정관·주주명부 정비 후 벤처확인까지 연결되는 범위. 제안 전 대표님 확인이 필요합니다.",
      companyId: "co_e", opportunityId: "op_4", requestedBy: "u_lee", requestedAt: d(-1, 9), status: "pending",
    },
    {
      id: "ap_2", kind: "discount", title: "씨엠푸드(주) 법인 경영자문 계약 할인 요청",
      summary: "정책자금 건을 함께 진행 중인 기존 고객. 연간 자문 계약에 한해 할인 적용 여부를 결정해 주세요.",
      companyId: "co_c", projectId: "pj_c2", baseAmount: 12000000, discountPct: 10,
      requestedBy: "u_park", requestedAt: d(0, 9, 20), status: "pending",
    },
    {
      id: "ap_3", kind: "promise", title: "디원건설(주) 결과보고 일정 2주 연기 요청",
      summary: "고객 측 자료 제출 지연으로 당초 약속한 보고일을 맞추기 어렵습니다. 고객에게 연기를 안내해도 될지 확인 부탁드립니다.",
      companyId: "co_d", projectId: "pj_d1", requestedBy: "u_jung", requestedAt: d(-2, 17), status: "pending",
    },
    {
      id: "ap_4", kind: "opportunity", title: "씨엠푸드(주) 특허 출원 자문 제안",
      summary: "공정 개선 결과물 중 권리화 가능 항목 1건. 제안 범위와 금액 확인 요청.",
      companyId: "co_c", opportunityId: "op_5", requestedBy: "u_park", requestedAt: d(-24, 14), status: "approved",
      decidedBy: "u_admin", decidedAt: d(-22, 9), decisionNote: "범위 동의. 금액은 기존 고객 기준으로 진행하세요.",
    },
  ];

  const surveys: SurveyResponse[] = [];

  // 샘플 공지는 샘플 기업에만 붙인다 — "샘플 지우기"를 누르면 함께 사라져 실제 고객에게 새지 않는다
  const notices: Notice[] = [
    { id: "nc_a1", companyId: "co_a", title: "중간 보고 전 확인 부탁드립니다", body: "다음 주 중간 보고에서 원가 개선안 초안을 함께 보려고 합니다.\n요청자료 화면에 남은 항목이 있으면 이번 주 안에 올려 주세요. 올리신 자료는 담당 컨설턴트가 바로 확인합니다.", pinned: true, publishedAt: d(-1, 10), authorId: "u_park" },
    { id: "nc_a2", companyId: "co_a", title: "자료는 카카오톡 대신 이 화면으로 보내 주세요", body: "카카오톡으로 받은 파일은 담당자 한 사람의 휴대폰에만 남습니다. 요청자료 화면에 올려 주시면 담당자·대표가 함께 확인하고, 검토 결과도 이곳에서 바로 알려 드립니다.", publishedAt: d(-9, 9), authorId: "u_park" },
  ];

  const oppActivities: Activity[] = [
    { id: "ac_op1", type: "opportunity_created", companyId: "co_b", actorId: "c_b", actorRole: "client", at: d(-1, 14), text: "고객 관심표시: 벤처기업확인" },
    { id: "ac_op2", type: "approval_requested", companyId: "co_e", actorId: "u_lee", actorRole: "consultant", at: d(-1, 9), text: "대표 승인 요청: 이플러스바이오(주) 법인 정비 연간 자문 제안" },
    { id: "ac_op3", type: "approval_requested", companyId: "co_c", actorId: "u_park", actorRole: "consultant", at: d(0, 9, 20), text: "대표 승인 요청: 씨엠푸드(주) 법인 경영자문 계약 할인 요청" },
    { id: "ac_qt1", type: "quote_sent", companyId: "co_a", projectId: "pj_a1", actorId: "u_park", actorRole: "consultant", at: d(-5, 10), text: "견적 발송: 경영진단 2차 — 원가 개선 실행지원" },
    { id: "ac_qt2", type: "quote_responded", companyId: "co_b", projectId: "pj_b1", actorId: "c_b", actorRole: "client", at: d(-12, 16), text: "고객 회신: 연구소 사후관리 자문 — 수락" },
  ];
  const oppNotifs: Notification[] = [
    { id: "nt_op1", audience: "internal", companyId: "co_c", title: "대표 승인 요청", body: "씨엠푸드(주) · 법인 경영자문 계약 할인 요청", at: d(0, 9, 20), read: false, href: "/ax/opportunities?tab=approvals" },
    { id: "nt_op2", audience: "internal", companyId: "co_b", title: "추가서비스 관심: 비앤테크(주)", body: "벤처기업확인 — 연구소 설립 마무리되면 이어서 검토하고 싶습니다.", at: d(-1, 14), read: false, href: "/ax/opportunities" },
  ];

  const allActivities = [...oppActivities, ...activities].sort((a, b) => b.at.localeCompare(a.at));
  const allNotifications = [...oppNotifs, ...notifications].sort((a, b) => b.at.localeCompare(a.at));

  // 고객 관리 — 샘플 기업에만. 금액·서류 파일은 넣지 않는다(지어낸 숫자·가짜 서류를 만들지 않는다)
  const companyVaults: CompanyVault[] = [];
  const companyFiles: CompanyFile[] = [];
  // 수금 — 샘플 계약의 예시 금액(대표만 보는 계약·수금 탭). 디원건설 중도금은 기한이 지나 "연체" 경고 예시가 된다
  const ymd = (n: number) => d(n).slice(0, 10);
  const CT: Record<string, string> = { co_a: d(-40), co_b: d(-18), co_c: d(-55), co_d: d(-60), co_f: d(-115) };
  const payments: Payment[] = [
    { id: "pm_a1", companyId: "co_a", createdAt: CT["co_a"], projectId: "pj_a1", kind: "deposit", label: "계약금", amount: 9_000_000, dueDate: ymd(-40), receivedAt: ymd(-39), note: "샘플 금액" },
    { id: "pm_a2", companyId: "co_a", createdAt: CT["co_a"], projectId: "pj_a1", kind: "interim", label: "잔금 (최종 보고 후)", amount: 9_000_000, dueDate: ymd(14), note: "샘플 금액" },
    { id: "pm_b1", companyId: "co_b", createdAt: CT["co_b"], projectId: "pj_b1", kind: "deposit", label: "계약금", amount: 3_750_000, dueDate: ymd(-18), receivedAt: ymd(-17), note: "샘플 금액" },
    { id: "pm_b2", companyId: "co_b", createdAt: CT["co_b"], projectId: "pj_b1", kind: "interim", label: "잔금 (설립 신고 후)", amount: 3_750_000, dueDate: ymd(30), note: "샘플 금액" },
    { id: "pm_c1", companyId: "co_c", createdAt: CT["co_c"], projectId: "pj_c1", kind: "deposit", label: "착수금", amount: 7_500_000, dueDate: ymd(-55), receivedAt: ymd(-54), note: "샘플 금액" },
    { id: "pm_c2", companyId: "co_c", createdAt: CT["co_c"], projectId: "pj_c1", kind: "success", label: "성공보수 (승인 시 · 금액 미정)", note: "승인 결과에 따라 계약서 기준으로 정산" },
    { id: "pm_d1", companyId: "co_d", createdAt: CT["co_d"], projectId: "pj_d1", kind: "deposit", label: "계약금", amount: 10_000_000, dueDate: ymd(-60), receivedAt: ymd(-59), note: "샘플 금액" },
    { id: "pm_d2", companyId: "co_d", createdAt: CT["co_d"], projectId: "pj_d1", kind: "interim", label: "중도금 (중간 점검 후)", amount: 6_000_000, dueDate: ymd(-6), note: "샘플 금액 · 입금 확인 필요" },
    { id: "pm_f1", companyId: "co_f", createdAt: CT["co_f"], projectId: "pj_f1", kind: "deposit", label: "계약금", amount: 8_000_000, dueDate: ymd(-115), receivedAt: ymd(-114), note: "샘플 금액" },
    { id: "pm_f2", companyId: "co_f", createdAt: CT["co_f"], projectId: "pj_f1", kind: "interim", label: "잔금", amount: 8_000_000, dueDate: ymd(-30), receivedAt: ymd(-29), note: "샘플 금액" },
  ];
  const journal: JournalEntry[] = [
    { id: "jn_a1", companyId: "co_a", type: "call", content: "대표님 통화 — 중간 보고 일정은 다음 주 초로 잡기로 함. 매출채권 자료는 경리 담당이 준비 중.", entryDate: d(-2).slice(0, 10), authorId: "u_park", createdAt: d(-2, 16) },
    { id: "jn_a2", companyId: "co_a", type: "decision", content: "원가 진단 범위를 본사 공장 1곳으로 한정. 2공장은 다음 단계에서 별도 논의.", entryDate: d(-12).slice(0, 10), pinned: true, authorId: "u_park", createdAt: d(-12, 11) },
  ];
  journal.push(
    { id: "jn_b1", companyId: "co_b", type: "blocker", content: "연구전담요원 후보 2명 학위증명 회신 지연 — 다음 주까지 안 오면 후보 교체안 제시.", entryDate: d(-3).slice(0, 10), pinned: true, authorId: "u_lee", createdAt: d(-3, 17) },
    { id: "jn_c1", companyId: "co_c", type: "decision", content: "시설자금 중심으로 신청 범위 확정. 운전자금은 다음 분기 별도 검토.", entryDate: d(-20).slice(0, 10), pinned: true, authorId: "u_park", createdAt: d(-20, 17) },
    { id: "jn_c2", companyId: "co_c", type: "call", content: "대표님 통화 — 초안 잘 받았고 이번 주 금요일까지 의견 주기로 함.", entryDate: d(-1).slice(0, 10), authorId: "u_park", createdAt: d(-1, 11) },
    { id: "jn_d1", companyId: "co_d", type: "blocker", content: "현장 1곳이 아직 카톡 보고 유지. 설명회 후에도 안 바뀌면 관리이사님께 직접 요청.", entryDate: d(-9).slice(0, 10), pinned: true, authorId: "u_jung", createdAt: d(-9, 18) },
    { id: "jn_e1", companyId: "co_e", type: "idea", content: "투자 유치 일정이 잡히면 정관 정비와 벤처확인을 같은 흐름으로 묶어 제안.", entryDate: d(-3).slice(0, 10), authorId: "u_lee", createdAt: d(-3, 12) },
    { id: "jn_f1", companyId: "co_f", type: "win", content: "사후관리 1차 점검 — 정산 표준양식 정착 확인. 대표님 만족, 다른 운수업체 소개 의향 언급.", entryDate: d(-28).slice(0, 10), pinned: true, authorId: "u_jung", createdAt: d(-28, 18) },
  );

  notices.push(
    { id: "nc_c1", companyId: "co_c", title: "사업계획서 초안을 올렸습니다", body: "완료자료에서 초안 v1을 확인하실 수 있습니다. 재무 파트는 결산 확정본을 받은 뒤 채워 넣겠습니다.\n의견은 문의하기에 남겨 주시면 다음 버전에 반영합니다.", pinned: true, publishedAt: d(-2, 17, 10), authorId: "u_park" },
    { id: "nc_f1", companyId: "co_f", title: "사후관리 2차 정기 점검 안내", body: "다음 주 점검에서 정산 오류·배차 지연 건수를 함께 봅니다. 요청자료의 '사후관리 운영 지표'를 미리 올려 주세요.", publishedAt: d(-5, 10), authorId: "u_jung" },
  );

  // 진행 상태 — 연구소 건은 고객 서류 회신을 기다리는 중(9일째 → "회신 지연" 경고 예시)
  for (const p of projects) {
    if (p.id === "pj_b1") { p.workStatus = "waiting_client"; p.waitingSince = d(-9); p.nextStep = "연구전담요원 재직증명 회신 받기"; }
    if (p.id === "pj_a1") { p.workStatus = "in_progress"; p.nextStep = "원가구조 진단 결과 1차 정리"; }
    if (p.id === "pj_c1") { p.workStatus = "in_progress"; p.nextStep = "대표 의견 반영 후 재무 파트 작성"; }
    if (p.id === "pj_c2") { p.workStatus = "waiting_client"; p.waitingSince = d(-1); p.nextStep = "연간 자문 계약서 서명 회신 받기"; }
    if (p.id === "pj_d1") { p.workStatus = "waiting_client"; p.waitingSince = d(-12); p.nextStep = "2주차 표준양식 적용 결과 받기"; }
    if (p.id === "pj_e1") { p.workStatus = "in_progress"; p.nextStep = "정관 · 사업자등록증 받은 뒤 자문 범위 확정"; }
    if (p.id === "pj_f1") { p.workStatus = "in_progress"; p.nextStep = "2차 정기 점검 — 개선 전후 운영 지표 비교"; }
    if (p.id === "pj_a2") { p.workStatus = "done"; }
  }

  return { users, companies, consultations, contracts, projects, docRequests, schedules, tasks, inquiries, results, opportunities, quotes, approvals, surveys, notices, companyVaults, companyFiles, journal, payments, activities: allActivities, notifications: allNotifications, programs: [], leads: [] };
}
