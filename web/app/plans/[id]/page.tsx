"use client";

import { useParams, useRouter } from "next/navigation";
import { PlatformHeader } from "@/components/headers";
import { PlanDetailView } from "@/components/plans/PlanDetailView";

const portalSlug = "atlanta";

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <PlatformHeader />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <PlanDetailView
          planId={params.id}
          portalSlug={portalSlug}
          onBack={() => router.push("/plans")}
        />
      </main>
    </div>
  );
}
