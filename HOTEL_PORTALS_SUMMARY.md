# Hotel Portal Configuration Summary

Created: 2026-02-14

## Overview

Created two new hotel portal configurations in the database to demo alongside FORTH Hotel. Both use the existing hotel vertical template and will automatically route to the `HotelConciergeFeed` component.

## Portal 1: Bellyard Hotel

**URL:** `/bellyard`

**About:** Boutique hotel in West Midtown, Atlanta. Part of the Rowan Collection. Design-forward with a focus on local art and culture. Connected to the Westside neighborhood.

**Portal ID:** `c3eb4133-6040-4524-ae8f-f5972f28e6a0`

### Configuration

- **Slug:** `bellyard`
- **Name:** Bellyard Hotel
- **Tagline:** "Your guide to Atlanta's Westside"
- **Type:** `business`
- **Plan:** `enterprise`
- **Status:** `active`
- **Visibility:** `public`
- **Vertical:** `hotel`
- **Parent Portal:** Atlanta (`74c2f211-ee11-453d-8386-ac2861705695`)

### Location & Filters

- **City:** Atlanta, GA
- **Geo Center:** [33.7705, -84.4022] (427 W Marietta St NW)
- **Radius:** 5 km
- **Focus Neighborhoods:** West Midtown, Westside, Home Park, English Avenue
- **Adult Content:** Excluded

### Branding (Warm, Modern, Earthy)

- **Theme Mode:** `light`
- **Primary Color:** `#2D3436` (dark charcoal)
- **Secondary Color:** `#636E72` (warm gray)
- **Accent Color:** `#D4A574` (warm terracotta/copper)
- **Background:** `#FAF8F5` (warm white)
- **Card Color:** `#FFFFFF`
- **Text Color:** `#2D3436`
- **Border Color:** `#E8E4DD`
- **Button Color:** `#D4A574`
- **Fonts:**
  - Heading: Cormorant Garamond
  - Body: Inter

### UX Settings

- **Header:** Minimal template, left logo, text nav
- **Ambient Effects:** None
- **Component Style:** Flat cards, rounded buttons, soft shadows
- **Animations:** Low
- **Glow:** Disabled
- **Footer Text:** "Curated for Bellyard Hotel guests"
- **Sharing Brand:** "Bellyard Hotel"

---

## Portal 2: Hotel Clermont

**URL:** `/clermont`

**About:** Iconic boutique hotel in Poncey-Highland, Atlanta. Known for the legendary Clermont Lounge downstairs. Quirky, fun, unapologetically Atlanta. Popular with younger travelers and locals.

**Portal ID:** `06fec83b-fe07-4eb4-ae5e-b1bbebbb8a41`

### Configuration

- **Slug:** `clermont`
- **Name:** Hotel Clermont
- **Tagline:** "Atlanta, unfiltered"
- **Type:** `business`
- **Plan:** `enterprise`
- **Status:** `active`
- **Visibility:** `public`
- **Vertical:** `hotel`
- **Parent Portal:** Atlanta (`74c2f211-ee11-453d-8386-ac2861705695`)

### Location & Filters

- **City:** Atlanta, GA
- **Geo Center:** [33.7744, -84.3605] (789 Ponce de Leon Ave NE)
- **Radius:** 5 km
- **Focus Neighborhoods:** Poncey-Highland, Virginia-Highland, Little Five Points, Inman Park, Old Fourth Ward
- **Adult Content:** Allowed (Clermont Lounge is part of brand identity)

### Branding (Dark, Edgy, Neon-Accented)

- **Theme Mode:** `dark`
- **Primary Color:** `#1A1A2E` (deep navy/black)
- **Secondary Color:** `#E94560` (neon pink/red)
- **Accent Color:** `#FFC947` (warm yellow/gold)
- **Background:** `#0F0F1A` (near black)
- **Card Color:** `#1A1A2E`
- **Text Color:** `#F2F2F2`
- **Border Color:** `#2A2A3E`
- **Button Color:** `#E94560`
- **Button Text:** `#FFFFFF`
- **Fonts:**
  - Heading: Space Grotesk
  - Body: Inter

### UX Settings

- **Header:** Minimal template, left logo, text nav
- **Ambient Effects:** None
- **Component Style:** Bordered cards, medium shadows
- **Animations:** Low
- **Glow:** Enabled (medium intensity)
- **Footer Text:** "Curated for Hotel Clermont guests"
- **Sharing Brand:** "Hotel Clermont"

---

## Template Routing

All three hotel portals route to `/web/app/[portal]/_templates/hotel.tsx`:

1. **FORTH Hotel** → `ForthExperience` component (special variant)
2. **Bellyard Hotel** → `HotelConciergeFeed` component
3. **Hotel Clermont** → `HotelConciergeFeed` component

The hotel template automatically detects the vertical type from `portal.settings.vertical === "hotel"` and renders the appropriate experience.

## Database Schema

Both portals were created with the same structure as FORTH:

```typescript
{
  slug: string,
  name: string,
  tagline: string,
  portal_type: "business",
  status: "active",
  visibility: "public",
  plan: "enterprise",
  parent_portal_id: string, // Atlanta portal
  filters: {
    city: string,
    state: string,
    geo_center: [lat, lng],
    geo_radius_km: number,
    neighborhoods: string[],
    exclude_adult: boolean
  },
  branding: {
    theme_mode: "light" | "dark",
    primary_color: string,
    secondary_color: string,
    accent_color: string,
    // ... color palette
    font_heading: string,
    font_body: string,
    header: { template, logo_position, nav_style, ... },
    ambient: { effect: "none", intensity: "off" },
    component_style: { ... }
  },
  settings: {
    vertical: "hotel",
    meta_title: string,
    meta_description: string,
    nav_labels: { feed, events, spots },
    feed: { feed_type, items_per_section, ... },
    // ... UX preferences
  }
}
```

## Creation Script

Portals created with: `/Users/coach/Projects/LostCity/crawlers/create_hotel_portals.py`

## Next Steps

1. Add logo images for each hotel (update `branding.logo_url`)
2. Add hero images if desired (update `branding.hero_image_url`)
3. Add OG images for social sharing (update `branding.og_image_url`)
4. Test both portals in local dev and staging
5. Consider creating hotel-specific feed sections or curated picks

## Testing

Visit the portals locally:
- http://localhost:3000/bellyard
- http://localhost:3000/clermont
- http://localhost:3000/forth (for comparison)

All three should show the hotel concierge experience with their respective branding and neighborhood filters applied.
