import type { ExploreHomePayload, ExploreQuickIntent } from "./types";
import { getExploreEditorialPromos } from "./editorial-guides";
import type { LanePreview, LaneSlug } from "@/lib/types/explore-home";

export function getExploreQuickIntents(
  portalSlug: string,
): ExploreQuickIntent[] {
  return [
    {
      id: "tonight",
      label: "Tonight",
      description: "Events happening today.",
      href: `/${portalSlug}/explore?lane=events&date=today`,
    },
    {
      id: "free",
      label: "Free",
      description: "Free events.",
      href: `/${portalSlug}/explore?lane=events&price=free&free=1`,
    },
    {
      id: "near-me",
      label: "Map",
      description: "Open the event map.",
      href: `/${portalSlug}/explore?lane=events&display=map`,
    },
    {
      id: "falcons",
      label: "Falcons",
      description: "Open Game Day for the Falcons.",
      href: `/${portalSlug}/explore?lane=game-day&team=atlanta-falcons`,
    },
    {
      id: "brunch",
      label: "Brunch",
      description: "Browse brunch spots.",
      href: `/${portalSlug}/explore?lane=places&search=brunch`,
    },
    {
      id: "live-music",
      label: "Live Music",
      description: "Open shows filtered to music.",
      href: `/${portalSlug}/explore?lane=shows&tab=music`,
    },
  ];
}

export function buildExploreHomePayload(
  portalSlug: string,
  response: { lanes: Record<LaneSlug, LanePreview> },
): ExploreHomePayload {
  return {
    lanes: response.lanes,
    quickIntents: getExploreQuickIntents(portalSlug),
    editorialPromos: getExploreEditorialPromos(portalSlug),
  };
}
