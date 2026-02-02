# Portal Architecture Guide
**LostCity Geographic Expansion - System Architecture**

*Companion to Geographic Expansion Playbook - focuses on portal/database architecture vs. crawler implementation*

---

## Executive Summary

This guide provides architectural recommendations for expanding LostCity coverage to new geographic areas (e.g., adding Marietta to Atlanta portals). It analyzes:

1. **How geographic boundaries are defined** (portal filters)
2. **How events/venues associate with portals** (venue-based model)
3. **What database changes are needed** (migrations, indexes)
4. **How filtering/search works** (query patterns)
5. **Which API routes handle portal content** (endpoint architecture)

**Key Files Analyzed:**
- `/web/lib/portal.ts` - Portal data access layer
- `/web/lib/portal-context.tsx` - Portal types and React context
- `/web/middleware.ts` - Subdomain routing and custom domain resolution
- `/database/migrations/001_portals.sql` - Portal schema
- `/database/migrations/019_event_portal_restriction.sql` - Portal-specific events
- `/database/migrations/091_custom_domains.sql` - B2B portal support
- `/web/app/api/events/route.ts` - Event filtering API
- `/web/app/api/portals/[slug]/feed/route.ts` - Portal feed generation
- `/web/lib/search.ts` - Search and filter logic
- `/web/lib/federation.ts` - Source subscription system

---

## 1. Geographic Boundary System

### Portal Filter Architecture

**Location:** `portals.filters` (JSONB column)

Portals define geographic scope through **flexible JSONB filters** stored in the database. This allows portals to be reconfigured without schema changes.

#### Available Filter Types

```typescript
interface PortalFilters {
  // Geographic filters
  city?: string;                    // "Atlanta", "Marietta"
  neighborhoods?: string[];         // ["Midtown", "Marietta Square"]
  geo_center?: [number, number];    // [lat, lng] for radius queries
  geo_radius_km?: number;           // Distance in kilometers
  venue_ids?: number[];             // Explicit venue whitelist

  // Content filters
  categories?: string[];            // Category whitelist
  exclude_categories?: string[];    // Category blacklist (e.g., "adult")
  tags?: string[];                  // Tag-based filtering

  // Temporal filters (rare)
  date_range_start?: string;        // "2026-01-01"
  date_range_end?: string;          // "2026-12-31"
  price_max?: number;               // Maximum price
}
```

**Example Portal Filters:**

```sql
-- Atlanta city portal (broad coverage)
INSERT INTO portals (slug, name, filters)
VALUES (
  'atlanta',
  'Atlanta',
  '{
    "city": "Atlanta",
    "geo_center": [33.7490, -84.3880],
    "geo_radius_km": 25,
    "exclude_categories": ["adult"]
  }'
);

-- Marietta neighborhood portal (narrow focus)
INSERT INTO portals (slug, name, filters)
VALUES (
  'marietta',
  'Marietta',
  '{
    "city": "Marietta",
    "neighborhoods": ["Marietta Square", "East Cobb", "West Cobb"],
    "geo_center": [33.9526, -84.5499],
    "geo_radius_km": 15
  }'
);

-- Business portal (specific venues only)
INSERT INTO portals (slug, name, portal_type, filters)
VALUES (
  'piedmont',
  'Piedmont Healthcare',
  'business',
  '{
    "venue_ids": [123, 456, 789],
    "categories": ["fitness", "wellness"]
  }'
);
```

### Filter Application Flow

```
1. User visits portal page → /marietta
2. Portal data loaded → SELECT * FROM portals WHERE slug = 'marietta'
3. Filters extracted → portal.filters = { city: "Marietta", neighborhoods: [...] }
4. Search query initiated → /api/events?neighborhoods=Marietta%20Square,East%20Cobb
5. Venue lookup → SELECT id FROM venues WHERE neighborhood IN ('Marietta Square', 'East Cobb')
6. Event filtering → SELECT * FROM events WHERE venue_id IN (venue_ids)
7. Results returned → Events from Marietta venues only
```

**Implementation in Code:**

```typescript
// web/lib/search.ts (lines 297-308)
if (filters.neighborhoods && filters.neighborhoods.length > 0) {
  queries.push(
    supabase
      .from("venues")
      .select("id")
      .in("neighborhood", filters.neighborhoods)
      .then(({ data }) => ({
        type: "neighborhoods",
        ids: data?.map((v) => v.id) || [],
      }))
  );
}

// Later: Apply venue filter to events
eventsQuery = eventsQuery.in("venue_id", neighborhoodVenueIds);
```

---

## 2. Event/Venue Association Model

### Venue-Based Geographic Inheritance

**All events inherit geography from their venue** via foreign key relationship:

```
Event (source_id, venue_id, title, dates...)
  → Venue (id, city, neighborhood, lat, lng)
    → Portal filters (city = "Marietta", neighborhoods = [...])
```

**Venue Table Schema:**

```sql
CREATE TABLE venues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address TEXT,
  neighborhood TEXT,              -- KEY FIELD for filtering
  city TEXT DEFAULT 'Atlanta',    -- KEY FIELD for filtering
  state TEXT DEFAULT 'GA',
  zip TEXT,
  lat DECIMAL(10, 8),             -- For geo-radius queries
  lng DECIMAL(11, 8),             -- For geo-radius queries
  venue_type TEXT,                -- "theater", "museum", "park", etc.
  website TEXT,
  aliases TEXT[],                 -- For venue normalization
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Event Table Schema (relevant fields):**

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  venue_id INTEGER REFERENCES venues(id),  -- Geographic link
  portal_id UUID REFERENCES portals(id),   -- Optional portal restriction
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  category TEXT,
  -- ... other fields
);
```

### Why This Model?

**Advantages:**
- Single source of truth for venue location
- Venues can be updated independently (bulk neighborhood fixes)
- Events automatically inherit venue updates
- Supports multi-event queries by venue
- Enables venue-specific feeds

**Trade-offs:**
- Events without venues have no geography (must be avoided in crawlers)
- Venue data quality is critical (affects all events at that venue)
- Multi-venue events require separate event entries (rare edge case)

### Geographic Data Quality

**Current Issue:** 40.9% of events lack neighborhood data (per companion playbook).

**Root Causes:**
1. Crawlers not setting `neighborhood` in `VENUE_DATA`
2. Aggregator crawlers creating venues with minimal data
3. Legacy venues pre-dating neighborhood requirement

**Solution:** See companion playbook for crawler-level fixes + backfill scripts.

---

## 3. Portal-Restricted Events

### Event Visibility Model

Events can be **public** (visible in all portals) or **restricted** (visible only in specific portal).

**Controlled by:** `events.portal_id` (UUID, nullable)

```sql
-- Public event (appears in ALL portals if filters match)
INSERT INTO events (title, venue_id, portal_id)
VALUES ('Public Concert', 123, NULL);

-- Portal-restricted event (only visible in Piedmont portal)
INSERT INTO events (title, venue_id, portal_id)
VALUES ('Piedmont Wellness Class', 456,
  (SELECT id FROM portals WHERE slug = 'piedmont'));
```

**Query Logic:**

```typescript
// web/app/api/portals/[slug]/feed/route.ts (lines 396-414)

if (isBusinessPortal) {
  // Business portals: Show portal-specific events + federated sources
  poolQuery = poolQuery.or(`portal_id.eq.${portal.id},source_id.in.(${sourceIds})`);
} else {
  // City portals: Show public events + portal-specific events + federated sources
  poolQuery = poolQuery.or(`portal_id.eq.${portal.id},portal_id.is.null,source_id.in.(${sourceIds})`);
}
```

**Use Cases:**

| Portal Type | `portal_id` Strategy | Example |
|-------------|---------------------|---------|
| City | Mostly `NULL` (public) | Atlanta shows all public Atlanta events |
| Business | All restricted | Piedmont only shows Piedmont events |
| Event | Mixed | Music festival shows public + festival-specific |
| Personal | All restricted | Private user portal |

**Migration:** `/database/migrations/019_event_portal_restriction.sql`

---

## 4. Source Federation System

### Overview

Portals can **own sources** and **share content** with other portals via a subscription model. This avoids duplicating crawlers for shared content.

**Key Tables:**

```sql
-- Sources can be owned by portals
ALTER TABLE sources
ADD COLUMN owner_portal_id UUID REFERENCES portals(id);

-- Sharing rules define what's accessible
CREATE TABLE source_sharing_rules (
  id UUID PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  owner_portal_id UUID REFERENCES portals(id),
  share_scope TEXT CHECK (share_scope IN ('all', 'selected', 'none')),
  allowed_categories TEXT[],  -- NULL = all categories
  -- ...
);

-- Subscriptions allow portals to consume shared content
CREATE TABLE source_subscriptions (
  id UUID PRIMARY KEY,
  subscriber_portal_id UUID REFERENCES portals(id),
  source_id INTEGER REFERENCES sources(id),
  subscription_scope TEXT CHECK (subscription_scope IN ('all', 'selected')),
  subscribed_categories TEXT[],  -- NULL = all categories
  is_active BOOLEAN DEFAULT TRUE,
  -- ...
);

-- Materialized view for fast lookups
CREATE MATERIALIZED VIEW portal_source_access AS
SELECT
  p.id as portal_id,
  s.id as source_id,
  s.name as source_name,
  -- Category constraints from sharing rules + subscriptions
  CASE
    WHEN sub.subscribed_categories IS NOT NULL THEN sub.subscribed_categories
    WHEN sr.allowed_categories IS NOT NULL THEN sr.allowed_categories
    ELSE NULL  -- NULL = all categories
  END as accessible_categories,
  -- Access type (owner, global, subscription)
  CASE
    WHEN s.owner_portal_id = p.id THEN 'owner'
    WHEN s.owner_portal_id IS NULL THEN 'global'
    ELSE 'subscription'
  END as access_type
FROM portals p
CROSS JOIN sources s
LEFT JOIN source_sharing_rules sr ON sr.source_id = s.id
LEFT JOIN source_subscriptions sub ON sub.source_id = s.id AND sub.subscriber_portal_id = p.id
WHERE
  s.owner_portal_id = p.id  -- Owned sources
  OR s.owner_portal_id IS NULL  -- Global sources
  OR (sr.share_scope != 'none' AND sub.is_active = TRUE);  -- Subscribed sources
```

**Example: Marietta subscribes to Atlanta music sources**

```sql
-- Atlanta owns music venues
UPDATE sources
SET owner_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE slug IN ('the-earl', 'variety-playhouse', 'terminal-west');

-- Atlanta shares music category
INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope, allowed_categories)
SELECT id, (SELECT id FROM portals WHERE slug = 'atlanta'), 'selected', '{"music"}'
FROM sources WHERE slug IN ('the-earl', 'variety-playhouse');

-- Marietta subscribes to music content
INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, subscribed_categories)
SELECT
  (SELECT id FROM portals WHERE slug = 'marietta'),
  id,
  'selected',
  '{"music"}'
FROM sources WHERE slug IN ('the-earl', 'variety-playhouse');
```

**Query Integration:**

```typescript
// web/lib/federation.ts
export async function getPortalSourceAccess(portalId: string): Promise<PortalSourceAccess> {
  const { data } = await supabase
    .from("portal_source_access")
    .select("source_id, source_name, accessible_categories, access_type")
    .eq("portal_id", portalId);

  return {
    sourceIds: data.map(row => row.source_id),
    categoryConstraints: new Map(
      data.map(row => [row.source_id, row.accessible_categories])
    ),
    accessDetails: data
  };
}
```

**Migration:** `/database/migrations/035_source_federation.sql`

---

## 5. Expansion Strategies

### Strategy 1: Extend Existing Portal

**Use Case:** Add suburbs to main city portal (Atlanta → includes Marietta, Decatur)

**Implementation:**

```sql
-- Update Atlanta portal to include Marietta neighborhoods
UPDATE portals
SET filters = jsonb_set(
  filters,
  '{neighborhoods}',
  (filters->'neighborhoods')::jsonb || '["Marietta Square", "East Cobb", "West Cobb"]'::jsonb
)
WHERE slug = 'atlanta';

-- Optionally expand radius
UPDATE portals
SET filters = jsonb_set(filters, '{geo_radius_km}', '35')
WHERE slug = 'atlanta';
```

**Pros:**
- No new portal needed
- Shared branding and sections
- Easier for users (single metro portal)
- Lower maintenance overhead

**Cons:**
- No Marietta-specific branding
- Harder to curate hyperlocal content
- URL is still `/atlanta` not `/marietta`

### Strategy 2: Create Independent Portal

**Use Case:** Dedicated portal for new area with unique identity

**Implementation:**

```sql
-- Create Marietta portal
INSERT INTO portals (slug, name, tagline, portal_type, status, filters, branding, settings)
VALUES (
  'marietta',
  'Marietta',
  'Discover events in Marietta, GA',
  'city',
  'active',
  '{
    "city": "Marietta",
    "neighborhoods": ["Marietta Square", "East Cobb", "West Cobb"],
    "geo_center": [33.9526, -84.5499],
    "geo_radius_km": 15
  }',
  '{
    "primary_color": "#003DA5",
    "secondary_color": "#C8102E",
    "logo_url": "https://cdn.lostcity.ai/portals/marietta-logo.png"
  }',
  '{
    "show_map": true,
    "default_view": "list",
    "show_categories": true
  }'
);

-- Create default feed sections
WITH portal AS (SELECT id FROM portals WHERE slug = 'marietta')
INSERT INTO portal_sections (portal_id, slug, title, section_type, auto_filter, display_order)
VALUES
  ((SELECT id FROM portal), 'happening-now', 'Happening Now', 'auto', '{"date_filter": "today"}', 0),
  ((SELECT id FROM portal), 'this-weekend', 'This Weekend', 'auto', '{"date_filter": "weekend"}', 1);
```

**Pros:**
- Custom branding for Marietta
- Dedicated URL (`/marietta` or `marietta.lostcity.ai`)
- Hyperlocal content curation
- Community identity/ownership

**Cons:**
- More portals to manage
- Potential content overlap with Atlanta
- Need to configure sections separately

### Strategy 3: Federation via Subscriptions

**Use Case:** Business portal wants Atlanta content

**Implementation:**

```sql
-- Create business portal
INSERT INTO portals (slug, name, portal_type, plan, filters, status)
VALUES (
  'marriott-atlanta',
  'Marriott Atlanta Events',
  'business',
  'professional',
  '{"categories": ["music", "art", "food_drink"]}',
  'active'
);

-- Subscribe to Atlanta sources (music only)
INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, subscribed_categories)
SELECT
  (SELECT id FROM portals WHERE slug = 'marriott-atlanta'),
  s.id,
  'selected',
  '["music"]'
FROM sources s
WHERE s.owner_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
  AND s.slug IN ('fox-theatre', 'symphony-hall', 'variety-playhouse');
```

**Pros:**
- No duplication of crawlers
- Content auto-syncs from Atlanta
- Category-level granularity
- B2B revenue model

**Cons:**
- More complex setup
- Requires federation infrastructure
- Portal depends on parent portal's content

---

## 6. Database Schema Changes for Expansion

### Required Indexes

```sql
-- Geographic filtering performance
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city);
CREATE INDEX IF NOT EXISTS idx_venues_neighborhood ON venues(neighborhood);
CREATE INDEX IF NOT EXISTS idx_venues_location ON venues USING gist(ll_to_earth(lat, lng));

-- Portal filtering performance
CREATE INDEX IF NOT EXISTS idx_events_portal_id ON events(portal_id);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON events(venue_id);

-- Portal lookup performance
CREATE INDEX IF NOT EXISTS idx_portals_slug_active ON portals(slug) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_portals_custom_domain ON portals(custom_domain)
  WHERE status = 'active' AND custom_domain IS NOT NULL;
```

### Migration Template: Add New Area Portal

```sql
-- File: database/migrations/XXX_marietta_portal.sql

BEGIN;

-- 1. Standardize venue data for new area
UPDATE venues
SET
  city = 'Marietta',
  neighborhood = CASE
    WHEN address ILIKE '%Marietta Square%' OR address ILIKE '%N Park Square%' THEN 'Marietta Square'
    WHEN address ILIKE '%East Cobb%' OR address ILIKE '%Johnson Ferry%' THEN 'East Cobb'
    WHEN address ILIKE '%West Cobb%' THEN 'West Cobb'
    ELSE 'Marietta'
  END
WHERE city = 'Marietta'
   OR address ILIKE '%Marietta, GA%'
   OR (lat BETWEEN 33.9 AND 34.0 AND lng BETWEEN -84.6 AND -84.5);

-- 2. Create portal
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
  'marietta',
  'Marietta',
  'Discover events in Marietta, GA',
  'city',
  'active',
  'public',
  '{
    "city": "Marietta",
    "neighborhoods": ["Marietta Square", "East Cobb", "West Cobb"],
    "geo_center": [33.9526, -84.5499],
    "geo_radius_km": 15
  }',
  '{
    "primary_color": "#003DA5",
    "secondary_color": "#C8102E"
  }',
  '{
    "show_map": true,
    "default_view": "list",
    "show_categories": true
  }'
);

-- 3. Create default feed sections
WITH portal AS (SELECT id FROM portals WHERE slug = 'marietta')
INSERT INTO portal_sections (portal_id, slug, title, section_type, auto_filter, display_order, is_visible)
VALUES
  ((SELECT id FROM portal), 'happening-now', 'Happening Now', 'auto', '{"date_filter": "today", "sort_by": "date"}', 0, true),
  ((SELECT id FROM portal), 'this-weekend', 'This Weekend', 'auto', '{"date_filter": "weekend"}', 1, true),
  ((SELECT id FROM portal), 'music', 'Live Music', 'auto', '{"categories": ["music"], "date_filter": "next_7_days"}', 2, true),
  ((SELECT id FROM portal), 'arts', 'Arts & Culture', 'auto', '{"categories": ["art", "theater"], "date_filter": "next_7_days"}', 3, true);

-- 4. Add area-specific sources (if any)
-- Note: Most crawlers created in Python code, just link ownership here
UPDATE sources
SET owner_portal_id = (SELECT id FROM portals WHERE slug = 'marietta')
WHERE slug IN (
  'marietta-square-market',
  'strand-theatre-marietta',
  'theatre-in-the-square'
);

COMMIT;
```

---

## 7. API Routes & Filtering

### Portal Content Routes

| Route | Purpose | Geographic Filtering |
|-------|---------|---------------------|
| `GET /api/portals/[slug]/feed` | Portal feed with sections | Applies `portal.filters` to all queries |
| `GET /api/events` | Global event search | Accepts `portal_id`, `neighborhoods`, `city` params |
| `GET /api/portals/[slug]/sources` | Portal's accessible sources | Returns federation-aware source list |
| `GET /api/venues` | Venue search | Direct `neighborhood`/`city` filtering |
| `GET /api/portals/[slug]/happening-now` | Live events | Combines time + geographic filters |

### Feed API Deep Dive

**File:** `/web/app/api/portals/[slug]/feed/route.ts`

**Flow:**

```typescript
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params;

  // 1. Load portal
  const { data: portal } = await supabase
    .from("portals")
    .select("id, slug, name, portal_type, settings, filters")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  // 2. Get federated source access
  const federationAccess = await getPortalSourceAccess(portal.id);

  // 3. Load portal sections
  const { data: sections } = await supabase
    .from("portal_sections")
    .select("id, title, auto_filter, ...")
    .eq("portal_id", portal.id)
    .eq("is_visible", true)
    .order("display_order");

  // 4. Build event pool query
  let poolQuery = supabase
    .from("events")
    .select("id, title, start_date, venue:venues(id, name, neighborhood, city)")
    .gte("start_date", today)
    .is("canonical_event_id", null);

  // 5. Apply geographic filters from portal.filters
  const filters = portal.filters as PortalFilters;

  if (filters.neighborhoods?.length) {
    // Get venue IDs in these neighborhoods
    const { data: venues } = await supabase
      .from("venues")
      .select("id")
      .in("neighborhood", filters.neighborhoods);

    const venueIds = venues.map(v => v.id);
    poolQuery = poolQuery.in("venue_id", venueIds);
  }

  if (filters.city) {
    const { data: venues } = await supabase
      .from("venues")
      .select("id")
      .eq("city", filters.city);

    const venueIds = venues.map(v => v.id);
    poolQuery = poolQuery.in("venue_id", venueIds);
  }

  // 6. Apply portal visibility logic
  if (isBusinessPortal) {
    // Business: portal events + federated sources
    poolQuery = poolQuery.or(
      `portal_id.eq.${portal.id},source_id.in.(${federationAccess.sourceIds})`
    );
  } else {
    // City: public events + portal events + federated sources
    poolQuery = poolQuery.or(
      `portal_id.eq.${portal.id},portal_id.is.null,source_id.in.(${federationAccess.sourceIds})`
    );
  }

  // 7. Execute query and build sections
  const { data: events } = await poolQuery.limit(200);

  // 8. Build sections using event pool
  const feedSections = sections.map(section => {
    let sectionEvents = filterEventsForSection(events, section.auto_filter);

    return {
      id: section.id,
      title: section.title,
      events: sectionEvents.slice(0, section.max_items || 5)
    };
  });

  return Response.json({ portal, sections: feedSections });
}
```

**Key Pattern:** Query once, filter in-memory for sections (performance optimization).

### Events API Deep Dive

**File:** `/web/app/api/events/route.ts`

**Flow:**

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Parse filters from query params
  const filters: SearchFilters = {
    search: searchParams.get("search"),
    categories: searchParams.get("categories")?.split(","),
    neighborhoods: searchParams.get("neighborhoods")?.split(","),
    city: searchParams.get("city"),
    portal_id: searchParams.get("portal_id"),
    // ... other filters
  };

  // Delegate to search module
  const { events, total } = await getFilteredEventsWithSearch(filters, page, pageSize);

  return Response.json({ events, total });
}
```

**Search Implementation (`web/lib/search.ts`):**

```typescript
export async function getFilteredEventsWithSearch(
  filters: SearchFilters,
  page: number,
  pageSize: number
) {
  // 1. Build venue filter (batched queries)
  const { neighborhoodVenueIds, cityVenueIds } = await batchFetchVenueIds({
    neighborhoods: filters.neighborhoods,
    city: filters.city
  });

  // 2. Start events query
  let query = supabase
    .from("events")
    .select("*, venue:venues(*)")
    .gte("start_date", today);

  // 3. Apply venue geographic filters
  if (neighborhoodVenueIds.length > 0) {
    query = query.in("venue_id", neighborhoodVenueIds);
  } else if (cityVenueIds.length > 0) {
    query = query.in("venue_id", cityVenueIds);
  }

  // 4. Apply portal filter
  if (filters.portal_id) {
    const { sourceIds } = await getPortalSourceAccess(filters.portal_id);
    query = query.or(`portal_id.eq.${filters.portal_id},portal_id.is.null,source_id.in.(${sourceIds})`);
  }

  // 5. Apply category, date, price filters...

  // 6. Execute query
  const { data: events, count } = await query
    .range(page * pageSize, (page + 1) * pageSize - 1);

  return { events, total: count };
}
```

---

## 8. Middleware & Routing

### Subdomain Routing

**File:** `/web/middleware.ts`

**Pattern:**

```
atlanta.lostcity.ai → rewrites to /atlanta
marietta.lostcity.ai → rewrites to /marietta
```

**Implementation:**

```typescript
export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const url = request.nextUrl.clone();

  // Skip API routes
  if (url.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  let portalSlug: string | null = null;

  // Check for custom domain (B2B portals)
  if (isCustomDomain(host)) {
    portalSlug = await resolveCustomDomainInMiddleware(host, request);

    if (portalSlug && url.pathname === "/") {
      url.pathname = `/${portalSlug}`;
      const response = NextResponse.rewrite(url);
      response.headers.set("x-portal-slug", portalSlug);
      response.headers.set("x-custom-domain", "true");
      return response;
    }
  }

  // Parse subdomain (e.g., atlanta.lostcity.ai)
  if (host.includes(".")) {
    const parts = host.split(".");
    const firstPart = parts[0];

    const skipParts = ["www", "lostcity", "localhost", "vercel"];
    if (!skipParts.includes(firstPart) && parts.length > 1) {
      portalSlug = firstPart;
    }
  }

  // Rewrite root to portal page
  if (portalSlug && url.pathname === "/") {
    url.pathname = `/${portalSlug}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
```

**Key Features:**
- Supports subdomains (`marietta.lostcity.ai`)
- Supports custom domains (`events.marriott.com`)
- Only rewrites root path (other routes work globally)
- Stores portal context in headers (`x-portal-slug`)

### Custom Domains (B2B Feature)

**Migration:** `/database/migrations/091_custom_domains.sql`

**Schema:**

```sql
ALTER TABLE portals
ADD COLUMN custom_domain VARCHAR(255) UNIQUE,
ADD COLUMN custom_domain_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN custom_domain_verification_token VARCHAR(64);
```

**Verification Flow:**

1. Portal admin sets `custom_domain = "events.marriott.com"`
2. System generates verification token
3. Admin adds TXT record: `_lostcity-verify.events.marriott.com` → token
4. Admin clicks "Verify Domain" → `/api/admin/portals/[id]/verify-domain`
5. API checks DNS record, sets `custom_domain_verified = true`
6. Middleware resolves `events.marriott.com` → portal slug

**Code:**

```typescript
// web/lib/portal.ts
export async function resolveCustomDomain(domain: string): Promise<string | null> {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");

  // Check cache first
  const cached = getCachedDomain(normalizedDomain);
  if (cached !== undefined) return cached;

  // Query database
  const { data } = await supabase
    .from("portals")
    .select("slug")
    .eq("custom_domain", normalizedDomain)
    .eq("custom_domain_verified", true)
    .eq("status", "active")
    .maybeSingle();

  const slug = data?.slug || null;
  setCachedDomain(normalizedDomain, slug);
  return slug;
}
```

---

## 9. Testing & Validation

### Data Quality Checks

```sql
-- 1. Verify all venues in new area have geographic data
SELECT
  COUNT(*) FILTER (WHERE neighborhood IS NULL) as missing_neighborhood,
  COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) as missing_coordinates,
  COUNT(*) as total_venues
FROM venues
WHERE city = 'Marietta';

-- Expected: missing_neighborhood < 20%, missing_coordinates < 10%

-- 2. Check event coverage distribution
SELECT
  DATE_TRUNC('week', e.start_date) as week,
  COUNT(*) as event_count,
  COUNT(DISTINCT v.neighborhood) as neighborhood_count,
  COUNT(DISTINCT e.category) as category_count
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.city = 'Marietta'
  AND e.start_date >= CURRENT_DATE
  AND e.start_date < CURRENT_DATE + INTERVAL '30 days'
GROUP BY week
ORDER BY week;

-- Expected: 10-20+ events per week, 3+ neighborhoods, 4+ categories

-- 3. Verify portal filter coverage
WITH marietta_venues AS (
  SELECT id FROM venues
  WHERE city = 'Marietta'
     OR neighborhood IN ('Marietta Square', 'East Cobb', 'West Cobb')
)
SELECT
  COUNT(DISTINCT e.id) as events_in_area,
  COUNT(DISTINCT e.id) FILTER (WHERE e.portal_id IS NULL) as public_events,
  COUNT(DISTINCT e.id) FILTER (WHERE e.portal_id IS NOT NULL) as restricted_events
FROM events e
WHERE e.venue_id IN (SELECT id FROM marietta_venues)
  AND e.start_date >= CURRENT_DATE;

-- Expected: Most events should be public (portal_id = NULL)
```

### API Testing

```bash
# Test portal feed
curl "https://lostcity.ai/api/portals/marietta/feed"

# Expected response:
{
  "portal": { "slug": "marietta", "name": "Marietta" },
  "sections": [
    {
      "id": "...",
      "title": "Happening Now",
      "events": [
        {
          "id": 123,
          "title": "Concert at Strand Theatre",
          "venue": {
            "name": "Strand Theatre",
            "neighborhood": "Marietta Square"
          }
        }
      ]
    }
  ]
}

# Test neighborhood filter
curl "https://lostcity.ai/api/events?neighborhoods=Marietta%20Square,East%20Cobb"

# Expected: Only events at venues in those neighborhoods

# Test portal-specific events
curl "https://lostcity.ai/api/events?portal_id=<marietta-portal-uuid>"

# Expected: Public events + Marietta-restricted events
```

### Performance Benchmarks

```sql
-- Query plan for neighborhood filter
EXPLAIN ANALYZE
SELECT e.id, e.title, v.name as venue_name
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.neighborhood IN ('Marietta Square', 'East Cobb')
  AND e.start_date >= CURRENT_DATE
ORDER BY e.start_date
LIMIT 20;

-- Expected plan:
-- 1. Index Scan on venues.neighborhood (idx_venues_neighborhood)
-- 2. Nested Loop Join with events (uses idx_events_venue_id)
-- 3. Index Scan on events.start_date (idx_events_start_date)

-- Target: < 50ms execution time for 20 results
```

---

## 10. Common Patterns & Anti-Patterns

### ✅ Recommended Patterns

**1. Use JSONB filters for flexibility**

```sql
-- Good: Flexible, no schema changes needed
UPDATE portals
SET filters = filters || '{"neighborhoods": ["New Area"]}'::jsonb
WHERE slug = 'atlanta';
```

**2. Batch venue queries**

```typescript
// Good: Single query for all neighborhoods
const { data: venues } = await supabase
  .from("venues")
  .select("id")
  .in("neighborhood", ["Marietta Square", "East Cobb", "West Cobb"]);

// Bad: N queries (one per neighborhood)
for (const hood of neighborhoods) {
  const { data } = await supabase.from("venues").select("id").eq("neighborhood", hood);
}
```

**3. Pre-compute portal access (materialized view)**

```sql
-- Good: Fast lookups
SELECT source_id FROM portal_source_access WHERE portal_id = $1;

-- Bad: Complex joins on every request
SELECT s.id FROM sources s
LEFT JOIN source_sharing_rules sr ON sr.source_id = s.id
LEFT JOIN source_subscriptions sub ON sub.source_id = s.id
WHERE ...;
```

### ❌ Anti-Patterns to Avoid

**1. Hardcoding geographic logic**

```typescript
// Bad: Hard to maintain, not flexible
if (portalSlug === 'marietta') {
  query = query.eq("venue.city", "Marietta");
} else if (portalSlug === 'atlanta') {
  query = query.in("venue.city", ["Atlanta", "Decatur", "East Point"]);
}

// Good: Use portal.filters
const filters = portal.filters as PortalFilters;
if (filters.city) {
  query = query.eq("venue.city", filters.city);
}
if (filters.neighborhoods) {
  query = query.in("venue.neighborhood", filters.neighborhoods);
}
```

**2. Creating duplicate events**

```typescript
// Bad: Same event in multiple portals = duplication
INSERT INTO events (title, venue_id, portal_id) VALUES ('Concert', 123, 'atlanta-uuid');
INSERT INTO events (title, venue_id, portal_id) VALUES ('Concert', 123, 'marietta-uuid');

// Good: One public event, visible in both portals via filters
INSERT INTO events (title, venue_id, portal_id) VALUES ('Concert', 123, NULL);
```

**3. Filtering after query**

```typescript
// Bad: Fetches too much data, filters in JS
const allEvents = await supabase.from("events").select("*, venue:venues(*)");
const mariettaEvents = allEvents.filter(e => e.venue.city === "Marietta");

// Good: Filter in SQL
const venues = await supabase.from("venues").select("id").eq("city", "Marietta");
const events = await supabase.from("events").select("*").in("venue_id", venueIds);
```

---

## 11. Future Enhancements

### Geo-Radius Queries

**Currently:** Only neighborhood/city filters are implemented.

**Future:** Add PostGIS support for radius-based filtering.

```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography column
ALTER TABLE venues ADD COLUMN location geography(POINT, 4326);

-- Populate from lat/lng
UPDATE venues SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326);

-- Create spatial index
CREATE INDEX idx_venues_location ON venues USING GIST(location);

-- Query events within 15km of Marietta center
SELECT e.*
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE ST_DWithin(
  v.location,
  ST_SetSRID(ST_MakePoint(-84.5499, 33.9526), 4326)::geography,
  15000  -- 15km in meters
);
```

**Implementation in `portal.filters`:**

```json
{
  "geo_center": [33.9526, -84.5499],
  "geo_radius_km": 15
}
```

### Multi-City Portals

**Use Case:** "North Atlanta" portal covering Roswell + Alpharetta + Johns Creek.

**Implementation:**

```sql
INSERT INTO portals (slug, name, filters)
VALUES (
  'north-atlanta',
  'North Atlanta',
  '{
    "cities": ["Roswell", "Alpharetta", "Johns Creek", "Sandy Springs"],
    "neighborhoods": ["Roswell Town Center", "Avalon", "City Springs"]
  }'
);
```

**Requires:** Update `web/lib/search.ts` to handle `filters.cities` (plural).

### Neighborhood Auto-Detection

**Use Case:** Crawlers that don't know venue neighborhood.

**Implementation:**

```python
# /crawlers/geocoding.py
def reverse_geocode_neighborhood(lat: float, lng: float) -> Optional[str]:
    """Use Google Maps Geocoding API to get neighborhood from coordinates."""
    response = requests.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={
            "latlng": f"{lat},{lng}",
            "key": config.google_maps_api_key
        }
    )

    for result in response.json().get("results", []):
        for component in result.get("address_components", []):
            if "neighborhood" in component.get("types", []):
                return component["long_name"]

    return None
```

---

## 12. Summary & Recommendations

### For Adding Marietta Coverage

**Recommended Approach: Strategy 2 (Independent Portal)**

**Rationale:**
- Marietta has distinct identity (separate city, not Atlanta neighborhood)
- Allows Marietta-specific branding and curation
- Clean URL (`/marietta`)
- Can still subscribe to Atlanta sources via federation

**Implementation Steps:**

1. **Data Preparation** (Week 1)
   - Run venue audit: Identify all Marietta venues
   - Standardize neighborhoods ("Marietta Square", "East Cobb", etc.)
   - Backfill missing lat/lng coordinates
   - Add neighborhood tags to existing events

2. **Portal Creation** (Week 1)
   - Run migration: Create portal + sections (use template above)
   - Configure filters: `city = "Marietta"`, `neighborhoods = [...]`
   - Set up branding (optional)
   - Test feed API

3. **Source Configuration** (Week 2)
   - Add Marietta-specific sources (see companion playbook)
   - Link ownership: `UPDATE sources SET owner_portal_id = marietta_uuid`
   - Set up federation: Subscribe to relevant Atlanta sources
   - Test federation queries

4. **Quality Assurance** (Week 2)
   - Verify 50+ events in next 30 days
   - Check neighborhood distribution (events across multiple neighborhoods)
   - Test API routes (`/api/portals/marietta/feed`, `/api/events?city=Marietta`)
   - Performance benchmarks (< 100ms for feed)

5. **Launch** (Week 3)
   - Enable portal (`status = 'active'`)
   - Set up subdomain (`marietta.lostcity.ai`)
   - Monitor crawl health
   - Gather user feedback

### Key Metrics for Success

- **Coverage:** 50+ events/month from Marietta area
- **Quality:** <20% missing neighborhood data
- **Diversity:** Events across 5+ categories
- **Performance:** Feed loads in <2s
- **Sources:** 10-15 active sources
- **Engagement:** 100+ portal visits/week

### Architecture Best Practices

1. **Always use portal.filters** - Don't hardcode geographic logic
2. **Batch venue queries** - Avoid N+1 query patterns
3. **Prefer public events** - Only use `portal_id` restriction for truly exclusive content
4. **Use federation for shared content** - Avoid duplicating crawlers
5. **Index aggressively** - Geographic queries are slow without indexes
6. **Validate data quality** - Missing neighborhoods break filtering

---

## Appendix: File Reference

### Core Portal Files

```
/web/lib/
├── portal.ts                 # Portal data access (getPortalBySlug, resolveCustomDomain)
├── portal-context.tsx        # Portal types and React context
├── search.ts                 # Event filtering logic (neighborhoods, city, geo)
└── federation.ts             # Source subscription system

/web/app/api/
├── portals/[slug]/feed/      # Portal feed generation
├── portals/[slug]/sources/   # Portal source access
├── events/route.ts           # Global event search
└── admin/portals/            # Portal management (B2B)

/database/migrations/
├── 001_portals.sql           # Portal schema
├── 019_event_portal_restriction.sql  # Portal-specific events
├── 035_source_federation.sql # Source sharing/subscriptions
└── 091_custom_domains.sql    # B2B custom domains

/web/middleware.ts            # Subdomain routing + custom domains
```

### Companion Documents

- **Geographic Expansion Playbook** - Crawler implementation, source discovery
- **Data Audit Summary** - Current coverage stats, data quality issues
- **Federation Guide** (future) - Detailed source subscription workflows

---

**Version:** 1.0
**Last Updated:** 2026-01-31
**Maintained By:** LostCity Engineering Team
