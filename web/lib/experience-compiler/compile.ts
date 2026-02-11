import { VISUAL_PRESETS } from "@/lib/visual-presets";
import { getVerticalTemplate, type VerticalId } from "@/lib/vertical-templates";
import type {
  CompileContext,
  CompiledExperience,
  CompiledSection,
  ExperienceCompilerWarning,
  ExperienceFeedType,
  ExperienceSectionSpec,
  ExperienceSpec,
  PortalType,
} from "./types";

const COMPILER_VERSION = "1.0";

function inferVertical(spec: ExperienceSpec, portalType: PortalType): VerticalId {
  if (spec.vertical) return spec.vertical;

  if (spec.portal_type === "business") return "hotel";
  if (spec.portal_type === "event") return "film";
  if (spec.portal_type === "personal") return "community";

  if (portalType === "business") return "hotel";
  if (portalType === "event") return "film";
  if (portalType === "personal") return "community";

  return "city";
}

function inferFeedType(vertical: VerticalId, requested?: ExperienceFeedType): ExperienceFeedType {
  if (requested) return requested;
  if (vertical === "hotel") return "destination_specials";
  return "standard";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function getUniqueSlug(preferred: string, seen: Set<string>): string {
  const base = slugify(preferred) || "section";
  if (!seen.has(base)) {
    seen.add(base);
    return base;
  }

  let n = 2;
  while (seen.has(`${base}-${n}`)) n += 1;
  const candidate = `${base}-${n}`;
  seen.add(candidate);
  return candidate;
}

function clampInt(value: number | undefined, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function compileSections(
  spec: ExperienceSpec,
  vertical: VerticalId,
  defaultLayout: string,
  defaultItemsPerSection: number,
  warnings: ExperienceCompilerWarning[]
): CompiledSection[] {
  const sourceSections: ExperienceSectionSpec[] = spec.sections && spec.sections.length > 0
    ? spec.sections
    : getVerticalTemplate(vertical).sections.map((s) => ({
      slug: s.slug,
      title: s.title,
      description: s.description,
      section_type: s.section_type,
      auto_filter: s.auto_filter,
    }));

  if (!spec.sections || spec.sections.length === 0) {
    warnings.push({
      code: "sections_defaulted",
      field: "sections",
      message: `No sections provided; compiler used the ${vertical} vertical template sections.`,
    });
  }

  const seen = new Set<string>();

  return sourceSections.map((section, index) => {
    const slug = getUniqueSlug(section.slug || section.title, seen);
    const sectionType = section.section_type || (section.auto_filter ? "auto" : "curated");

    if ((sectionType === "auto" || sectionType === "mixed") && !section.auto_filter) {
      warnings.push({
        code: "auto_section_without_filter",
        field: `sections[${index}].auto_filter`,
        message: `Section "${section.title}" is ${sectionType} without auto_filter; it may render empty.`,
      });
    }

    return {
      slug,
      title: section.title,
      description: section.description,
      section_type: sectionType,
      auto_filter: section.auto_filter,
      layout: section.layout || defaultLayout,
      items_per_row: clampInt(section.items_per_row, 1, 6),
      max_items: clampInt(section.max_items ?? defaultItemsPerSection, 1, 60),
      style: section.style,
      is_visible: section.is_visible ?? true,
      display_order: index,
    };
  });
}

export function compileExperienceSpec(spec: ExperienceSpec, context: CompileContext): CompiledExperience {
  const warnings: ExperienceCompilerWarning[] = [];

  const vertical = inferVertical(spec, context.portalType);
  const template = getVerticalTemplate(vertical);

  const visualPresetId = spec.branding?.visual_preset || template.visual_preset;
  const preset = VISUAL_PRESETS[visualPresetId];

  const filters: Record<string, unknown> = {
    ...(context.existingFilters || {}),
  };

  if (spec.audience?.city) filters.city = spec.audience.city;
  if (spec.audience?.neighborhoods?.length) filters.neighborhoods = spec.audience.neighborhoods;
  if (spec.audience?.categories?.length) filters.categories = spec.audience.categories;
  if (spec.audience?.geo_center) filters.geo_center = spec.audience.geo_center;
  if (spec.audience?.geo_radius_km !== undefined) filters.geo_radius_km = spec.audience.geo_radius_km;

  const branding: Record<string, unknown> = {
    ...(context.existingBranding || {}),
    visual_preset: visualPresetId,
    theme_mode: spec.branding?.theme_mode || preset.theme_mode,
    ...preset.colors,
  };

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
    const value = spec.branding?.[field];
    if (value !== undefined) branding[field] = value;
  }

  if (spec.branding?.header) {
    branding.header = {
      ...(typeof branding.header === "object" && branding.header ? branding.header as Record<string, unknown> : {}),
      ...spec.branding.header,
    };
  }

  if (spec.branding?.ambient) {
    branding.ambient = {
      ...(typeof branding.ambient === "object" && branding.ambient ? branding.ambient as Record<string, unknown> : {}),
      ...spec.branding.ambient,
    };
  }

  if (spec.branding?.component_style) {
    branding.component_style = {
      ...(typeof branding.component_style === "object" && branding.component_style
        ? branding.component_style as Record<string, unknown>
        : {}),
      ...spec.branding.component_style,
    };
  }

  if (spec.branding?.category_colors) {
    branding.category_colors = {
      ...(typeof branding.category_colors === "object" && branding.category_colors
        ? branding.category_colors as Record<string, unknown>
        : {}),
      ...spec.branding.category_colors,
    };
  }

  const settings: Record<string, unknown> = {
    ...(context.existingSettings || {}),
    vertical,
  };

  const existingFeed =
    typeof settings.feed === "object" && settings.feed
      ? settings.feed as Record<string, unknown>
      : {};

  const existingFeedType = typeof existingFeed.feed_type === "string"
    ? existingFeed.feed_type as ExperienceFeedType
    : undefined;
  const existingDefaultLayout = typeof existingFeed.default_layout === "string"
    ? existingFeed.default_layout
    : undefined;
  const existingItemsPerSection =
    typeof existingFeed.items_per_section === "number"
      ? existingFeed.items_per_section
      : undefined;
  const existingHideImages =
    typeof existingFeed.hide_images === "boolean"
      ? existingFeed.hide_images
      : undefined;

  const feedType = inferFeedType(vertical, spec.feed?.feed_type || existingFeedType);
  const defaultLayout = spec.feed?.default_layout || existingDefaultLayout || "vertical";
  const defaultItemsPerSection =
    clampInt(spec.feed?.items_per_section ?? existingItemsPerSection ?? 24, 1, 60) || 24;

  settings.feed = {
    ...existingFeed,
    feed_type: feedType,
    items_per_section: defaultItemsPerSection,
    default_layout: defaultLayout,
    hide_images: spec.feed?.hide_images ?? existingHideImages ?? false,
  };

  if (spec.navigation?.default_view) settings.default_view = spec.navigation.default_view;
  if (spec.navigation?.show_map !== undefined) settings.show_map = spec.navigation.show_map;
  if (spec.navigation?.nav_labels) {
    settings.nav_labels = {
      ...(typeof settings.nav_labels === "object" && settings.nav_labels ? settings.nav_labels as Record<string, unknown> : {}),
      ...spec.navigation.nav_labels,
    };
  }

  settings.experience_compiler = {
    version: COMPILER_VERSION,
    compiled_at: new Date().toISOString(),
    profile: {
      vertical,
      feed_type: feedType,
      source_portal_slug: spec.federation?.source_portal_slug || null,
      subscribe_shared_sources: spec.federation?.subscribe_shared_sources ?? false,
    },
    metadata: spec.metadata || {},
  };

  const sections = compileSections(spec, vertical, defaultLayout, defaultItemsPerSection, warnings);

  return {
    portal: {
      name: spec.name,
      tagline: spec.tagline,
      parent_portal_id: spec.federation?.parent_portal_id,
      filters,
      branding,
      settings,
    },
    sections,
    warnings,
    metadata: {
      vertical,
      visual_preset: visualPresetId,
      feed_type: feedType,
      compiled_at: new Date().toISOString(),
    },
  };
}
