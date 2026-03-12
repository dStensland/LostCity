type HappeningNowCopyArgs = {
  modeLabel: string;
};

type SpotsCopyArgs = {
  activeChipLabel?: string | null;
};

type HighlightsCopyArgs = {
  period: "today" | "week" | "month";
};

export function getFeedEmptyStateCopy() {
  return {
    headline: "Nothing to show here yet",
    subline: "Try the full event feed while we pull together fresh picks for this view.",
    actionLabel: "Browse all events",
  };
}

export function getEventListingEmptyStateCopy() {
  return {
    headline: "No events match this page right now",
    subline: "Try the full event feed for more Atlanta plans happening soon.",
    actionLabel: "Browse all events",
  };
}

export function getSpotsEmptyStateCopy({ activeChipLabel }: SpotsCopyArgs) {
  if (activeChipLabel) {
    return {
      headline: `No places found for '${activeChipLabel}'`,
      subline: "Try a different filter or nearby area to widen the search.",
    };
  }

  return {
    headline: "No places match these filters",
    subline: "Try a different filter or nearby area to widen the search.",
  };
}

export function getHappeningNowEmptyStateCopy({ modeLabel }: HappeningNowCopyArgs) {
  if (modeLabel !== "All of Atlanta") {
    return {
      headline: "Nothing is live in this area right now",
      subline: `Try all of Atlanta or a different filter to find something open near ${modeLabel}.`,
      actionLabel: "Browse upcoming events",
    };
  }

  return {
    headline: "Nothing is live right now",
    subline: "Try upcoming events or check back later tonight for a fresh pulse.",
    actionLabel: "Browse upcoming events",
  };
}

export function getGroupsUnavailableCopy(groupsLabel: string) {
  return {
    headline: `${groupsLabel} aren't live here yet`,
    subline: "Explore events and places while we finish opening this part of the portal.",
    actionLabel: "Explore the portal",
  };
}

export function getTrendingEmptyStateCopy() {
  return {
    headline: "Trending picks are quiet right now",
    subline: "Check back later for what Atlanta is buzzing about this week.",
  };
}

export function getHighlightsEmptyStateCopy({ period }: HighlightsCopyArgs) {
  switch (period) {
    case "today":
      return {
        headline: "Nothing picked for today yet",
        subline: "Try this week's highlights or browse the full event feed.",
      };
    case "week":
      return {
        headline: "Nothing picked for this week yet",
        subline: "Try this month's highlights or browse the full event feed.",
      };
    case "month":
      return {
        headline: "Nothing picked for this month yet",
        subline: "Browse the full event feed while we line up more highlights.",
      };
  }
}
