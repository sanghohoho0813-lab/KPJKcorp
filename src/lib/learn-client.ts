/**
 * 로그인 없는 /learn — 공개한 학습 자료만 읽는다.
 * 서버면 learn_contents(published = true, anon 읽기 정책). 서버가 없으면(시연) 이 브라우저에 있는 공개 자료.
 * 표가 아직 없거나 읽지 못하면 빈 목록 — 대표가 공개하지 않은 자료를 대신 보여 주지 않는다.
 */
import type { LearnContent } from "./types";
import { supa } from "./server/client";
import { learnFromRow } from "./server/rows";
import { visibleLearn } from "./learn";

export type PublicLearn = { items: LearnContent[]; source: "server" | "local" | "unavailable" };

export async function loadPublicLearn(local: LearnContent[]): Promise<PublicLearn> {
  const sb = supa();
  if (!sb) return { items: visibleLearn(local), source: "local" };
  const { data, error } = await sb.from("learn_contents").select("*").eq("published", true).order("updated_at", { ascending: false }).limit(500);
  if (error) return { items: [], source: "unavailable" };
  return { items: visibleLearn((data ?? []).map(learnFromRow)), source: "server" };
}
