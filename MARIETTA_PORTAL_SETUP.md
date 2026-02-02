# Marietta Portal Setup Guide

This document explains how to set up the Marietta city portal for LostCity.

## Overview

The Marietta portal is a city-focused portal for Marietta, GA, a historic city in the Atlanta metro area. It features:

- **Portal Type**: City portal (public)
- **Slug**: `marietta`
- **Name**: Discover Marietta
- **Tagline**: Events & happenings in historic Marietta
- **Coverage**: 14 Marietta neighborhoods including Marietta Square, East Cobb, and more
- **Branding**: Clean, historic aesthetic with blue/purple color scheme
- **Visual Preset**: Corporate Clean (professional, light theme)

## Dual Portal Strategy

Events in Marietta will appear in **BOTH** portals:

1. **Marietta Portal** (`/marietta`) - Dedicated Marietta events feed
2. **Atlanta Portal** (`/atlanta`) - Metro-wide feed including Marietta

This is achieved by adding Marietta neighborhoods to the Atlanta portal's neighborhood filter list, ensuring metro-wide event discovery while maintaining a focused Marietta-specific view.

## Installation Methods

You have two options for creating the portal:

### Option 1: TypeScript Script (Recommended for Development)

Run the TypeScript script which creates the portal, sections, and updates Atlanta:

```bash
cd web
npx tsx scripts/create-marietta-portal.ts
```

**What it does:**
- Creates Marietta portal with starter plan
- Creates 5 default feed sections (This Week, Around the Square, Arts & Culture, etc.)
- Adds Marietta neighborhoods to Atlanta portal filter
- Links Marietta to Atlanta as parent portal (if B2B columns exist)
- Activates the portal
- Provides verification output

**Benefits:**
- Safe (checks for existing portal before creating)
- Verbose output for debugging
- Creates feed sections automatically
- Handles schema variations gracefully

### Option 2: SQL Migration (Recommended for Production)

Run the SQL migration directly in Supabase:

```bash
# Via psql
psql $DATABASE_URL -f database/migrations/093_marietta_portal.sql

# Or via Supabase SQL Editor
# Copy/paste contents of 093_marietta_portal.sql
```

**What it does:**
- Creates Marietta portal (or updates if exists via `ON CONFLICT`)
- Updates Atlanta portal to include Marietta neighborhoods (only if not already present)
- Idempotent (safe to run multiple times)

**Benefits:**
- Production-ready
- Idempotent operations
- No dependencies on Node/TypeScript
- Can be included in migration pipeline

## Portal Configuration

### Filters

```json
{
  "city": "Marietta",
  "neighborhoods": [
    "Marietta Square",
    "Downtown Marietta",
    "East Cobb",
    "Polk",
    "Whitlock",
    "Fort Hill",
    "North Landing",
    "Eastern Marietta",
    "Indian Hills",
    "Chimney Springs",
    "Windsor Oaks",
    "Somerset",
    "Brookstone",
    "Powers Park"
  ]
}
```

### Branding

**Visual Identity:**
- **Theme**: Light mode, corporate clean
- **Primary Color**: `#2563eb` (Historic blue)
- **Secondary Color**: `#7c3aed` (Regal purple)
- **Accent Color**: `#dc2626` (Brick red - references historic buildings)
- **Fonts**: Inter for both headings and body (clean, modern)

**Header Style:**
- Standard template
- Logo on left, medium size
- Tab-style navigation
- Search in header

**Ambient Effects:**
- Subtle glow effect
- Soft blue/purple gradients
- Slow animation speed

**Component Styles:**
- Medium border radius
- Elevated card style
- Medium shadows
- Traditional button style (not pill/ghost)
- No neon glow (professional aesthetic)

### Settings

```json
{
  "show_map": true,
  "default_view": "list",
  "show_categories": true,
  "icon_glow": false,
  "exclude_adult": false,
  "meta_description": "Discover events, activities, and entertainment in historic Marietta, GA...",
  "nav_labels": {
    "feed": "Feed",
    "events": "Events",
    "spots": "Places"
  }
}
```

## Default Feed Sections (Script Only)

If using the TypeScript script, these sections are created automatically:

1. **This Week in Marietta** - Events in the next 7 days
2. **Around the Square** - Events in Marietta Square/Downtown neighborhoods
3. **Arts & Culture** - Art, theater, and music events
4. **Family Events** - Family-friendly activities
5. **Food & Drink** - Dining and nightlife events

## Verification

After running either method, verify the portal is active:

### Via Browser
Visit: `http://localhost:3000/marietta` (dev) or `https://lostcity.com/marietta` (prod)

### Via SQL
```sql
SELECT slug, name, status, portal_type
FROM portals
WHERE slug = 'marietta';

-- Check Atlanta includes Marietta neighborhoods
SELECT filters->'neighborhoods' as neighborhoods
FROM portals
WHERE slug = 'atlanta';
```

### Via Script Output
The TypeScript script provides detailed verification output including:
- Portal details (name, slug, type, status)
- Branding summary
- Filter configuration
- Feed sections created
- Atlanta portal update status

## Existing Marietta Content

The following venues/sources already exist for Marietta:

**Venues:**
- Marietta Cobb Museum of Art (art museum on Marietta Square)
- Various East Cobb restaurants and venues
- Historic downtown establishments

**Sources:**
- `marietta_cobb_museum.py` - Active crawler for museum events
- Events tagged with "marietta" tag

All existing Marietta events will automatically appear in the portal once activated.

## Next Steps

1. **Run the portal creation** using your preferred method
2. **Add branding assets** (optional):
   - Logo (recommended 200x60px)
   - Hero image for header (recommended 1920x600px)
   - Favicon (32x32px)
3. **Customize sections** via admin panel if needed
4. **Add featured content** for key Marietta events
5. **Test event discovery** - search for Marietta events, check filters
6. **Add more Marietta sources** - identify additional event sources in Marietta

## Troubleshooting

### Portal doesn't appear
- Check `status` is `'active'` in database
- Verify no typos in slug
- Check Next.js server restarted (dev mode)

### Events not showing
- Verify events have `city = 'Marietta'` or matching neighborhood
- Check source is active and crawled recently
- Confirm category filters aren't excluding events

### Atlanta update didn't work
- Check if neighborhoods were already present
- Verify Atlanta portal exists with slug 'atlanta'
- Run script with verbose output to see error details

## File Locations

- **TypeScript Script**: `/web/scripts/create-marietta-portal.ts`
- **SQL Migration**: `/database/migrations/093_marietta_portal.sql`
- **This Guide**: `/MARIETTA_PORTAL_SETUP.md`
- **Marietta Source**: `/crawlers/sources/marietta_cobb_museum.py`

## Questions?

This portal configuration follows the established patterns from:
- Atlanta portal (`001_portals.sql`)
- Piedmont portal (`018_piedmont_portal.sql`)
- Atlanta Families portal (`scripts/create-atlanta-families-portal.ts`)
