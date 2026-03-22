"use client";

import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  PaintBrush,
  Image,
  TreePalm,
  FilmSlate,
  Compass,
  Star,
} from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Section config per venue type (client-only — uses Phosphor icon components)
// ---------------------------------------------------------------------------

export type FeatureSectionConfig = {
  title: string;
  Icon: ComponentType<IconProps>;
  color: string;
};

export const FEATURE_SECTION_CONFIG: Record<string, FeatureSectionConfig> = {
  museum: { title: "What's Here", Icon: PaintBrush, color: "#F472B6" },
  gallery: { title: "Current Exhibition", Icon: Image, color: "#A78BFA" },
  park: { title: "Things to Do", Icon: TreePalm, color: "#4ADE80" },
  cinema: { title: "Now Playing", Icon: FilmSlate, color: "#FBBF24" },
  theater: { title: "Now Playing", Icon: FilmSlate, color: "#FBBF24" },
  historic_site: { title: "Points of Interest", Icon: Compass, color: "#38BDF8" },
};

const DEFAULT_CONFIG: FeatureSectionConfig = {
  title: "Features & Attractions",
  Icon: Star,
  color: "#FB923C",
};

export function getFeatureSectionConfig(
  venueType: string | null | undefined
): FeatureSectionConfig {
  if (venueType && FEATURE_SECTION_CONFIG[venueType]) {
    return FEATURE_SECTION_CONFIG[venueType];
  }
  return DEFAULT_CONFIG;
}
