import { filterEvidence, EMPTY_FILTER, describeFilter } from "../../src/lib/evidence-filter";
import { ruleDays, ruleOn } from "../../src/lib/rules";
let fail=0; const ok=(c:boolean,m:string)=>{console.log((c?"OK  ":"FAIL")+" "+m); if(!c) fail++;};
const now=new Date(2026,8,29,15,0);           // 로컬 9/29 15:00
const at=(d:number,h=10)=>new Date(2026,8,d,h).toISOString();
const A:any[]=[
 {id:"1",type:"document_uploaded",actorId:"c_a",actorRole:"client",companyId:"co_a",at:at(29,9),text:"자료 제출: 재무제표"},
 {id:"2",type:"rule_task_created",actorId:"system",actorRole:"system",companyId:"co_b",at:at(28),text:"규칙 생성 (자료 기한 3일 초과 독촉)"},
 {id:"3",type:"sign_in_failed",actorId:"u_park",actorRole:"consultant",at:at(20),text:"로그인 실패"},
 {id:"4",type:"consultation_logged",actorId:"u_park",actorRole:"consultant",companyId:"co_a",at:at(1),text:"상담 기록: 초기상담"},
];
const N={userName:(id:string)=>({u_park:"박성훈",c_a:"김민석"} as any)[id], companyName:(id?:string)=>({co_a:"에이정밀(주)",co_b:"비앤테크(주)"} as any)[id!]};
const f=(p:any)=>filterEvidence(A,{...EMPTY_FILTER,...p},now,N).map(a=>a.id).join(",");
ok(f({})==="1,2,3,4","all, newest first "+f({}));
ok(f({period:"today"})==="1","today");
ok(f({period:"7"})==="1,2","7 days "+f({period:"7"}));
ok(f({period:"30"})==="1,2,3,4","30 days (9/1 포함) "+f({period:"30"}));
ok(f({period:"custom",from:"2026-09-20",to:"2026-09-28"})==="2,3","custom inclusive "+f({period:"custom",from:"2026-09-20",to:"2026-09-28"}));
ok(f({group:"docs"})==="1","group docs");
ok(f({group:"account"})==="3","group account");
ok(f({actor:"client"})==="1" && f({actor:"system"})==="2" && f({actor:"u_park"})==="3,4","actors");
ok(f({company:"co_a"})==="1,4","company");
ok(f({q:"에이정밀 상담"})==="4","multi-word search incl. company name");
ok(f({q:"박성훈"})==="3,4","search by actor name");
ok(describeFilter({...EMPTY_FILTER,actor:"u_park",company:"co_a",q:"x"},N).join("|")==="기간: 전체 기간|분류: 전체|행위자: 박성훈|기업: 에이정밀(주)|검색어: x","describe");
ok(ruleDays(undefined,"contract_renewal")===30 && ruleDays({"contract_renewal.days":45},"contract_renewal")===45 && ruleDays({"contract_renewal.days":0},"contract_renewal")===30 && ruleDays({"contract_renewal.days":true} as any,"contract_renewal")===30,"ruleDays guard");
ok(ruleOn(undefined,"x") && ruleOn({"x.days":3},"x") && !ruleOn({x:false},"x"),"ruleOn");
process.exit(fail?1:0);
