"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { PageSkeleton } from "@/components/ui/ui";

export default function Root() {
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.session);
  const router = useRouter();
  useEffect(() => {
    if (!hydrated) return;
    if (!session) router.replace("/login");
    else if (session.role === "client") router.replace("/portal");
    else router.replace("/ax/dashboard");
  }, [hydrated, session, router]);
  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageSkeleton />
    </div>
  );
}
