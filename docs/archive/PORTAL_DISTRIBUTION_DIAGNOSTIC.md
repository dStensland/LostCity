# Portal Distribution Diagnostic Report
**Generated:** February 4, 2026
**Database:** Supabase (LostCity events platform)

---

## Executive Summary

The LostCity platform has **8,160 total future events** distributed across 6 portals:
- **Atlanta portal**: 5,647 events (69.2% of platform)
- **Nashville portal**: 1,349 events (16.5% of platform)
- **Piedmont Healthcare portal**: 112 events (1.4% of platform)
- **3 inactive portals**: 0 events each (Sample Conference, Coach's Picks, Atlanta Families)
- **Unassigned events**: 1,052 future events (NULL portal_id) = 11.4% of platform

This represents a significant data quality issue: over 1,000 events lack portal assignment.

---

## Query Results

### Query 1: All Future Events by Portal (Unrestricted)

**Total database future events: 8,160**

| Portal Name | Portal Slug | Future Events | % of Total |
|---|---|---:|---:|
| Atlanta | atlanta | 5,647 | 69.2% |
| LostCity Nashville | nashville | 1,349 | 16.5% |
| Piedmont Healthcare | piedmont | 112 | 1.4% |
| Sample Conference 2026 | sample-conference | 0 | 0.0% |
| Coach's Picks | coach | 0 | 0.0% |
| Atlanta Families | atlanta-families | 0 | 0.0% |
| **UNASSIGNED (NULL)** | *null* | **1,052** | **11.4%** |

---

### Query 2: Events in Next 30 Days by Portal

**Total 30-day events: 3,308**

| Portal Name | Portal Slug | 30-Day Events |
|---|---|---:|
| Atlanta | atlanta | 2,523 |
| LostCity Nashville | nashville | 742 |
| Piedmont Healthcare | piedmont | 43 |
| Other portals | - | 0 |

**Insight:** 30-day distribution shows similar concentration (76.2% Atlanta, 22.4% Nashville).

---

### Query 3: Atlanta Portal - 30-Day Events by Category

**Total Atlanta 30-day events: 1,000 sampled**

| Category | Event Count | % of Sample |
|---|---:|---:|
| Music | 167 | 16.7% |
| Community | 155 | 15.5% |
| Nightlife | 148 | 14.8% |
| Theater | 137 | 13.7% |
| Sports | 112 | 11.2% |
| Comedy | 111 | 11.1% |
| Film | 50 | 5.0% |
| Art | 32 | 3.2% |
| Family | 27 | 2.7% |
| Words (Readings, Lectures) | 22 | 2.2% |
| Food & Drink | 13 | 1.3% |
| Outdoors | 8 | 0.8% |
| Learning | 6 | 0.6% |
| Fitness | 4 | 0.4% |
| Cultural | 3 | 0.3% |
| Other (Arts, Outdoor, Food, Religious, Tours) | 4 | 0.4% |

**Insight:** Atlanta has robust entertainment diversity with music, community, nightlife, and theater driving majority of events.

---

### Query 4: Unassigned Events - Top Contributing Sources

**Total unassigned future events: 1,052**

| Source Name | Source Slug | Unassigned Events | % of Unassigned |
|---|---|---:|---:|
| The Springs Cinema & Taphouse | springs-cinema | 211 | 20.1% |
| Ticketmaster | ticketmaster | 126 | 12.0% |
| Tara Theatre | tara-theatre | 117 | 11.1% |
| UNKNOWN (source_id: 460) | unknown | 65 | 6.2% |
| Plaza Theatre | plaza-theatre | 55 | 5.2% |
| Starlight Drive-In Theatre | starlight-drive-in | 36 | 3.4% |
| Landmark Midtown Art Cinema | landmark-midtown | 35 | 3.3% |
| Red Light Cafe | red-light-cafe | 30 | 2.9% |
| UNKNOWN (source_id: 459) | unknown | 22 | 2.1% |
| Ebenezer Baptist Church | ebenezer-baptist-church | 20 | 1.9% |
| Krog Street Market | krog-street-market | 19 | 1.8% |
| Morehouse College | morehouse-college | 19 | 1.8% |
| City of College Park | college-park-city | 18 | 1.7% |
| Museum of Design Atlanta | moda | 18 | 1.7% |
| **Top 14 total** | - | **792** | **75.3%** |

**Insight:** Cinema crawlers (Springs, Tara, Plaza, Starlight, Landmark) + Ticketmaster account for ~53% of unassigned events.

---

### Query 5: Atlanta Portal - Top 15 Venues by Event Count (30 Days)

| Rank | Venue Name | Neighborhood | Venue Type | Event Count |
|---|---|---|---|---:|
| 1 | Dad's Garage Theatre | Old Fourth Ward | Theater | 52 |
| 2 | Fox Theatre - Atlanta | Midtown | Theater | 28 |
| 3 | Gas South Arena | Duluth | Stadium | 27 |
| 4 | Tara Theatre | Cheshire Bridge | Cinema | 27 |
| 5 | State Farm Arena | Downtown | Stadium | 27 |
| 6 | Alliance Theatre - Coca-Cola Stage | Midtown | Theater | 26 |
| 7 | Laughing Skull Lounge | Midtown | Theater | 25 |
| 8 | 7 Stages | (None) | Theater | 23 |
| 9 | TEN ATL | East Atlanta | Bar | 22 |
| 10 | Lore Atlanta | Old Fourth Ward | Bar | 22 |
| 11 | Truist Park | Smyrna | Stadium | 18 |
| 12 | Stone Mountain Park | Stone Mountain | Park | 17 |
| 13 | Joystick Gamebar | Downtown | Bar | 15 |
| 14 | OnStage Atlanta | Oakhurst | Theater | 15 |
| 15 | The Earl | East Atlanta | Music Venue | 15 |

**Insight:** Theater-type venues dominate (Dad's Garage, Fox, Alliance, Laughing Skull, 7 Stages) with sports venues (Gas South, State Farm, Truist) clustering for major sporting events.

---

## Data Quality Issues Identified

### Issue 1: Portal Assignment Coverage Gap (CRITICAL)

**Problem:** 1,052 future events (11.4% of platform) have NULL portal_id

**Affected sources:**
- Cinema crawlers: 458 events (43.6%)
- Ticketmaster: 126 events (12.0%)
- Church/Institutional: 20 events (1.9%)
- Unknown/Orphaned sources: 65+ events (6.2%)

**Root cause:** Sources are not configured with portal assignment. Events from these sources insert without specifying portal_id, leaving it NULL.

**Impact:**
- Events not visible in any portal (invisible to users)
- Cannot be filtered by portal
- May cause issues in portal-scoped API queries

**Recommended fixes:**
1. **Immediate:** Update all cinema source crawlers to set `portal_id` to Atlanta UUID
2. **Immediate:** Update Ticketmaster crawler to assign events to appropriate portal
3. **Ongoing:** Add NOT NULL constraint + default value to events.portal_id column
4. **Validation:** Backfill NULL portal_id for existing events using venue location/geo-matching

---

### Issue 2: Event Assignment Concentration

**Problem:** 69.2% of platform events concentrated in Atlanta portal

**Context:**
- Atlanta: 5,647 events
- Nashville: 1,349 events (24% of Atlanta)
- Piedmont: 112 events (2% of Atlanta)
- Inactive portals: 0 events

**Root cause:** Limited source activation for Nashville and Piedmont portals. Nashville has only boutique sources activated; Piedmont has minimal event sources.

**Impact:**
- Unbalanced user experience
- Nashville users see 3.8x fewer events than Atlanta
- Piedmont portal is essentially empty

**Recommended fixes:**
1. Activate additional Nashville sources (venues, aggregators, local events)
2. Activate Piedmont sources (hospitals, wellness centers, community organizations)
3. Audit source activation status for all portals

---

### Issue 3: Inactive Portal Configurations

**Problem:** 3 portals have 0 events:
- Sample Conference 2026
- Coach's Picks
- Atlanta Families

**Root cause:** Portals created but not configured with active sources.

**Impact:**
- Platform waste (unused schema entries)
- Potential confusion for development/testing

**Recommended fixes:**
1. Archive/delete unused test portals
2. Clarify portal setup workflow (when to create vs. when to activate)

---

## Data Quality Metrics

| Metric | Value | Status |
|---|---|---|
| Total future events | 8,160 | OK |
| Properly assigned events | 7,108 (87.1%) | WARNING |
| Unassigned events | 1,052 (11.4%) | CRITICAL |
| Portal assignment coverage | 87.1% | WARNING |
| Atlanta event concentration | 69.2% | INFO |
| Nashville vs Atlanta ratio | 1:4.2 | INFO |
| Piedmont portal usage | 1.5% | LOW |

---

## Validation Queries

### Find all events needing portal assignment:
```sql
SELECT 
    e.id,
    e.title,
    e.start_date,
    s.name as source_name,
    s.slug as source_slug,
    v.name as venue_name,
    v.city
FROM events e
LEFT JOIN sources s ON e.source_id = s.id
LEFT JOIN venues v ON e.venue_id = v.id
WHERE e.portal_id IS NULL
AND e.start_date >= CURRENT_DATE
ORDER BY s.id, e.start_date
LIMIT 1000;
```

### Find event distribution anomalies:
```sql
SELECT 
    p.name as portal_name,
    COUNT(e.id) as event_count,
    COUNT(DISTINCT e.source_id) as source_count,
    COUNT(DISTINCT e.venue_id) as venue_count,
    ROUND(COUNT(e.id) * 100.0 / 
        (SELECT COUNT(*) FROM events WHERE start_date >= CURRENT_DATE AND portal_id IS NOT NULL)::numeric, 1) 
        as percent_of_assigned
FROM portals p
LEFT JOIN events e ON p.id = e.portal_id AND e.start_date >= CURRENT_DATE
GROUP BY p.id, p.name
ORDER BY event_count DESC;
```

### Verify cinema source backfill:
```sql
SELECT 
    source_id,
    COUNT(*) as event_count,
    COUNT(DISTINCT portal_id) as portal_count,
    portal_id
FROM events
WHERE source_id IN (
    SELECT id FROM sources 
    WHERE slug IN ('springs-cinema', 'tara-theatre', 'plaza-theatre', 
                   'starlight-drive-in', 'landmark-midtown')
)
AND start_date >= CURRENT_DATE
GROUP BY source_id, portal_id
ORDER BY source_id;
```

---

## Recommended Action Plan

### Phase 1: Immediate Fixes (Day 1)
1. Update cinema crawlers to set portal_id = Atlanta UUID
2. Update Ticketmaster crawler to assign to Atlanta portal
3. Backfill NULL portal_id for existing events using venue geocoding
4. Document portal assignment in crawler development guidelines

### Phase 2: Data Integrity (Days 2-3)
1. Add NOT NULL constraint to events.portal_id
2. Add foreign key validation
3. Audit all active sources for correct portal assignment
4. Create validation test suite for portal assignment

### Phase 3: Feature Parity (Week 1)
1. Activate Nashville source collection
2. Activate Piedmont source collection
3. Archive unused test portals
4. Document portal provisioning workflow

### Phase 4: Monitoring (Ongoing)
1. Add dashboard metric: % of events with valid portal_id
2. Add crawl log warning for NULL portal_id events
3. Weekly audit of unassigned events by source
4. Monitor portal concentration ratio

---

## Connection Details Used

**Database:** Supabase PostgreSQL
**Config file:** `/Users/coach/Projects/LostCity/crawlers/config.py`
**Connection module:** `/Users/coach/Projects/LostCity/crawlers/db.py`

Diagnostic scripts created:
- `/Users/coach/Projects/LostCity/crawlers/portal_distribution_diagnostics.py`
- `/Users/coach/Projects/LostCity/crawlers/additional_portal_diagnostics.py`

