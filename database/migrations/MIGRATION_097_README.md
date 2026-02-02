# Migration 097: College Park Portal

## Quick Reference

**File**: `097_college_park_portal.sql`
**Purpose**: Create College Park city portal with soulful, heritage-focused branding
**Dependencies**: None (idempotent, safe to re-run)

## What This Migration Does

1. **Creates College Park Portal**
   - Slug: `college-park`
   - Type: `city`
   - 8 neighborhoods covering College Park geography
   - Warm, soulful color palette (reds, golds, earth tones)
   - Cultural heritage-focused branding

2. **Updates Atlanta Portal**
   - Adds College Park's 8 neighborhoods to Atlanta metro feed
   - Ensures College Park events show in both portals
   - Uses conditional check to prevent duplicates

3. **Adds Documentation**
   - Comment explaining cultural significance of branding choices

## To Run This Migration

### Option 1: Supabase SQL Editor (Recommended)
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Copy contents of `097_college_park_portal.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify success message

### Option 2: psql (If you have direct access)
```bash
psql $DATABASE_URL -f database/migrations/097_college_park_portal.sql
```

## Verification

After running, verify the portal was created:

```sql
-- Check portal exists
SELECT slug, name, tagline, portal_type, status
FROM portals
WHERE slug = 'college-park';

-- Check neighborhoods were configured
SELECT
    slug,
    jsonb_array_length(filters->'neighborhoods') as neighborhood_count,
    filters->'neighborhoods' as neighborhoods
FROM portals
WHERE slug = 'college-park';

-- Verify Atlanta portal was updated
SELECT
    slug,
    jsonb_array_length(filters->'neighborhoods') as neighborhood_count
FROM portals
WHERE slug = 'atlanta';
```

Expected results:
- College Park portal exists with status 'active'
- College Park has 8 neighborhoods
- Atlanta portal has added 8 College Park neighborhoods

## Frontend Verification

After migration, verify the portal is accessible:

1. **Visit Portal**: https://lostcity.app/college-park
2. **Check Branding**: Should see warm red/gold color scheme
3. **Test Filtering**: Neighborhoods should filter College Park events
4. **Check Hero**: "Soul Food Capital of America" hero section

## Cultural Significance

This portal celebrates College Park's unique identity:
- **Soul Food Capital**: More Black-owned restaurants than anywhere in America
- **Gullah-Geechee Heritage**: Cultural preservation and celebration
- **Historic District**: 4th largest in Georgia (867 structures)
- **Black Business Hub**: Main Street revitalization

Visual design reflects **warmth, heritage, and cultural richness** distinct from:
- Marietta (corporate blues)
- Decatur (artsy oranges)
- Atlanta (metro-wide neutrality)

## Rollback (If Needed)

To remove the portal:

```sql
-- Delete College Park portal
DELETE FROM portals WHERE slug = 'college-park';

-- Remove neighborhoods from Atlanta portal (if desired)
UPDATE portals
SET filters = jsonb_set(
    filters,
    '{neighborhoods}',
    (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(filters->'neighborhoods') elem
        WHERE elem::text NOT IN (
            '"Historic College Park"',
            '"Downtown College Park"',
            '"Main Street District"',
            '"College Park Old Town"',
            '"West End College Park"',
            '"East Point Border"',
            '"College Park Heights"',
            '"Airport Area"'
        )
    )
)
WHERE slug = 'atlanta';
```

## Next Steps After Migration

1. **Add College Park Sources**
   - Restaurant sources (Virgil's, Main Street dining)
   - Cultural centers
   - Community organizations

2. **Verify Event Coverage**
   - Check existing events tagged to College Park
   - Monitor for cultural events
   - Ensure proper neighborhood assignment

3. **Custom Content**
   - Add hero images featuring Main Street
   - Highlight Gullah-Geechee cultural venues
   - Feature Black-owned business spotlights

4. **Marketing**
   - Share portal with College Park community
   - Partner with Main Street merchants
   - Promote cultural heritage events

## Related Files

- **Migration**: `database/migrations/097_college_park_portal.sql`
- **Documentation**: `COLLEGE_PARK_PORTAL.md`
- **Comparison**: `CITY_PORTALS_COMPARISON.md`

## Questions?

- Portal slug: `college-park`
- URL: `https://lostcity.app/college-park`
- Type: City portal (filters by city + neighborhoods)
- Status: Active (visible to public)
