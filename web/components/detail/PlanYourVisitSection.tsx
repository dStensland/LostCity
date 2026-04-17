"use client";

import { memo } from "react";
import { Ticket, Clock, CheckCircle } from "@phosphor-icons/react";
import type { PlaceProfile, PlaceGoogleDetails } from "@/lib/types/places";

interface PlanYourVisitSectionProps {
  placeProfile: PlaceProfile | null;
  googleData: PlaceGoogleDetails | null;
}

function formatVerifiedDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function deriveAdmissionText(priceLevel: number | null | undefined): string {
  if (priceLevel === null || priceLevel === undefined) return "Check website";
  if (priceLevel === 0) return "Free";
  if (priceLevel === 1) return "$";
  if (priceLevel === 2) return "$$";
  if (priceLevel === 3) return "$$$";
  if (priceLevel === 4) return "$$$$";
  return "Check website";
}

function deriveDurationText(planningNotes: string | null | undefined): string {
  if (!planningNotes) return "2–3 hours";
  // Look for patterns like "1-2 hours", "90 minutes", "about 3 hours", "2–3 hrs"
  const match = planningNotes.match(
    /\b(\d+[\u20131\-]?\d*)\s*(?:to|[-\u2013])?\s*(?:\d+\s*)?(?:hour|hr|minute|min)s?\b/i
  );
  if (match) {
    return match[0].replace(/\s+/g, " ").trim();
  }
  return "2–3 hours";
}

function hasRelevantData(
  placeProfile: PlaceProfile | null,
  googleData: PlaceGoogleDetails | null
): boolean {
  if (!placeProfile) return false;
  return (
    placeProfile.planning_notes != null ||
    placeProfile.planning_last_verified_at != null ||
    (googleData?.price_level != null)
  );
}

export const PlanYourVisitSection = memo(function PlanYourVisitSection({
  placeProfile,
  googleData,
}: PlanYourVisitSectionProps) {
  if (!hasRelevantData(placeProfile, googleData)) return null;

  const admissionText = deriveAdmissionText(googleData?.price_level);
  const durationText = deriveDurationText(placeProfile?.planning_notes);

  // First line of planning_notes as sub-text for admission card
  const planningFirstLine = placeProfile?.planning_notes
    ? placeProfile.planning_notes.split(/\n|\r\n/)[0]?.trim() ?? null
    : null;

  return (
    <div>
      <div className="flex gap-3">
        {/* Admission card */}
        <div className="flex-1 flex flex-col gap-1.5 rounded-lg bg-[var(--dusk)] p-3">
          <Ticket size={16} weight="duotone" style={{ color: "#C9874F" }} aria-hidden="true" />
          <p className="text-2xs font-semibold text-[var(--cream)] uppercase tracking-[0.1em] font-mono">
            Admission
          </p>
          <p className="text-sm font-medium text-[var(--cream)]">{admissionText}</p>
          {planningFirstLine && (
            <p className="text-xs text-[var(--muted)] leading-snug line-clamp-2">
              {planningFirstLine}
            </p>
          )}
        </div>

        {/* Duration card */}
        <div className="flex-1 flex flex-col gap-1.5 rounded-lg bg-[var(--dusk)] p-3">
          <Clock size={16} weight="duotone" style={{ color: "#C9874F" }} aria-hidden="true" />
          <p className="text-2xs font-semibold text-[var(--cream)] uppercase tracking-[0.1em] font-mono">
            Duration
          </p>
          <p className="text-sm font-medium text-[var(--cream)]">{durationText}</p>
          <p className="text-xs text-[var(--muted)]">typical visit</p>
        </div>
      </div>

      {/* Verified date footer */}
      {placeProfile?.planning_last_verified_at && (
        <div className="flex items-center gap-1.5 mt-2">
          <CheckCircle size={12} className="text-[#00D9A0]" aria-hidden="true" />
          <span className="font-mono text-2xs text-[var(--muted)]">
            Last verified {formatVerifiedDate(placeProfile.planning_last_verified_at)}
          </span>
        </div>
      )}
    </div>
  );
});

export type { PlanYourVisitSectionProps };
