"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useState, useRef } from "react";
import EventDetailView from "./EventDetailView";
import VenueDetailView from "./VenueDetailView";
import SeriesDetailView from "./SeriesDetailView";
import OrgDetailView from "./OrgDetailView";

interface DetailViewRouterProps {
  portalSlug: string;
  children: React.ReactNode;
}

function AnimatedDetailWrapper({ children, onClose, portalSlug, searchParams }: {
  children: React.ReactNode;
  onClose: () => void;
  portalSlug: string;
  searchParams: URLSearchParams;
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
      const params = new URLSearchParams(searchParams.toString());
      params.delete("event");
      params.delete("spot");
      params.delete("series");
      params.delete("org");
      const queryString = params.toString();
      router.push(`/${portalSlug}${queryString ? `?${queryString}` : ""}`, { scroll: false });
    }
  }, [closing, portalSlug, router, searchParams]);

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
  const orgSlug = searchParams.get("org");

  // Direct close handler (fallback, used when not in animated wrapper)
  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("org");
    const queryString = params.toString();
    router.push(`/${portalSlug}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [portalSlug, router, searchParams]);

  // If we have a detail param, show the detail view with animated wrapper
  if (eventId) {
    const id = parseInt(eventId, 10);
    if (!isNaN(id)) {
      return (
        <AnimatedDetailWrapper onClose={handleClose} portalSlug={portalSlug} searchParams={searchParams}>
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
      <AnimatedDetailWrapper onClose={handleClose} portalSlug={portalSlug} searchParams={searchParams}>
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
      <AnimatedDetailWrapper onClose={handleClose} portalSlug={portalSlug} searchParams={searchParams}>
        <SeriesDetailView
          slug={seriesSlug}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      </AnimatedDetailWrapper>
    );
  }

  if (orgSlug) {
    return (
      <AnimatedDetailWrapper onClose={handleClose} portalSlug={portalSlug} searchParams={searchParams}>
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
