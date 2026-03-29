"use client";

import { memo } from "react";
import type { DiscoveryEntity, DiscoveryPlaceEntity } from "@/lib/types/discovery";
import { CompactDiningCard } from "./CompactDiningCard";
import { CompactArtsCard } from "./CompactArtsCard";
import { CompactOutdoorCard } from "./CompactOutdoorCard";
import { CompactNightlifeCard } from "./CompactNightlifeCard";
import { CompactEventCard } from "./CompactEventCard";

// -------------------------------------------------------------------------
// Place type routing sets
// -------------------------------------------------------------------------

const ARTS_PLACE_TYPES = new Set([
  "museum",
  "gallery",
  "arts_center",
  "theater",
  "studio",
]);

const OUTDOOR_PLACE_TYPES = new Set([
  "park",
  "trail",
  "recreation",
  "viewpoint",
  "landmark",
  "garden",
  "outdoor",
]);

// Exclusively nightlife — not shared with dining
const NIGHTLIFE_EXCLUSIVE_TYPES = new Set([
  "nightclub",
  "comedy_club",
  "karaoke",
  "lgbtq",
]);

// -------------------------------------------------------------------------
// PlaceCardDispatcher — renders the correct card for a place entity
// Separated from DiscoveryCard to avoid creating components during render.
// -------------------------------------------------------------------------

interface PlaceCardDispatcherProps {
  entity: DiscoveryPlaceEntity;
  portalSlug: string;
  lane?: string;
}

const PlaceCardDispatcher = memo(function PlaceCardDispatcher({
  entity,
  portalSlug,
  lane,
}: PlaceCardDispatcherProps) {
  const { place_type: pt } = entity;

  if (ARTS_PLACE_TYPES.has(pt)) {
    return <CompactArtsCard entity={entity} portalSlug={portalSlug} />;
  }
  if (OUTDOOR_PLACE_TYPES.has(pt)) {
    return <CompactOutdoorCard entity={entity} portalSlug={portalSlug} />;
  }
  if (NIGHTLIFE_EXCLUSIVE_TYPES.has(pt) || lane === "nightlife") {
    return <CompactNightlifeCard entity={entity} portalSlug={portalSlug} />;
  }
  // Default: dining card handles all food/drink place types plus unknown
  return <CompactDiningCard entity={entity} portalSlug={portalSlug} />;
});

// -------------------------------------------------------------------------
// DiscoveryCard dispatcher
// -------------------------------------------------------------------------

interface DiscoveryCardProps {
  entity: DiscoveryEntity;
  portalSlug: string;
  /** Vertical lane hint — used to disambiguate shared place types (e.g. "bar" in nightlife vs dining) */
  lane?: string;
}

export const DiscoveryCard = memo(function DiscoveryCard({
  entity,
  portalSlug,
  lane,
}: DiscoveryCardProps) {
  if (entity.entity_type === "event") {
    return <CompactEventCard entity={entity} portalSlug={portalSlug} />;
  }

  return (
    <PlaceCardDispatcher entity={entity} portalSlug={portalSlug} lane={lane} />
  );
});

export type { DiscoveryCardProps };
