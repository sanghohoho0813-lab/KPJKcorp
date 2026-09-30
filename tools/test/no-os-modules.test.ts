/**
 * 전문 모듈 비노출 검사.
 *
 * 고객 관리 기능은 다른 운영 시스템(AX MVP Factory OS)에서 옮겨 왔다. 그 시스템의 전문 모듈
 * (정책자금·절세·재무분석·크레탑·고용지원금·기업부설연구소·특허/벤처 작업실·AX 제작·웹스튜디오·도구함 등)은
 * 김상호(미래 AI 랩)의 자산이라 이 저장소에 한 줄도 들어오면 안 된다.
 *
 * 그 모듈에만 있는 이름(코드 식별자·화면 문구)이 src/ 에 나타나면 실패한다.
 * "정책자금·고용지원금·기업부설연구소" 같은 낱말 자체는 KPJK 가 원래부터 쓰던 상담 분야라 검사하지 않는다 —
 * 모듈을 가리키는 고유 이름만 본다.
 *
 * 실행: npx tsx tools/test/no-os-modules.test.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../../src");
const FORBIDDEN: [RegExp, string][] = [
  [/크레탑|cretop/i, "크레탑 분석 모듈"],
  [/toolResults?\b|toolRegistry|ToolResultsCard|ClientToolsCard|toolsNeeding/, "도구함 모듈"],
  [/policyFund|fundingApplication|FundingSection|fundingOrchestrator/, "정책자금 모듈"],
  [/websiteStudio|웹\s?스튜디오|WebsiteDesign/i, "웹스튜디오 모듈"],
  [/taxCalculator|세금\s?계산기|taxProfile/i, "세금 계산기 모듈"],
  [/labcare|researchLabTool/i, "연구소 도구 모듈"],
  [/AxProjectsCard|axClientLink|mvpDesign|deliverableOrchestrator/i, "AX 제작 흐름 모듈"],
  [/consultingStudio|patentVentureStudio/i, "특허·벤처 작업실"],
  [/payrollRoster|employmentGrantTool|명부\s?→\s?직원 등록/, "고용지원금 모듈"],
  [/My MIRAE|miraeailab|customerBridge|portal_client_links/i, "OS 고객 플랫폼(외부)"],
  [/SalesJourneyCard|salesCretop|agentLedger|AgentSettlementPage/, "OS 영업 모듈 코드"],
  [/ax-mvp-factory-os|AX MVP Factory/i, "OS 저장소 참조"],
];

function walk(dir: string, out: string[] = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css|json)$/.test(n)) out.push(p);
  }
  return out;
}

let fail = 0;
const files = walk(ROOT);
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const [re, what] of FORBIDDEN) {
      if (re.test(line)) { fail++; console.error(`FAIL ${f.replace(ROOT, "src")}:${i + 1} — ${what}: ${line.trim().slice(0, 100)}`); }
    }
  });
}
console.log(fail ? `\n${fail}건 발견` : `OK   src/ ${files.length}개 파일에 전문 모듈 흔적 없음`);
process.exit(fail ? 1 : 0);
