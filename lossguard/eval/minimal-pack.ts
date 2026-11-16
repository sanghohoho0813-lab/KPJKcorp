import type { IndustryPack } from "../engine/types";

/** 업종 사전을 최소로 줄인 묶음 — 사전 의존도 점검용 */
export function minimalPack(p: IndustryPack): IndustryPack {
  return {
    ...p, key: p.key + "-minimal", version: p.version + "-min",
    headerAliases: { no: ["번호"], name: ["품명"], spec: ["규격"], unit: ["단위"], qty: ["수량"], unitPrice: ["단가"], amount: ["금액"], note: ["비고"] },
    groupAliases: { mat: ["재료비"], lab: ["노무비"], exp: ["경비"], sum: ["합계"], before: ["변경전"], after: ["변경후"], delta: ["증감"] },
    subtotalWords: ["소계", "합계", "총계"], totalWords: ["합계", "총계"], adjustWords: ["단수정리"], taxWords: ["부가가치세"], overheadWords: [],
    nameNoise: [], synonyms: [],
    sheetNames: { cover: ["표지"], summary: ["집계표"], detail: ["내역서"], unitcost: ["일위대가"] },
    coverAmountLabels: ["견적금액"],
  };
}
