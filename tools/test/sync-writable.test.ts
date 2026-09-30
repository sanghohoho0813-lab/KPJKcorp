// 서버에 "누가 무엇을 직접 쓸 수 있나" — setup.sql 정책과 같아야 한다.
// 여기가 어긋나면 한 줄 때문에 묶음 전체가 거절된다(18차 이후 실연결에서 실제로 겪은 일).
import { writable } from "../../src/lib/server/sync";
import { personId, activityToRow, activityFromRow } from "../../src/lib/server/rows";

let fail = 0;
const ok = (label: string, cond: boolean) => { console.log(`${cond ? "OK  " : "FAIL"} ${label}`); if (!cond) fail++; };

const ME = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-2222-3333-4444-555555555555";
const client = { role: "client", userId: ME };
const staff = { role: "consultant", userId: ME };

// 고객
ok("고객: 업무(tasks)를 보내지 않는다", !writable("tasks", {}, true, client));
ok("고객: 프로젝트(단계 변경)를 보내지 않는다", !writable("projects", {}, false, client));
ok("고객: 자료요청 새로 만들기 X", !writable("docRequests", {}, true, client));
ok("고객: 자료요청 제출 표시 O", writable("docRequests", {}, false, client));
ok("고객: 새 문의 O", writable("inquiries", {}, true, client));
ok("고객: 문의 상태 변경 X (서버 트리거)", !writable("inquiries", {}, false, client));
ok("고객: 상담요청 O", writable("opportunities", {}, true, client));
ok("고객: 견적 회신(기존 행) O", writable("quotes", {}, false, client));
ok("고객: 담당자 알림 보내기 O", writable("notifications", { audience: "internal" }, true, client));
ok("고객: 고객용 알림 만들기 X (서버 트리거)", !writable("notifications", { audience: "client" }, true, client));
ok("고객: 내 알림 읽음 O", writable("notifications", { audience: "client" }, false, client));
ok("고객: 내 이름 기록 O", writable("activities", { actorId: ME }, true, client));
ok("고객: system 기록 X", !writable("activities", { actorId: "system" }, true, client));
ok("고객: 서류함·수금·일기 X", ["companyVaults", "companyFiles", "journal", "payments"].every((k) => !writable(k as never, {}, true, client)));

// 내부
ok("내부: 업무 O", writable("tasks", {}, true, staff));
ok("내부: system 기록 O", writable("activities", { actorId: "system", actorRole: "system" }, true, staff));
ok("내부: 남의 이름 기록 X", !writable("activities", { actorId: OTHER }, true, staff));

// 사람 칸
ok("personId: 계정 ID 통과", personId(ME) === ME);
ok("personId: 데모 ID(u_admin)는 비움", personId("u_admin") === null);
ok("personId: system 은 비움", personId("system") === null);
const row = activityToRow({ id: "ac1", type: "task_created", actorId: "system", actorRole: "system", at: "2026-01-01T00:00:00Z", text: "x" } as never);
ok("기록: system 은 작성자 없이 system 역할로", row.actor_id === null && row.actor_role === "system");
const row2 = activityToRow({ id: "ac2", type: "sign_in", actorId: "u_park", actorRole: "consultant", at: "2026-01-01T00:00:00Z", text: "x" } as never);
ok("기록: 계정 아닌 작성자는 system 으로(묶음 거절 방지)", row2.actor_id === null && row2.actor_role === "system");
ok("기록: 서버에서 읽을 때 system 으로 복원", activityFromRow({ id: "a", type: "task_created", actor_id: null, actor_role: "system", at: "", message: "" }).actorId === "system");

if (fail) { console.log(`\n${fail}건 실패`); process.exit(1); }
console.log("\n전부 통과");
