"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import EventDetailView from "./EventDetailView";
import VenueDetailView from "./VenueDetailView";
import SeriesDetailView from "./SeriesDetailView";
import OrgDetailView from "./OrgDetailView";

interface DetailViewRouterProps {
  portalSlug: string;
  children: React.ReactNode;
}

export default function DetailViewRouter({ portalSlug, children }: DetailViewRouterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check for detail view params
  const eventId = searchParams.get("event");
  const spotSlug = searchParams.get("spot");
  const seriesSlug = searchParams.get("series");
  const orgSlug = searchParams.get("org");

  // Close handler - removes the detail param and goes back to the view
  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("org");
    const queryString = params.toString();
    router.push(`/${portalSlug}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [portalSlug, router, searchParams]);

  // If we have a detail param, show the detail view
  if (eventId) {
    const id = parseInt(eventId, 10);
    if (!isNaN(id)) {
      return (
        <EventDetailView
          eventId={id}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      );
    }
  }

  if (spotSlug) {
    return (
      <VenueDetailView
        slug={spotSlug}
        portalSlug={portalSlug}
        onClose={handleClose}
      />
    );
  }

  if (seriesSlug) {
    return (
      <SeriesDetailView
        slug={seriesSlug}
        portalSlug={portalSlug}
        onClose={handleClose}
      />
    );
  }

  if (orgSlug) {
    return (
      <OrgDetailView
        slug={orgSlug}
        portalSlug={portalSlug}
        onClose={handleClose}
      />
    );
  }

  // Otherwise render normal content
  return <>{children}</>;
}
