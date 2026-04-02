export type LaneState = "alive" | "quiet" | "zero";

export type LaneSlug =
  | "events"
  | "shows"
  | "regulars"
  | "places"
  | "classes"
  | "calendar"
  | "map";

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
  items: PreviewItem[];
}

export interface ExploreHomeResponse {
  lanes: Record<LaneSlug, LanePreview>;
}
