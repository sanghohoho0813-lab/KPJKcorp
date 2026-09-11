"use client";

import { Suspense } from "react";
import { InquiryConsole } from "@/components/domain/InquiryConsole";

/** 문의는 업무함(/ax/tasks?tab=inquiry) 안으로 들어갔지만, 알림·대시보드 링크를 위해 단독 화면도 유지한다. */
export default function InquiriesPage() {
  return <Suspense><InquiryConsole /></Suspense>;
}
