import { notFound } from "next/navigation";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { isDogPortal } from "@/lib/dog-art";
import { getDogAdoptionEvents, getDogAdoptionOrgs } from "@/lib/dog-data";
import DogDeepPageShell from "@/app/[portal]/_components/dog/DogDeepPageShell";
import { DogEventCard } from "@/app/[portal]/_components/dog/DogCard";
import DogOrgCard from "@/app/[portal]/_components/dog/DogOrgCard";
import DogEmptyState from "@/app/[portal]/_components/dog/DogEmptyState";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export const revalidate = 60;

export default async function DogAdoptPage({ params }: Props) {
  const { portal: portalSlug } = await params;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const vertical = getPortalVertical(portal);
  if (vertical !== "dog" && !isDogPortal(portal.slug)) notFound();

  const [events, orgs] = await Promise.all([
    getDogAdoptionEvents(30),
    getDogAdoptionOrgs(),
  ]);

  return (
    <DogDeepPageShell portalSlug={portalSlug} pageTitle="Adopt">
      {/* Org profiles */}
      {orgs.length > 0 && (
        <section className="mb-8">
          <h2 className="dog-section-title">Shelters & Rescues</h2>
          <p
            className="text-xs -mt-1 mb-3"
            style={{ color: "var(--dog-stone)" }}
          >
            Atlanta organizations helping dogs find homes
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {orgs.map((org) => (
              <DogOrgCard key={org.id} org={org} portalSlug={portalSlug} />
            ))}
          </div>
        </section>
      )}

      {/* Adoption events */}
      {events.length > 0 && (
        <section>
          <h2 className="dog-section-title">Upcoming Adoption Events</h2>
          <p
            className="text-xs -mt-1 mb-3"
            style={{ color: "var(--dog-stone)" }}
          >
            Meet your new best friend in person
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <DogEventCard
                key={event.id}
                event={event}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </section>
      )}

      {events.length === 0 && orgs.length === 0 && (
        <DogEmptyState
          emoji="❤️"
          headline="Adoption info coming soon"
          body="We're connecting with local shelters and rescues."
        />
      )}
    </DogDeepPageShell>
  );
}
