"use client";

import { PlanYourVisitSection as PlanYourVisit } from "@/components/detail/PlanYourVisitSection";
import { AccessibilitySection } from "@/components/detail/AccessibilitySection";
import type { SectionProps } from "@/lib/detail/types";
import type { PlaceProfile, PlaceGoogleDetails } from "@/lib/types/places";

export function PlanYourVisitSection({ data }: SectionProps) {
  if (data.entityType !== "place") return null;

  const placeProfile = data.payload.placeProfile as PlaceProfile | null;
  const googleData = data.payload.placeVerticalDetails?.google as PlaceGoogleDetails | null;

  const hasPlanData =
    placeProfile?.planning_notes != null ||
    placeProfile?.planning_last_verified_at != null ||
    googleData?.price_level != null;

  const hasAccessibilityData =
    placeProfile != null &&
    (placeProfile.wheelchair_accessible != null ||
      placeProfile.family_suitability != null ||
      placeProfile.age_min != null ||
      placeProfile.age_max != null ||
      placeProfile.sensory_notes != null ||
      placeProfile.accessibility_notes != null);

  if (!hasPlanData && !hasAccessibilityData) return null;

  return (
    <div className="space-y-6">
      {hasPlanData && (
        <PlanYourVisit placeProfile={placeProfile} googleData={googleData} />
      )}
      {hasAccessibilityData && (
        <AccessibilitySection placeProfile={placeProfile} />
      )}
    </div>
  );
}
