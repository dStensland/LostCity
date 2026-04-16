"use client";

import { CalendarBlank, MagnifyingGlass } from "@phosphor-icons/react";
import { buildExploreUrl } from "@/lib/find-url";

interface PlansEmptyStateProps {
  portalSlug: string;
  hasEverRsvped?: boolean;
}

export function PlansEmptyState({
  portalSlug,
  hasEverRsvped = false,
}: PlansEmptyStateProps) {
  const exploreUrl = buildExploreUrl({ portalSlug, lane: "events" });

  if (!hasEverRsvped) {
    // First-session: user has never RSVPed to anything
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center">
        <CalendarBlank
          size={48}
          weight="duotone"
          className="text-[var(--cream)] opacity-20 mb-4"
        />
        <h2 className="text-base font-semibold text-[var(--cream)] mb-2">
          Your plans live here
        </h2>
        <p className="text-sm text-[var(--muted)] max-w-xs mb-6">
          RSVP to events, subscribe to series, build plans with friends.
          Everything you commit to shows up on this timeline.
        </p>
        <a
          href={exploreUrl}
          className="h-10 rounded-xl bg-[var(--coral)] text-[var(--night)] text-sm font-medium flex items-center justify-center gap-2 px-5 hover:brightness-110 transition-all duration-200"
        >
          <MagnifyingGlass size={16} weight="bold" />
          Explore what&apos;s happening
        </a>
      </div>
    );
  }

  // Sparse-week: user has RSVPed before but nothing this period
  return (
    <div className="flex flex-col items-center justify-center min-h-[30vh] px-4 text-center">
      <p className="text-sm text-[var(--muted)] mb-4">
        Your week is open.
      </p>
      <a
        href={exploreUrl}
        className="text-xs text-[var(--coral)]/80 hover:text-[var(--coral)] transition-colors duration-200"
      >
        Browse what&apos;s happening →
      </a>
    </div>
  );
}
