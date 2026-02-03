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
export const CATEGORY_CONFIG = {
  // Event categories
  music: { label: "Music", color: "#F9A8D4" },
  film: { label: "Film", color: "#A5B4FC" },
  comedy: { label: "Comedy", color: "#FCD34D" },
  theater: { label: "Theater", color: "#F0ABFC" },
  art: { label: "Art", color: "#C4B5FD" },
  community: { label: "Community", color: "#6EE7B7" },
  food_drink: { label: "Food & Drink", color: "#FDBA74" },
  sports: { label: "Sports", color: "#7DD3FC" },
  fitness: { label: "Fitness", color: "#5EEAD4" },
  nightlife: { label: "Nightlife", color: "#E879F9" },
  family: { label: "Family", color: "#A78BFA" },
  learning: { label: "Learning", color: "#A8E6CF" },
  dance: { label: "Dance", color: "#F9A8D4" },
  tours: { label: "Tours", color: "#7DD3FC" },
  meetup: { label: "Meetup", color: "#ED1C40" },
  words: { label: "Words", color: "#93C5FD" },
  religious: { label: "Religious", color: "#DDD6FE" },
  markets: { label: "Markets", color: "#FCA5A5" },
  wellness: { label: "Wellness", color: "#99F6E4" },
  gaming: { label: "Gaming", color: "#86EFAC" },
  outdoors: { label: "Outdoors", color: "#BEF264" },
  activism: { label: "Activism", color: "#F87171" },
  other: { label: "Other", color: "#8B8B94" },

  // Spot types
  music_venue: { label: "Music Venue", color: "#F9A8D4" },
  bar: { label: "Bar", color: "#FDBA74" },
  restaurant: { label: "Restaurant", color: "#FB923C" },
  coffee_shop: { label: "Coffee", color: "#D4A574" },
  brewery: { label: "Brewery", color: "#FCD34D" },
  gallery: { label: "Gallery", color: "#C4B5FD" },
  club: { label: "Club", color: "#E879F9" },
  arena: { label: "Arena", color: "#7DD3FC" },
  comedy_club: { label: "Comedy Club", color: "#FCD34D" },
  museum: { label: "Museum", color: "#94A3B8" },
  convention_center: { label: "Convention", color: "#38BDF8" },
  games: { label: "Games", color: "#4ADE80" },
  bookstore: { label: "Bookstore", color: "#93C5FD" },
  library: { label: "Library", color: "#60A5FA" },
  venue: { label: "Venue", color: "#A78BFA" },
  organization: { label: "Organization", color: "#6EE7B7" },
  festival: { label: "Festival", color: "#FBBF24" },
  cinema: { label: "Cinema", color: "#A5B4FC" },
  park: { label: "Park", color: "#86EFAC" },
  garden: { label: "Garden", color: "#4ADE80" },
  outdoor: { label: "Outdoor", color: "#BEF264" },
  food_hall: { label: "Food Hall", color: "#FB923C" },
  farmers_market: { label: "Farmers Market", color: "#FCA5A5" },

  // Extended categories
  haunted: { label: "Haunted", color: "#9333EA" },
  cooking: { label: "Cooking", color: "#F97316" },
  eatertainment: { label: "Eatertainment", color: "#22D3EE" },
  yoga: { label: "Yoga", color: "#A3E635" },
  coworking: { label: "Coworking", color: "#60A5FA" },
  record_store: { label: "Record Store", color: "#EC4899" },
  lgbtq: { label: "LGBTQ+", color: "#F472B6" },
  sports_bar: { label: "Sports Bar", color: "#38BDF8" },
  attraction: { label: "Attraction", color: "#FBBF24" },
  studio: { label: "Studio", color: "#A3E635" },
  cooking_school: { label: "Cooking School", color: "#F97316" },
  community_center: { label: "Community Center", color: "#6EE7B7" },

  // Extended spot types
  college: { label: "College", color: "#60A5FA" },
  university: { label: "University", color: "#60A5FA" },
  healthcare: { label: "Healthcare", color: "#34D399" },
  hospital: { label: "Hospital", color: "#34D399" },
  hotel: { label: "Hotel", color: "#FBBF24" },
  rooftop: { label: "Rooftop", color: "#F472B6" },
  distillery: { label: "Distillery", color: "#D97706" },
  winery: { label: "Winery", color: "#A855F7" },
  church: { label: "Church", color: "#DDD6FE" },
  event_space: { label: "Event Space", color: "#A78BFA" },
  fitness_center: { label: "Fitness Center", color: "#5EEAD4" },
} as const;

export type CategoryType = keyof typeof CATEGORY_CONFIG;

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

// Export helper to get color for a category
export function getCategoryColor(type: string): string {
  return CATEGORY_CONFIG[type as CategoryType]?.color || "#8B8B94";
}

// Export helper to get label for a category
export function getCategoryLabel(type: string): string {
  return CATEGORY_CONFIG[type as CategoryType]?.label || type;
}
