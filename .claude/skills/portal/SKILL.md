---
description: Use when building a new portal, extending an existing portal, configuring portal themes/presets, setting up source federation, or debugging portal data isolation issues
---

# Portal Build / Configure

$ARGUMENTS

## Overview

A portal is a themed, scoped view of the LostCity event platform. Building one touches 7 layers: theme, migration, feed sections, source federation, routing, components, and data QA. This skill codifies the sequence and conventions so agents don't rediscover them each time.

**North star check**: Every portal is a live production product for real users, not a demo. Ship it complete or don't ship it.

## When to Use

- Building a new first-party portal (Lost Arts, Lost Youth, Lost Track, etc.)
- Building a B2B portal (hotel, convention, neighborhood)
- Adding source federation or subscriptions to an existing portal
- Configuring or debugging portal themes/presets
- Diagnosing portal data isolation issues (wrong events appearing)

## Portal Build Sequence

Follow this order. Each step depends on the previous.

### Step 1: Theme / Preset

**Files:** `web/lib/visual-presets.ts`, `web/lib/apply-preset.ts`

Define the visual identity. Each portal needs a distinct visual language.

| Decision | Options |
|----------|---------|
| Preset | `default`, `editorial_light`, `corporate_clean`, `vibrant_community`, `nightlife`, `family_friendly`, `minimal_modern`, `cosmic_dark`, `neon_honkytonk`, `custom` |
| Theme mode | `dark` or `light` |
| Header template | `standard`, `minimal`, `branded`, `immersive` |
| Component style | `border_radius`, `shadows`, `card_style`, `button_style`, `glow_enabled`, `glass_enabled` |
| Ambient effect | `none`, `subtle_glow`, `gradient_wave`, `particle_field`, `aurora`, `constellation`, etc. |

**Branding JSONB** goes on the portal row. `applyPreset()` merges preset defaults with branding overrides. Only store fields that differ from the preset via `getCustomOverrides()`.

**Plan tiers restrict presets:** starter = default only, professional = most, enterprise = all + custom.

**Typography:** Font preloads per vertical are set in `[portal]/layout.tsx` — add new fonts there.

### Step 2: Migration

Create a numbered migration in `web/supabase/migrations/`. A new portal needs:

```sql
-- 1. Portal row
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, vertical_slug, city_slug, parent_portal_id, filters, branding, settings)
VALUES ('adventure', 'Lost Track', 'Wander over yonder', 'city', 'active', 'public', 'adventure', 'atlanta', '<atlanta-portal-uuid>',
  '{"city": "Atlanta", "categories": ["outdoors", "sports", "recreation"]}'::jsonb,
  '{"visual_preset": "minimal_modern", "primary_color": "#C45A3B", "font_heading": "Space Grotesk"}'::jsonb,
  '{"vertical": "adventure"}'::jsonb
);

-- 2. Feed sections (block_type, auto_filter, scheduling)
INSERT INTO portal_sections (portal_id, slug, title, section_type, block_type, auto_filter, display_order, is_visible)
VALUES
  ('<portal-uuid>', 'featured', 'Featured', 'auto', 'hero_banner', '{"max_items": 1}', 1, true),
  ('<portal-uuid>', 'this-weekend', 'This Weekend', 'auto', 'event_cards', '{"date_filter": "this_weekend", "max_items": 8}', 2, true);

-- 3. Source ownership (set owner_portal_id on sources this portal owns)
UPDATE sources SET owner_portal_id = '<portal-uuid>' WHERE slug IN ('alltrails-atlanta', 'rei-atlanta');

-- 4. Source subscriptions (subscribe to sources owned by other portals)
INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT '<portal-uuid>', s.id, 'all', true
FROM sources s WHERE s.slug IN ('eventbrite-atlanta', 'meetup-atlanta');
```

**Key tables:**
- `portals` — Portal definition + filters/branding/settings JSONB
- `portal_sections` — Feed sections with block types, auto_filter, scheduling
- `source_subscriptions` — Which sources a portal receives events from
- `source_sharing_rules` — Which categories a source shares (owner controls)
- `portal_source_access` — Materialized view pre-computing the access matrix

### Step 3: Source Federation

**How events reach a portal:**

```
Source (owner_portal_id) ──owns──> Events (portal_id inherited in _step_set_flags)
                         ──shares─> source_sharing_rules (scope: all/selected/none)
                         ──subscribes─> source_subscriptions (subscriber gets events)
                         ──cached──> portal_source_access (materialized view)
```

**Portal isolation rule:** Events with `portal_id = X` appear ONLY in portal X and portals that subscribe to source X. The `portal_id.eq.X,portal_id.is.null` query pattern **leaks NULL events into every portal** — this caused the Nashville data leak. Always set `owner_portal_id` on sources.

**Refresh the materialized view** after changing subscriptions:
```sql
REFRESH MATERIALIZED VIEW portal_source_access;
```

### Step 4: CityPulse Feed Integration

**For first-party portals** (city verticals), the CityPulse pipeline (`web/lib/city-pulse/`) handles feed rendering. Key decisions:

- **Content policy** — Which section types to suppress via `manifest.contentPolicy.suppressedSections`
- **keepRecurring** — Set `true` for portals that want RecurringStrip (civic, family)
- **Category filters** — Portal's `filters.categories` scopes which events enter the pipeline
- **Feed sections** — Legacy portal_sections table OR computed CityPulse sections (most first-party portals use CityPulse)

**For B2B portals**, the legacy feed loader (`web/lib/portal-feed-loader.ts`) handles sections from the `portal_sections` table with auto_filter JSONB.

### Step 5: Routing

**Layout:** `web/app/[portal]/layout.tsx` resolves portal by slug, applies preset, injects CSS vars via `<PortalTheme>`.

**Resolution order:**
1. Custom domain → `resolveCustomDomain(host)`
2. Vertical subdomain → `x-lc-vertical` header (e.g., `arts.atlanta.lostcity.ai`)
3. Slug lookup → `getCachedPortalBySlug(slug)`

**For subdomain routing**, set `vertical_slug` + `city_slug` on the portal row. Middleware maps `{vertical}.{city}.lostcity.ai` to the portal.

### Step 6: Portal-Specific Components

Common portal-specific pieces:
- **Hero component** — `CivicHero`, `ArtsHero`, etc. in `web/components/`
- **Secondary nav** — `ArtsSecondaryNav`, `FamilyNav`, etc.
- **Find view filters** — Category subset relevant to the vertical
- **Venue detail sections** — Portal-specific venue rendering

**Use theme tokens** (`var(--action-primary)`, `var(--twilight)`, `var(--void)`) not hardcoded colors. This ensures light/dark mode works.

### Step 7: Data QA

Before calling a portal "done":
1. **Attribution check** — No events from wrong portals leaking in
2. **Source coverage** — All relevant sources subscribed and producing events
3. **Image coverage** — Venue images populated (check `SELECT COUNT(*) FROM venues WHERE image_url IS NULL AND id IN (...)`)
4. **Empty sections** — Every feed section has data; sections with 0 events should not render
5. **Console errors** — Zero errors at desktop and 375px mobile
6. **Links work** — Every "See all", event detail, venue detail link resolves

## Portal Type Reference

| Vertical | Slug Pattern | Design Language | Key Feature |
|----------|-------------|-----------------|-------------|
| City (base) | `atlanta` | Cinematic minimalism, dark | Full CityPulse feed |
| Civic | `helpatl` | Editorial light, teal accent | Community action sections |
| Family | `family` | Field sage, warm amber, light | Age filtering, programs |
| Adventure | `adventure` | Terracotta, sharp corners | Commitment filter, destinations |
| Arts | `arts` | Copper, monospace, zero radius | Open calls, exhibitions |
| Sports | `sports` | TBD | Spectator + participation |
| Hotel (B2B) | `forth` | Custom domain, branded | Guest-facing, curated |

## Common Mistakes

- **Forgetting `owner_portal_id` on sources** → Events get `portal_id=NULL` → leak everywhere
- **Not refreshing `portal_source_access`** → Subscriptions exist but portal can't see events
- **Hardcoded colors instead of theme tokens** → Breaks when portal is light mode
- **Using `portal_id.is.null` in queries** → Leaks unattributed events into portal
- **Skipping data QA** → Portal launches with empty sections or broken images

## Key Files

| File | Purpose |
|------|---------|
| `web/lib/visual-presets.ts` | Preset definitions (9 presets) |
| `web/lib/apply-preset.ts` | Preset merge + plan tier enforcement |
| `web/lib/portal-context.tsx` | Portal type definitions, PortalProvider |
| `web/lib/portal.ts` | Portal resolution, alias overrides |
| `web/lib/portal-feed-loader.ts` | Legacy B2B feed loader |
| `web/lib/portal-feed-plan.ts` | Feed section planning |
| `web/app/[portal]/layout.tsx` | Portal routing + theme injection |
| `web/app/[portal]/page.tsx` | Portal homepage rendering |
| `crawlers/db/events.py:1002-1007` | Portal_id inheritance in `_step_set_flags` |
