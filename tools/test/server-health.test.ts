import { runServerCheck, keyRole, checkReport, type HealthClient } from "../../src/lib/server/health";
let fail=0; const ok=(c:boolean,m:string)=>{console.log((c?"OK  ":"FAIL")+" "+m); if(!c) fail++;};
const jwt=(role:string)=>"eyJhbGciOiJIUzI1NiJ9."+Buffer.from(JSON.stringify({role,ref:"x"})).toString("base64url")+".sig";
const fake=(o:{session?:boolean; missing?:string[]; noCol?:boolean; role?:string|null; roleErr?:boolean; noBucket?:string[]}={}):HealthClient=>({
  auth:{getSession:async()=>({data:{session:o.session===false?null:{user:{id:"u1",email:"ceo@x.kr"}}}})},
  from:(t)=>({select:(cols)=>({limit:()=>Promise.resolve(o.missing?.includes(t)?{error:{code:"PGRST205",message:"Could not find the table"},count:null}:(t==="app_settings"&&cols.includes("baseline")&&o.noCol)?{error:{code:"42703",message:"column app_settings.baseline_surveys does not exist"}}:{error:null,count:t==="companies"?3:0})})}),
  rpc:async()=>o.roleErr?{data:null,error:{code:"PGRST202",message:"not found"}}:{data:o.role===undefined?"admin":o.role,error:null},
  storage:{from:(b)=>({list:async()=>({error:o.noBucket?.includes(b)?{message:"Bucket not found"}:null})})},
});
const URL_="https://abcdefgh.supabase.co"; const f200=async()=>({ok:true,status:200});
const st=(r:any[])=>r.map(i=>i.key+":"+i.status).join(" ");
(async()=>{
  ok(keyRole(jwt("anon"))==="anon" && keyRole(jwt("service_role"))==="service_role" && keyRole("sb_secret_abc")==="service_role" && keyRole("sb_publishable_x")==="anon","keyRole");
  let r=await runServerCheck({client:null}); ok(r.length===1&&r[0].status==="fail"&&!!r[0].fix,"no env");
  r=await runServerCheck({url:URL_,key:jwt("service_role"),client:fake()}); ok(r.length===1&&r[0].status==="fail"&&r[0].detail.includes("service_role"),"service_role blocked");
  r=await runServerCheck({url:URL_,key:jwt("anon"),client:fake(),fetcher:f200}); ok(st(r)==="env:ok reach:ok session:ok tables:ok columns:ok role:ok buckets:ok","all ok: "+st(r));
  ok(r.find(i=>i.key==="tables")!.detail.includes("기업 3"),"counts");
  r=await runServerCheck({url:URL_+"/rest/v1",key:jwt("anon"),client:fake(),fetcher:f200}); ok(r[0].status==="warn","url with path warns");
  r=await runServerCheck({url:URL_,key:jwt("anon"),client:fake(),fetcher:async()=>({ok:false,status:401})}); ok(st(r)==="env:ok reach:fail","401");
  r=await runServerCheck({url:URL_,key:jwt("anon"),client:fake(),fetcher:async()=>{throw new Error("x")}}); ok(st(r)==="env:ok reach:fail"&&r[1].detail.includes("닿지"),"network");
  r=await runServerCheck({url:URL_,key:jwt("anon"),client:fake({session:false}),fetcher:f200}); ok(st(r)==="env:ok reach:ok session:warn","no session");
  r=await runServerCheck({url:URL_,key:jwt("anon"),client:fake({missing:["notices"],noCol:true}),fetcher:f200}); ok(r.find(i=>i.key==="tables")!.status==="fail"&&r.find(i=>i.key==="tables")!.detail.includes("notices")&&r.find(i=>i.key==="columns")!.status==="fail","old setup.sql");
  r=await runServerCheck({url:URL_,key:jwt("anon"),client:fake({role:null}),fetcher:f200}); ok(r.find(i=>i.key==="role")!.status==="fail"&&r.find(i=>i.key==="role")!.detail.includes("대표 계정 연결"),"no role");
  r=await runServerCheck({url:URL_,key:jwt("anon"),client:fake({noBucket:["results"]}),fetcher:f200}); ok(r.find(i=>i.key==="buckets")!.status==="fail","bucket missing");
  const rep=checkReport(r,new Date()); ok(rep.includes("파일 보관함 3개: 막힘")&&!rep.includes("eyJ"),"report has no key");
  process.exit(fail?1:0);
})();
