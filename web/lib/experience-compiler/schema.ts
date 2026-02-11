import { VISUAL_PRESETS, type VisualPresetId } from "@/lib/visual-presets";
import type {
  ExperienceCompilerWarning,
  ExperienceSectionSpec,
  ExperienceSpec,
  ExperienceView,
  ExperienceFeedType,
  PortalType,
  ValidatedExperienceSpec,
} from "./types";
import type { VerticalId } from "@/lib/vertical-templates";

type ValidationSuccess = {
  ok: true;
  value: ValidatedExperienceSpec;
};

type ValidationFailure = {
  ok: false;
  errors: string[];
};

export type ExperienceValidationResult = ValidationSuccess | ValidationFailure;

const VALID_VERTICALS: VerticalId[] = ["city", "hotel", "film", "community"];
const VALID_PORTAL_TYPES: PortalType[] = ["city", "event", "business", "personal"];
const VALID_VIEWS: ExperienceView[] = ["feed", "find", "community"];
const VALID_FEED_TYPES: ExperienceFeedType[] = ["standard", "concierge", "destination_specials"];
const VALID_SECTION_TYPES = ["auto", "curated", "mixed"] as const;
const VALID_LAYOUTS = ["vertical", "horizontal", "grid", "masonry", "timeline"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asTrimmedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function normalizeStringArray(value: unknown, maxItems = 24): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const normalized = asTrimmedString(item, 64);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }

  return result.length ? result : undefined;
}

function normalizeGeoCenter(value: unknown): [number, number] | undefined {
  if (Array.isArray(value) && value.length === 2) {
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return undefined;
  }

  if (!isRecord(value)) return undefined;

  const lat = Number(value.lat);
  const lng = Number(value.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

  return [lat, lng];
}

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSection(input: unknown, index: number, errors: string[]): ExperienceSectionSpec | null {
  if (!isRecord(input)) {
    errors.push(`sections[${index}] must be an object`);
    return null;
  }

  const title = asTrimmedString(input.title, 100);
  if (!title) {
    errors.push(`sections[${index}].title is required`);
    return null;
  }

  const sectionTypeRaw = asTrimmedString(input.section_type, 16);
  const sectionType = sectionTypeRaw && VALID_SECTION_TYPES.includes(sectionTypeRaw as (typeof VALID_SECTION_TYPES)[number])
    ? sectionTypeRaw as (typeof VALID_SECTION_TYPES)[number]
    : undefined;

  if (sectionTypeRaw && !sectionType) {
    errors.push(`sections[${index}].section_type must be auto, curated, or mixed`);
    return null;
  }

  const layoutRaw = asTrimmedString(input.layout, 16);
  if (layoutRaw && !VALID_LAYOUTS.includes(layoutRaw as (typeof VALID_LAYOUTS)[number])) {
    errors.push(`sections[${index}].layout must be one of: ${VALID_LAYOUTS.join(", ")}`);
    return null;
  }

  const itemsPerRow = clampNumber(input.items_per_row, 1, 6);
  const maxItems = clampNumber(input.max_items, 1, 60);

  const autoFilter = isRecord(input.auto_filter) ? input.auto_filter : undefined;
  const style = isRecord(input.style) ? input.style : undefined;

  return {
    slug: asTrimmedString(input.slug, 100),
    title,
    description: asTrimmedString(input.description, 240),
    section_type: sectionType,
    auto_filter: autoFilter,
    layout: layoutRaw,
    items_per_row: itemsPerRow,
    max_items: maxItems,
    style,
    is_visible: typeof input.is_visible === "boolean" ? input.is_visible : undefined,
  };
}

export function validateExperienceSpec(input: unknown): ExperienceValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Experience spec must be an object"] };
  }

  const spec: ExperienceSpec = {};
  const warnings: ExperienceCompilerWarning[] = [];
  const errors: string[] = [];

  const name = asTrimmedString(input.name, 120);
  if (input.name !== undefined && !name) {
    errors.push("name must be a non-empty string");
  } else if (name) {
    spec.name = name;
  }

  const tagline = asTrimmedString(input.tagline, 240);
  if (input.tagline !== undefined && !tagline) {
    errors.push("tagline must be a non-empty string");
  } else if (tagline) {
    spec.tagline = tagline;
  }

  const portalType = asTrimmedString(input.portal_type, 32);
  if (portalType && VALID_PORTAL_TYPES.includes(portalType as PortalType)) {
    spec.portal_type = portalType as PortalType;
  } else if (input.portal_type !== undefined) {
    errors.push(`portal_type must be one of: ${VALID_PORTAL_TYPES.join(", ")}`);
  }

  const vertical = asTrimmedString(input.vertical, 32);
  if (vertical && VALID_VERTICALS.includes(vertical as VerticalId)) {
    spec.vertical = vertical as VerticalId;
  } else if (input.vertical !== undefined) {
    errors.push(`vertical must be one of: ${VALID_VERTICALS.join(", ")}`);
  }

  if (isRecord(input.audience)) {
    const audience: NonNullable<ExperienceSpec["audience"]> = {};

    const city = asTrimmedString(input.audience.city, 80);
    if (city) audience.city = city;

    const neighborhoods = normalizeStringArray(input.audience.neighborhoods, 32);
    if (neighborhoods) audience.neighborhoods = neighborhoods;

    const categories = normalizeStringArray(input.audience.categories, 32);
    if (categories) audience.categories = categories;

    const center = normalizeGeoCenter(input.audience.geo_center);
    if (input.audience.geo_center !== undefined && !center) {
      errors.push("audience.geo_center must be [lat, lng] or { lat, lng }");
    } else if (center) {
      const [lat, lng] = center;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        errors.push("audience.geo_center coordinates are out of range");
      } else {
        audience.geo_center = center;
      }
    }

    const radius = clampNumber(input.audience.geo_radius_km, 0.5, 100);
    if (input.audience.geo_radius_km !== undefined && radius === undefined) {
      errors.push("audience.geo_radius_km must be numeric");
    } else if (radius !== undefined) {
      audience.geo_radius_km = radius;
    }

    if (Object.keys(audience).length > 0) {
      spec.audience = audience;
    }
  } else if (input.audience !== undefined) {
    errors.push("audience must be an object");
  }

  if (isRecord(input.navigation)) {
    const navigation: NonNullable<ExperienceSpec["navigation"]> = {};

    const defaultView = asTrimmedString(input.navigation.default_view, 24);
    if (defaultView && VALID_VIEWS.includes(defaultView as ExperienceView)) {
      navigation.default_view = defaultView as ExperienceView;
    } else if (input.navigation.default_view !== undefined) {
      errors.push(`navigation.default_view must be one of: ${VALID_VIEWS.join(", ")}`);
    }

    if (typeof input.navigation.show_map === "boolean") {
      navigation.show_map = input.navigation.show_map;
    }

    if (isRecord(input.navigation.nav_labels)) {
      const navLabels: { feed?: string; events?: string; spots?: string } = {};
      const feed = asTrimmedString(input.navigation.nav_labels.feed, 32);
      const events = asTrimmedString(input.navigation.nav_labels.events, 32);
      const spots = asTrimmedString(input.navigation.nav_labels.spots, 32);

      if (feed) navLabels.feed = feed;
      if (events) navLabels.events = events;
      if (spots) navLabels.spots = spots;

      if (Object.keys(navLabels).length > 0) navigation.nav_labels = navLabels;
    }

    if (Object.keys(navigation).length > 0) {
      spec.navigation = navigation;
    }
  } else if (input.navigation !== undefined) {
    errors.push("navigation must be an object");
  }

  if (isRecord(input.feed)) {
    const feed: NonNullable<ExperienceSpec["feed"]> = {};

    const feedType = asTrimmedString(input.feed.feed_type, 32);
    if (feedType && VALID_FEED_TYPES.includes(feedType as ExperienceFeedType)) {
      feed.feed_type = feedType as ExperienceFeedType;
    } else if (input.feed.feed_type !== undefined) {
      errors.push(`feed.feed_type must be one of: ${VALID_FEED_TYPES.join(", ")}`);
    }

    const itemsPerSection = clampNumber(input.feed.items_per_section, 1, 60);
    if (input.feed.items_per_section !== undefined && itemsPerSection === undefined) {
      errors.push("feed.items_per_section must be numeric");
    } else if (itemsPerSection !== undefined) {
      feed.items_per_section = itemsPerSection;
    }

    const layout = asTrimmedString(input.feed.default_layout, 24);
    if (layout && VALID_LAYOUTS.includes(layout as (typeof VALID_LAYOUTS)[number])) {
      feed.default_layout = layout as NonNullable<ExperienceSpec["feed"]>["default_layout"];
    } else if (input.feed.default_layout !== undefined) {
      errors.push(`feed.default_layout must be one of: ${VALID_LAYOUTS.join(", ")}`);
    }

    if (typeof input.feed.hide_images === "boolean") {
      feed.hide_images = input.feed.hide_images;
    }

    if (Object.keys(feed).length > 0) {
      spec.feed = feed;
    }
  } else if (input.feed !== undefined) {
    errors.push("feed must be an object");
  }

  if (isRecord(input.branding)) {
    const branding: NonNullable<ExperienceSpec["branding"]> = {};

    const visualPreset = asTrimmedString(input.branding.visual_preset, 40);
    if (visualPreset && (visualPreset in VISUAL_PRESETS)) {
      branding.visual_preset = visualPreset as VisualPresetId;
    } else if (input.branding.visual_preset !== undefined) {
      errors.push(`branding.visual_preset must be one of: ${Object.keys(VISUAL_PRESETS).join(", ")}`);
    }

    const themeMode = asTrimmedString(input.branding.theme_mode, 8);
    if (themeMode === "light" || themeMode === "dark") {
      branding.theme_mode = themeMode;
    } else if (input.branding.theme_mode !== undefined) {
      errors.push("branding.theme_mode must be light or dark");
    }

    const brandingFields = [
      "primary_color",
      "secondary_color",
      "accent_color",
      "background_color",
      "text_color",
      "muted_color",
      "button_color",
      "button_text_color",
      "border_color",
      "card_color",
      "logo_url",
      "hero_image_url",
      "favicon_url",
      "og_image_url",
      "font_heading",
      "font_body",
    ] as const;

    for (const field of brandingFields) {
      const value = asTrimmedString(input.branding[field], 240);
      if (value) {
        branding[field] = value;
      }
    }

    if (isRecord(input.branding.header)) {
      branding.header = input.branding.header;
    }
    if (isRecord(input.branding.ambient)) {
      branding.ambient = input.branding.ambient;
    }
    if (isRecord(input.branding.component_style)) {
      branding.component_style = input.branding.component_style;
    }
    if (isRecord(input.branding.category_colors)) {
      branding.category_colors = Object.fromEntries(
        Object.entries(input.branding.category_colors)
          .filter(([key, value]) => typeof key === "string" && typeof value === "string")
          .map(([key, value]) => [key.trim(), String(value).trim()])
      );
    }

    if (Object.keys(branding).length > 0) {
      spec.branding = branding;
    }
  } else if (input.branding !== undefined) {
    errors.push("branding must be an object");
  }

  if (Array.isArray(input.sections)) {
    if (input.sections.length > 40) {
      errors.push("sections cannot exceed 40 items");
    } else {
      const sections: ExperienceSectionSpec[] = [];
      for (let i = 0; i < input.sections.length; i += 1) {
        const normalized = normalizeSection(input.sections[i], i, errors);
        if (normalized) sections.push(normalized);
      }
      if (sections.length > 0) {
        spec.sections = sections;
      }
    }
  } else if (input.sections !== undefined) {
    errors.push("sections must be an array");
  }

  if (isRecord(input.federation)) {
    const federation: NonNullable<ExperienceSpec["federation"]> = {};

    const parentPortalId = asTrimmedString(input.federation.parent_portal_id, 64);
    const sourcePortalSlug = asTrimmedString(input.federation.source_portal_slug, 80);

    if (parentPortalId) federation.parent_portal_id = parentPortalId;
    if (sourcePortalSlug) federation.source_portal_slug = sourcePortalSlug;

    if (typeof input.federation.subscribe_shared_sources === "boolean") {
      federation.subscribe_shared_sources = input.federation.subscribe_shared_sources;
    }

    if (Object.keys(federation).length > 0) {
      spec.federation = federation;
      if (federation.source_portal_slug && !federation.parent_portal_id) {
        warnings.push({
          code: "source_slug_without_parent",
          field: "federation.source_portal_slug",
          message: "source_portal_slug provided without parent_portal_id; source sharing setup may require explicit parent_portal_id.",
        });
      }
    }
  } else if (input.federation !== undefined) {
    errors.push("federation must be an object");
  }

  if (isRecord(input.metadata)) {
    spec.metadata = input.metadata;
  } else if (input.metadata !== undefined) {
    errors.push("metadata must be an object");
  }

  if (!spec.vertical && !spec.portal_type) {
    warnings.push({
      code: "vertical_inferred",
      field: "vertical",
      message: "No vertical provided; compiler will infer a vertical from the portal type.",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { spec, warnings } };
}
