import type { VisualPresetId, HeaderConfig, AmbientConfig, ComponentStyleConfig } from "@/lib/visual-presets";
import type { VerticalId } from "@/lib/vertical-templates";

export type ExperienceView = "feed" | "find" | "community";
export type ExperienceFeedType = "standard" | "concierge" | "destination_specials";
export type ExperienceSectionType = "auto" | "curated" | "mixed";

export type PortalType = "city" | "event" | "business" | "personal";

export type ExperienceAudienceSpec = {
  city?: string;
  neighborhoods?: string[];
  categories?: string[];
  geo_center?: [number, number]; // [lat, lng]
  geo_radius_km?: number;
};

export type ExperienceNavigationSpec = {
  default_view?: ExperienceView;
  show_map?: boolean;
  nav_labels?: {
    feed?: string;
    events?: string;
    spots?: string;
  };
};

export type ExperienceFeedSpec = {
  feed_type?: ExperienceFeedType;
  items_per_section?: number;
  default_layout?: "vertical" | "horizontal" | "grid" | "masonry" | "timeline";
  hide_images?: boolean;
};

export type ExperienceBrandingSpec = {
  visual_preset?: VisualPresetId;
  theme_mode?: "light" | "dark";
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  muted_color?: string;
  button_color?: string;
  button_text_color?: string;
  border_color?: string;
  card_color?: string;
  logo_url?: string;
  hero_image_url?: string;
  favicon_url?: string;
  og_image_url?: string;
  font_heading?: string;
  font_body?: string;
  header?: Partial<HeaderConfig>;
  ambient?: Partial<AmbientConfig>;
  component_style?: Partial<ComponentStyleConfig>;
  category_colors?: Record<string, string>;
};

export type ExperienceSectionSpec = {
  slug?: string;
  title: string;
  description?: string;
  section_type?: ExperienceSectionType;
  auto_filter?: Record<string, unknown>;
  layout?: string;
  items_per_row?: number;
  max_items?: number;
  style?: Record<string, unknown>;
  is_visible?: boolean;
};

export type ExperienceFederationSpec = {
  parent_portal_id?: string;
  source_portal_slug?: string;
  subscribe_shared_sources?: boolean;
};

export type ExperienceSpec = {
  name?: string;
  tagline?: string;
  portal_type?: PortalType;
  vertical?: VerticalId;
  audience?: ExperienceAudienceSpec;
  navigation?: ExperienceNavigationSpec;
  feed?: ExperienceFeedSpec;
  branding?: ExperienceBrandingSpec;
  sections?: ExperienceSectionSpec[];
  federation?: ExperienceFederationSpec;
  metadata?: Record<string, unknown>;
};

export type ExperienceCompilerWarning = {
  code: string;
  message: string;
  field?: string;
};

export type ValidatedExperienceSpec = {
  spec: ExperienceSpec;
  warnings: ExperienceCompilerWarning[];
};

export type CompiledPortalUpdates = {
  name?: string;
  tagline?: string;
  parent_portal_id?: string | null;
  filters: Record<string, unknown>;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
};

export type CompiledSection = {
  slug: string;
  title: string;
  description?: string;
  section_type: ExperienceSectionType;
  auto_filter?: Record<string, unknown>;
  layout?: string;
  items_per_row?: number;
  max_items?: number;
  style?: Record<string, unknown>;
  is_visible: boolean;
  display_order: number;
};

export type CompileContext = {
  portalId: string;
  portalSlug: string;
  portalType: PortalType;
  existingFilters?: Record<string, unknown> | null;
  existingBranding?: Record<string, unknown> | null;
  existingSettings?: Record<string, unknown> | null;
};

export type CompiledExperience = {
  portal: CompiledPortalUpdates;
  sections: CompiledSection[];
  warnings: ExperienceCompilerWarning[];
  metadata: {
    vertical: VerticalId;
    visual_preset: VisualPresetId;
    feed_type: ExperienceFeedType;
    compiled_at: string;
  };
};
