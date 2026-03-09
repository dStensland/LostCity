/**
 * Portal-configurable copy strings for the Outing Planner.
 * Adapts terminology per vertical — no DB changes needed.
 */

type PortalVertical = "city" | "hotel" | "film" | "hospital" | "community" | "marketplace" | "dog";

export interface OutingCopy {
  sheetTitle: string;
  subtitle: (venueName?: string) => string;
  beforeLabel: string | ((category?: string | null) => string);
  afterLabel: string | ((category?: string | null) => string);
  anchorBadge: string;
  emptyTitle: string;
  emptySubtitle: string;
  addPrompt: string;
  shareTitle: string;
  planButton: string;
}

/** Resolve a label that may be a function (category-aware) or a plain string */
export function resolveLabel(
  label: string | ((category?: string | null) => string),
  category?: string | null,
): string {
  return typeof label === "function" ? label(category) : label;
}

const COPY_BY_VERTICAL: Record<PortalVertical, OutingCopy> = {
  city: {
    sheetTitle: "Make a Night of It",
    subtitle: (v) => v ? `Spots near ${v}` : "Nearby spots to round out your evening",
    beforeLabel: (cat) => {
      if (cat === "sports") return "Before the Game";
      if (cat === "film") return "Before the Screening";
      if (cat === "community" || cat === "networking" || cat === "education") return "Before";
      if (cat === "festival") return "Before the Festival";
      return "Before the Show";
    },
    afterLabel: (cat) => {
      if (cat === "sports") return "After the Game";
      if (cat === "film") return "After the Screening";
      if (cat === "community" || cat === "networking" || cat === "education") return "After";
      if (cat === "festival") return "After the Festival";
      return "After the Show";
    },
    anchorBadge: "Your Event",
    emptyTitle: "Nothing found nearby",
    emptySubtitle: "Browse all nearby spots instead",
    addPrompt: "Tap + to start building your evening",
    shareTitle: "Share Your Outing",
    planButton: "Plan an Evening Here",
  },
  hotel: {
    sheetTitle: "Your Evening Plan",
    subtitle: (v) => v ? `Near ${v}` : "Curated spots for your evening",
    beforeLabel: "Start Your Evening",
    afterLabel: "Wind Down",
    anchorBadge: "Your Reservation",
    emptyTitle: "No suggestions available",
    emptySubtitle: "Ask the concierge for recommendations",
    addPrompt: "Tap + to build your evening itinerary",
    shareTitle: "Share Your Plan",
    planButton: "Plan Your Evening",
  },
  film: {
    sheetTitle: "Your Festival Day",
    subtitle: (v) => v ? `Near ${v}` : "Make the most of your screening day",
    beforeLabel: "Before the Screening",
    afterLabel: "After the Screening",
    anchorBadge: "Your Screening",
    emptyTitle: "Nothing found nearby",
    emptySubtitle: "Check the festival map for options",
    addPrompt: "Tap + to plan around your screening",
    shareTitle: "Share Your Day",
    planButton: "Plan Around This Screening",
  },
  hospital: {
    sheetTitle: "Plan Your Visit",
    subtitle: (v) => v ? `Near ${v}` : "Nearby options around your visit",
    beforeLabel: "Before Your Visit",
    afterLabel: "After Your Visit",
    anchorBadge: "Your Appointment",
    emptyTitle: "Nothing found nearby",
    emptySubtitle: "Browse nearby spots",
    addPrompt: "Tap + to plan around your visit",
    shareTitle: "Share Plan",
    planButton: "Plan Around Your Visit",
  },
  community: {
    sheetTitle: "Make a Night of It",
    subtitle: (v) => v ? `Spots near ${v}` : "Nearby spots",
    beforeLabel: "Before",
    afterLabel: "After",
    anchorBadge: "Your Event",
    emptyTitle: "Nothing found nearby",
    emptySubtitle: "Browse all nearby spots",
    addPrompt: "Tap + to start planning",
    shareTitle: "Share Your Outing",
    planButton: "Plan an Outing Here",
  },
  marketplace: {
    sheetTitle: "Make a Night of It",
    subtitle: (v) => v ? `Spots near ${v}` : "Nearby spots",
    beforeLabel: "Before",
    afterLabel: "After",
    anchorBadge: "Your Event",
    emptyTitle: "Nothing found nearby",
    emptySubtitle: "Browse all nearby spots",
    addPrompt: "Tap + to start planning",
    shareTitle: "Share Your Outing",
    planButton: "Plan an Outing Here",
  },
  dog: {
    sheetTitle: "Plan Your Outing",
    subtitle: (v) => v ? `Near ${v}` : "Dog-friendly spots nearby",
    beforeLabel: "Before",
    afterLabel: "After",
    anchorBadge: "Your Spot",
    emptyTitle: "Nothing found nearby",
    emptySubtitle: "Browse nearby dog-friendly spots",
    addPrompt: "Tap + to plan your outing",
    shareTitle: "Share Your Outing",
    planButton: "Plan an Outing Here",
  },
};

export function getOutingCopy(vertical?: PortalVertical | string): OutingCopy {
  return COPY_BY_VERTICAL[(vertical as PortalVertical) || "city"] || COPY_BY_VERTICAL.city;
}
