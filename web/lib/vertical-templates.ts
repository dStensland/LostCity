/**
 * Vertical Templates - Pre-configured portal setups by business vertical
 *
 * Each vertical provides default configuration for:
 * - Portal type and settings
 * - Content sections and ordering
 * - Visual preset
 * - Filters and audience targeting
 */

import { VisualPresetId } from "./visual-presets";

export type VerticalId = "city" | "hotel" | "film" | "community";

export interface PortalSection {
  slug: string;
  title: string;
  description?: string;
  section_type: "auto" | "curated";
  auto_filter?: Record<string, unknown>;
  display_order: number;
}

export interface VerticalTemplate {
  id: VerticalId;
  name: string;
  description: string;
  portal_type: "city" | "event" | "business" | "personal";
  visual_preset: VisualPresetId;

  // Default filters
  default_filters: {
    categories?: string[];
    neighborhoods?: string[];
    city?: string;
  };

  // Pre-built sections
  sections: PortalSection[];
}

export const VERTICAL_TEMPLATES: Record<VerticalId, VerticalTemplate> = {
  city: {
    id: "city",
    name: "City Guide",
    description: "Comprehensive event discovery for a city or region",
    portal_type: "city",
    visual_preset: "default",
    default_filters: {
      categories: [],
      neighborhoods: [],
    },
    sections: [
      {
        slug: "tonight",
        title: "Tonight",
        description: "Events happening today",
        section_type: "auto",
        auto_filter: {
          when: "today",
          sort: "start_time",
        },
        display_order: 0,
      },
      {
        slug: "this-weekend",
        title: "This Weekend",
        description: "Events happening this weekend",
        section_type: "auto",
        auto_filter: {
          when: "weekend",
          sort: "popularity",
        },
        display_order: 1,
      },
      {
        slug: "popular",
        title: "Popular Events",
        description: "Trending and highly-rated events",
        section_type: "auto",
        auto_filter: {
          sort: "popularity",
          limit: 20,
        },
        display_order: 2,
      },
      {
        slug: "free-events",
        title: "Free Events",
        description: "No-cost events and experiences",
        section_type: "auto",
        auto_filter: {
          price: "free",
          sort: "start_date",
        },
        display_order: 3,
      },
    ],
  },

  hotel: {
    id: "hotel",
    name: "Hotel Concierge",
    description: "Guest recommendations for hotels and short-term rentals",
    portal_type: "business",
    visual_preset: "cosmic_dark",
    default_filters: {
      categories: [],
      neighborhoods: [],
    },
    sections: [
      {
        slug: "our-picks",
        title: "Our Picks",
        description: "Staff recommendations for today",
        section_type: "curated",
        display_order: 0,
      },
      {
        slug: "tonight",
        title: "Tonight",
        description: "Events happening today",
        section_type: "auto",
        auto_filter: {
          when: "today",
          sort: "proximity",
        },
        display_order: 1,
      },
      {
        slug: "nearby-dining",
        title: "Nearby Dining",
        description: "Restaurants within walking distance",
        section_type: "auto",
        auto_filter: {
          categories: ["food_drink"],
          proximity_km: 2,
          sort: "distance",
        },
        display_order: 2,
      },
      {
        slug: "drinks",
        title: "Drinks & Nightlife",
        description: "Bars and nightlife spots nearby",
        section_type: "auto",
        auto_filter: {
          categories: ["nightlife"],
          proximity_km: 2,
          sort: "distance",
        },
        display_order: 3,
      },
    ],
  },

  film: {
    id: "film",
    name: "Film & Arts",
    description: "Focused on screenings, galleries, and performances",
    portal_type: "event",
    visual_preset: "cosmic_dark",
    default_filters: {
      categories: ["film", "art", "theater"],
    },
    sections: [
      {
        slug: "this-week",
        title: "This Week",
        description: "Films and performances this week",
        section_type: "auto",
        auto_filter: {
          when: "week",
          sort: "start_date",
        },
        display_order: 0,
      },
      {
        slug: "screenings",
        title: "Film Screenings",
        description: "Indie, repertory, and classic films",
        section_type: "auto",
        auto_filter: {
          categories: ["film"],
          sort: "start_date",
        },
        display_order: 1,
      },
      {
        slug: "galleries",
        title: "Gallery Openings",
        description: "New exhibitions and art events",
        section_type: "auto",
        auto_filter: {
          categories: ["art"],
          tags: ["gallery", "opening-night"],
          sort: "start_date",
        },
        display_order: 2,
      },
      {
        slug: "performances",
        title: "Performances",
        description: "Theater, dance, and live performances",
        section_type: "auto",
        auto_filter: {
          categories: ["theater"],
          sort: "start_date",
        },
        display_order: 3,
      },
    ],
  },

  community: {
    id: "community",
    name: "Community Group",
    description: "Local events and neighborhood activities",
    portal_type: "personal",
    visual_preset: "vibrant_community",
    default_filters: {
      categories: ["community", "family"],
      neighborhoods: [],
    },
    sections: [
      {
        slug: "this-weekend",
        title: "This Weekend",
        description: "Events happening this weekend",
        section_type: "auto",
        auto_filter: {
          when: "weekend",
          sort: "start_date",
        },
        display_order: 0,
      },
      {
        slug: "free-events",
        title: "Free Events",
        description: "No-cost community events",
        section_type: "auto",
        auto_filter: {
          price: "free",
          sort: "start_date",
        },
        display_order: 1,
      },
      {
        slug: "local-venues",
        title: "Local Venues",
        description: "Neighborhood spots and gathering places",
        section_type: "auto",
        auto_filter: {
          proximity_km: 3,
          sort: "distance",
        },
        display_order: 2,
      },
    ],
  },
};

/**
 * Get a vertical template by ID
 */
export function getVerticalTemplate(id: VerticalId): VerticalTemplate {
  return VERTICAL_TEMPLATES[id];
}

/**
 * Get all vertical templates as an array
 */
export function getAllVerticalTemplates(): VerticalTemplate[] {
  return Object.values(VERTICAL_TEMPLATES);
}
