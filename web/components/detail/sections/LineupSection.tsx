"use client";

import { useState, useMemo } from "react";
import { RichArtistCard } from "@/components/detail/RichArtistCard";
import { getDisplayParticipants, getLineupLabels } from "@/lib/artists-utils";
import type { SectionProps } from "@/lib/detail/types";

const LINEUP_PREVIEW_COUNT = 5;

export function LineupSection({ data, portalSlug }: SectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (data.entityType !== "event") return null;

  const { event, eventArtists } = data.payload;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const displayParticipants = useMemo(
    () => getDisplayParticipants(eventArtists as Parameters<typeof getDisplayParticipants>[0], {
      eventTitle: event.title,
      eventCategory: event.category,
    }),
    [eventArtists, event.title, event.category],
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const labels = useMemo(
    () => getLineupLabels(displayParticipants, { eventCategory: event.category }),
    [displayParticipants, event.category],
  );

  if (displayParticipants.length === 0) return null;

  const isTiered = labels.grouping === "tiered";
  const headliners = displayParticipants.filter((a) => a.is_headliner || a.billing_order === 1);
  const support = displayParticipants.filter((a) => !a.is_headliner && a.billing_order !== 1);

  const allVisible = expanded
    ? displayParticipants
    : displayParticipants.slice(0, LINEUP_PREVIEW_COUNT);
  const visibleHeadliners = expanded
    ? headliners
    : headliners.slice(0, LINEUP_PREVIEW_COUNT);
  const visibleSupport = expanded
    ? support
    : support.slice(0, Math.max(0, LINEUP_PREVIEW_COUNT - visibleHeadliners.length));

  const hasMore = displayParticipants.length > LINEUP_PREVIEW_COUNT;

  return (
    <div className="space-y-2">
      {isTiered ? (
        <>
          {visibleHeadliners.length > 0 && (
            <>
              {visibleSupport.length > 0 && (
                <p className="font-mono text-2xs uppercase tracking-[0.12em] text-[var(--muted)] pt-1">
                  {labels.headlinerLabel}
                </p>
              )}
              {visibleHeadliners.map((a) => (
                <RichArtistCard key={a.id} artist={a} portalSlug={portalSlug} />
              ))}
            </>
          )}
          {visibleSupport.length > 0 && (
            <>
              <p className="font-mono text-2xs uppercase tracking-[0.12em] text-[var(--muted)] pt-2">
                {labels.supportLabel}
              </p>
              {visibleSupport.map((a) => (
                <RichArtistCard key={a.id} artist={a} portalSlug={portalSlug} />
              ))}
            </>
          )}
        </>
      ) : (
        <>
          {allVisible.map((a) => (
            <RichArtistCard key={a.id} artist={a} portalSlug={portalSlug} />
          ))}
        </>
      )}

      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 w-full py-2.5 text-sm font-medium text-[var(--soft)] hover:text-[var(--cream)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--dusk)] transition-colors"
        >
          See all {displayParticipants.length} {labels.artistNoun}
        </button>
      )}
    </div>
  );
}
