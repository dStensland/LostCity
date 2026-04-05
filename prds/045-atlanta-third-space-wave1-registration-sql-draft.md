# PRD 045: Atlanta Third-Space Wave 1 Registration SQL Draft

**Portal:** `atlanta`
**Surface:** `consumer`
**Status:** SQL draft
**Last Updated:** 2026-04-01
**Depends on:** `prds/044-atlanta-third-space-wave1-activation-plan.md`

---

## Purpose

This document provides draft SQL for the two Wave 1 registration targets:

- `community-grounds`
- `charis-books`

It is intentionally not a live migration file.

The goal is to make the next migration step copy-pasteable while avoiding edits
to the currently shared migration area until implementation is coordinated.

Important update from dry-run validation on 2026-04-01:

- `charis-books` is already present in the current DB target as a live source
  row
- `fulton-library` and `atlanta-beltline` are also present as live source rows

So this SQL draft remains directly relevant for:

- `community-grounds`

and only conditionally relevant for:

- `charis-books`, if migration parity or source-registration provenance needs to
  be restored in code rather than the row being created from some earlier path

---

## Assumptions

These drafts assume:

- Atlanta ownership
- source rows should be active
- both sources should have seeded venue rows
- `portal_source_access` should be refreshed after registration
- `source_sharing_rules` are not required in Wave 1 unless another portal needs
  direct subscription immediately

Two open implementation assumptions remain:

### 1. `integration_method`

These drafts use `python` because both sources are intended to run through
Python crawler code.

If the team wants source rows to reflect profile-driven `html` or
`llm_crawler` semantics instead, normalize that deliberately before applying.

### 2. `expected_event_count`

These drafts include:

- `community-grounds = 0`
- `charis-books = 25`

If source-health tooling treats `0` as broken rather than valid destination-
first behavior, either omit the column or align with current ops conventions.

---

## Proposed Combined Migration Body

```sql
DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Wave 1 third-space sources.';
  END IF;

  -- ============================================================
  -- 1. Community Grounds
  -- ============================================================

  INSERT INTO venues (
    name,
    slug,
    address,
    neighborhood,
    city,
    state,
    zip,
    lat,
    lng,
    venue_type,
    spot_type,
    website,
    description,
    vibes,
    active
  )
  VALUES (
    'Community Grounds',
    'community-grounds',
    '1297 McDonough Blvd SE',
    'South Atlanta',
    'Atlanta',
    'GA',
    '30315',
    33.7190676,
    -84.3852661,
    'coffee_shop',
    'coffee_shop',
    'https://communitygrounds.com/',
    'Neighborhood coffee shop operated by Focused Community Strategies. The official site describes Community Grounds as a positive third space for conversations, fellowship, creativity, and community-building, with conference-room reservations and daily coffee service.',
    ARRAY['community', 'coffee', 'third-space', 'conversation', 'meeting-friendly'],
    TRUE
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    venue_type = EXCLUDED.venue_type,
    spot_type = EXCLUDED.spot_type,
    website = EXCLUDED.website,
    description = EXCLUDED.description,
    vibes = EXCLUDED.vibes,
    active = EXCLUDED.active;

  INSERT INTO sources (
    name,
    slug,
    url,
    source_type,
    crawl_frequency,
    is_active,
    owner_portal_id,
    integration_method,
    expected_event_count
  )
  VALUES (
    'Community Grounds',
    'community-grounds',
    'https://communitygrounds.com/',
    'venue',
    'weekly',
    TRUE,
    atlanta_portal_id,
    'python',
    0
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    owner_portal_id = EXCLUDED.owner_portal_id,
    integration_method = EXCLUDED.integration_method,
    expected_event_count = EXCLUDED.expected_event_count;

  -- ============================================================
  -- 2. Charis Books & More
  -- ============================================================

  INSERT INTO venues (
    name,
    slug,
    address,
    neighborhood,
    city,
    state,
    zip,
    lat,
    lng,
    venue_type,
    spot_type,
    website,
    description,
    vibes,
    active
  )
  VALUES (
    'Charis Books & More',
    'charis-books',
    '184 S Candler St',
    'Decatur',
    'Decatur',
    'GA',
    '30030',
    33.7681081,
    -84.2922579,
    'bookstore',
    'bookstore',
    'https://www.charisbooksandmore.com/',
    'Independent feminist bookstore and community venue in Decatur hosting book clubs, readings, author conversations, and recurring community-centered programming.',
    ARRAY['bookstore', 'community', 'discussion', 'queer', 'feminist'],
    TRUE
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    venue_type = EXCLUDED.venue_type,
    spot_type = EXCLUDED.spot_type,
    website = EXCLUDED.website,
    description = EXCLUDED.description,
    vibes = EXCLUDED.vibes,
    active = EXCLUDED.active;

  INSERT INTO sources (
    name,
    slug,
    url,
    source_type,
    crawl_frequency,
    is_active,
    owner_portal_id,
    integration_method,
    expected_event_count
  )
  VALUES (
    'Charis Books & More',
    'charis-books',
    'https://www.charisbooksandmore.com/events',
    'venue',
    'daily',
    TRUE,
    atlanta_portal_id,
    'python',
    25
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    owner_portal_id = EXCLUDED.owner_portal_id,
    integration_method = EXCLUDED.integration_method,
    expected_event_count = EXCLUDED.expected_event_count;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
```

---

## Notes On The Draft

### Community Grounds coordinates

The draft uses OpenStreetMap/Nominatim resolution for:

- `1297 McDonough Blvd SE, Atlanta, GA 30315`
- `lat = 33.7190676`
- `lng = -84.3852661`

This resolves to the Carver Neighborhood Market / Community Grounds area.

Neighborhood label is still a judgment call. Current draft uses `South Atlanta`
instead of the more micro-local `Roseland`.

### Charis coordinates

The draft uses OpenStreetMap/Nominatim resolution for:

- `184 S Candler St, Decatur, GA 30030`
- `lat = 33.7681081`
- `lng = -84.2922579`

This is materially consistent with the existing crawler constants.

### Why seed venues here

Per `database/CLAUDE.md`, a full new-source flow should include both:

- source insert
- venue insert

That is still the right move here because these are destination-first or
destination-anchored sources, not abstract organizations with floating venues.

---

## Pre-Apply Checks

Before converting this draft into a real migration:

1. confirm `sources.integration_method` convention for Charis
2. confirm `expected_event_count = 0` is acceptable for destination-first
   Community Grounds
3. confirm neighborhood normalization for Community Grounds
4. create matching migration pair in:
   - `database/migrations/`
   - `supabase/migrations/`

---

## Post-Apply Checks

After registration:

```bash
python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched
cd crawlers
python3 main.py --source community-grounds --dry-run
python3 main.py --source charis-books --dry-run
```

Then confirm:

- both sources are active
- both sources are Atlanta-owned
- seeded venue rows exist and look correct
- no source-health false negatives appear immediately
