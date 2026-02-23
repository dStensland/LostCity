/**
 * Feed header admin utilities.
 *
 * Constants, image list, grid mapping, and template variable resolution
 * for the Feed Header Command Center.
 */

import type { FeedHeaderRow, FeedHeaderConditions, LayoutVariant, TextTreatment } from "@/lib/city-pulse/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const TIME_SLOTS = [
  "morning",
  "midday",
  "happy_hour",
  "evening",
  "late_night",
] as const;

export const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export const SLOT_LABELS: Record<string, string> = {
  morning: "Morning",
  midday: "Midday",
  happy_hour: "Happy Hr",
  evening: "Evening",
  late_night: "Late Night",
};

export const DAY_THEMES = [
  "taco_tuesday",
  "wine_wednesday",
  "thirsty_thursday",
  "friday_night",
  "brunch_weekend",
  "saturday_night",
  "sunday_funday",
] as const;

export const WEATHER_SIGNALS = ["rain", "cold", "nice", "hot"] as const;

export const HOLIDAYS = [
  "new_years_day",
  "mlk_day",
  "valentines_day",
  "st_patricks_day",
  "easter",
  "mothers_day",
  "memorial_day",
  "fathers_day",
  "independence_day",
  "labor_day",
  "halloween",
  "veterans_day",
  "thanksgiving",
  "christmas_eve",
  "christmas",
] as const;

export const ICON_OPTIONS = [
  "Coffee",
  "PersonSimpleWalk",
  "Storefront",
  "Tree",
  "SunHorizon",
  "Path",
  "MusicNotes",
  "Martini",
  "ForkKnife",
  "Umbrella",
  "BeerStein",
  "Bank",
  "Egg",
  "CookingPot",
  "SmileyWink",
] as const;

export const TEMPLATE_VARS = [
  "{{display_name}}",
  "{{city_name}}",
  "{{day_theme}}",
  "{{weather_label}}",
  "{{time_label}}",
] as const;

// ---------------------------------------------------------------------------
// Portal images — curated per time slot, all verified + free to use
// ---------------------------------------------------------------------------

export type TimeSlotTag = "morning" | "midday" | "happy_hour" | "evening" | "late_night" | "rain" | "any";

export interface PortalImage {
  path: string;
  label: string;
  slot: TimeSlotTag;
  credit?: string;
}

export const PORTAL_IMAGES: PortalImage[] = [
  // ── Morning ─────────────────────────────────────────────────────────────
  { path: "/portals/atlanta/jackson-st-bridge.jpg", label: "Jackson St Bridge", slot: "morning" },
  { path: "https://images.unsplash.com/photo-1702494600481-043a92b6271e?w=1200&q=80&fit=crop&auto=format", label: "Piedmont Lake", slot: "morning", credit: "Terry Granger / Unsplash" },
  { path: "https://images.unsplash.com/photo-1589414480645-9c552d67f352?w=1200&q=80&fit=crop&auto=format", label: "Piedmont Golden", slot: "morning", credit: "Ben Dutton / Unsplash" },
  { path: "https://images.unsplash.com/photo-1541655446662-baff34d3288a?w=1200&q=80&fit=crop&auto=format", label: "Ponce City Market", slot: "morning", credit: "Ronny Sison / Unsplash" },

  // ── Midday ──────────────────────────────────────────────────────────────
  { path: "https://images.pexels.com/photos/33133734/pexels-photo-33133734.jpeg?w=1200&h=630&fit=crop", label: "ATL Aerial", slot: "midday", credit: "Kelly / Pexels" },
  { path: "https://images.pexels.com/photos/5063779/pexels-photo-5063779.jpeg?w=1200&h=630&fit=crop", label: "Downtown Towers", slot: "midday", credit: "Nate Hovee / Pexels" },
  { path: "https://images.pexels.com/photos/33133744/pexels-photo-33133744.jpeg?w=1200&h=630&fit=crop", label: "MBS Stadium", slot: "midday", credit: "Kelly / Pexels" },
  { path: "https://images.unsplash.com/photo-1506833913194-a9d027e04686?w=1200&q=80&fit=crop&auto=format", label: "Ponce North", slot: "midday", credit: "Thom Milkovic / Unsplash" },
  { path: "/portals/atlanta/skyline-candidate-1.jpg", label: "Skyline Day", slot: "midday" },

  // ── Happy Hour ──────────────────────────────────────────────────────────
  { path: "https://images.unsplash.com/photo-1753744402410-44319f72f8c5?w=1200&q=80&fit=crop&auto=format", label: "Aerial + Ferris", slot: "happy_hour", credit: "Joao Costa / Unsplash" },
  { path: "https://images.pexels.com/photos/11599618/pexels-photo-11599618.jpeg?w=1200&h=630&fit=crop", label: "ATL Sunset", slot: "happy_hour", credit: "Connor McManus / Pexels" },
  { path: "https://images.unsplash.com/photo-1633142253214-3100edb4f670?w=1200&q=80&fit=crop&auto=format", label: "Ponce Neon Sign", slot: "happy_hour", credit: "Richard Mohan / Unsplash" },
  { path: "https://images.unsplash.com/photo-1543171215-1beb7b8b0ecb?w=1200&q=80&fit=crop&auto=format", label: "Atlanta Mural", slot: "happy_hour", credit: "Ronny Sison / Unsplash" },
  { path: "/portals/atlanta/skyline-candidate-2.jpg", label: "Golden Hour", slot: "happy_hour" },

  // ── Evening ─────────────────────────────────────────────────────────────
  { path: "https://images.unsplash.com/photo-1736512642636-423ec6799e76?w=1200&q=80&fit=crop&auto=format", label: "Snow Piedmont", slot: "evening", credit: "Stephen Harlan / Unsplash" },
  { path: "https://images.pexels.com/photos/17056802/pexels-photo-17056802.jpeg?w=1200&h=630&fit=crop", label: "Peachtree District", slot: "evening", credit: "Sara Free / Pexels" },
  { path: "https://images.pexels.com/photos/164400/pexels-photo-164400.jpeg?w=1200&h=630&fit=crop", label: "ATL Panoramic", slot: "evening", credit: "Pexels" },
  { path: "/portals/atlanta/header-bg.jpg", label: "Classic Evening", slot: "evening" },

  // ── Late Night ──────────────────────────────────────────────────────────
  { path: "https://images.unsplash.com/photo-1704223058918-dbfa9b73eea2?w=1200&q=80&fit=crop&auto=format", label: "Aerial Night Glow", slot: "late_night", credit: "Venti Views / Unsplash" },
  { path: "https://images.unsplash.com/photo-1703811096376-1cb9f563961d?w=1200&q=80&fit=crop&auto=format", label: "Highway Night", slot: "late_night", credit: "Venti Views / Unsplash" },
  { path: "https://images.pexels.com/photos/31222634/pexels-photo-31222634.jpeg?w=1200&h=630&fit=crop", label: "B&W Skyline", slot: "late_night", credit: "Dominik Gryzbon / Pexels" },
  { path: "/portals/atlanta/header-bg-skyline.jpg", label: "Night Skyline", slot: "late_night" },

  // ── Rain ────────────────────────────────────────────────────────────────
  { path: "/portals/atlanta/header-bg-rain-crop.jpg", label: "Rain Mood", slot: "rain" },

  // ── Any ─────────────────────────────────────────────────────────────────
  { path: "/portals/atlanta/crown-boa.jpg", label: "Crown (Boa)", slot: "any" },
  { path: "/portals/atlanta/crown-westin.jpg", label: "Crown (Westin)", slot: "any" },
  { path: "/portals/atlanta/crown-altitude.jpg", label: "Crown (Alt)", slot: "any" },
];

/** Get images filtered by time slot, with "any" always included */
export function getImagesForSlot(slot?: string): PortalImage[] {
  if (!slot) return PORTAL_IMAGES;
  return PORTAL_IMAGES.filter((img) => img.slot === slot || img.slot === "any");
}

/** All unique time slot tags for grouping */
export const IMAGE_SLOT_GROUPS: { slot: TimeSlotTag; label: string }[] = [
  { slot: "morning", label: "Morning" },
  { slot: "midday", label: "Midday" },
  { slot: "happy_hour", label: "Happy Hour" },
  { slot: "evening", label: "Evening" },
  { slot: "late_night", label: "Late Night" },
  { slot: "rain", label: "Rain" },
  { slot: "any", label: "General" },
];

// ---------------------------------------------------------------------------
// Accent color swatches
// ---------------------------------------------------------------------------

export const ACCENT_SWATCHES = [
  { value: "var(--coral)", label: "Coral" },
  { value: "var(--gold)", label: "Gold" },
  { value: "var(--neon-magenta)", label: "Magenta" },
  { value: "#4ade80", label: "Green" },
  { value: "#60a5fa", label: "Blue" },
  { value: "#c084fc", label: "Purple" },
  { value: "#fb923c", label: "Orange" },
  { value: "#f87171", label: "Red" },
];

// ---------------------------------------------------------------------------
// Grid cell types
// ---------------------------------------------------------------------------

export type GridCell = {
  day: string;
  slot: string;
  header: FeedHeaderRow | null;
};

// ---------------------------------------------------------------------------
// Grid ↔ header mapping
// ---------------------------------------------------------------------------

/**
 * Find the base (priority 10) header for a given day × slot cell.
 * Base headers have exactly one day in show_on_days and one slot in
 * conditions.time_slots.
 */
export function findHeaderForCell(
  headers: FeedHeaderRow[],
  day: string,
  slot: string
): FeedHeaderRow | null {
  return (
    headers.find(
      (h) =>
        h.priority === 10 &&
        h.show_on_days?.length === 1 &&
        h.show_on_days[0] === day &&
        h.conditions?.time_slots?.length === 1 &&
        h.conditions.time_slots[0] === slot
    ) ?? null
  );
}

/**
 * Get override headers (priority < 10) for a given day × slot.
 * Overrides have weather_signals, holidays, or festivals conditions set.
 */
export function findOverridesForCell(
  headers: FeedHeaderRow[],
  day: string,
  slot: string
): FeedHeaderRow[] {
  return headers.filter((h) => {
    if (h.priority >= 10) return false;
    // Must target this day (or all days)
    const matchesDay = !h.show_on_days || h.show_on_days.includes(day);
    // Must target this slot (or all slots)
    const matchesSlot =
      !h.conditions?.time_slots || h.conditions.time_slots.includes(slot);
    // Must have at least one override condition
    const hasOverrideCondition =
      (h.conditions?.weather_signals?.length ?? 0) > 0 ||
      (h.conditions?.holidays?.length ?? 0) > 0 ||
      h.conditions?.festivals === true;
    return matchesDay && matchesSlot && hasOverrideCondition;
  });
}

/**
 * Classify an override header by its primary type.
 */
export function getOverrideType(
  h: FeedHeaderRow
): "weather" | "holiday" | "festival" | "unknown" {
  if (h.conditions?.weather_signals?.length) return "weather";
  if (h.conditions?.holidays?.length) return "holiday";
  if (h.conditions?.festivals) return "festival";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Template variable resolution (client-side preview)
// ---------------------------------------------------------------------------

export function resolveTemplateVars(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] ?? match;
  });
}

// ---------------------------------------------------------------------------
// Auto-slug
// ---------------------------------------------------------------------------

export function autoSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

// ---------------------------------------------------------------------------
// Build payload from form state
// ---------------------------------------------------------------------------

export type HeaderFormData = {
  name: string;
  slug: string;
  is_active: boolean;
  priority: number;
  schedule_start: string;
  schedule_end: string;
  show_on_days: string[];
  show_after_time: string;
  show_before_time: string;
  conditions: FeedHeaderConditions;
  headline: string;
  subtitle: string;
  hero_image_url: string;
  accent_color: string;
  layout_variant: LayoutVariant | "";
  text_treatment: TextTreatment | "";
  dashboard_cards: Array<{
    id: string;
    label: string;
    icon: string;
    href: string;
    accent?: string;
    value?: string;
    hide_when_empty?: boolean;
    query?: {
      entity: "events" | "venues";
      category?: string;
      venue_type?: string;
      date_filter?: string;
      time_after?: string;
      is_free?: boolean;
      is_open?: boolean;
    };
  }>;
  quick_links: Array<{
    label: string;
    icon: string;
    href: string;
    accent_color: string;
  }>;
  cta_label: string;
  cta_href: string;
  cta_style: "primary" | "ghost";
  suppressed_event_ids: string;
  boosted_event_ids: string;
};

export const EMPTY_FORM: HeaderFormData = {
  name: "",
  slug: "",
  is_active: true,
  priority: 10,
  schedule_start: "",
  schedule_end: "",
  show_on_days: [],
  show_after_time: "",
  show_before_time: "",
  conditions: {},
  headline: "",
  subtitle: "",
  hero_image_url: "",
  accent_color: "",
  layout_variant: "",
  text_treatment: "",
  dashboard_cards: [],
  quick_links: [],
  cta_label: "",
  cta_href: "",
  cta_style: "primary",
  suppressed_event_ids: "",
  boosted_event_ids: "",
};

export function headerToFormData(header: FeedHeaderRow): HeaderFormData {
  return {
    name: header.name,
    slug: header.slug,
    is_active: header.is_active,
    priority: header.priority,
    schedule_start: header.schedule_start || "",
    schedule_end: header.schedule_end || "",
    show_on_days: header.show_on_days || [],
    show_after_time: header.show_after_time || "",
    show_before_time: header.show_before_time || "",
    conditions: header.conditions || {},
    headline: header.headline || "",
    subtitle: header.subtitle || "",
    hero_image_url: header.hero_image_url || "",
    accent_color: header.accent_color || "",
    layout_variant: header.layout_variant || "",
    text_treatment: header.text_treatment || "",
    dashboard_cards: header.dashboard_cards || [],
    quick_links: header.quick_links || [],
    cta_label: header.cta?.label || "",
    cta_href: header.cta?.href || "",
    cta_style: header.cta?.style || "primary",
    suppressed_event_ids: (header.suppressed_event_ids || []).join(", "),
    boosted_event_ids: (header.boosted_event_ids || []).join(", "),
  };
}

export function formDataToPayload(formData: HeaderFormData) {
  const parseIds = (s: string): number[] =>
    s
      .split(",")
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !isNaN(n));

  const cta =
    formData.cta_label && formData.cta_href
      ? {
          label: formData.cta_label,
          href: formData.cta_href,
          style: formData.cta_style,
        }
      : null;

  return {
    name: formData.name,
    slug: formData.slug,
    is_active: formData.is_active,
    priority: formData.priority,
    schedule_start: formData.schedule_start || null,
    schedule_end: formData.schedule_end || null,
    show_on_days: formData.show_on_days.length > 0 ? formData.show_on_days : null,
    show_after_time: formData.show_after_time || null,
    show_before_time: formData.show_before_time || null,
    conditions: formData.conditions,
    headline: formData.headline || null,
    subtitle: formData.subtitle || null,
    hero_image_url: formData.hero_image_url || null,
    accent_color: formData.accent_color || null,
    layout_variant: formData.layout_variant || null,
    text_treatment: formData.text_treatment || null,
    dashboard_cards:
      formData.dashboard_cards.length > 0 ? formData.dashboard_cards : null,
    quick_links:
      formData.quick_links.length > 0 ? formData.quick_links : null,
    cta,
    suppressed_event_ids: parseIds(formData.suppressed_event_ids),
    boosted_event_ids: parseIds(formData.boosted_event_ids),
  };
}
