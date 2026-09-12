import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeBoot } from "@/components/shell/ThemeBoot";
import { FontLoader } from "@/components/shell/FontLoader";

export const metadata: Metadata = {
  title: "KPJK Consulting AX",
  description: "케이피제이케이코퍼레이션 — 기업컨설팅 운영 AX + 기업고객 Portal",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171b20",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" data-theme="kpjk" data-font="s" suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeBoot />
        <FontLoader />
        {children}
      </body>
    </html>
  );
}
