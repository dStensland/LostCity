import type React from "react";
import {
  Palette,
  ForkKnife,
  MoonStars,
  Tree,
  MusicNotes,
  Ticket,
} from "@phosphor-icons/react";

export type VerticalLane =
  | "arts"
  | "dining"
  | "nightlife"
  | "outdoors"
  | "music"
  | "entertainment";

// -------------------------------------------------------------------------
// Shared lane order — used by FindView and FindSidebar
// -------------------------------------------------------------------------

export const DEFAULT_LANE_ORDER: VerticalLane[] = [
  "arts",
  "dining",
  "nightlife",
  "outdoors",
  "music",
  "entertainment",
];

// -------------------------------------------------------------------------
// Shared lane icon map — used by LaneFilterBar, FindSidebar
// -------------------------------------------------------------------------

export const LANE_ICONS: Record<
  string,
  React.ComponentType<{
    size?: number;
    className?: string;
    color?: string;
    style?: React.CSSProperties;
    weight?: "duotone" | "regular" | "bold" | "fill" | "thin" | "light";
  }>
> = {
  palette: Palette,
  "fork-knife": ForkKnife,
  "moon-stars": MoonStars,
  tree: Tree,
  "music-notes": MusicNotes,
  ticket: Ticket,
};

export const LANE_CONFIG: Record<
  VerticalLane,
  { label: string; icon: string; color: string; placeTypes: string[] }
> = {
  arts: {
    label: "Arts & Culture",
    icon: "palette",
    color: "#C9874F",
    placeTypes: ["museum", "gallery", "arts_center", "theater"],
  },
  dining: {
    label: "Eat & Drink",
    icon: "fork-knife",
    color: "#FF6B7A",
    placeTypes: [
      "restaurant",
      "bar",
      "brewery",
      "cocktail_bar",
      "coffee_shop",
      "food_hall",
      "wine_bar",
      "rooftop",
      "lounge",
    ],
  },
  nightlife: {
    label: "Nightlife",
    icon: "moon-stars",
    color: "#E855A0",
    placeTypes: [
      "bar",
      "nightclub",
      "cocktail_bar",
      "lounge",
      "music_venue",
      "comedy_club",
      "karaoke",
      "lgbtq",
    ],
  },
  outdoors: {
    label: "Outdoors",
    icon: "tree",
    color: "#00D9A0",
    placeTypes: ["park", "trail", "recreation", "viewpoint", "landmark"],
  },
  music: {
    label: "Music & Shows",
    icon: "music-notes",
    color: "#A78BFA",
    placeTypes: ["music_venue", "amphitheater", "arena", "stadium"],
  },
  entertainment: {
    label: "Entertainment",
    icon: "ticket",
    color: "#A78BFA",
    placeTypes: [
      "arcade",
      "attraction",
      "entertainment",
      "escape_room",
      "bowling",
      "zoo",
      "aquarium",
      "cinema",
    ],
  },
};
