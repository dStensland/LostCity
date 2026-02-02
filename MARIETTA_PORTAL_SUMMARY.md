# Marietta Portal - Quick Summary

## What Was Created

1. **TypeScript Script** (`web/scripts/create-marietta-portal.ts`)
   - Full-featured portal creation script
   - Creates portal, sections, and updates Atlanta
   - Includes verification and error handling
   - Safe to run multiple times

2. **SQL Migration** (`database/migrations/093_marietta_portal.sql`)
   - Production-ready migration file
   - Idempotent portal creation
   - Updates Atlanta to include Marietta neighborhoods
   - Can be run via psql or Supabase SQL Editor

3. **Setup Guide** (`MARIETTA_PORTAL_SETUP.md`)
   - Comprehensive documentation
   - Installation instructions for both methods
   - Configuration details
   - Troubleshooting guide

## Portal Details

**URL**: `/marietta`

**Configuration**:
- Type: City portal
- Coverage: 14 Marietta neighborhoods
- Theme: Corporate Clean (light, professional)
- Colors: Blue (#2563eb), purple (#7c3aed), red (#dc2626)
- Plan: Starter (free tier)

**Key Features**:
- Events filtered by city="Marietta" or Marietta neighborhoods
- Clean, historic downtown aesthetic
- Standard header with tabs navigation
- Subtle ambient glow effects
- Map view enabled

**Dual Portal Setup**:
- Marietta events appear in `/marietta` (focused view)
- Marietta events ALSO appear in `/atlanta` (metro view)
- Achieved by adding Marietta neighborhoods to Atlanta's filter list

## How to Activate

### Quick Start (TypeScript)
```bash
cd web
npx tsx scripts/create-marietta-portal.ts
```

### Production (SQL)
```bash
psql $DATABASE_URL -f database/migrations/093_marietta_portal.sql
```

## What Happens

1. Creates `marietta` portal with proper filters and branding
2. Adds 5 feed sections (TypeScript method only):
   - This Week in Marietta
   - Around the Square
   - Arts & Culture
   - Family Events
   - Food & Drink
3. Updates Atlanta portal to include Marietta neighborhoods
4. Sets status to `active`

## Verification

After running, check:
- Visit `http://localhost:3000/marietta`
- Existing Marietta events should appear
- Marietta Cobb Museum events should be visible
- Events should also appear in `/atlanta` feed

## Files Created

```
web/scripts/create-marietta-portal.ts          # TypeScript creation script
database/migrations/093_marietta_portal.sql    # SQL migration
MARIETTA_PORTAL_SETUP.md                       # Detailed guide
MARIETTA_PORTAL_SUMMARY.md                     # This file
```

## Existing Marietta Content

**Already Active**:
- Marietta Cobb Museum of Art source (`crawlers/sources/marietta_cobb_museum.py`)
- Events with `neighborhood="Marietta Square"` or `city="Marietta"`
- Venues in Marietta

**Will Immediately Benefit**:
- All Marietta events will appear in both portals
- Marietta residents get focused local feed
- Atlanta users see metro-wide coverage including Marietta

## Next Steps (Optional)

1. Add logo and hero image via admin panel
2. Create custom feed sections for Marietta-specific content
3. Add more Marietta event sources (theaters, venues, community centers)
4. Enable custom domain (requires Professional/Enterprise plan)
5. Adjust branding colors to match Marietta city branding if desired

## Technical Notes

**Portal Type**: City portal (not business/event/personal)

**Neighborhood List** (14 total):
- Marietta Square
- Downtown Marietta
- East Cobb
- Polk
- Whitlock
- Fort Hill
- North Landing
- Eastern Marietta
- Indian Hills
- Chimney Springs
- Windsor Oaks
- Somerset
- Brookstone
- Powers Park

**Schema Compatibility**:
- Script handles missing `parent_portal_id` column gracefully
- Script handles missing `plan` column gracefully
- Migration uses `ON CONFLICT` for idempotency
- Atlanta update checks for existing neighborhoods before adding

**No Breaking Changes**:
- Existing Marietta events unaffected
- Atlanta portal neighborhoods extended (not replaced)
- All migrations are additive only
