"use client";

import PlaceFeaturesSection from "@/components/detail/PlaceFeaturesSection";
import type { SectionProps } from "@/lib/detail/types";
import type { PlaceFeature } from "@/lib/place-features";

export function FeaturesSection({ data }: SectionProps) {
  if (data.entityType !== "place") return null;

  const features = data.payload.features as PlaceFeature[];
  if (!features || features.length === 0) return null;

  const spot = data.payload.spot as Record<string, unknown>;
  const venueType = (spot.place_type || spot.spot_type) as string | null | undefined;

  return <PlaceFeaturesSection features={features} venueType={venueType} />;
}
