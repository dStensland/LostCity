import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { isDogPortal } from "@/lib/dog-art";
import { getDogServices } from "@/lib/dog-data";
import { SERVICE_TYPE_OPTIONS } from "@/lib/dog-tags";
import DogDeepPageShell from "@/app/[portal]/_components/dog/DogDeepPageShell";
import DogFilterChips from "@/app/[portal]/_components/dog/DogFilterChips";
import { DogVenueRow } from "@/app/[portal]/_components/dog/DogCard";
import DogEmptyState from "@/app/[portal]/_components/dog/DogEmptyState";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ type?: string }>;
};

export const revalidate = 60;

export default async function DogServicesPage({
  params,
  searchParams,
}: Props) {
  const { portal: portalSlug } = await params;
  const sp = await searchParams;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const vertical = getPortalVertical(portal);
  if (vertical !== "dog" && !isDogPortal(portal.slug)) notFound();

  const venues = await getDogServices(sp.type);

  return (
    <DogDeepPageShell portalSlug={portalSlug} pageTitle="Services">
      <p className="text-sm mb-4" style={{ color: "var(--dog-stone)" }}>
        Vets, groomers, pet stores, and daycare in Atlanta.
      </p>

      <div className="mb-6">
        <Suspense fallback={null}>
          <DogFilterChips paramName="type" options={SERVICE_TYPE_OPTIONS} />
        </Suspense>
      </div>

      {venues.length === 0 ? (
        <DogEmptyState
          emoji="🦴"
          headline="No services found"
          body="Try a different filter or check back soon."
        />
      ) : (
        <div className="space-y-3">
          {venues.map((venue) => (
            <DogVenueRow
              key={venue.id}
              venue={venue}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}
    </DogDeepPageShell>
  );
}
