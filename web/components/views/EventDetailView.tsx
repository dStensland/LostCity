"use client";

import { useMemo } from "react";
import { parseISO, format } from "date-fns";
import { BookmarkSimple, CalendarPlus, HandWaving, ShareNetwork, Ticket, UserPlus } from "@phosphor-icons/react";
import { DetailLayout } from "@/components/detail/core/DetailLayout";
import { EventIdentity } from "@/components/detail/identity/EventIdentity";
import { eventManifest } from "@/components/detail/manifests/event";
import { useDetailData } from "@/lib/detail/use-detail-data";
import { getCategoryColor } from "@/lib/category-config";
import type { EventApiResponse, EventData, HeroConfig, ActionConfig, EntityData } from "@/lib/detail/types";

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
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EventDetailView({
  eventId,
  portalSlug,
  onClose,
  initialData,
}: EventDetailViewProps) {
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

  const heroConfig = useMemo<HeroConfig>(() => ({
    imageUrl: event?.image_url ?? null,
    aspectClass: "aspect-video lg:aspect-[16/10]",
    fallbackMode: "category-icon",
    galleryEnabled: false,
    category: event?.category ?? null,
    isLive: event?.is_live ?? false,
    tier: data?.heroTier,
    title: event?.title,
    metadataLine: event ? buildMetadataLine(event) : undefined,
    tags: [...(event?.genres ?? []), ...(event?.tags ?? [])].slice(0, 5),
    accentColor,
  }), [event, data?.heroTier, accentColor]);

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
      heroTier: data?.heroTier,
    };

    return config;
  }, [event, data?.heroTier]);

  const entityData = useMemo<EntityData | null>(
    () => (data ? { entityType: "event", payload: data } : null),
    [data],
  );

  if (status === "loading" || !entityData || !event) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <DetailLayout
      heroConfig={heroConfig}
      identity={
        data?.heroTier !== "typographic" ? (
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
      shellVariant="elevated"
    />
  );
}
