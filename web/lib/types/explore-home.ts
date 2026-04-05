import type { ExploreHomePayload } from "@/lib/explore-platform/types";

export type LaneState = "alive" | "quiet" | "zero";

export type LaneSlug =
  | "events"
  | "shows"
  | "game-day"
  | "regulars"
  | "places"
  | "classes";

export interface PreviewItem {
  id: number;
  type: "event" | "showtime" | "place" | "regular" | "class";
  title: string;
  subtitle: string;
  image_url: string | null;
  metadata: string;
  detail_url: string;
}

export interface LanePreview {
  state: LaneState;
  count: number;
  count_today: number | null;
  count_weekend: number | null;
  copy: string;
  /** @deprecated Retained as optional for ExploreHomeSection (Task 9 removal). */
  items?: PreviewItem[];
}

export type ExploreHomeResponse = ExploreHomePayload;
