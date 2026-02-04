"use client";

import { CSSProperties, type ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";

// Phosphor icon imports - using Light weight for neon tube aesthetic
import {
  // Music & Audio
  Waveform,
  VinylRecord,
  SpeakerHigh,
  MusicNotes,

  // Film & Visual
  FilmSlate,
  MonitorPlay,

  // Comedy & Theater
  Smiley,
  MaskHappy,
  Microphone,

  // Art & Creativity
  Palette,
  FrameCorners,
  Bank,

  // Food & Drink
  Martini,
  ForkKnife,
  Coffee,
  BeerBottle,
  Cheers,
  Wine,
  Flask,
  Storefront,
  ShoppingBag,
  CookingPot,

  // Nightlife & Entertainment
  MoonStars,
  DiscoBall,
  GameController,
  ForkKnife as Knife,

  // Sports & Fitness
  Lightning,
  Barbell,
  Trophy,
  Television,

  // Community & Social
  UsersThree,
  UsersFour,
  Handshake,
  Rainbow,
  HandFist,
  Buildings,

  // Learning & Words
  GraduationCap,
  BookOpen,
  Books,
  Laptop,

  // Outdoors & Nature
  Mountains,
  Tree,
  Flower,

  // Tours & Travel
  Compass,
  Bed,

  // Venues & Spaces
  MapPin,
  Sparkle,
  BuildingOffice,
  Warehouse,
  Tent,

  // Religious & Special
  Church,
  Cross,
  Ghost,
  FirstAid,
  CirclesFour,
  Leaf,
} from "@phosphor-icons/react/dist/ssr";

// Unified category/type definitions with colors (same as original)
// Re-export category config and helpers from shared module (usable by both server and client components)
export { CATEGORY_CONFIG, getCategoryColor, getCategoryLabel } from "@/lib/category-config";
export type { CategoryType } from "@/lib/category-config";
import { CATEGORY_CONFIG, type CategoryType } from "@/lib/category-config";

// Map categories to Phosphor icons - curated for urban hip aesthetic
const ICON_MAP: Record<string, ComponentType<IconProps>> = {
  // Music & Audio - sound waves and vinyl for that DJ culture vibe
  music: Waveform,
  music_venue: SpeakerHigh,
  record_store: VinylRecord,

  // Film & Visual - cinematic
  film: FilmSlate,
  cinema: MonitorPlay,

  // Comedy & Theater - expressive
  comedy: Smiley,
  comedy_club: Microphone,
  theater: MaskHappy,

  // Art & Creativity - artsy
  art: Palette,
  gallery: FrameCorners,
  museum: Bank,

  // Food & Drink - craft cocktail culture
  food_drink: Martini,
  restaurant: ForkKnife,
  bar: Cheers,
  coffee_shop: Coffee,
  brewery: BeerBottle,
  winery: Wine,
  distillery: Flask,
  food_hall: Storefront,
  farmers_market: ShoppingBag,
  cooking: CookingPot,
  cooking_school: CookingPot,

  // Nightlife & Entertainment - after dark energy
  nightlife: MoonStars,
  club: DiscoBall,
  dance: MusicNotes,
  gaming: GameController,
  games: GameController,
  eatertainment: Knife,

  // Sports & Fitness - dynamic energy
  sports: Lightning,
  fitness: Barbell,
  fitness_center: Barbell,
  arena: Trophy,
  sports_bar: Television,
  yoga: Leaf,
  studio: Leaf,
  wellness: Leaf,

  // Community & Social - connection
  community: UsersThree,
  meetup: Handshake,
  family: UsersFour,
  community_center: Buildings,
  lgbtq: Rainbow,
  activism: HandFist,
  organization: Buildings,

  // Learning & Words - intellectual
  learning: GraduationCap,
  college: GraduationCap,
  university: GraduationCap,
  words: BookOpen,
  bookstore: BookOpen,
  library: Books,
  coworking: Laptop,

  // Outdoors & Nature - urban escape
  outdoors: Mountains,
  outdoor: Mountains,
  park: Tree,
  garden: Flower,

  // Tours & Travel - exploration
  tours: Compass,
  hotel: Bed,
  rooftop: MoonStars,

  // Venues & Spaces - destinations
  venue: MapPin,
  event_space: Sparkle,
  convention_center: BuildingOffice,
  festival: Tent,
  markets: Warehouse,

  // Religious & Special
  religious: Cross,
  church: Church,
  haunted: Ghost,
  attraction: Ghost,
  healthcare: FirstAid,
  hospital: FirstAid,

  // Default
  other: CirclesFour,
};

type GlowIntensity = "none" | "subtle" | "default" | "intense" | "pulse" | "flicker";

interface Props {
  type: string;
  size?: number;
  className?: string;
  showLabel?: boolean;
  style?: CSSProperties;
  glow?: GlowIntensity;
  /** Use thin weight for maximum neon effect */
  weight?: "thin" | "light" | "regular" | "bold";
}

// Map glow intensity to CSS class
const GLOW_CLASSES: Record<GlowIntensity, string> = {
  none: "",
  subtle: "icon-neon-subtle",
  default: "icon-neon",
  intense: "icon-neon-intense",
  pulse: "icon-neon icon-neon-pulse",
  flicker: "icon-neon icon-neon-flicker",
};

export default function CategoryIcon({
  type,
  size = 20,
  className = "",
  showLabel = false,
  style,
  glow = "default",
  weight = "light",
}: Props) {
  const config = CATEGORY_CONFIG[type as CategoryType];
  const color = config?.color || "#8B8B94";
  const label = config?.label || type;

  const IconComponent = ICON_MAP[type] || ICON_MAP.other || CirclesFour;
  const glowClass = GLOW_CLASSES[glow];

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{ color, ...style }}
    >
      <IconComponent
        size={size}
        weight={weight}
        className={`flex-shrink-0 ${glowClass}`}
      />
      {showLabel && (
        <span className="font-mono text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      )}
    </span>
  );
}

