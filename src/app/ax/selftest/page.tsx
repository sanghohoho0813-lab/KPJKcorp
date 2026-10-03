"use client";

import { useState } from "react";
import Link from "next/link";
import { Bug, MousePointerClick } from "lucide-react";
import { Button, PageHeader } from "@/components/ui/ui";

/**
 * 자체 점검 — 오류 안내 화면이 실제로 뜨는지 대표님이 직접 확인하는 곳(메뉴에는 없음, 설정 › 데이터에서 연결).
 * 일부러 오류를 내도 이 화면 안에서만 일어나고 데이터에는 아무 영향이 없다.
 */
function Boom(): never {
  throw new Error("자체 점검: 일부러 낸 화면 오류입니다");
}

export default function SelfTestPage() {
  const [boom, setBoom] = useState(false);
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title="자체 점검" desc="오류가 났을 때 화면이 어떻게 안내하는지 미리 확인합니다. 데이터에는 아무 영향이 없습니다." />
      <div className="card space-y-4 p-5 md:p-6">
        <div>
          <div className="font-bold">1. 화면 오류</div>
          <p className="mt-1 text-[0.88rem] text-ink-2">누르면 이 화면이 일부러 깨집니다. 사이드바는 그대로 있고 내용 자리에 안내와 &lsquo;다시 시도&rsquo; 버튼이 떠야 합니다.</p>
          <Button className="mt-2" variant="outline" icon={<Bug size={16} />} data-testid="selftest-render" onClick={() => setBoom(true)}>화면 오류 내 보기</Button>
        </div>
        <div className="border-t border-line pt-4">
          <div className="font-bold">2. 동작 오류</div>
          <p className="mt-1 text-[0.88rem] text-ink-2">누르면 버튼 동작 중에 오류가 납니다. 화면은 그대로이고, 설정 › 데이터 › 최근 화면 오류에 한 줄 남아야 합니다.</p>
          <Button
            className="mt-2" variant="outline" icon={<MousePointerClick size={16} />} data-testid="selftest-event"
            onClick={() => { setTimeout(() => { throw new Error("자체 점검: 일부러 낸 동작 오류입니다"); }, 0); }}
          >
            동작 오류 내 보기
          </Button>
        </div>
        <div className="border-t border-line pt-4 text-[0.88rem]">
          <Link href="/ax/settings?open=data" className="font-semibold text-accent">설정 › 데이터에서 기록 확인 →</Link>
        </div>
      </div>
      {boom && <Boom />}
    </div>
  );
}
