"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useRef } from "react";
import EventDetailView from "./EventDetailView";
import VenueDetailView from "./VenueDetailView";
import SeriesDetailView from "./SeriesDetailView";
import OrgDetailView from "./OrgDetailView";
import FestivalDetailView from "./FestivalDetailView";

interface DetailViewRouterProps {
  portalSlug: string;
  children: React.ReactNode;
}

function AnimatedDetailWrapper({ children }: {
  children: React.ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const router = useRouter();
  const navigatingRef = useRef(false);

  const handleAnimatedClose = useCallback(() => {
    if (navigatingRef.current) return;
    setClosing(true);
  }, []);

  const handleAnimationEnd = useCallback(() => {
    if (closing && !navigatingRef.current) {
      navigatingRef.current = true;
      // Use router.back() to walk the navigation chain correctly:
      // e.g., List → Event → Venue → close → Event → close → List
      // Each detail open pushes a history entry, so back() reverses the chain.
      router.back();
    }
  }, [closing, router]);

  return (
    <div
      className={closing ? "animate-detail-exit" : "animate-detail-enter"}
      onAnimationEnd={handleAnimationEnd}
    >
      {/* Clone children with the animated close handler */}
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

export default function DetailViewRouter({ portalSlug, children }: DetailViewRouterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check for detail view params
  const eventId = searchParams.get("event");
  const spotSlug = searchParams.get("spot");
  const seriesSlug = searchParams.get("series");
  const festivalSlug = searchParams.get("festival");
  const orgSlug = searchParams.get("org");

  // When a detail view opens via query params, we want to start at the top instead of preserving
  // the underlying feed scroll position.
  useEffect(() => {
    if (!eventId && !spotSlug && !seriesSlug && !festivalSlug && !orgSlug) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [eventId, spotSlug, seriesSlug, festivalSlug, orgSlug]);

  // Close handler navigates back through the history chain
  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  // If we have a detail param, show the detail view with animated wrapper
  if (eventId) {
    const id = parseInt(eventId, 10);
    if (!isNaN(id)) {
      return (
        <AnimatedDetailWrapper>
          <EventDetailView
            eventId={id}
            portalSlug={portalSlug}
            onClose={handleClose}
          />
        </AnimatedDetailWrapper>
      );
    }
  }

  if (spotSlug) {
    return (
      <AnimatedDetailWrapper>
        <VenueDetailView
          slug={spotSlug}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      </AnimatedDetailWrapper>
    );
  }

  if (seriesSlug) {
    return (
      <AnimatedDetailWrapper>
        <SeriesDetailView
          slug={seriesSlug}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      </AnimatedDetailWrapper>
    );
  }

  if (festivalSlug) {
    return (
      <AnimatedDetailWrapper>
        <FestivalDetailView
          slug={festivalSlug}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      </AnimatedDetailWrapper>
    );
  }

  if (orgSlug) {
    return (
      <AnimatedDetailWrapper>
        <OrgDetailView
          slug={orgSlug}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      </AnimatedDetailWrapper>
    );
  }

  // Otherwise render normal content
  return <>{children}</>;
}
