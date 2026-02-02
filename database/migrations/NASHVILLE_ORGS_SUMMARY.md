# Nashville Metro Organizations Import

## Summary

Created comprehensive import of 48 Nashville Metro area organizations into the `event_producers` table to support the Nashville portal launch.

## Files Created

1. **SQL Migration**: `/Users/coach/Projects/LostCity/database/migrations/106_nashville_organizations.sql`
   - Ready-to-run SQL INSERT statements
   - Includes ON CONFLICT handling for updates
   - Can be executed via Supabase SQL editor or migration runner

2. **Python Import Script**: `/Users/coach/Projects/LostCity/crawlers/import_nashville_orgs.py`
   - Alternative programmatic import using Supabase client
   - Includes update/insert logic
   - Note: Requires `event_producers` table to exist first

## Organizations Imported (48 total)

### Music Industry (6)
- Country Music Association
- Americana Music Association  
- Nashville Songwriters Association International
- Gospel Music Association
- Musicians Hall of Fame and Museum
- Nashville Music Equality

### Arts & Culture (8)
- Metro Arts Nashville
- OZ Arts Nashville
- Nashville Arts Coalition
- Frist Art Museum
- Tennessee Performing Arts Center (TPAC)
- The Nashville Symphony
- Nashville Ballet
- Nashville Opera

### Community Nonprofits (6)
- Nashville Public Library
- Hands On Nashville
- Nashville Rescue Mission
- Second Harvest Food Bank of Middle Tennessee
- Habitat for Humanity Nashville
- Nashville Farmers' Market

### Business & Professional (4)
- Nashville Area Chamber of Commerce
- Nashville Technology Council
- Nashville Entrepreneur Center
- Music City Center

### LGBTQ+ Organizations (3)
- Nashville Pride
- Tennessee Equality Project
- OUTMemphis Nashville

### Suburban/Regional (4)
- Downtown Franklin Association
- Heritage Foundation of Franklin and Williamson County
- Rutherford Arts Alliance
- Williamson County Parks and Recreation

### Film & Theater (4)
- Nashville Film Festival
- Nashville Repertory Theatre
- Circle Players Nashville
- Nashville Children's Theatre

### Cultural & Heritage (6)
- National Museum of African American Music
- Country Music Hall of Fame and Museum
- Historic RCA Studio B
- Cheekwood Estate & Gardens
- The Parthenon
- Adventure Science Center

### Sports & Recreation (2)
- Nashville Sports Council
- Music City Runners Club

### Neighborhood Associations (3)
- East Nashville Business Association
- 12 South Neighborhood Association
- The Nations Neighborhood

### Food & Beverage (2)
- Nashville Craft Distillery
- Tennessee Craft

## Data Quality Features

Each organization record includes:
- **Core Identity**: name, slug (URL-safe), org_type
- **Location**: city, neighborhood (where applicable)
- **Categories**: Array of event types they host/produce
- **Description**: 1-2 sentence summary of their mission/activities
- **Social Media**: Instagram, Facebook, Twitter handles
- **Website**: Official URL

## Organization Types Used

- `music_industry` - Trade associations and industry groups
- `music_museum` - Music-focused museums
- `arts_nonprofit` - Arts advocacy and support organizations
- `museum` - Museums and cultural institutions
- `performing_arts` - Theaters, orchestras, ballet, opera
- `library` - Public library systems
- `nonprofit` - General community nonprofits
- `public_market` - Farmers markets and public marketplaces
- `business` - Chambers, business associations
- `convention_center` - Convention and event venues
- `lgbtq` - LGBTQ+ advocacy and community organizations
- `government` - Public/government organizations (parks, etc.)
- `film_society` - Film festivals and cinema organizations
- `neighborhood` - Neighborhood associations

## How to Apply

### Option 1: Supabase SQL Editor (Recommended)
1. Log into Supabase dashboard
2. Navigate to SQL Editor
3. Copy contents of `106_nashville_organizations.sql`
4. Execute

### Option 2: Migration Runner
```bash
cd database
node run_migration.mjs migrations/106_nashville_organizations.sql
```

### Option 3: Python Script
```bash
cd crawlers
source venv/bin/activate
python import_nashville_orgs.py
```

## Next Steps

1. **Apply Migration**: Run the SQL migration to import organizations
2. **Link to Sources**: Create crawler sources for organizations with event pages
3. **Producer Linking**: Update `db.py` `_SOURCE_PRODUCER_MAP` to auto-link events to these producers
4. **Verification**: Query to confirm:
   ```sql
   SELECT city, org_type, COUNT(*) 
   FROM event_producers 
   WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro')
   GROUP BY city, org_type
   ORDER BY city, org_type;
   ```

## Coverage Analysis

**Geographic Distribution:**
- Nashville: 38 organizations
- Franklin: 3 organizations  
- Murfreesboro: 1 organization
- Regional/Multi-city: 6 organizations

**Category Focus:**
- Music (direct/indirect): 12 organizations
- Arts & Culture: 14 organizations
- Community/Nonprofit: 11 organizations
- Business/Professional: 7 organizations
- Sports/Recreation: 2 organizations
- Neighborhood: 3 organizations

This provides strong foundational data for the Nashville portal across all major event categories and metro sub-regions.
