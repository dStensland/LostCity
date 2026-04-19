import "server-only";

import type { ExploreLaneId, ExploreUtilityView } from "@/lib/explore-platform/types";
import type { ExploreLaneInitialDataMap } from "@/lib/explore-platform/lane-data";
import type { ExploreLaneServerLoaderArgs } from "@/lib/explore-platform/types";
import { getExploreEventsInitialData } from "./events";
import { getExplorePlacesInitialData } from "./places";
import { getExploreClassesInitialData } from "./classes";
import { getExploreShowsInitialData } from "./shows";
import { getExploreRegularsInitialData } from "./regulars";
import { getExploreGameDayInitialData } from "./game-day";
import { getExploreNeighborhoodsInitialData } from "./neighborhoods";

export function resolveExploreLaneFromParams(params: URLSearchParams): {
  lane: ExploreLaneId | null;
  display: ExploreUtilityView;
} {
  const rawLane = params.get("lane");
  const rawDisplay = params.get("display");

  const display: ExploreUtilityView =
    rawDisplay === "map" || rawDisplay === "calendar" ? rawDisplay : "list";

  const lane =
    rawLane === "events" ||
    rawLane === "shows" ||
    rawLane === "game-day" ||
    rawLane === "regulars" ||
    rawLane === "places" ||
    rawLane === "classes" ||
    rawLane === "neighborhoods"
      ? rawLane
      : null;

  return {
    lane,
    display: lane === "events" ? display : "list",
  };
}

export async function loadExploreLaneInitialData(
  lane: ExploreLaneId,
  args: ExploreLaneServerLoaderArgs,
): Promise<ExploreLaneInitialDataMap[ExploreLaneId] | null> {
  switch (lane) {
    case "events":
      return getExploreEventsInitialData(args);
    case "places":
      return getExplorePlacesInitialData(args);
    case "classes":
      return getExploreClassesInitialData(args);
    case "shows":
      return getExploreShowsInitialData(args);
    case "regulars":
      return getExploreRegularsInitialData(args);
    case "game-day":
      return getExploreGameDayInitialData(args);
    case "neighborhoods":
      return getExploreNeighborhoodsInitialData(args);
    default:
      return null;
  }
}
