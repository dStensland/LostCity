"use client";

import { useParams, useRouter } from "next/navigation";
import { PlatformHeader } from "@/components/headers";
import { PlanDetailView } from "@/components/plans/PlanDetailView";

// Plans are portal-independent; default to "atlanta" for event/venue links
const DEFAULT_PORTAL_SLUG = "atlanta";

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <PlatformHeader />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <PlanDetailView
          planId={params.id}
          portalSlug={DEFAULT_PORTAL_SLUG}
          onBack={() => router.push("/plans")}
        />
      </main>
    </div>
  );
}
