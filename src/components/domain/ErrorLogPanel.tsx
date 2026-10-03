"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bug, ClipboardCopy, Trash2 } from "lucide-react";
import { clearErrors, errorReport, readErrors, type ErrorEntry } from "@/lib/error-log";
import { fmtDateTime } from "@/lib/format";
import { Badge, Button } from "@/components/ui/ui";

const KIND: Record<ErrorEntry["kind"], string> = { render: "화면", event: "동작", chunk: "새 버전" };

/** 설정 › 데이터 — 이 브라우저에서 난 화면 오류 최근 20건. 개발자 도구 없이 복사해 전달한다 */
export function ErrorLogPanel() {
  const [list, setList] = useState<ErrorEntry[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const load = () => setList(readErrors());
    load();
    window.addEventListener("kpjk-error-log", load);
    return () => window.removeEventListener("kpjk-error-log", load);
  }, []);

  const copy = async () => {
    const text = errorReport(list);
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { window.prompt("아래 내용을 복사해 전달해 주세요", text); }
  };

  return (
    <div className="mt-5 border-t border-line pt-4" data-testid="error-log">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-[0.92rem] font-bold"><Bug size={16} className="text-ink-3" /> 최근 화면 오류</span>
        <Badge tone={list.length ? "warning" : "success"}>{list.length ? `${list.length}건` : "없음"}</Badge>
      </div>
      <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-2">
        화면이 깨지거나 버튼이 동작하지 않았을 때의 기록입니다. 이 브라우저에만 최근 20건이 남고 서버로 보내지 않습니다.
        문제가 있으면 <b>복사</b>해서 담당자에게 전달해 주세요.
      </p>
      {list.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {list.slice(0, 5).map((e) => (
            <li key={e.at + e.message} className="rounded-lg bg-surface-2 px-3 py-2 text-[0.82rem]">
              <div className="flex flex-wrap items-center gap-x-2 text-ink-3"><Badge tone={e.kind === "render" ? "error" : "neutral"}>{KIND[e.kind]}</Badge>{fmtDateTime(e.at)} · <span className="break-all">{e.path}</span></div>
              <div className="mt-1 break-words font-semibold text-ink-2">{e.message}</div>
            </li>
          ))}
          {list.length > 5 && <li className="text-[0.8rem] text-ink-3">외 {list.length - 5}건 (복사하면 전부 들어갑니다)</li>}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={<ClipboardCopy size={15} />} disabled={!list.length} onClick={copy}>{copied ? "복사했습니다" : "오류 기록 복사"}</Button>
        <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} disabled={!list.length} onClick={() => { clearErrors(); setCopied(false); }}>기록 지우기</Button>
        <Link href="/ax/selftest" className="pressable link-more inline-flex items-center px-2 text-[0.85rem] font-semibold text-accent">오류 안내 화면 확인해 보기 →</Link>
      </div>
    </div>
  );
}
