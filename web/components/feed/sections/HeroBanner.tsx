"use client";

import { HeroCard } from "@/components/feed/HeroCard";
import type { FeedEventData } from "@/components/EventCard";
import type { FeedSectionData } from "./types";

export function HeroBanner({
  section,
  portalSlug,
  hideImages,
}: {
  section: FeedSectionData;
  portalSlug: string;
  hideImages?: boolean;
}) {
  const event = section.events[0];
  if (!event) return null;
  return (
    <section className="mb-4 sm:mb-6">
      <HeroCard
        event={event as FeedEventData}
        portalSlug={portalSlug}
        hideImages={hideImages}
        editorialBlurb={section.description}
      />
    </section>
  );
}
