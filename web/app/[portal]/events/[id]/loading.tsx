"use client";

import { PortalHeader } from "@/components/headers";
import Skeleton from "@/components/Skeleton";
import { useParams } from "next/navigation";
import { usePortalOptional } from "@/lib/portal-context";
import { resolveSkeletonVertical } from "@/lib/skeleton-contract";
import { isFilmPortalVertical } from "@/lib/portal-taxonomy";

export default function EventLoading() {
  const params = useParams();
  const portalSlug = (params?.portal as string) || "atlanta";
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal;
  const vertical = resolveSkeletonVertical(portal, portalSlug);

  if (vertical === "hotel") {
    return (
      <div data-skeleton-route="event-detail" data-skeleton-vertical={vertical} className="min-h-screen bg-[var(--hotel-ivory)]">
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="h-[420px] rounded-2xl skeleton-shimmer mb-6" />
          <div className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-6 sm:p-8">
            <Skeleton className="h-4 w-24 rounded mb-4" />
            <Skeleton className="h-10 w-[72%] rounded mb-2" />
            <Skeleton className="h-5 w-52 rounded mt-3" delay="0.05s" />
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--hotel-sand)] p-3">
                  <Skeleton className="h-3 w-16 rounded mb-2" delay={`${i * 0.05}s`} />
                  <Skeleton className="h-5 w-20 rounded" delay={`${i * 0.05 + 0.05}s`} />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (vertical === "hospital") {
    return (
      <div data-skeleton-route="event-detail" data-skeleton-vertical={vertical} className="min-h-screen bg-[#f2f5fa]">
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="h-72 rounded-2xl skeleton-shimmer mb-6" />
          <div className="rounded-2xl border border-[#d5dfef] bg-white p-6 sm:p-8">
            <Skeleton className="h-4 w-24 rounded mb-4" />
            <Skeleton className="h-10 w-[68%] rounded mb-3" />
            <Skeleton className="h-4 w-60 rounded" delay="0.05s" />
            <div className="mt-6 space-y-2">
              <Skeleton className="h-4 w-full rounded" delay="0.1s" />
              <Skeleton className="h-4 w-[86%] rounded" delay="0.15s" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isFilmPortalVertical(vertical)) {
    return (
      <div data-skeleton-route="event-detail" data-skeleton-vertical={vertical} className="min-h-screen bg-[#070a12]">
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="h-80 rounded-2xl skeleton-shimmer mb-6" />
          <div className="rounded-2xl border border-[#2a3244] bg-[#0c1321] p-6 sm:p-8">
            <Skeleton className="h-4 w-24 rounded mb-4" />
            <Skeleton className="h-10 w-[74%] rounded mb-3" />
            <Skeleton className="h-4 w-48 rounded" delay="0.05s" />
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" delay={`${i * 0.05}s`} />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Default: DetailShell two-column skeleton matching EventDetailView layout
  const skeletonSidebar = (
    <div>
      <Skeleton className="aspect-video lg:aspect-[16/10] w-full" />
      <div className="px-5 pt-4 pb-3 space-y-2">
        <Skeleton className="h-7 w-[80%] rounded" delay="0.1s" />
        <Skeleton className="h-4 w-[50%] rounded" delay="0.14s" />
        <Skeleton className="h-4 w-[60%] rounded" delay="0.18s" />
      </div>
      <div className="mx-5 border-t border-[var(--twilight)]/40" />
      <div className="px-5 py-3 flex gap-1.5">
        <Skeleton className="h-6 w-16 rounded-full" delay="0.22s" />
        <Skeleton className="h-6 w-20 rounded-full" delay="0.24s" />
      </div>
      <div className="mx-5 border-t border-[var(--twilight)]/40" />
      <div className="px-5 py-3">
        <Skeleton className="h-12 w-full rounded-lg" delay="0.28s" />
      </div>
      <div className="px-5 py-2 flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-xl" delay="0.3s" />
        <Skeleton className="h-10 flex-1 rounded-xl" delay="0.32s" />
      </div>
    </div>
  );
  const skeletonContent = (
    <div className="p-4 lg:p-8 space-y-6">
      <Skeleton className="h-3 w-20 rounded" delay="0.3s" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full rounded" delay="0.34s" />
        <Skeleton className="h-4 w-[90%] rounded" delay="0.36s" />
        <Skeleton className="h-4 w-[70%] rounded" delay="0.38s" />
      </div>
      <div className="pt-4 space-y-2">
        <Skeleton className="h-3 w-24 rounded" delay="0.42s" />
        <Skeleton className="h-16 w-full rounded-lg" delay="0.46s" />
      </div>
    </div>
  );

  return (
    <div data-skeleton-route="event-detail" data-skeleton-vertical="city" className="min-h-screen">
      <PortalHeader
        portalSlug={portalSlug}
        portalName={portal?.name || "Lost City"}
        hideNav
      />
      <div className="flex flex-col min-h-[calc(100dvh-56px)]">
        <div className="lg:flex flex-1">
          <section className="lg:w-[340px] lg:flex-shrink-0 border-b border-[var(--twilight)]/40 lg:border-b-0 lg:border-r lg:border-[var(--twilight)]/40 bg-[var(--card-bg,var(--night))]">
            {skeletonSidebar}
          </section>
          <main className="flex-1 min-w-0">
            {skeletonContent}
          </main>
        </div>
      </div>
    </div>
  );
}
