"use client";

import { DiningDetailsSection } from "@/components/detail/DiningDetailsSection";
import type { SectionProps } from "@/lib/detail/types";
import type { PlaceDiningDetails, PlaceProfile } from "@/lib/types/places";

export function DiningSection({ data }: SectionProps) {
  if (data.entityType !== "place") return null;

  const diningData = data.payload.placeVerticalDetails?.dining as PlaceDiningDetails | null;
  if (!diningData) return null;

  const placeProfile = data.payload.placeProfile as PlaceProfile | null;

  return <DiningDetailsSection diningData={diningData} placeProfile={placeProfile} />;
}
