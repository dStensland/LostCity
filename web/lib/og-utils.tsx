/**
 * Shared utilities for OpenGraph / Twitter image generation.
 * Used by all opengraph-image.tsx and twitter-image.tsx convention files.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const TWITTER_SIZE = { width: 1200, height: 600 } as const;

export const OG_BG_COLOR = "#0D0D10";
export const OG_BRAND_COLOR = "#FF6B6B";
export const OG_CREAM = "#F5F5DC";

export type CategoryStyle = {
  accent: string;
  badgeBg: string;
  gradient: string;
};

export const OG_CATEGORY_STYLES: Record<string, CategoryStyle> = {
  music: {
    accent: "text-[#F9A8D4]",
    badgeBg: "bg-[#F9A8D4]",
    gradient: "bg-[linear-gradient(90deg,_#F9A8D4,_#FF6B6B)]",
  },
  film: {
    accent: "text-[#A5B4FC]",
    badgeBg: "bg-[#A5B4FC]",
    gradient: "bg-[linear-gradient(90deg,_#A5B4FC,_#FF6B6B)]",
  },
  comedy: {
    accent: "text-[#FCD34D]",
    badgeBg: "bg-[#FCD34D]",
    gradient: "bg-[linear-gradient(90deg,_#FCD34D,_#FF6B6B)]",
  },
  theater: {
    accent: "text-[#F0ABFC]",
    badgeBg: "bg-[#F0ABFC]",
    gradient: "bg-[linear-gradient(90deg,_#F0ABFC,_#FF6B6B)]",
  },
  art: {
    accent: "text-[#C4B5FD]",
    badgeBg: "bg-[#C4B5FD]",
    gradient: "bg-[linear-gradient(90deg,_#C4B5FD,_#FF6B6B)]",
  },
  community: {
    accent: "text-[#6EE7B7]",
    badgeBg: "bg-[#6EE7B7]",
    gradient: "bg-[linear-gradient(90deg,_#6EE7B7,_#FF6B6B)]",
  },
  food_drink: {
    accent: "text-[#FDBA74]",
    badgeBg: "bg-[#FDBA74]",
    gradient: "bg-[linear-gradient(90deg,_#FDBA74,_#FF6B6B)]",
  },
  sports: {
    accent: "text-[#7DD3FC]",
    badgeBg: "bg-[#7DD3FC]",
    gradient: "bg-[linear-gradient(90deg,_#7DD3FC,_#FF6B6B)]",
  },
  fitness: {
    accent: "text-[#5EEAD4]",
    badgeBg: "bg-[#5EEAD4]",
    gradient: "bg-[linear-gradient(90deg,_#5EEAD4,_#FF6B6B)]",
  },
  nightlife: {
    accent: "text-[#E879F9]",
    badgeBg: "bg-[#E879F9]",
    gradient: "bg-[linear-gradient(90deg,_#E879F9,_#FF6B6B)]",
  },
  family: {
    accent: "text-[#A78BFA]",
    badgeBg: "bg-[#A78BFA]",
    gradient: "bg-[linear-gradient(90deg,_#A78BFA,_#FF6B6B)]",
  },
  default: {
    accent: "text-[#FF6B6B]",
    badgeBg: "bg-[#FF6B6B]",
    gradient: "bg-[linear-gradient(90deg,_#FF6B6B,_#FF6B6B)]",
  },
};

/** Venue type accent styles for spot OG images. */
export const OG_VENUE_TYPE_STYLES: Record<string, CategoryStyle> = {
  music_venue: {
    accent: "text-[#E855A0]",
    badgeBg: "bg-[#E855A0]",
    gradient: "bg-[linear-gradient(90deg,_#E855A0,_#FF6B6B)]",
  },
  theater: {
    accent: "text-[#A78BFA]",
    badgeBg: "bg-[#A78BFA]",
    gradient: "bg-[linear-gradient(90deg,_#A78BFA,_#FF6B6B)]",
  },
  nightclub: {
    accent: "text-[#00D4E8]",
    badgeBg: "bg-[#00D4E8]",
    gradient: "bg-[linear-gradient(90deg,_#00D4E8,_#FF6B6B)]",
  },
  bar: {
    accent: "text-[#FF6B7A]",
    badgeBg: "bg-[#FF6B7A]",
    gradient: "bg-[linear-gradient(90deg,_#FF6B7A,_#FF6B6B)]",
  },
  restaurant: {
    accent: "text-[#FFD93D]",
    badgeBg: "bg-[#FFD93D]",
    gradient: "bg-[linear-gradient(90deg,_#FFD93D,_#FF6B6B)]",
  },
  brewery: {
    accent: "text-[#FDBA74]",
    badgeBg: "bg-[#FDBA74]",
    gradient: "bg-[linear-gradient(90deg,_#FDBA74,_#FF6B6B)]",
  },
  cocktail_bar: {
    accent: "text-[#E855A0]",
    badgeBg: "bg-[#E855A0]",
    gradient: "bg-[linear-gradient(90deg,_#E855A0,_#FF6B6B)]",
  },
  gallery: {
    accent: "text-[#C4B5FD]",
    badgeBg: "bg-[#C4B5FD]",
    gradient: "bg-[linear-gradient(90deg,_#C4B5FD,_#FF6B6B)]",
  },
  comedy_club: {
    accent: "text-[#FCD34D]",
    badgeBg: "bg-[#FCD34D]",
    gradient: "bg-[linear-gradient(90deg,_#FCD34D,_#FF6B6B)]",
  },
  cinema: {
    accent: "text-[#A5B4FC]",
    badgeBg: "bg-[#A5B4FC]",
    gradient: "bg-[linear-gradient(90deg,_#A5B4FC,_#FF6B6B)]",
  },
};

/** Look up accent style for a venue type, falling back to default. */
export function getVenueTypeOgStyle(venueType: string | null | undefined): CategoryStyle {
  return (venueType && OG_VENUE_TYPE_STYLES[venueType]) || OG_CATEGORY_STYLES.default;
}

/** Look up accent style for a category, falling back to default. */
export function getCategoryOgStyle(category: string | null | undefined): CategoryStyle {
  return (category && OG_CATEGORY_STYLES[category]) || OG_CATEGORY_STYLES.default;
}

/** Standard dark gradient overlay for text readability on images. */
export function ogImageOverlay() {
  return (
    <div
      tw="absolute inset-0 bg-[linear-gradient(to_top,_rgba(13,13,16,0.95)_0%,_rgba(13,13,16,0.7)_50%,_rgba(13,13,16,0.4)_100%)]"
    />
  );
}

/** Fallback card for error states. */
export function ogFallbackCard(message: string, size: { width: number; height: number }) {
  return (
    <div tw={`w-full h-full flex items-center justify-center bg-[${OG_BG_COLOR}] text-[${OG_CREAM}] font-sans`}>
      <span tw="text-[48px]">{message}</span>
    </div>
  );
}

/** Standard "Lost City" footer branding element. */
export function ogFooter(opts?: { light?: boolean }) {
  const footerColor = opts?.light ? "text-[#999999]" : "text-[#555560]";
  return (
    <div tw="flex items-center gap-3">
      <span tw="text-[20px] font-bold text-[#FF6B6B]">Lost City</span>
      <span tw={`text-[16px] ${footerColor}`}>lostcity.ai</span>
    </div>
  );
}
