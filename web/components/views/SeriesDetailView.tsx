"use client";

import { useMemo } from "react";
import { ShareNetwork, BookmarkSimple, BellRinging } from "@phosphor-icons/react";
import { useSeriesSubscription } from "@/lib/hooks/useSeriesSubscription";
import { DetailLayout } from "@/components/detail/core/DetailLayout";
import { DetailLoadingSkeleton } from "@/components/detail/core/DetailLoadingSkeleton";
import { SeriesIdentity } from "@/components/detail/identity/SeriesIdentity";
import { getSeriesManifest } from "@/components/detail/manifests/series";
import { useDetailData } from "@/lib/detail/use-detail-data";
import { getSeriesTypeColor } from "@/lib/series-utils";
import type { SeriesApiResponse, HeroConfig, ActionConfig, EntityData } from "@/lib/detail/types";

// ── Props ────────────────────────────────────────────────────────────────────

interface SeriesDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose?: () => void;
  initialData?: SeriesApiResponse;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SeriesDetailView({
  slug,
  portalSlug,
  onClose,
  initialData,
}: SeriesDetailViewProps) {
  const { data, status } = useDetailData<SeriesApiResponse>({
    entityType: "series",
    identifier: slug,
    portalSlug,
    initialData,
  });

  const series = data?.series ?? null;
  const venueShowtimes = useMemo(() => data?.venueShowtimes ?? [], [data]);
  const isFilm = series?.series_type === "film";

  const isSubscribable = ["recurring_show", "class_series"].includes(series?.series_type ?? "");
  const { isSubscribed, subscribe, unsubscribe } = useSeriesSubscription(
    isSubscribable ? series?.id : null
  );

  // Derive next event ticket URL for CTA
  const nextTicketUrl = useMemo(() => {
    const allEvents = venueShowtimes
      .flatMap((vs) => vs.events)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    return allEvents[0]?.ticketUrl ?? null;
  }, [venueShowtimes]);

  const accentColor = useMemo(
    () => getSeriesTypeColor(series?.series_type ?? ""),
    [series?.series_type],
  );

  const heroConfig = useMemo<HeroConfig>(() => {
    if (isFilm) {
      return {
        imageUrl: series?.image_url ?? null,
        aspectClass: "aspect-[2/3]",
        fallbackMode: "type-icon",
        galleryEnabled: false,
        mobileMaxHeight: "max-h-[280px]",
      };
    }
    return {
      imageUrl: series?.image_url ?? null,
      aspectClass: "aspect-video lg:aspect-[16/10]",
      fallbackMode: "banner",
      galleryEnabled: false,
    };
  }, [isFilm, series]);

  const actionConfig = useMemo<ActionConfig>(() => {
    const primaryCTA: ActionConfig["primaryCTA"] = nextTicketUrl
      ? {
          label: isFilm ? "Get Showtimes" : "Get Tickets",
          href: nextTicketUrl,
          variant: "filled",
        }
      : null;

    const secondaryActions: ActionConfig["secondaryActions"] = [
      { icon: <BookmarkSimple size={18} weight="duotone" />, label: "Save" },
      { icon: <ShareNetwork size={18} weight="duotone" />, label: "Share" },
    ];

    if (isSubscribable) {
      secondaryActions.unshift({
        icon: <BellRinging size={18} weight={isSubscribed ? "fill" : "duotone"} />,
        label: isSubscribed ? "Subscribed" : "Subscribe",
        onClick: () => {
          if (isSubscribed) {
            unsubscribe.mutate();
          } else {
            subscribe.mutate();
          }
        },
      });
    }

    return {
      primaryCTA,
      secondaryActions,
      stickyBar: { enabled: !!nextTicketUrl },
    };
  }, [nextTicketUrl, isFilm, isSubscribable, isSubscribed, subscribe, unsubscribe]);

  const manifest = useMemo(
    () => getSeriesManifest(isFilm),
    [isFilm],
  );

  const entityData = useMemo<EntityData | null>(
    () => (data ? { entityType: "series", payload: data } : null),
    [data],
  );

  if (status === "loading" || !entityData || !series) {
    return <DetailLoadingSkeleton />;
  }

  // NOTE: intentionally no shellVariant prop — series stay on the sidebar
  // shell for now. Elevated shell is events-only in this landing; series
  // elevation is a tracked follow-up.
  return (
    <DetailLayout
      heroConfig={heroConfig}
      identity={
        <SeriesIdentity
          series={series}
          venueShowtimes={venueShowtimes}
          portalSlug={portalSlug}
        />
      }
      actionConfig={actionConfig}
      manifest={manifest}
      data={entityData}
      portalSlug={portalSlug}
      accentColor={accentColor}
      entityType="series"
      onClose={onClose}
    />
  );
}
