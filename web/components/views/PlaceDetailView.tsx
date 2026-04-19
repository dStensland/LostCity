"use client";

import { useEffect, useMemo, useRef } from "react";
import { markOverlayPhase } from "@/lib/detail/overlay-perf";
import {
  CalendarCheck,
  GlobeSimple,
  BookOpen,
  NavigationArrow,
  Phone,
  BookmarkSimple,
  ShareNetwork,
} from "@phosphor-icons/react";
import { PlaceDetailShell } from "@/components/detail/place/PlaceDetailShell";
import { PlaceHero } from "@/components/detail/place/PlaceHero";
import { PlaceIdentityV2 } from "@/components/detail/place/PlaceIdentityV2";
import { PlaceStatusBar } from "@/components/detail/place/PlaceStatusBar";
import { PlaceQuickActions, type QuickAction } from "@/components/detail/place/PlaceQuickActions";
import { DetailLoadingSkeleton } from "@/components/detail/core/DetailLoadingSkeleton";
import { SeededDetailSkeleton } from "@/components/detail/core/SeededDetailSkeleton";
import type { SpotSeed } from "@/lib/detail/entity-preview-store";
import { HeroOverlayNav } from "@/components/detail/core/HeroOverlayNav";
import { SectionHeader } from "@/components/detail/core/SectionHeader";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import { getPlaceManifest } from "@/components/detail/manifests/place";
import { sectionRegistry } from "@/components/detail/sections";
import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import { getCategoryColor } from "@/lib/category-config";
import { getPlaceHoursStatus } from "@/lib/place-hours-status";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { usePortal } from "@/lib/portal-context";
import type { SpotDetailPayload, WalkableNeighbor, NearbyDestination } from "@/lib/spot-detail";
import type { EntityData, SectionModule } from "@/lib/detail/types";
import type { PlaceProfile, PlaceDiningDetails, PlaceGoogleDetails } from "@/lib/types/places";
import { PlacePlansStripLive } from "@/components/plans/PlacePlansStripLive";

// ── SpotApiResponse — re-export for callers ───────────────────────────────────

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
  /** Partial card-published seed for fast first paint. */
  seedData?: SpotSeed;
}

// ── Thin State Empty Component ───────────────────────────────────────────────

function ThinStateEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Magnifying glass icon — SVG inline to avoid dependency */}
      <div className="w-14 h-14 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center mb-5">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="7" />
          <line x1="21" y1="21" x2="14.7" y2="14.7" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[var(--cream)] mb-2">
        We&apos;re still learning about this place
      </h3>
      <p className="text-sm text-[var(--muted)] leading-relaxed max-w-[280px]">
        Check back soon — or help us out by suggesting details.
      </p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlaceDetailView({
  slug,
  portalSlug,
  onClose,
  initialData,
  seedData,
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

  const resolvedStatus = initialData ? ("ready" as const) : status;
  const stampedRef = useRef<string | null>(null);
  useEffect(() => {
    if (resolvedStatus !== "ready") return;
    const ref = `spot:${slug}`;
    if (stampedRef.current === ref) return;
    stampedRef.current = ref;
    markOverlayPhase("content-ready", ref);
  }, [resolvedStatus, slug]);

  const data = (initialData ?? fetchedData) as SpotDetailPayload | null;

  const spot = data?.spot ?? null;
  const placeProfile = data?.placeProfile ?? null;
  const diningData = data?.placeVerticalDetails?.dining ?? null;
  const googleData = data?.placeVerticalDetails?.google ?? null;
  const spotType = typeof spot?.spot_type === "string" ? spot.spot_type : null;

  const accentColor = useMemo(
    () => getCategoryColor(spotType ?? null),
    [spotType],
  );
  const accentClass = useMemo(
    () => createCssVarClass("--detail-accent", accentColor, "detail-accent"),
    [accentColor],
  );

  const entityData = useMemo<EntityData | null>(
    () => (data ? { entityType: "place", payload: data } : null),
    [data],
  );

  // ── Hours status ────────────────────────────────────────────────────────────
  const hoursStatus = useMemo(() => {
    if (!spot?.hours) return null;
    return getPlaceHoursStatus(spot.hours as Record<string, unknown>);
  }, [spot]);

  // ── Hero image ──────────────────────────────────────────────────────────────
  const heroImageUrl = useMemo(() => {
    return (
      placeProfile?.hero_image_url ??
      (placeProfile?.gallery_urls?.[0] ?? null) ??
      (typeof spot?.image_url === "string" ? spot.image_url : null)
    );
  }, [spot, placeProfile]);

  // ── Quick actions (subtype-aware, max 4) ────────────────────────────────────
  const quickActions = useMemo<QuickAction[]>(() => {
    if (!spot) return [];
    const actions: QuickAction[] = [];

    const reservationUrl = diningData?.reservation_url ?? null;
    const website = typeof spot.website === "string" ? spot.website : null;
    const menuUrl = diningData?.menu_url ?? null;
    const phone = typeof spot.phone === "string" ? spot.phone : null;
    const address = typeof spot.address === "string" ? spot.address : null;
    const name = typeof spot.name === "string" ? spot.name : "";
    const city = typeof spot.city === "string" ? spot.city : "";
    const state = typeof spot.state === "string" ? spot.state : "";

    // Primary action: Reserve if restaurant with reservation_url, else Website
    if (reservationUrl) {
      actions.push({
        icon: <CalendarCheck size={18} weight="duotone" />,
        label: "Reserve",
        href: reservationUrl,
        variant: "primary",
      });
    } else if (website) {
      actions.push({
        icon: <GlobeSimple size={18} weight="duotone" />,
        label: "Website",
        href: website,
        variant: "primary",
      });
    }

    // Secondary actions: Menu, Directions, Call, Save, Share
    if (menuUrl && actions.length < 4) {
      actions.push({
        icon: <BookOpen size={18} weight="duotone" />,
        label: "Menu",
        href: menuUrl,
        variant: "secondary",
      });
    }

    if (address && actions.length < 4) {
      const mapsQuery = encodeURIComponent(
        `${name}, ${address}, ${city}, ${state}`,
      );
      actions.push({
        icon: <NavigationArrow size={18} weight="duotone" />,
        label: "Directions",
        href: `https://maps.google.com/?q=${mapsQuery}`,
        variant: "secondary",
      });
    }

    if (phone && actions.length < 4) {
      actions.push({
        icon: <Phone size={18} weight="duotone" />,
        label: "Call",
        href: `tel:${phone}`,
        variant: "secondary",
      });
    }

    if (actions.length < 4) {
      actions.push({
        icon: <BookmarkSimple size={18} weight="duotone" />,
        label: "Save",
        variant: "secondary",
      });
    }

    if (actions.length < 4) {
      actions.push({
        icon: <ShareNetwork size={18} weight="duotone" />,
        label: "Share",
        variant: "secondary",
      });
    }

    // Cap at 4
    return actions.slice(0, 4);
  }, [spot, diningData]);

  // ── Resolved sections ───────────────────────────────────────────────────────
  const resolvedSections = useMemo<SectionModule[]>(() => {
    if (!entityData) return [];
    const manifest = getPlaceManifest(spotType ?? "");
    const sections: SectionModule[] = [];

    for (const id of manifest) {
      const mod = sectionRegistry.get(id);
      if (!mod) continue;
      if (!mod.allowedEntityTypes.includes("place")) continue;
      if (!mod.trait(entityData)) continue;
      sections.push(mod);
    }

    return sections;
  }, [entityData, spotType]);

  // ── Sticky bar primary action ───────────────────────────────────────────────
  const primaryAction = useMemo(() => {
    const primary = quickActions.find((a) => a.variant === "primary");
    if (!primary || !primary.href) return undefined;
    return { label: primary.label, href: primary.href };
  }, [quickActions]);

  // ── Loading / no data ───────────────────────────────────────────────────────
  if (status === "loading" || !entityData || !spot) {
    if (seedData) return <SeededDetailSkeleton seed={seedData} />;
    return <DetailLoadingSkeleton />;
  }

  // ── Build section ReactNodes ────────────────────────────────────────────────
  const sectionNodes = resolvedSections.map((module) => {
    const Section = module.component;
    const count = module.getCount?.(entityData) ?? null;
    return (
      <div key={module.id} className="flex flex-col gap-3">
        {!module.hideWrapperHeader && (
          <SectionHeader label={module.label} count={count} icon={module.icon} />
        )}
        <Section
          data={entityData}
          portalSlug={portalSlug}
          accentColor={accentColor}
          entityType="place"
        />
      </div>
    );
  });

  // Thin state: zero sections → show fallback
  const baseSections =
    sectionNodes.length > 0 ? sectionNodes : [<ThinStateEmpty key="empty" />];

  // Presence signal: PlacePlansStripLive — shows "N friends here" when active plans exist.
  // Renders nothing when no active plans, so it never creates empty space.
  const placeId = typeof spot.id === "number" ? spot.id : null;
  const sectionsToRender = placeId
    ? [
        <PlacePlansStripLive
          key="presence"
          placeId={placeId}
          variant="full"
          className="mx-0"
        />,
        ...baseSections,
      ]
    : baseSections;

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <PlaceDetailShell
        hero={
          <PlaceHero
            imageUrl={heroImageUrl}
            category={spotType}
            overlaySlot={<HeroOverlayNav onClose={onClose} portalSlug={portalSlug} />}
          />
        }
        identity={
          <PlaceIdentityV2
            spot={spot}
            diningData={diningData}
            googleData={googleData}
          />
        }
        statusBar={
          hoursStatus && hoursStatus.kind !== "unknown" ? (
            <PlaceStatusBar status={hoursStatus} />
          ) : null
        }
        quickActions={
          <PlaceQuickActions actions={quickActions} />
        }
        sections={sectionsToRender}
        bottomBar={
          <DetailStickyBar
            primaryAction={primaryAction}
            primaryVariant={
              quickActions.find((a) => a.variant === "primary" && a.label === "Reserve")
                ? "filled"
                : "outlined"
            }
            primaryColor={accentColor}
            showShareButton
            scrollThreshold={300}
          />
        }
      />
    </>
  );
}
