import { notFound } from "next/navigation";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { isDogPortal } from "@/lib/dog-art";
import { getDogPupCupSpots } from "@/lib/dog-data";
import DogDeepPageShell from "@/app/[portal]/_components/dog/DogDeepPageShell";
import { DogVenueCard } from "@/app/[portal]/_components/dog/DogCard";
import DogEmptyState from "@/app/[portal]/_components/dog/DogEmptyState";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export const revalidate = 60;

export default async function DogPupCupsPage({ params }: Props) {
  const { portal: portalSlug } = await params;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const vertical = getPortalVertical(portal);
  if (vertical !== "dog" && !isDogPortal(portal.slug)) notFound();

  const spots = await getDogPupCupSpots();

  return (
    <DogDeepPageShell portalSlug={portalSlug} pageTitle="Pup Cup Spots">
      <p className="text-sm mb-6" style={{ color: "var(--dog-stone)" }}>
        Places that serve treats, pup cups, and dog menus around Atlanta.
      </p>

      {spots.length === 0 ? (
        <DogEmptyState
          emoji="🧁"
          headline="No pup cup spots yet"
          body="Know a place? Help us tag it."
          ctaLabel="Tag a spot"
          ctaHref={`/${portalSlug}?view=find`}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {spots.map((venue) => (
            <DogVenueCard
              key={venue.id}
              venue={venue}
              portalSlug={portalSlug}
              showTags
            />
          ))}
        </div>
      )}
    </DogDeepPageShell>
  );
}
