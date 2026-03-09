"use client";

import { useEffect, useState, useCallback } from "react";
import type { Portal } from "@/lib/portal-context";
import type { FeedEvent, Destination } from "@/lib/forth-types";
import type { DiscoverFeedData, PropertyMoment } from "@/lib/concierge/concierge-types";
import type { EveningSlot } from "@/lib/concierge/evening-vibes";
import HotelHeader from "../hotel/HotelHeader";
import { DiscoverHero } from "./sections/DiscoverHero";
import { AtForthSection } from "./sections/AtForthSection";
import { DiscoverTonightSection } from "./sections/DiscoverTonightSection";
import { DiscoverSceneSection } from "./sections/DiscoverSceneSection";
import DiscoverComingUpSection from "./sections/DiscoverComingUpSection";
import DiscoverNeighborhoodSection from "./sections/DiscoverNeighborhoodSection";
import AgentFooter from "./sections/AgentFooter";
import EveningPlannerDrawer from "./EveningPlannerDrawer";
import EventDetailModal from "./EventDetailModal";
import VenueDetailModal, {
  type VenueModalData,
  venueFromDestination,
  venueFromPropertyMoment,
} from "./VenueDetailModal";
import AddToPlanSheet from "./AddToPlanSheet";

interface DiscoverShellProps {
  portal: Portal;
  data: DiscoverFeedData;
}

export default function DiscoverShell({ portal, data }: DiscoverShellProps) {
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<FeedEvent | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenueModalData | null>(null);
  const [addToPlanEvent, setAddToPlanEvent] = useState<FeedEvent | null>(null);
  const logoUrl = portal.branding?.logo_url as string | null | undefined;

  // Mark body with data attributes for hotel-specific CSS
  useEffect(() => {
    document.body.dataset.forthExperience = "true";
    document.body.dataset.conciergeExperience = "true";
    return () => {
      delete document.body.dataset.forthExperience;
      delete document.body.dataset.conciergeExperience;
    };
  }, []);

  const handleOpenPlanner = useCallback(() => {
    setPlannerOpen(true);
  }, []);

  const handleClosePlanner = useCallback(() => {
    setPlannerOpen(false);
  }, []);

  // Event detail modal
  const handleEventClick = useCallback((event: FeedEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseEventDetail = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  // Venue detail modal
  const handlePropertyMomentClick = useCallback((moment: PropertyMoment) => {
    setSelectedVenue(venueFromPropertyMoment(moment));
  }, []);

  const handleDestinationClick = useCallback((dest: Destination) => {
    setSelectedVenue(venueFromDestination(dest));
  }, []);

  const handleCloseVenueDetail = useCallback(() => {
    setSelectedVenue(null);
  }, []);

  // "Add to Your Evening" flow
  const handleAddToPlan = useCallback((event: FeedEvent) => {
    setSelectedEvent(null); // close event detail first
    setAddToPlanEvent(event);
  }, []);

  const handleCloseAddToPlan = useCallback(() => {
    setAddToPlanEvent(null);
  }, []);

  const handleConfirmAddToPlan = useCallback(
    (event: FeedEvent, slot: EveningSlot) => {
      void event;
      void slot;
      // TODO: Wire to evening plan state when Playbook persistence is ready
      setAddToPlanEvent(null);
      setPlannerOpen(true); // open planner to show the plan
    },
    [],
  );

  // When event detail opens from within venue detail
  const handleEventFromVenue = useCallback((event: FeedEvent) => {
    setSelectedVenue(null);
    setSelectedEvent(event);
  }, []);

  // Find tonight events at the selected venue (for venue detail modal)
  const venueEvents =
    selectedVenue
      ? data.tonightEvents.filter(
          (e) =>
            e.venue_name &&
            e.venue_name.toLowerCase() === selectedVenue.name.toLowerCase(),
        )
      : [];

  return (
    <div className="min-h-screen bg-[var(--hotel-ivory)]">
      <HotelHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        logoUrl={logoUrl}
        conciergePhone={data.config.conciergePhone}
        onOpenPlanner={handleOpenPlanner}
        plannerOpen={plannerOpen}
      />

      {/* On desktop, dim the feed when the planner panel is open */}
      <main
        className={`max-w-3xl mx-auto px-4 md:px-6 space-y-10 pb-16 transition-opacity duration-300 ${
          plannerOpen ? "md:opacity-50 md:pointer-events-none" : ""
        }`}
      >
        <DiscoverHero
          ambient={data.ambient}
          onOpenPlanner={handleOpenPlanner}
        />

        <AtForthSection
          moments={data.propertyMoments}
          portalName={portal.name}
          onMomentClick={handlePropertyMomentClick}
        />

        <DiscoverTonightSection
          events={data.tonightEvents}
          dayPart={data.ambient.dayPart}
          onEventClick={handleEventClick}
        />

        <DiscoverSceneSection regulars={data.regulars} />

        <DiscoverComingUpSection
          events={data.comingUpEvents}
          onEventClick={handleEventClick}
        />

        <DiscoverNeighborhoodSection
          destinations={data.destinations}
          onDestinationClick={handleDestinationClick}
        />

        <AgentFooter
          narrative={data.agentNarrative}
          conciergePhone={data.config.conciergePhone}
        />
      </main>

      {/* Evening Planner Drawer */}
      {plannerOpen && (
        <EveningPlannerDrawer
          portalSlug={portal.slug}
          portalId={portal.id}
          onClose={handleClosePlanner}
        />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          dayPart={data.ambient.dayPart}
          onClose={handleCloseEventDetail}
          onAddToPlan={handleAddToPlan}
        />
      )}

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <VenueDetailModal
          venue={selectedVenue}
          tonightEvents={venueEvents}
          onClose={handleCloseVenueDetail}
          onEventClick={handleEventFromVenue}
        />
      )}

      {/* Add to Plan Sheet */}
      {addToPlanEvent && (
        <AddToPlanSheet
          event={addToPlanEvent}
          currentStops={[]}
          onAdd={handleConfirmAddToPlan}
          onClose={handleCloseAddToPlan}
        />
      )}
    </div>
  );
}
