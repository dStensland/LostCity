# BP-4b Content Schema: Atlanta Dog Portal

## Operator-Editable vs Developer-Managed

### Operator-Editable (no code deploy required)

These fields live in `portals.content` JSONB column and are editable via admin UI.

| Field | Example | Update Frequency |
|-------|---------|-----------------|
| Hero headline | "SNIFF. PLAY. REPEAT." | Seasonal |
| Hero subhead | "All the dog-friendly stuff in Atlanta." | Seasonal |
| Hero CTA text | "Explore the map" | Seasonal |
| Hero CTA URL | `?view=map` | Seasonal |
| Hero background image | Upload or URL | Seasonal |
| Featured events | Pinned event IDs with labels | Weekly |
| Featured places | Pinned venue IDs with labels | Monthly |
| Curated lists | List slugs, order, visibility | Monthly |
| Announcements | "Doggy Con is this weekend!" | As needed |
| Section visibility | Show/hide any feed section | As needed |
| Section ordering | Reorder feed sections | Rarely |
| Sponsor placements | Logo, link, position | Per deal |

### Developer-Managed (requires code change)

| Aspect | Why |
|--------|-----|
| Source policy (allowed sources) | Security / data governance |
| Tag/vibe filter logic | Core data contract |
| Ranking algorithm | Complex logic, needs testing |
| Feed interleaving rules | UX architecture |
| Template structure and components | Design integrity |
| Route structure | Architecture |
| Map configuration (markers, style) | Design integrity |

---

## Schema Design

### `portals.content` JSONB Structure

```jsonc
{
  "hero": {
    "headline": "SNIFF. PLAY. REPEAT.",
    "subhead": "All the dog-friendly stuff in Atlanta.",
    "cta_text": "Explore the map",
    "cta_url": "?view=map",
    "image_url": null
  },

  "sections": [
    { "type": "this_weekend",   "title": "This Weekend",          "visible": true, "order": 1 },
    { "type": "parks_nearby",   "title": "Dog Parks Near You",    "visible": true, "order": 2 },
    { "type": "new_spots",      "title": "New Spots",             "visible": true, "order": 3 },
    { "type": "curated_lists",  "title": "Lists",                 "visible": true, "order": 4 },
    { "type": "happening_today","title": "Happening Today",       "visible": true, "order": 5 },
    { "type": "trails",         "title": "Trails & Nature",       "visible": true, "order": 6 },
    { "type": "community_tag",  "title": "Know a spot?",          "visible": true, "order": 7 }
  ],

  "featured": [
    {
      "type": "event",
      "id": "evt_abc123",
      "label": "Editor's Pick",
      "pinned_until": "2026-03-01T00:00:00Z"
    },
    {
      "type": "venue",
      "id": "ven_def456",
      "label": "New & Noteworthy",
      "pinned_until": null
    }
  ],

  "curated_lists": [
    { "slug": "best-off-leash-parks",     "visible": true, "order": 1 },
    { "slug": "pup-cup-spots",            "visible": true, "order": 2 },
    { "slug": "new-dog-parent-starter",   "visible": true, "order": 3 },
    { "slug": "dog-friendly-patios",      "visible": true, "order": 4 },
    { "slug": "rainy-day-options",        "visible": true, "order": 5 }
  ],

  "announcements": [
    {
      "text": "Doggy Con is this Saturday at Woodruff Park!",
      "style": "banner",
      "active_from": "2026-09-20T00:00:00Z",
      "active_until": "2026-09-28T00:00:00Z",
      "link_url": "/atl-dogs/events/doggycon-2026",
      "link_text": "See details"
    }
  ],

  "sponsors": [
    {
      "name": "Three Dog Bakery",
      "logo_url": "/sponsors/three-dog-bakery.png",
      "link_url": "https://threedogbakery.com",
      "position": "footer",
      "active_until": "2026-06-01T00:00:00Z"
    }
  ]
}
```

---

## Admin Surface

### v1: Supabase Studio (stopgap)

Portal operators can edit the `content` JSONB directly in Supabase Studio.
Not ideal but functional. Documented with field descriptions.

### v2: Admin Page at `/atl-dogs/admin/content`

Simple form-based editor for each content block:

- **Hero editor**: Text inputs for headline/subhead/CTA, image upload
- **Section manager**: Drag-to-reorder, toggle visibility
- **Featured picker**: Search events/venues, pin with label and expiration
- **List manager**: Reorder curated lists, toggle visibility
- **Announcement editor**: Rich text, date range, link
- **Sponsor manager**: Logo upload, link, position, expiration

Auth: Portal owner only (checked via portal ownership in `portals` table).

### Guardrails

- All text fields have max length limits (headline: 60 chars, subhead: 120 chars)
- Image URLs validated (must be HTTPS, must resolve)
- `pinned_until` required on featured items (no permanent pins — forces review)
- Sections cannot be deleted, only hidden (prevents breaking the feed structure)
- Fallback defaults for every field (empty `content` JSONB = sensible defaults render)

---

## Migration Plan

### Phase 1: Launch with Hardcoded Defaults

Template renders hardcoded content. No content JSONB needed yet.
```typescript
const DEFAULT_HERO = {
  headline: "SNIFF. PLAY. REPEAT.",
  subhead: "All the dog-friendly stuff in Atlanta.",
  cta_text: "Explore the map",
  cta_url: "?view=map",
};
```

### Phase 2: Read from DB with Fallbacks

Template reads `portals.content` JSONB. Falls back to hardcoded defaults
for any missing field. Operator can start editing via Supabase Studio.

```typescript
const hero = portal.content?.hero ?? DEFAULT_HERO;
```

### Phase 3: Admin UI

Build `/atl-dogs/admin/content` page. Operator edits without touching DB directly.

This phased approach means the portal launches without blocking on CMS work.
