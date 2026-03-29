"use client";

import { memo } from "react";
import { Wheelchair } from "@phosphor-icons/react";
import type { PlaceProfile } from "@/lib/types/places";
import { SectionHeader } from "@/components/detail/SectionHeader";

interface AccessibilitySectionProps {
  placeProfile: PlaceProfile | null;
}

function hasAccessibilityData(placeProfile: PlaceProfile | null): boolean {
  if (!placeProfile) return false;
  return (
    placeProfile.wheelchair_accessible != null ||
    placeProfile.family_suitability != null ||
    placeProfile.age_min != null ||
    placeProfile.age_max != null ||
    placeProfile.sensory_notes != null ||
    placeProfile.accessibility_notes != null
  );
}

function buildAgeLabel(ageMin: number | null, ageMax: number | null): string | null {
  if (ageMin == null && ageMax == null) return null;
  if (ageMin != null && ageMax != null) return `Ages ${ageMin}–${ageMax}`;
  if (ageMin != null) return `Ages ${ageMin}+`;
  if (ageMax != null) return `Ages up to ${ageMax}`;
  return null;
}

export const AccessibilitySection = memo(function AccessibilitySection({
  placeProfile,
}: AccessibilitySectionProps) {
  if (!hasAccessibilityData(placeProfile)) return null;

  const ageLabel = buildAgeLabel(
    placeProfile!.age_min,
    placeProfile!.age_max
  );

  const pills: string[] = [];
  if (placeProfile!.wheelchair_accessible === true) pills.push("Wheelchair");
  if (placeProfile!.family_suitability === "yes") pills.push("Family-friendly");
  if (ageLabel) pills.push(ageLabel);

  const proseParts: string[] = [];
  if (placeProfile!.sensory_notes) proseParts.push(placeProfile!.sensory_notes);
  if (placeProfile!.accessibility_notes) proseParts.push(placeProfile!.accessibility_notes);
  const proseText = proseParts.join(" ").trim();

  // Must have at least a pill or prose to render
  if (pills.length === 0 && !proseText) return null;

  return (
    <div>
      <SectionHeader
        title="Accessibility"
        variant="divider"
        rightAction={
          <Wheelchair
            size={16}
            weight="duotone"
            style={{ color: "#A78BFA" }}
            aria-hidden="true"
          />
        }
      />

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {pills.map((pill) => (
            <span
              key={pill}
              className="inline-flex items-center rounded py-1 px-2 text-xs font-medium"
              style={{
                backgroundColor: "rgba(167, 139, 250, 0.10)",
                color: "#A78BFA",
              }}
            >
              {pill === "Wheelchair" ? "♿ " : ""}
              {pill}
            </span>
          ))}
        </div>
      )}

      {proseText && (
        <p className="text-sm text-[var(--soft)] leading-relaxed">{proseText}</p>
      )}
    </div>
  );
});

export type { AccessibilitySectionProps };
