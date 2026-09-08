import { AxShell } from "@/components/shell/AxShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AxShell>{children}</AxShell>;
}
