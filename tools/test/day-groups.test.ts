// 날짜 묶음 — 오늘 · 어제 · 이번 주 · 이전(이 기기 달력 기준), 받은 순서 유지.
import { dayGroupOf, groupByDay } from "../../src/lib/day-groups";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const now = new Date(2026, 9, 20, 10, 0);
const at = (d: number, h = 9) => new Date(2026, 9, 20 + d, h).toISOString();
ok(dayGroupOf(at(0, 0), now) === "today" && dayGroupOf(at(0, 23), now) === "today", "오늘 0시 · 23시 모두 오늘(시각이 아니라 달력)");
ok(dayGroupOf(at(-1, 23), now) === "yesterday", "어제 밤 → 어제");
ok(dayGroupOf(at(-6), now) === "week" && dayGroupOf(at(-7), now) === "older", "6일 전까지 이번 주, 7일 전부터 이전");
const xs = [at(0), at(0, 8), at(-1), at(-3), at(-10), at(-20)].map((t, i) => ({ id: i, t }));
const g = groupByDay(xs, (x) => x.t, now);
ok(g.map((x) => `${x.label}${x.items.length}`).join() === "오늘2,어제1,이번 주1,이전2", "묶음 · 개수 · 순서 유지");
ok(groupByDay([], (x: { t: string }) => x.t, now).length === 0, "빈 목록");
console.log(fail ? `\n${fail} FAIL` : "\nALL OK");
process.exit(fail ? 1 : 0);
