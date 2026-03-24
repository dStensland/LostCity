// Client-safe utilities for Open Calls
// Import from this file in "use client" components.
// Server-only fetching lives in lib/open-calls.ts

export type {
  OpenCall,
  OpenCallWithOrg,
  CallType,
  CallStatus,
  ConfidenceTier,
} from "@/lib/types/open-calls";

export {
  CALL_TYPE_LABELS,
  CALL_STATUS_LABELS,
  CALL_STATUS_COLORS,
  CONFIDENCE_TIER_LABELS,
  CONFIDENCE_TIER_DESCRIPTIONS,
  isDeadlineSoon,
  formatDeadline,
  formatFee,
} from "@/lib/types/open-calls";

export type { OpenCallsFilters, OpenCallsResult } from "@/lib/open-calls";

// Call type filter options for the filter bar
export const CALL_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "submission", label: "Submission" },
  { value: "residency", label: "Residency" },
  { value: "grant", label: "Grant" },
  { value: "commission", label: "Commission" },
  { value: "exhibition_proposal", label: "Proposal" },
];

// Confidence tier filter options for the filter bar
export const CONFIDENCE_TIER_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "aggregated", label: "Aggregated" },
  { value: "discovered", label: "Discovered" },
];

/**
 * Returns a CSS class for the deadline urgency color.
 * Uses portal-safe semantic tokens only — no hardcoded hex.
 */
export function getDeadlineUrgencyClass(
  deadline: string | null,
  status: string
): string {
  if (!deadline || status !== "open") return "text-[var(--muted)]";

  const now = new Date();
  const d = new Date(deadline + "T12:00:00");
  const daysLeft = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysLeft < 0) return "text-[var(--muted)]";
  // < 7 days: urgent warm-red — use neon-red token (closest semantic token to warm-red #B54A3A)
  if (daysLeft <= 7) return "text-[var(--neon-red)]";
  // < 30 days: copper urgency — use action-primary (portal theme's copper)
  if (daysLeft <= 30) return "text-[var(--action-primary)]";

  return "text-[var(--muted)]";
}
