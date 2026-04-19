"use client";

import { useMemo } from "react";
import { parseISO, format } from "date-fns";
import { BookmarkSimple, CalendarPlus, HandWaving, ShareNetwork, Ticket, UserPlus } from "@phosphor-icons/react";
import { DetailLayout } from "@/components/detail/core/DetailLayout";
import { DetailLoadingSkeleton } from "@/components/detail/core/DetailLoadingSkeleton";
import { SeededDetailSkeleton } from "@/components/detail/core/SeededDetailSkeleton";
import type { EventSeed } from "@/lib/detail/entity-preview-store";
import { useOverlayContext } from "@/lib/detail/overlay-context";
import { EventIdentity } from "@/components/detail/identity/EventIdentity";
import { eventManifest } from "@/components/detail/manifests/event";
import { useDetailData } from "@/lib/detail/use-detail-data";
import { formatEventTime, formatPriceRange } from "@/lib/detail/format";
import { getCategoryColor } from "@/lib/category-config";
import { ENABLE_ELEVATED_DETAIL } from "@/lib/launch-flags";
import type { EventApiResponse, EventData, HeroConfig, ActionConfig, QuickFactsData, EntityData } from "@/lib/detail/types";

// ── Re-export EventApiResponse so callers (EventDetailWrapper) can still import it ──
export type { EventApiResponse };

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMetadataLine(event: EventData): string {
  const parts: string[] = [];
  if (event.start_date) {
    const date = parseISO(event.start_date);
    parts.push(format(date, "MMM d").toUpperCase());
  }
  if (event.venue?.name) {
    parts.push(event.venue.name.toUpperCase());
  }
  return parts.join(" · ");
}

// ── Props ────────────────────────────────────────────────────────────────────

interface EventDetailViewProps {
  eventId: number;
  portalSlug: string;
  onClose: () => void;
  /** Server-fetched data — skips client fetch when provided */
  initialData?: EventApiResponse;
  /**
   * Partial data published by the originating card (via entity-preview-store).
   * Renders a layout-preserving skeleton with real title + image while the
   * enrichment fetch runs. Replaced when `data` arrives.
   */
  seedData?: EventSeed;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EventDetailView({
  eventId,
  portalSlug,
  onClose,
  initialData,
  seedData,
}: EventDetailViewProps) {
  // Inside the overlay, force the sidebar shell. The elevated shell was
  // designed for 1600px page context; at 768px overlay card width it
  // compresses awkwardly. `useOverlayContext().inOverlay` replaces the
  // prop-drilled `inOverlay` flag the router used to pass.
  const { inOverlay } = useOverlayContext();
  const { data, status } = useDetailData<EventApiResponse>({
    entityType: "event",
    identifier: eventId,
    portalSlug,
    initialData,
  });

  const event = data?.event ?? null;

  const accentColor = useMemo(
    () => getCategoryColor(event?.category ?? null),
    [event?.category],
  );

  // heroTier should be populated server-side by computeHeroTier. Default to
  // 'compact' if missing so we don't silently fall back to LegacyHero — that
  // would bypass the entire elevated shell for events with no image metadata.
  const resolvedHeroTier = useMemo(() => {
    if (data?.heroTier) return data.heroTier;
    if (data && process.env.NODE_ENV !== "production") {
      console.warn(
        `[EventDetailView] heroTier missing for event ${eventId}; defaulting to 'compact'. ` +
          `Check that computeHeroTier() ran server-side and image_width/image_height are populated.`,
      );
    }
    return data ? ("compact" as const) : undefined;
  }, [data, eventId]);

  const heroConfig = useMemo<HeroConfig>(() => ({
    imageUrl: event?.image_url ?? null,
    aspectClass: "aspect-video lg:aspect-[16/10]",
    fallbackMode: "category-icon",
    galleryEnabled: false,
    category: event?.category ?? null,
    isLive: event?.is_live ?? false,
    tier: resolvedHeroTier,
    title: event?.title,
    metadataLine: event ? buildMetadataLine(event) : undefined,
    tags: [...(event?.genres ?? []), ...(event?.tags ?? [])].slice(0, 5),
    accentColor,
  }), [event, resolvedHeroTier, accentColor]);

  const actionConfig = useMemo<ActionConfig>(() => {
    const ctaColor = event?.is_free ? "var(--neon-green)" : undefined;

    const primaryCTA: ActionConfig["primaryCTA"] = event?.ticket_url
      ? {
          label: "Get Tickets",
          href: event.ticket_url,
          variant: "filled",
          icon: <Ticket size={18} weight="duotone" />,
          color: ctaColor,
        }
      : event?.is_free
        ? {
            label: "Free Entry",
            href: event.source_url ?? undefined,
            variant: "outlined",
            color: ctaColor,
          }
        : event?.source_url
          ? { label: "Learn More", href: event.source_url, variant: "outlined" }
          : null;

    const config: ActionConfig = {
      primaryCTA,
      secondaryActions: [
        { icon: <HandWaving size={18} weight="duotone" />, label: "RSVP" },
        { icon: <BookmarkSimple size={18} weight="duotone" />, label: "Save" },
        { icon: <UserPlus size={18} weight="duotone" />, label: "Invite" },
        { icon: <CalendarPlus size={18} weight="duotone" />, label: "Add to Calendar" },
        { icon: <ShareNetwork size={18} weight="duotone" />, label: "Share" },
      ],
      stickyBar: { enabled: !!event?.ticket_url },
      posterUrl: event?.image_url ?? null,
      heroTier: resolvedHeroTier,
    };

    return config;
  }, [event, resolvedHeroTier]);

  const quickFacts = useMemo<QuickFactsData | undefined>(() => {
    if (!event) return undefined;
    const dateObj = parseISO(event.start_date);
    const datePart =
      event.end_date && event.end_date !== event.start_date
        ? `${format(dateObj, "MMM d")} – ${format(parseISO(event.end_date), "MMM d")}`
        : format(dateObj, "EEE, MMM d");
    const timePart = formatEventTime(event.is_all_day, event.start_time, event.end_time);
    return {
      date: timePart ? `${datePart} · ${timePart}` : datePart,
      venueName: event.venue?.name ?? null,
      venueSlug: event.venue?.slug ?? null,
      priceText: formatPriceRange(event.is_free, event.price_min, event.price_max),
      agePolicy: event.age_policy ?? null,
    };
  }, [event]);

  const entityData = useMemo<EntityData | null>(
    () => (data ? { entityType: "event", payload: data } : null),
    [data],
  );

  if (status === "loading" || !entityData || !event) {
    if (seedData) {
      return (
        <SeededDetailSkeleton
          seed={seedData}
          variant={inOverlay ? "sidebar" : "full"}
        />
      );
    }
    return <DetailLoadingSkeleton />;
  }

  return (
    <DetailLayout
      heroConfig={heroConfig}
      identity={
        resolvedHeroTier !== "typographic" ? (
          <EventIdentity event={event} portalSlug={portalSlug} variant="elevated" />
        ) : null
      }
      actionConfig={actionConfig}
      manifest={eventManifest}
      data={entityData}
      portalSlug={portalSlug}
      accentColor={accentColor}
      entityType="event"
      onClose={onClose}
      shellVariant={inOverlay ? "sidebar" : ENABLE_ELEVATED_DETAIL ? "elevated" : "sidebar"}
      quickFacts={quickFacts}
    />
  );
}
