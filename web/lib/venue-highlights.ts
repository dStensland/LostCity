import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  Binoculars,
  Columns,
  Scroll,
  PaintBrush,
  Leaf,
  Aperture,
  Diamond,
} from "@phosphor-icons/react";

export type HighlightType =
  | "viewpoint"
  | "architecture"
  | "history"
  | "art"
  | "nature"
  | "photo_spot"
  | "hidden_feature";

export type VenueHighlight = {
  id: number;
  highlight_type: HighlightType;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
};

export const HIGHLIGHT_CONFIG: Record<
  HighlightType,
  { Icon: ComponentType<IconProps>; label: string; color: string }
> = {
  viewpoint: { Icon: Binoculars, label: "Scenic View", color: "#38BDF8" },
  architecture: { Icon: Columns, label: "Architecture", color: "#A78BFA" },
  history: { Icon: Scroll, label: "Historic", color: "#FBBF24" },
  art: { Icon: PaintBrush, label: "Art", color: "#F472B6" },
  nature: { Icon: Leaf, label: "Nature", color: "#4ADE80" },
  photo_spot: { Icon: Aperture, label: "Photo Spot", color: "#FB923C" },
  hidden_feature: { Icon: Diamond, label: "Hidden Gem", color: "#C084FC" },
};
