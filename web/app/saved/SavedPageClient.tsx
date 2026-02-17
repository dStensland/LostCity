"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import UnifiedHeader from "@/components/UnifiedHeader";
import DashboardPlanning from "@/components/dashboard/DashboardPlanning";
import PageFooter from "@/components/PageFooter";
import { usePortalOptional, DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

export default function SavedPageClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const portalContext = usePortalOptional();
  const portalSlug = portalContext?.portal?.slug || DEFAULT_PORTAL_SLUG;

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/saved`);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <>
        <UnifiedHeader portalSlug={portalSlug} hideNav />
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="h-8 w-40 skeleton-shimmer rounded mb-6" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
                <div className="flex gap-4">
                  <div className="w-20 h-20 skeleton-shimmer rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 skeleton-shimmer rounded w-3/4" />
                    <div className="h-4 skeleton-shimmer rounded w-1/2" />
                    <div className="h-3 skeleton-shimmer rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <UnifiedHeader
        portalSlug={portalSlug}
        backLink={{ href: `/${portalSlug}`, label: "Home" }}
        hideNav
      />
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold text-[var(--cream)] mb-6">Your Stash</h1>
        <DashboardPlanning />
      </main>
      <PageFooter />
    </>
  );
}
