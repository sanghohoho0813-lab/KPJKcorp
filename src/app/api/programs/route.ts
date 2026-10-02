import { getBizinfo } from "@/lib/server/bizinfo";

/**
 * 기업마당 지원사업 공고를 앱 모양으로 돌려준다(접수 중인 것만).
 * 키가 없으면 지어낸 공고를 주지 않고 "연결 안 됨"을 알린다. 받는 일은 lib/server/bizinfo.ts.
 */
export async function GET(request: Request) {
  const r = await getBizinfo(new URL(request.url).searchParams.get("fresh") === "1");
  // 화면으로 보내는 응답은 4.5MB 를 넘지 않게 요약문을 줄인다(매칭에는 공고명·대상·해시태그가 주로 쓰인다)
  if (r.ok) return Response.json({ ...r, items: r.items.map((x) => (x.summary && x.summary.length > 200 ? { ...x, summary: x.summary.slice(0, 200) } : x)) });
  return Response.json(r);
}
