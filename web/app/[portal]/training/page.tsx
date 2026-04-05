import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDogTrainingEvents } from "@/lib/dog-data";
import { TRAINING_FILTER_OPTIONS } from "@/lib/dog-tags";
import DogDeepPageShell from "@/app/[portal]/_components/dog/DogDeepPageShell";
import DogFilterChips from "@/app/[portal]/_components/dog/DogFilterChips";
import { DogEventCard } from "@/app/[portal]/_components/dog/DogCard";
import DogEmptyState from "@/app/[portal]/_components/dog/DogEmptyState";
import { resolveFeedPageRequest } from "../_surfaces/feed/resolve-feed-page-request";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export const revalidate = 300;

export default async function DogTrainingPage({ params, searchParams }: Props) {
  const { portal: portalSlug } = await params;
  const sp = await searchParams;

  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/training`,
  });
  if (!request || !request.isDog) notFound();

  const events = await getDogTrainingEvents(sp.filter, 50);

  return (
    <DogDeepPageShell portalSlug={portalSlug} pageTitle="Training & Classes">
      <p className="text-sm mb-4" style={{ color: "var(--dog-stone)" }}>
        Puppy school, obedience, agility, and more around Atlanta.
      </p>

      <div className="mb-6">
        <Suspense fallback={null}>
          <DogFilterChips
            paramName="filter"
            options={TRAINING_FILTER_OPTIONS}
          />
        </Suspense>
      </div>

      {events.length === 0 ? (
        <DogEmptyState
          emoji="🎓"
          headline="No training classes found"
          body="Try a different filter or check back soon."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <DogEventCard
              key={event.id}
              event={event}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}
    </DogDeepPageShell>
  );
}
