import { getBizinfo } from "@/lib/server/bizinfo";

/**
 * 기업마당 지원사업 공고를 앱 모양으로 돌려준다(접수 중인 것만).
 * 키가 없으면 지어낸 공고를 주지 않고 "연결 안 됨"을 알린다. 받는 일은 lib/server/bizinfo.ts.
 */
export async function GET(request: Request) {
  const r = await getBizinfo(new URL(request.url).searchParams.get("fresh") === "1");
  return Response.json(r);
}
