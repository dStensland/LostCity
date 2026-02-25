# Atlanta-Support Source Review

**Date**: 2026-02-17
**Scope**: Audit of event sources feeding the Emory Community Hub via the `atlanta-support` portal

---

## Architecture Overview

The community hub displays organizations and events through a two-layer system:

### Layer 1: Policy (code-defined)

- **File**: `lib/support-source-policy.ts`
- **Count**: 200+ organizations across 32 support tracks
- **Purpose**: Curated directory of trusted community partners
- **Each entry has**: `id`, `name`, `track`, `focus`, `url`
- **Matching**: `resolveSupportSourcePolicy()` matches DB sources to policy items by normalized slug or name, with 160+ aliases

### Layer 2: Database (live sources)

- **Table**: `sources` (columns: `id`, `slug`, `name`, `url`, `is_active`, `owner_portal_id`)
- **Portal**: Sources must have `owner_portal_id` set to the `atlanta-support` portal's ID
- **Crawlers**: Each source has a corresponding Python crawler in `crawlers/sources/`

### How They Connect

1. `emory-community-category-feed.ts` queries `sources` where `owner_portal_id = atlanta-support` AND `is_active = true`
2. Each DB source is matched against `support-source-policy.ts` by slug/name
3. **Matched** → displayed with real event data
4. **Unmatched** → filtered out (hidden)
5. Policy orgs with **no DB source** → shown as "always available" with a website link but 0 events

**There is no automatic seeding.** Sources must be manually created in the DB and assigned to `atlanta-support`.

---

## Resolution Status (2026-02-18)

This review has now been actioned in code:

- Expanded assignment automation in `crawlers/scripts/apply_portal_assignments.py` to include the full crawler-backed Atlanta support source set plus known slug variants.
- Improved support policy matching in `web/lib/support-source-policy.ts` to choose the best match (exact and most-specific term), preventing broad false matches.
- Added regression tests in `web/lib/support-source-policy.test.ts` for key edge cases (notably Piedmont slug variants).

Validation run on 2026-02-18:

- `python3 scripts/apply_portal_assignments.py --dry-run` reported all mapped support sources already assigned to `atlanta-support`.
- No `owner_portal_id` updates were needed and no future `events.portal_id` backfills were needed.
- Variant slugs not present in DB (safe skips): `fulton-county-board-of-health`, `northside-hospital`, `northside-hospital-atlanta`, `adventhealth-gordon`, `piedmont-healthcare-nc`, `piedmont-healthcare-cme`, `mercy-care-atlanta`.

---

## Crawlers That Exist

These support-policy organizations have working crawlers in `crawlers/sources/`:

### Public Health
| Policy ID | Org Name | Crawler File | Track |
|---|---|---|---|
| `good-samaritan-health-center` | Good Samaritan Health Center of Atlanta | `good_samaritan_health.py` | public_health |
| `dekalb-public-health` | DeKalb Public Health | `dekalb_public_health.py` | public_health |
| `fulton-board-health` | Fulton County Board of Health | `fulton_board_health.py` | public_health |
| `northside-health-fairs` | Northside Hospital Community Health Fairs | `northside_health_fairs.py` | public_health |

### Food Support
| Policy ID | Org Name | Crawler File | Track |
|---|---|---|---|
| `atlanta-community-food-bank` | Atlanta Community Food Bank | `atlanta_community_food_bank.py` | food_support |

### Mental Health
| Policy ID | Org Name | Crawler File | Track |
|---|---|---|---|
| `nami-georgia` | NAMI Georgia | `nami_georgia.py` | mental_health |
| `aid-atlanta` | AID Atlanta | `aid_atlanta.py` | mental_health |
| `positive-impact-health` | Positive Impact Health Centers | `positive_impact_health.py` | mental_health |

### Community Wellness
| Policy ID | Org Name | Crawler File | Track |
|---|---|---|---|
| `ymca-atlanta` | YMCA of Metro Atlanta | `ymca_atlanta.py` | community_wellness |
| `grady-health` | Grady Health Foundation | `grady_health.py` | community_wellness |
| `health-walks-atlanta` | Atlanta Health Walks & Charity Runs | `health_walks_atlanta.py` | community_wellness |

### Disability Services
| Policy ID | Org Name | Crawler File | Track |
|---|---|---|---|
| `shepherd-center` | Shepherd Center | `shepherd_center.py` | disability_services |

### Chronic Disease / Cancer
| Policy ID | Org Name | Crawler File | Track |
|---|---|---|---|
| `cancer-support-community-atlanta` | Cancer Support Community Atlanta | `cancer_support_community_atlanta.py` | chronic_disease |
| `acs-georgia` | American Cancer Society Georgia | `acs_georgia.py` | chronic_disease |
| `winship-cancer-institute` | Winship Cancer Institute | `winship_cancer_institute.py` | cancer_support |
| `atlanta-cancer-care-foundation` | Atlanta Cancer Care Foundation | `atlanta_cancer_care_foundation.py` | cancer_support |
| `colorectal-cancer-alliance` | Colorectal Cancer Alliance | `colorectal_cancer_alliance.py` | cancer_support |
| `georgia-ovarian-cancer` | Georgia Ovarian Cancer Alliance | `georgia_ovarian_cancer.py` | cancer_support |
| `cure-childhood-cancer` | CURE Childhood Cancer | `cure_childhood_cancer.py` | pediatric_family |

### Pediatric / Family
| Policy ID | Org Name | Crawler File | Track |
|---|---|---|---|
| `healthy-mothers-ga` | Healthy Mothers Healthy Babies Coalition of GA | `healthy_mothers_ga.py` | pediatric_family |

### Hospital Community
| Policy ID | Org Name | Crawler File(s) | Track |
|---|---|---|---|
| `piedmont-healthcare` | Piedmont Healthcare | `piedmont_healthcare.py` | hospital_community |
| `piedmonthealthcare-events` | Piedmont HealthCare Events | `piedmont_classes.py`, `piedmont_cancer_support.py`, `piedmont_fitness.py`, `piedmont_heart_conferences.py`, `piedmont_womens_heart.py`, `piedmont_transplant.py` | hospital_community |
| `adventhealth-georgia` | AdventHealth Georgia | `adventhealth_georgia.py` | hospital_community |
| (Emory-owned) | Emory Healthcare | `emory_healthcare_community.py` | hospital_community |

---

## Action Item 1: Verify DB Assignment

**Problem**: Crawlers above may be producing events under the main `atlanta` portal but NOT assigned to `atlanta-support`. The community hub only queries sources where `owner_portal_id = atlanta-support`.

**Task**:
1. Query the `portals` table to get the `atlanta-support` portal ID
2. Query `sources` where `owner_portal_id` equals that ID and `is_active = true`
3. Compare against the crawler list above
4. For any crawler that exists but whose source is NOT assigned to `atlanta-support`, update `owner_portal_id`

**SQL to audit**:
```sql
-- Get atlanta-support portal ID
SELECT id FROM portals WHERE slug = 'atlanta-support';

-- List all sources assigned to it
SELECT s.slug, s.name, s.is_active,
  (SELECT COUNT(*) FROM events e WHERE e.source_id = s.id AND e.start_date >= CURRENT_DATE) as upcoming_events
FROM sources s
WHERE s.owner_portal_id = '<atlanta-support-id>'
ORDER BY s.slug;

-- Find crawled support sources NOT assigned to atlanta-support
SELECT s.slug, s.name, s.owner_portal_id, s.is_active
FROM sources s
WHERE s.slug IN (
  'atlanta-community-food-bank', 'ymca-atlanta', 'nami-georgia',
  'good-samaritan-health-center', 'dekalb-public-health', 'fulton-board-health',
  'northside-health-fairs', 'aid-atlanta', 'positive-impact-health',
  'grady-health', 'health-walks-atlanta', 'shepherd-center',
  'cancer-support-community-atlanta', 'acs-georgia', 'winship-cancer-institute',
  'atlanta-cancer-care-foundation', 'colorectal-cancer-alliance',
  'georgia-ovarian-cancer', 'cure-childhood-cancer', 'healthy-mothers-ga',
  'piedmont-healthcare', 'adventhealth-georgia'
)
AND (s.owner_portal_id IS NULL OR s.owner_portal_id != '<atlanta-support-id>');
```

**Fix**: For unassigned sources:
```sql
UPDATE sources
SET owner_portal_id = '<atlanta-support-id>'
WHERE slug IN (/* slugs from above query */)
AND (owner_portal_id IS NULL OR owner_portal_id != '<atlanta-support-id>');
```

---

## Action Item 2: High-Value Crawlers to Build

These policy organizations have **no crawler** but are high-traffic, event-rich Atlanta institutions worth adding. Prioritized by event frequency and community impact.

### Priority 1 — Weekly/regular events, high community value
| Policy ID | Org Name | URL | Track | Why |
|---|---|---|---|---|
| `open-hand-atlanta` | Open Hand Atlanta | openhandatlanta.org | food_support | Highlight org for Food & Nutrition category |
| `community-farmers-markets` | Community Farmers Markets | cfmatl.org | food_support | Highlight org; weekly markets with calendar |
| `atlanta-legal-aid` | Atlanta Legal Aid Society | atlantalegalaid.org | legal_aid | Highlight org for Life Essentials; regular clinics |
| `worksource-atlanta` | WorkSource Atlanta | worksourceatlanta.org | employment_workforce | Highlight org for Life Essentials; regular job fairs |
| `irc-atlanta` | IRC Atlanta | rescue.org/united-states/atlanta-ga | immigrant_refugee | Highlight org for Life Essentials |
| `choa-community-events` | Children's Healthcare of Atlanta | choa.org | pediatric_health | Highlight org for Family & Children; Strong4Life events |
| `camp-twin-lakes` | Camp Twin Lakes | camptwinlakes.org | pediatric_health | Highlight org for Family & Children |
| `georgia-transplant-foundation` | Georgia Transplant Foundation | gatransplant.org | transplant | Highlight org for Specialized Care |
| `american-lung-georgia` | American Lung Association GA | lung.org | respiratory | Highlight org for Specialized Care |
| `hands-on-atlanta` | Hands On Atlanta | handsonatlanta.org | community_wellness | Major volunteer platform; rich event calendar |
| `beltline-fitness` | Atlanta BeltLine Fitness | beltline.org/things-to-do/fitness/ | community_wellness | Highlight org for Stay Well; regular free classes |

### Priority 2 — Monthly/periodic events, good recognition
| Policy ID | Org Name | URL | Track | Why |
|---|---|---|---|---|
| `meals-on-wheels-atlanta` | Meals on Wheels Atlanta | mealsonwheelsatlanta.org | food_support | Volunteer events |
| `hosea-helps` | Hosea Helps | hoseahelps.org | food_support | Large distribution events |
| `mha-georgia` | Mental Health America of Georgia | mhageorgia.org | mental_health | Workshops and advocacy |
| `skyland-trail` | Skyland Trail | skylandtrail.org | mental_health | Lectures and community events |
| `park-pride` | Park Pride | parkpride.org | community_wellness | Park activation events |
| `mercy-care` | Mercy Care Atlanta | mercyatlanta.org | housing_homelessness | Healthcare for homeless; community events |
| `va-atlanta` | VA Atlanta Healthcare System | va.gov/atlanta-health-care/ | veterans | Health screenings, PTSD groups |
| `goodwill-north-ga` | Goodwill of North Georgia | ging.org | employment_workforce | Hiring events, workshops |
| `komen-atlanta` | Susan G. Komen Greater Atlanta | komen.org | cancer_support | Race for the Cure, education events |
| `lls-georgia` | Leukemia & Lymphoma Society GA | lls.org | cancer_support | Light The Night walks |

### Priority 3 — Seasonal/annual events, niche but important
| Policy ID | Org Name | URL | Track |
|---|---|---|---|
| `special-olympics-georgia` | Special Olympics Georgia | specialolympicsga.org | pediatric_health |
| `make-a-wish-georgia` | Make-A-Wish Georgia | wish.org/georgia | pediatric_health |
| `ada-georgia` | American Diabetes Association GA | diabetes.org | chronic_disease |
| `aha-georgia` | American Heart Association GA | heart.org/en/affiliates/georgia | chronic_disease |
| `sickle-cell-ga` | Sickle Cell Foundation of Georgia | sicklecellga.org | chronic_disease |
| `arthritis-foundation-georgia` | Arthritis Foundation Georgia | arthritis.org | autoimmune |
| `alzheimers-association-georgia` | Alzheimer's Association GA | alz.org/georgia | community_wellness |
| `blazesports` | BlazeSports America | blazesports.org | disability_services |

---

## Action Item 3: Source Name Matching Issues

The policy matching system uses `resolveSupportSourcePolicy()` which normalizes names and checks aliases. Potential mismatches to check:

- DB source slug `piedmont-classes` vs policy ID `piedmont-classes` (should match)
- DB source slug `wellstar-community-events` — if the crawler uses a different slug, it won't match
- Any source whose DB name differs significantly from the policy `name` field

**Task**: After running the DB audit (Action Item 1), check for sources that exist in `atlanta-support` but return `null` from `resolveSupportSourcePolicy()`. These would be silently filtered out.

---

## Files Reference

| File | Purpose |
|---|---|
| `lib/support-source-policy.ts` | 200+ org definitions, aliases, matching functions |
| `lib/emory-source-policy.ts` | Emory-specific source tiers and federation rules |
| `lib/hospital-source-governance.ts` | Track-level access control per hospital portal |
| `lib/emory-community-category-feed.ts` | Queries DB sources, matches to policy, builds category feed |
| `lib/emory-federation-showcase.ts` | Fetches events from federated sources for discovery deck |
| `lib/emory-community-categories.ts` | 7 category definitions with track mappings and highlight org IDs |
| `lib/federation.ts` | Portal-source ownership, sharing, and subscription system |
| `crawlers/sources/*.py` | Individual crawler implementations (783 total files) |
