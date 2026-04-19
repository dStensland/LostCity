"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { setFeedVisible } from "@/lib/feed-visibility";
import { LinkContextProvider } from "@/lib/link-context";
import { markOverlayPhase, overlayRef } from "@/lib/detail/overlay-perf";
import {
  peekEntityPreview,
  buildEntityRef,
  type EventSeed,
  type SpotSeed,
  type SeriesSeed,
  type FestivalSeed,
  type OrgSeed,
  type NeighborhoodSeed,
} from "@/lib/detail/entity-preview-store";
import {
  buildDetailCloseFallbackUrl,
  resolveDetailOverlayTarget,
} from "./detail-entry-contract";

const EventDetailView = dynamic(() => import("@/components/views/EventDetailView"));
const PlaceDetailView = dynamic(() => import("@/components/views/PlaceDetailView"));
const SeriesDetailView = dynamic(() => import("@/components/views/SeriesDetailView"));
const OrgDetailView = dynamic(() => import("@/components/views/OrgDetailView"));
const FestivalDetailView = dynamic(() => import("@/components/views/FestivalDetailView"));
const NeighborhoodDetailView = dynamic(
  () => import("@/components/views/NeighborhoodDetailView"),
);

/**
 * Did the page initially load with an overlay param in the URL? If yes, the
 * first overlay-router mount is a cold-load-of-shared-link and the enter
 * animation should be skipped (otherwise the user sees the feed flash under
 * a sliding overlay).
 *
 * Captured at module evaluation time (before any render) from the actual URL
 * rather than from React state so it's stable across Strict-Mode double-
 * invocation, HMR, and client-side navigations. After the first mount, we
 * set `initialOverlayConsumed` so subsequent click-navigations animate.
 */
const initialHadOverlayParam =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).toString().length > 0 &&
  /[?&](event|spot|series|festival|org|artist|neighborhood)=/.test(
    window.location.search,
  );
let initialOverlayConsumed = false;

/**
 * Per plan doc §Locked Decisions #4: after 5 consecutive overlay swaps, the
 * next entity-link click should resolve as a canonical navigation (full page
 * load) to keep the overlay depth bounded. Cards inside the overlay read
 * context via `useLinkContext()`, so we force canonical by nesting an inner
 * `LinkContextProvider value="canonical"` around the detail view when the
 * counter hits this cap.
 */
const MAX_OVERLAY_DEPTH = 5;

/**
 * Build a selector that can re-find a triggering element after React may
 * have replaced its DOM node during reconciliation. Prefers `id` (stable),
 * then `href` (stable for Link elements), then a kind-tag fallback.
 * Returns `null` when we can't build anything reliable.
 */
function buildFocusSelector(el: HTMLElement): string | null {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const href = el.getAttribute("href");
  if (href) {
    // Escape any embedded double quotes for the attribute-value context.
    const escaped = href.replace(/"/g, '\\"');
    return `a[href="${escaped}"]`;
  }
  return null;
}

/** aria-label per overlay kind — announces entity type to assistive tech. */
const ARIA_LABELS: Record<string, string> = {
  event: "Event detail overlay",
  spot: "Place detail overlay",
  series: "Series detail overlay",
  festival: "Festival detail overlay",
  org: "Organization detail overlay",
  artist: "Artist detail overlay",
  neighborhood: "Neighborhood detail overlay",
};

interface DetailOverlayRouterProps {
  portalSlug: string;
  children: React.ReactNode;
}

function AnimatedDetailWrapper({
  children,
  onNavigateClose,
  animateEnter,
  ariaLabel,
}: {
  children: React.ReactNode;
  onNavigateClose: () => void;
  /**
   * When false, skips the enter animation — used on cold load of a shared
   * `?event=123` link so the user doesn't see the feed flash under a sliding
   * overlay. Animation still plays on swap and on subsequent click-to-open.
   */
  animateEnter: boolean;
  /** aria-label for the dialog, e.g. "Event detail overlay". */
  ariaLabel: string;
}) {
  const [closing, setClosing] = useState(false);
  const navigatingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Capture identifying info for the triggering element — a raw node ref
  // doesn't survive React's reconciliation when the lane un-hides on close.
  // The selector resolves back to an equivalent element on restore.
  const triggerSelectorRef = useRef<string | null>(null);

  const handleAnimatedClose = useCallback(() => {
    if (navigatingRef.current) return;
    setClosing(true);
  }, []);

  const handleAnimationEnd = useCallback(() => {
    if (closing && !navigatingRef.current) {
      navigatingRef.current = true;
      onNavigateClose();
    }
  }, [closing, onNavigateClose]);

  // Defensive fallback: if the exit animation's `animationend` event doesn't
  // fire within the animation duration + a small buffer — e.g. the tab is
  // background-throttled, or the user has an animation-blocker — force the
  // close anyway so the user isn't trapped in a non-closing overlay. Matches
  // --motion-fast (200ms) + margin.
  useEffect(() => {
    if (!closing || navigatingRef.current) return;
    const id = setTimeout(() => {
      if (!navigatingRef.current) {
        navigatingRef.current = true;
        onNavigateClose();
      }
    }, 500);
    return () => clearTimeout(id);
  }, [closing, onNavigateClose]);

  // Capture trigger + move focus to overlay on mount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const trigger = document.activeElement;
    if (trigger instanceof HTMLElement && trigger.tagName !== "BODY") {
      triggerSelectorRef.current = buildFocusSelector(trigger);
    }
    containerRef.current?.focus({ preventScroll: true });
    return () => {
      // Restore focus on unmount. Defer beyond the next paint — the lane was
      // `display:none` while the overlay was active, and the browser refuses
      // to move focus to display:none elements; React needs to re-render the
      // lane un-hidden before focus() works. Selector (not a raw node ref)
      // because React reconciliation may replace the original DOM node
      // during the close — the selector re-queries the equivalent element.
      const sel = triggerSelectorRef.current;
      if (!sel) return;
      setTimeout(() => {
        const target = document.querySelector(sel);
        if (target instanceof HTMLElement) {
          target.focus({ preventScroll: true });
        }
      }, 0);
    };
  }, []);

  // Escape closes + focus trap.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleAnimatedClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus trap — cycle Tab / Shift+Tab within the overlay container.
      const container = containerRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAnimatedClose]);

  const animClass = closing
    ? "animate-detail-exit"
    : animateEnter
      ? "animate-detail-enter"
      : "";

  return (
    <div
      ref={containerRef}
      className={animClass}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      tabIndex={-1}
      onAnimationEnd={handleAnimationEnd}
    >
      {typeof children === "object" && children !== null && "props" in (children as React.ReactElement)
        ? (() => {
            const child = children as React.ReactElement<{ onClose: () => void }>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Child = child.type as React.ComponentType<any>;
            return <Child {...child.props} onClose={handleAnimatedClose} />;
          })()
        : children}
    </div>
  );
}

export default function DetailOverlayRouter({
  portalSlug,
  children,
}: DetailOverlayRouterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const detailTarget = useMemo(
    () => resolveDetailOverlayTarget(searchParams),
    [searchParams],
  );

  // Stamp target-resolved synchronously during render so seeded-paint (which
  // runs in the child's useLayoutEffect, i.e. *before* parent effects) always
  // has a baseline to measure against. markOverlayPhase is a perf-only
  // side-effect; duplicate stamps across re-renders are harmless (the measure
  // logic picks the most recent via getEntriesByName).
  if (detailTarget) {
    const ref = overlayRef(detailTarget);
    if (ref) markOverlayPhase("target-resolved", ref);
  }

  // Skip enter animation on cold load of a shared `?event=123` link — without
  // this guard the user sees the feed flash under a sliding-up overlay. The
  // first mount where `initialHadOverlayParam` is true (and not yet consumed)
  // is the cold-load case. Any later mount — whether the user closed and
  // reopened, or navigated in for the first time — should animate.
  const [isColdLoadMount] = useState(
    () => initialHadOverlayParam && !initialOverlayConsumed,
  );
  useEffect(() => {
    initialOverlayConsumed = true;
  }, []);

  // Track swap depth: how many overlays have been opened in a row without
  // closing. Initial value = 1 if we mounted with a target (cold-load or
  // first click), else 0. Each target change while target stays truthy is a
  // swap and increments depth. When detailTarget goes null (overlay closed),
  // depth resets. When depth >= MAX_OVERLAY_DEPTH, card links inside the
  // overlay render with canonical context.
  const currentKey = detailTarget
    ? `${detailTarget.kind}:${
        "id" in detailTarget ? detailTarget.id : detailTarget.slug
      }`
    : null;
  const prevKeyRef = useRef<string | null>(null);
  const [swapDepth, setSwapDepth] = useState(currentKey ? 1 : 0);
  useEffect(() => {
    if (!currentKey) {
      if (prevKeyRef.current !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSwapDepth(0);
        prevKeyRef.current = null;
      }
      return;
    }
    if (prevKeyRef.current === null) {
      // First open of this overlay chain — already counted by initial state.
      prevKeyRef.current = currentKey;
      return;
    }
    if (prevKeyRef.current !== currentKey) {
      prevKeyRef.current = currentKey;
      setSwapDepth((d) => d + 1);
    }
  }, [currentKey]);

  const atDepthCap = swapDepth >= MAX_OVERLAY_DEPTH;

  useEffect(() => {
    if (!detailTarget) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [detailTarget]);

  const closeFallbackUrl = useMemo(
    () => buildDetailCloseFallbackUrl(pathname, searchParams),
    [pathname, searchParams],
  );

  const navigateClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(closeFallbackUrl, { scroll: false });
  }, [router, closeFallbackUrl]);

  const handleClose = useCallback(() => {
    navigateClose();
  }, [navigateClose]);

  let detailView: React.ReactNode = null;

  switch (detailTarget?.kind) {
    case "event": {
      const seed = peekEntityPreview(
        buildEntityRef("event", detailTarget.id),
      ) as EventSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`event-${detailTarget.id}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
          ariaLabel={ARIA_LABELS[detailTarget.kind]}
        >
          <EventDetailView
            eventId={detailTarget.id}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "spot": {
      const seed = peekEntityPreview(
        buildEntityRef("spot", detailTarget.slug),
      ) as SpotSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`spot-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
          ariaLabel={ARIA_LABELS[detailTarget.kind]}
        >
          <PlaceDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "series": {
      const seed = peekEntityPreview(
        buildEntityRef("series", detailTarget.slug),
      ) as SeriesSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`series-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
          ariaLabel={ARIA_LABELS[detailTarget.kind]}
        >
          <SeriesDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "festival": {
      const seed = peekEntityPreview(
        buildEntityRef("festival", detailTarget.slug),
      ) as FestivalSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`festival-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
          ariaLabel={ARIA_LABELS[detailTarget.kind]}
        >
          <FestivalDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "org": {
      const seed = peekEntityPreview(
        buildEntityRef("org", detailTarget.slug),
      ) as OrgSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`org-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
          ariaLabel={ARIA_LABELS[detailTarget.kind]}
        >
          <OrgDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "artist":
      detailView = null;
      break;
    case "neighborhood": {
      const seed = peekEntityPreview(
        buildEntityRef("neighborhood", detailTarget.slug),
      ) as NeighborhoodSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`neighborhood-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
          ariaLabel={ARIA_LABELS[detailTarget.kind]}
        >
          <NeighborhoodDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    default:
      detailView = null;
  }

  const isDetailActive = detailView !== null;

  useEffect(() => {
    setFeedVisible(!isDetailActive);
  }, [isDetailActive]);

  // Wrap the detail view in an inner LinkContextProvider when at cap so that
  // card components inside (which build URLs via useLinkContext) emit
  // canonical links. Next click inside the overlay becomes a full-page nav to
  // the canonical route instead of yet-another swap.
  const wrappedDetailView =
    atDepthCap && detailView ? (
      <LinkContextProvider value="canonical">{detailView}</LinkContextProvider>
    ) : (
      detailView
    );

  // Polite live-region announcement so screen readers hear "Event detail
  // opened" (etc.) when the overlay opens or swaps. Rendered outside the
  // animated wrapper so it's unaffected by mount/unmount flicker.
  const announcement = detailTarget
    ? `${ARIA_LABELS[detailTarget.kind]?.replace(" overlay", "") ?? "Detail"} opened`
    : "";

  return (
    <>
      <div className={isDetailActive ? "hidden" : "contents"}>{children}</div>
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {announcement}
      </div>
      {wrappedDetailView}
    </>
  );
}
