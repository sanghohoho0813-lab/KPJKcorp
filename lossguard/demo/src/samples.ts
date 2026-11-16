import index from "../samples/index.json";
import aContract from "../samples/synthetic-A-contract.xlsx";
import aChange from "../samples/synthetic-A-change1.xlsx";
import aSettle from "../samples/synthetic-A-settlement.xls";
import aCost from "../samples/synthetic-A-cost.csv";
import bContract from "../samples/synthetic-B-contract.xlsx";
import bChange from "../samples/synthetic-B-change1.xlsx";
import bSettle from "../samples/synthetic-B-settlement.xlsx";

/** 시연용 가상(합성) 공사자료 — 실제 기업 자료가 아니다. 만든 방법: demo/make-samples.ts */
const BYTES: Record<string, Uint8Array> = {
  "synthetic-A-contract.xlsx": aContract, "synthetic-A-change1.xlsx": aChange, "synthetic-A-settlement.xls": aSettle, "synthetic-A-cost.csv": aCost,
  "synthetic-B-contract.xlsx": bContract, "synthetic-B-change1.xlsx": bChange, "synthetic-B-settlement.xlsx": bSettle,
};

export interface SampleSite { key: string; name: string; status: "completed"; contractAmount?: number; vat: "excluded" | "included"; changes: { round: number; prevAmount?: number; newAmount?: number }[]; story: string; files: { path: string; display: string; kind: "contract" | "change" | "settlement" | "cost"; round?: number; bytes: Uint8Array }[] }

type Meta = Omit<SampleSite, "files"> & { files: Omit<SampleSite["files"][number], "bytes">[] };
export const SAMPLES: SampleSite[] = (index.sites as unknown as Meta[]).map((s) => ({
  ...s, files: s.files.map((f) => ({ ...f, bytes: BYTES[f.path] })),
}));
