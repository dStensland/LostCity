"use client";

import { useParams, useRouter } from "next/navigation";
import { usePortal } from "@/lib/portal-context";
import { PortalHeader } from "@/components/headers";
import { PlanDetailView } from "@/components/plans/PlanDetailView";

export default function PlanDetailPage() {
  const { portal } = usePortal();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <PlanDetailView
          planId={params.id}
          portalSlug={portal.slug}
          onBack={() => router.push(`/${portal.slug}/plans`)}
        />
      </main>
    </div>
  );
}
