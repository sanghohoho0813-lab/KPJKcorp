import { PrintShell } from "@/components/shell/PrintShell";

/** 인쇄용 화면 — 사이드바·헤더 없이 A4 한 장으로. 브라우저 인쇄로 PDF를 만든다. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PrintShell>{children}</PrintShell>;
}
