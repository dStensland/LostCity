"use client";

import { useMemo } from "react";
import { BookmarkSimple, ShareNetwork, UserPlus } from "@phosphor-icons/react";
import { DetailLayout } from "@/components/detail/core/DetailLayout";
import { PlaceIdentity } from "@/components/detail/identity/PlaceIdentity";
import { getPlaceManifest } from "@/components/detail/manifests/place";
import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import { getCategoryColor } from "@/lib/category-config";
import type { SpotDetailPayload, WalkableNeighbor, NearbyDestination } from "@/lib/spot-detail";
import type { HeroConfig, ActionConfig, EntityData } from "@/lib/detail/types";
import type { PlaceProfile, PlaceDiningDetails, PlaceGoogleDetails } from "@/lib/types/places";
import { usePortal } from "@/lib/portal-context";

// ── SpotApiResponse — re-export for callers ───────────────────────────────────
//
// The spot-detail-mapper.ts maps SpotDetailPayload → SpotApiResponse.
// PlaceDetailWrapper and PlaceDetailWrapperProps import this type.
// Keep this type as the concrete subset the mapper actually returns.

export type SpotApiResponse = {
  spot: Record<string, unknown>;
  upcomingEvents: Array<Record<string, unknown>>;
  screenings: unknown;
  nearbyDestinations: Record<string, NearbyDestination[]>;
  highlights: Array<Record<string, unknown>>;
  features: unknown[];
  specials: unknown[];
  editorialMentions: unknown[];
  occasions: unknown[];
  exhibitions: unknown[];
  attachedChildDestinations: unknown[];
  artifacts: Array<Record<string, unknown>>;
  walkableNeighbors: WalkableNeighbor[];
  placeProfile?: PlaceProfile | null;
  placeVerticalDetails?: {
    dining: PlaceDiningDetails | null;
    outdoor: unknown | null;
    google: PlaceGoogleDetails | null;
  } | null;
};

// ── Props ────────────────────────────────────────────────────────────────────

interface PlaceDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
  /** Server-fetched data — skips client fetch when provided */
  initialData?: SpotApiResponse;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlaceDetailView({
  slug,
  portalSlug,
  onClose,
  initialData,
}: PlaceDetailViewProps) {
  const { portal } = usePortal();

  // Client-side fetch only when no initialData (overlay path)
  const fetchUrl = useMemo(() => {
    if (initialData) return null;
    if (!portal?.id) return null;
    return `/api/spots/${slug}`;
  }, [initialData, portal?.id, slug]);

  const { data: fetchedData, status } = useDetailFetch<SpotDetailPayload>(fetchUrl, {
    entityLabel: "spot",
  });

  // Merge: initialData (SpotApiResponse) is structurally compatible with
  // SpotDetailPayload for all fields consumed by section modules.
  const data = (initialData ?? fetchedData) as SpotDetailPayload | null;

  const spot = data?.spot ?? null;
  const placeProfile = data?.placeProfile ?? null;
  const diningData = data?.placeVerticalDetails?.dining ?? null;
  const googleData = data?.placeVerticalDetails?.google ?? null;
  const spotType = typeof spot?.spot_type === "string" ? spot.spot_type : null;

  const heroConfig = useMemo<HeroConfig>(() => {
    const galleryUrls: string[] = [
      placeProfile?.hero_image_url,
      ...(placeProfile?.gallery_urls ?? []),
    ].filter((u): u is string => !!u);

    const imageUrl =
      galleryUrls[0] ??
      (typeof spot?.image_url === "string" ? spot.image_url : null);

    const hasGallery = galleryUrls.length > 1;

    return {
      imageUrl,
      aspectClass: "aspect-video lg:aspect-[16/10]",
      fallbackMode: "type-icon",
      galleryEnabled: hasGallery,
      galleryUrls: hasGallery ? galleryUrls : undefined,
    };
  }, [spot, placeProfile]);

  const actionConfig = useMemo<ActionConfig>(() => {
    const reservationUrl = diningData?.reservation_url ?? null;
    const website = typeof spot?.website === "string" ? spot.website : null;

    let primaryCTA: ActionConfig["primaryCTA"] = null;
    if (reservationUrl) {
      primaryCTA = { label: "Reserve a Table", href: reservationUrl, variant: "filled" };
    } else if (website) {
      primaryCTA = { label: "Visit Website", href: website, variant: "outlined" };
    }

    return {
      primaryCTA,
      secondaryActions: [
        { icon: <BookmarkSimple size={18} weight="duotone" />, label: "Save" },
        { icon: <UserPlus size={18} weight="duotone" />, label: "Follow" },
        { icon: <ShareNetwork size={18} weight="duotone" />, label: "Share" },
      ],
      stickyBar: { enabled: !!reservationUrl },
    };
  }, [spot, diningData]);

  const accentColor = useMemo(
    () => getCategoryColor(spotType ?? null),
    [spotType],
  );

  const manifest = useMemo(() => getPlaceManifest(spotType ?? ""), [spotType]);

  const entityData = useMemo<EntityData | null>(
    () => (data ? { entityType: "place", payload: data } : null),
    [data],
  );

  if (status === "loading" || !entityData || !spot) {
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
        <PlaceIdentity
          spot={spot}
          diningData={diningData}
          googleData={googleData}
          placeProfile={placeProfile}
          portalSlug={portalSlug}
        />
      }
      actionConfig={actionConfig}
      manifest={manifest}
      data={entityData}
      portalSlug={portalSlug}
      accentColor={accentColor}
      entityType="place"
      onClose={onClose}
    />
  );
}
