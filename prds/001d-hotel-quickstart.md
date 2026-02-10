# Hotel Concierge Vertical - Quick Start Guide

## Create a Hotel Portal (5 Minutes)

### 1. Create Portal in Database

```sql
-- Insert new hotel portal
INSERT INTO portals (
  slug,
  name,
  tagline,
  portal_type,
  status,
  visibility,
  plan,
  filters,
  branding,
  settings
) VALUES (
  'forth',
  'FORTH Hotel Atlanta',
  'Your Evening, Curated',
  'business',
  'active',
  'public',
  'professional',
  jsonb_build_object(
    'city', 'Atlanta',
    'geo_center', array[33.7577, -84.3728],  -- FORTH Hotel coordinates
    'geo_radius_km', 5
  ),
  jsonb_build_object(
    'primary_color', '#D4AF7A',      -- Champagne gold
    'secondary_color', '#C9A88A',    -- Rose gold
    'background_color', '#FDFBF7',   -- Ivory
    'text_color', '#2F2D2A',         -- Charcoal
    'logo_url', 'https://example.com/forth-logo.png',
    'theme_mode', 'light'
  ),
  jsonb_build_object(
    'vertical', 'hotel'              -- KEY FIELD: Activates hotel experience
  )
);
```

### 2. Add Events to Portal

Hotel portals use the same events as city portals. Just ensure events are within the `geo_radius_km` and match the `city` filter.

```sql
-- Events within 5km of FORTH Hotel will automatically appear
-- No special tagging needed
```

### 3. Visit Portal

Navigate to `forth.lostcity.app` (or `localhost:3000/forth` in development).

You should see:
- ✅ Light theme with warm ivory/cream colors
- ✅ Serif headlines (Cormorant Garamond)
- ✅ "Good Morning/Afternoon/Evening" greeting
- ✅ Tonight's events sorted by time
- ✅ Generous spacing between sections
- ✅ No ambient effects or glow

## Verify It's Working

### Visual Checklist

- [ ] Background is light (ivory/cream), not dark
- [ ] Fonts are Cormorant Garamond (headings) + Inter (body)
- [ ] Event cards have soft shadows, no neon borders
- [ ] No particle effects or ambient glow visible
- [ ] Header says "[Hotel Name] Concierge"
- [ ] Event cards show distance from hotel
- [ ] Free events say "Complimentary for Guests"
- [ ] Spacing feels generous (64px between sections)

### Technical Checklist

- [ ] `data-vertical="hotel"` attribute on portal wrapper div
- [ ] Hotel CSS variables applied (check DevTools computed styles)
- [ ] Cormorant Garamond and Inter fonts loaded (check Network tab)
- [ ] `/api/portals/forth/feed` returns events (check Network tab)
- [ ] No TypeScript errors in console

## Customize Your Hotel Portal

### Update Branding Colors

```sql
UPDATE portals
SET branding = branding || jsonb_build_object(
  'primary_color', '#YOUR_CHAMPAGNE_COLOR',
  'secondary_color', '#YOUR_ROSE_GOLD_COLOR',
  'accent_color', '#YOUR_BRASS_COLOR',
  'logo_url', 'https://yourhotel.com/logo.png'
)
WHERE slug = 'forth';
```

### Set Hotel Location (for proximity)

```sql
UPDATE portals
SET filters = filters || jsonb_build_object(
  'geo_center', array[YOUR_LAT, YOUR_LNG],
  'geo_radius_km', 5  -- Events within 5km
)
WHERE slug = 'forth';
```

### Add Hotel Logo

```sql
UPDATE portals
SET branding = branding || jsonb_build_object(
  'logo_url', 'https://yourhotel.com/logo.png'
)
WHERE slug = 'forth';
```

## Common Issues

### Portal still looks like city portal (dark theme, neon colors)

**Fix**: Ensure `settings.vertical` is set to `"hotel"`

```sql
UPDATE portals
SET settings = settings || jsonb_build_object('vertical', 'hotel')
WHERE slug = 'forth';
```

### Fonts not loading (still showing Outfit)

**Fix**: Clear browser cache and hard reload (Cmd+Shift+R). Verify fonts load in Network tab.

### No events showing

**Fix**: Check `filters.city` and `filters.geo_center` match your event data

```sql
-- See which events are within radius
SELECT id, title, venue_name, city, lat, lng
FROM events
WHERE city = 'Atlanta'
  AND lat IS NOT NULL
  AND lng IS NOT NULL
  AND start_date >= CURRENT_DATE
ORDER BY start_date, start_time
LIMIT 20;
```

### Distance not showing on event cards

**Fix**: Events need lat/lng coordinates. Run venue enrichment script:

```bash
cd crawlers
python3 venue_enrich.py
```

## Demo Script (2 Minutes)

### 1. Show Contrast (30 seconds)

"Let me show you two different experiences built on the same platform..."

- Open `atlanta.lostcity.app` (city portal)
  - Dark theme, neon pink/cyan, dense feed, social features
- Open `forth.lostcity.app` (hotel portal)
  - Light theme, warm gold, spacious layout, proximity-focused

### 2. Explain Architecture (30 seconds)

"These are the same events, same venues, same data. But the experience is completely different."

- Point to URL: "Same subdomain structure"
- Point to events: "Same event data"
- Show database: "One field changes everything: `settings.vertical`"

### 3. Show Details (1 minute)

**Typography**: "Outfit → Cormorant Garamond + Inter"
**Colors**: "Neon magenta → Champagne gold"
**Density**: "20 events → 6 per section"
**Language**: "'Happening Now' → 'This Evening'"
**Features**: "Social proof → Distance from hotel"

### 4. Close

"This proves our inverted white-labeling hypothesis. We can serve multiple verticals from one codebase, one data layer, without sacrificing design quality or user experience."

## Next Steps

### For Demo
1. Add FORTH branding (logo, colors)
2. Load Atlanta events within 5km of FORTH
3. Enrich venues with photos and coordinates
4. Test on mobile device
5. Prepare demo script

### Post-Demo Enhancements
1. Server-side data fetching (move from client component)
2. Proximity calculations (haversine distance from hotel)
3. Curated sections integration (portal_sections table)
4. Venue browsing with filters (Restaurants, Bars, Coffee)
5. Day planner view (horizontal day selector)
6. Weather-aware suggestions (rainy day → indoor events)

## Support

See full implementation details in:
- `/HOTEL_VERTICAL_IMPLEMENTATION.md` - Complete technical documentation
- `/web/app/[portal]/_components/hotel/README.md` - Component API reference
- `/prds/001-hotel-concierge-vertical.md` - Original PRD
- `/prds/001a-hotel-design-direction.md` - Design spec

---

**Ready to demo!** 🎉
