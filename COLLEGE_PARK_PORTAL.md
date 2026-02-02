# College Park Portal Configuration

## Overview
College Park is being configured as a **city-type portal** celebrating its unique identity as the Soul Food Capital of America with deep Gullah-Geechee cultural heritage.

## Cultural Identity

### Core Attributes
- **Soul Food Capital**: More Black-owned restaurants on Main Street than anywhere else in America
- **Gullah-Geechee Heritage**: Virgil's Gullah Kitchen & Bar is the flagship cultural destination
- **Historic District**: 4th largest in Georgia with 867 historic structures
- **Black Business Hub**: Concentrated corridor of Black-owned businesses
- **Revitalization Story**: Main Street revival and cultural preservation

### Differentiators
- **vs. Marietta**: Corporate/professional (blues) → College Park is cultural/soulful (reds/golds)
- **vs. Decatur**: Artsy/progressive (oranges) → College Park is heritage-focused (earth tones)
- **vs. Atlanta**: Metro-wide → College Park is neighborhood-intimate with cultural specificity

## Portal Configuration

### Basic Info
```yaml
slug: college-park
name: Discover College Park
tagline: Soul food, culture & history in Atlanta's airport city
portal_type: city
status: active
visibility: public
```

### Neighborhoods (8 total)
1. **Historic College Park** - Core historic district
2. **Downtown College Park** - Central business district
3. **Main Street District** - Restaurant and cultural corridor
4. **College Park Old Town** - Original settlement area
5. **West End College Park** - Western residential area
6. **East Point Border** - Eastern edge near East Point
7. **College Park Heights** - Northern residential area
8. **Airport Area** - Southern area near Hartsfield-Jackson

### Visual Identity

**Color Palette** (Warm, Soulful, Historic)
- Primary: `#dc2626` (Deep Red) - Rich, welcoming, cultural warmth
- Secondary: `#b91c1c` (Darker Red) - Depth and heritage
- Accent: `#d97706` (Amber/Gold) - Historical significance
- Background: `#fef3c7` (Warm Cream) - Inviting, approachable
- Card: `#fffbeb` (Lighter Cream) - Clean presentation
- Border: `#fed7aa` (Peach) - Soft separation

**Typography**
- Headings: Inter (clean, readable)
- Body: Inter (consistent, professional)

**Ambient Effects**
- Effect: `warm_glow`
- Intensity: `medium`
- Colors: Cream and peach tones
- Animation: `slow` (dignified, not flashy)

**Component Style**
- Border Radius: `lg` (friendly, welcoming)
- Shadows: `elevated` (depth and importance)
- Card Style: `warm` (cultural warmth)
- Glow: `medium` (subtle cultural richness)
- Glass: Disabled (solid, grounded in heritage)

### Settings

**Navigation**
- Feed, Events, Places (standard labels)
- Map view enabled
- Categories visible
- Icon glow enabled for visual warmth

**Hero Section**
```json
{
  "enabled": true,
  "title": "Soul Food Capital of America",
  "subtitle": "Celebrate Black culture, Gullah-Geechee heritage, and historic Main Street dining",
  "style": "warm"
}
```

**SEO**
```
Discover events, dining, and culture in College Park, GA - home to more Black-owned
restaurants than any other place in America. Experience Gullah-Geechee heritage,
soul food, and historic Main Street charm.
```

## Migration Details

**File**: `database/migrations/097_college_park_portal.sql`

**Actions**:
1. Insert College Park portal with complete configuration
2. Update Atlanta portal to include College Park's 8 neighborhoods
3. Add comment explaining cultural significance of branding

**Conflict Handling**:
- Uses `ON CONFLICT (slug) DO UPDATE` for idempotency
- Safe to run multiple times

**Atlanta Integration**:
- Adds neighborhoods only if not already present
- Uses `jsonb_set` with array concatenation
- Conditional check prevents duplicates

## Implementation Checklist

- [x] Define 8 neighborhoods covering College Park geography
- [x] Design warm, soulful color palette (reds, golds, earth tones)
- [x] Configure visual preset for cultural celebration
- [x] Write comprehensive meta description
- [x] Add hero section highlighting cultural identity
- [x] Create SQL migration file
- [x] Include Atlanta portal update
- [ ] Run migration in Supabase SQL Editor
- [ ] Verify portal appears at `/college-park`
- [ ] Test neighborhood filtering
- [ ] Confirm College Park events show in Atlanta feed

## Cultural Considerations

This portal celebrates College Park's unique Black cultural heritage. The design choices reflect:

1. **Warmth over Corporate**: Red/gold palette vs. blue corporate tones
2. **Heritage over Trendy**: Earth tones and elevated shadows vs. glass effects
3. **Soul over Artsy**: Warm glow vs. creative energy
4. **Community over Metro**: Intimate neighborhood focus vs. city-wide scope

The visual identity should make residents feel **seen, celebrated, and proud** of their community's distinctive cultural contributions.

## Next Steps

1. Run the migration in Supabase SQL Editor
2. Visit `https://lostcity.app/college-park` to verify
3. Add College Park-specific sources (restaurants, cultural centers)
4. Monitor event coverage for cultural venues
5. Consider custom imagery featuring Main Street and historic architecture
