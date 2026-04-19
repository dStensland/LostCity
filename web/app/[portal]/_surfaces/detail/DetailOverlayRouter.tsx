"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { setFeedVisible } from "@/lib/feed-visibility";
import { LinkContextProvider } from "@/lib/link-context";
import { OverlayContextProvider } from "@/lib/detail/overlay-context";
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
  DETAIL_ENTRY_PARAM_KEYS,
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
 * Module-scoped state for cold-load detection. Captured at script evaluation
 * time (before any render) from the actual URL rather than from React state
 * so it's stable across Strict-Mode double-invocation, HMR, and client-side
 * navigations.
 *
 * - `hadOverlayParamAtLoad`: did the initial URL carry an overlay param?
 *   If yes, the first overlay-router mount in this tab session is a
 *   cold-load-of-a-shared-link and should skip the enter animation
 *   (otherwise the user sees the feed flash under a sliding overlay).
 * - `consumed`: flipped after the first mount so subsequent click-navigations
 *   animate normally.
 *
 * Grouped as one object so future module-scoped load-state additions have a
 * natural home instead of accumulating as loose globals.
 */
const OVERLAY_PARAM_REGEX = new RegExp(
  `[?&](${DETAIL_ENTRY_PARAM_KEYS.join("|")})=`,
);

const initialOverlayLoadState = {
  hadOverlayParamAtLoad:
    typeof window !== "undefined" &&
    window.location.search.length > 0 &&
    OVERLAY_PARAM_REGEX.test(window.location.search),
  consumed: false,
};

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
  atDepthCap = false,
  onDepthCapExit,
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
  /**
   * When true, card-link clicks inside the overlay are intercepted: a
   * distinct depth-cap exit animation plays (slides further, longer
   * duration) before `onDepthCapExit(href)` fires — signals "leaving
   * overlay context" per plan § Motion Specs.
   */
  atDepthCap?: boolean;
  onDepthCapExit?: (href: string) => void;
}) {
  const [closing, setClosing] = useState(false);
  // Null when not a depth-cap close; holds the target href when a depth-cap
  // link click has been intercepted and we're awaiting the exit animation.
  const [depthCapHref, setDepthCapHref] = useState<string | null>(null);
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
      if (depthCapHref && onDepthCapExit) {
        onDepthCapExit(depthCapHref);
      } else {
        onNavigateClose();
      }
    }
  }, [closing, onNavigateClose, depthCapHref, onDepthCapExit]);

  // Depth-cap interceptor — when at cap, capture internal link clicks on the
  // overlay container, prevent the default Next.js navigation, play the
  // distinct exit animation, then navigate via onDepthCapExit so the user
  // senses "leaving overlay context" before the canonical page loads.
  useEffect(() => {
    if (!atDepthCap || !onDepthCapExit) return;
    const container = containerRef.current;
    if (!container) return;
    function onClick(e: MouseEvent) {
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      // Skip cmd/ctrl/shift/alt + middle-click — let browser default happen.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }
      // Same-origin only — external links shouldn't get the overlay-exit treatment.
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      setDepthCapHref(url.pathname + url.search + url.hash);
      setClosing(true);
    }
    container.addEventListener("click", onClick, true);
    return () => container.removeEventListener("click", onClick, true);
  }, [atDepthCap, onDepthCapExit]);

  // Defensive fallback: if the exit animation's `animationend` event doesn't
  // fire within the animation duration + a small buffer — e.g. the tab is
  // background-throttled, or the user has an animation-blocker — force the
  // navigation anyway so the user isn't trapped. Longer budget on depth-cap
  // (animation is 400ms vs 200ms) matches --motion-slow + margin.
  useEffect(() => {
    if (!closing || navigatingRef.current) return;
    const budget = depthCapHref ? 700 : 500;
    const id = setTimeout(() => {
      if (!navigatingRef.current) {
        navigatingRef.current = true;
        if (depthCapHref && onDepthCapExit) {
          onDepthCapExit(depthCapHref);
        } else {
          onNavigateClose();
        }
      }
    }, budget);
    return () => clearTimeout(id);
  }, [closing, onNavigateClose, depthCapHref, onDepthCapExit]);

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
    ? depthCapHref
      ? "animate-detail-exit-depth-cap"
      : "animate-detail-exit"
    : animateEnter
      ? "animate-detail-enter"
      : "";

  // Positional shell: the outer container fixes to viewport and centers the
  // card; the card itself carries the visual affordance (dusk surface,
  // shadow-card-xl, rounded-card-xl, internal scroll). Lane stays visible
  // underneath on --void — shadow elevation creates the depth cue, not a
  // backdrop dim. See plan doc § Locked Decisions #5.
  // Top inset clears the sticky portal header (z-100, ~64px mobile / ~72px
  // desktop). The overlay renders below the header so site navigation
  // (portal switch, search, profile) stays accessible while the overlay is
  // open — consistent with "overlay ≠ modal" per design-truth.
  return (
    <div
      className={`fixed inset-x-0 top-[calc(var(--header-h,72px)+0.5rem)] bottom-4 z-[60] flex items-start justify-center px-3 sm:px-6 pointer-events-none ${animClass}`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className="pointer-events-auto relative w-full max-w-3xl h-full bg-[var(--dusk)] rounded-card-xl shadow-card-xl overflow-y-auto overflow-x-hidden"
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
  // first mount where `hadOverlayParamAtLoad` is true (and not yet consumed)
  // is the cold-load case. Any later mount — whether the user closed and
  // reopened, or navigated in for the first time — should animate.
  const [isColdLoadMount] = useState(
    () =>
      initialOverlayLoadState.hadOverlayParamAtLoad &&
      !initialOverlayLoadState.consumed,
  );
  useEffect(() => {
    initialOverlayLoadState.consumed = true;
  }, []);

  // Track swap depth: how many overlays have been shown in a row without
  // closing. Overlay #1 = depth 1. Each swap (transition between two truthy
  // targets) increments by 1. Depth ≥ MAX_OVERLAY_DEPTH (5) forces canonical
  // context for card links inside the overlay, so the next click exits to a
  // full-page nav instead of stacking another swap.
  //
  // The router is conditionally mounted (only when an overlay is active) —
  // closing the overlay unmounts the component, which resets state on the
  // next mount via the useState initializer.
  const currentKey = detailTarget
    ? `${detailTarget.kind}:${
        "id" in detailTarget ? detailTarget.id : detailTarget.slug
      }`
    : null;
  const prevKeyRef = useRef<string | null>(null);
  const [swapDepth, setSwapDepth] = useState(currentKey ? 1 : 0);
  useEffect(() => {
    if (!currentKey) return;
    if (prevKeyRef.current === null) {
      // First render with a target — count as depth 1.
      prevKeyRef.current = currentKey;
      return;
    }
    if (prevKeyRef.current !== currentKey) {
      prevKeyRef.current = currentKey;
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Depth-cap exit: the wrapper intercepts the card click, plays the longer
  // depth-cap exit anim, then calls this — which does the actual canonical
  // navigation. router.push (not router.replace) so browser history still
  // carries the transition.
  const handleDepthCapExit = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

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
          atDepthCap={atDepthCap}
          onDepthCapExit={handleDepthCapExit}
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
          atDepthCap={atDepthCap}
          onDepthCapExit={handleDepthCapExit}
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
          atDepthCap={atDepthCap}
          onDepthCapExit={handleDepthCapExit}
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
          atDepthCap={atDepthCap}
          onDepthCapExit={handleDepthCapExit}
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
          atDepthCap={atDepthCap}
          onDepthCapExit={handleDepthCapExit}
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
          atDepthCap={atDepthCap}
          onDepthCapExit={handleDepthCapExit}
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

  // Wrap the detail view in an OverlayContextProvider so views inside can read
  // `inOverlay: true` via useOverlayContext() — replaces `inOverlay` prop
  // drilling. When at depth cap, also nest a LinkContextProvider so cards
  // inside emit canonical links and the next click exits via full-page nav.
  const wrappedDetailView = detailView ? (
    <OverlayContextProvider value={{ inOverlay: true }}>
      {atDepthCap ? (
        <LinkContextProvider value="canonical">{detailView}</LinkContextProvider>
      ) : (
        detailView
      )}
    </OverlayContextProvider>
  ) : null;

  // Polite live-region announcement so screen readers hear "Event detail
  // opened" (etc.) when the overlay opens or swaps. Rendered outside the
  // animated wrapper so it's unaffected by mount/unmount flicker.
  const announcement = detailTarget
    ? `${ARIA_LABELS[detailTarget.kind]?.replace(" overlay", "") ?? "Detail"} opened`
    : "";

  // Lane stays in DOM behind the overlay — the card's shadow-elevation is
  // what creates the depth cue. When an overlay is active, mark the lane
  // inert + aria-hidden so assistive tech and keyboard focus don't leak
  // into the background content. `setFeedVisible(false)` still runs above
  // to pause scroll-driven feed listeners without affecting visual DOM.
  return (
    <>
      <div
        className="contents"
        aria-hidden={isDetailActive ? "true" : undefined}
        inert={isDetailActive}
      >
        {children}
      </div>
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
