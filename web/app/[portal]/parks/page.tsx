import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { isDogPortal } from "@/lib/dog-art";
import { getDogOffLeashParks, getDogTrails } from "@/lib/dog-data";
import { PARK_FILTER_OPTIONS } from "@/lib/dog-tags";
import DogDeepPageShell from "@/app/[portal]/_components/dog/DogDeepPageShell";
import DogFilterChips from "@/app/[portal]/_components/dog/DogFilterChips";
import { DogVenueCard } from "@/app/[portal]/_components/dog/DogCard";
import DogTagChips from "@/app/[portal]/_components/dog/DogTagChips";
import DogEmptyState from "@/app/[portal]/_components/dog/DogEmptyState";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ filter?: string; tab?: string }>;
};

export const revalidate = 60;

export default async function DogParksPage({ params, searchParams }: Props) {
  const { portal: portalSlug } = await params;
  const sp = await searchParams;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const vertical = getPortalVertical(portal);
  if (vertical !== "dog" && !isDogPortal(portal.slug)) {
    redirect(`/${portal.slug}?view=find&type=destinations`);
  }

  const isTrailsTab = sp.tab === "trails";
  const filter = sp.filter;

  const [parks, trails] = await Promise.all([
    isTrailsTab ? Promise.resolve([]) : getDogOffLeashParks(filter),
    isTrailsTab ? getDogTrails(30) : Promise.resolve([]),
  ]);

  const items = isTrailsTab ? trails : parks;

  return (
    <DogDeepPageShell portalSlug={portalSlug} pageTitle="Parks & Trails">
      {/* Tab toggle */}
      <div className="flex gap-2 mb-4">
        <a
          href={`/${portalSlug}/parks`}
          className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
          style={{
            background: !isTrailsTab
              ? "var(--dog-orange)"
              : "rgba(253, 232, 138, 0.25)",
            color: !isTrailsTab ? "#fff" : "var(--dog-charcoal)",
          }}
        >
          Off-Leash Parks
        </a>
        <a
          href={`/${portalSlug}/parks?tab=trails`}
          className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
          style={{
            background: isTrailsTab
              ? "var(--dog-orange)"
              : "rgba(253, 232, 138, 0.25)",
            color: isTrailsTab ? "#fff" : "var(--dog-charcoal)",
          }}
        >
          Trails & Nature
        </a>
      </div>

      {/* Filters for off-leash tab */}
      {!isTrailsTab && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <DogFilterChips paramName="filter" options={PARK_FILTER_OPTIONS} />
          </Suspense>
        </div>
      )}

      {items.length === 0 ? (
        <DogEmptyState
          emoji="🌳"
          headline="No parks found"
          body="Try a different filter or check back soon."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((venue) => (
            <div key={venue.id} className="flex flex-col">
              <DogVenueCard
                venue={venue}
                portalSlug={portalSlug}
                showTags
              />
              {venue.vibes && venue.vibes.length > 3 && (
                <div className="px-4 pb-3 -mt-1">
                  <DogTagChips vibes={venue.vibes} maxTags={6} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DogDeepPageShell>
  );
}
