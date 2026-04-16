"use client";

import { useMemo } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Ticket, ShareNetwork, BookmarkSimple } from "@phosphor-icons/react";
import { DetailLayout } from "@/components/detail/core/DetailLayout";
import { FestivalIdentity } from "@/components/detail/identity/FestivalIdentity";
import { festivalManifest } from "@/components/detail/manifests/festival";
import { useDetailData } from "@/lib/detail/use-detail-data";
import type { FestivalApiResponse, HeroConfig, ActionConfig, EntityData } from "@/lib/detail/types";

// ── Props ────────────────────────────────────────────────────────────────────

interface FestivalDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose?: () => void;
  showOpenPageLink?: boolean;
  initialData?: FestivalApiResponse;
}

// ── Temporal helpers ─────────────────────────────────────────────────────────

function getTodayString(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function deriveFestivalAccent(
  announcedStart: string | null | undefined,
  announcedEnd: string | null | undefined,
  today: string,
): { showTicketCta: boolean; accentColor: string } {
  if (!announcedStart) {
    return { showTicketCta: true, accentColor: "#FF6B7A" };
  }

  const start = announcedStart.substring(0, 10);
  const end = announcedEnd?.substring(0, 10) ?? null;

  if (end && today > end) {
    // Ended
    return { showTicketCta: false, accentColor: "" };
  }

  if (!end) {
    const daysSinceStart = differenceInCalendarDays(parseISO(today), parseISO(start));
    if (today >= start && daysSinceStart > 30) {
      // Stale no-end — treat as ended
      return { showTicketCta: false, accentColor: "" };
    }
  }

  // Upcoming or happening
  const isHappening = today >= start;
  return {
    showTicketCta: true,
    accentColor: isHappening ? "#FFD93D" : "#FF6B7A",
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FestivalDetailView({
  slug,
  portalSlug,
  onClose,
  initialData,
}: FestivalDetailViewProps) {
  const { data, status } = useDetailData<FestivalApiResponse>({
    entityType: "festival",
    identifier: slug,
    portalSlug,
    initialData,
  });

  const festival = data?.festival ?? null;
  const today = useMemo(() => getTodayString(), []);

  const { showTicketCta, accentColor } = useMemo(
    () => deriveFestivalAccent(festival?.announced_start, festival?.announced_end, today),
    [festival?.announced_start, festival?.announced_end, today],
  );

  const heroConfig = useMemo<HeroConfig>(() => ({
    imageUrl: festival?.image_url ?? null,
    aspectClass: "aspect-[16/7]",
    fallbackMode: "banner",
    galleryEnabled: false,
  }), [festival]);

  const actionConfig = useMemo<ActionConfig>(() => {
    const ticketUrl = festival?.ticket_url ?? null;
    const website = festival?.website ?? null;

    let primaryCTA: ActionConfig["primaryCTA"] = null;
    if (showTicketCta && ticketUrl) {
      primaryCTA = { label: "Get Tickets", href: ticketUrl, variant: "filled" };
    } else if (website) {
      primaryCTA = { label: "Visit Website", href: website, variant: "outlined" };
    }

    return {
      primaryCTA,
      secondaryActions: [
        { icon: <BookmarkSimple size={18} weight="duotone" />, label: "Save" },
        { icon: <ShareNetwork size={18} weight="duotone" />, label: "Share" },
      ],
      stickyBar: { enabled: !!(showTicketCta && ticketUrl) },
    };
  }, [festival, showTicketCta]);

  const entityData = useMemo<EntityData | null>(
    () => (data ? { entityType: "festival", payload: data } : null),
    [data],
  );

  if (status === "loading" || !entityData || !festival) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <DetailLayout
      heroConfig={heroConfig}
      identity={<FestivalIdentity festival={festival} portalSlug={portalSlug} />}
      actionConfig={actionConfig}
      manifest={festivalManifest}
      data={entityData}
      portalSlug={portalSlug}
      accentColor={accentColor || "var(--gold)"}
      entityType="festival"
      onClose={onClose}
    />
  );
}
