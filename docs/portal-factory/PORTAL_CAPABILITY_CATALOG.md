# Portal Capability Catalog

**Status:** Draft  
**Purpose:** Give product, data, and frontend work one shared inventory of reusable portal capabilities so new portal PRDs and provisioning plans stop reinventing the same substrate.

---

## Strategic Thesis

Lost City should keep doing two things at once:

1. Ship portals that feel bespoke and first-party.
2. Reuse underlying capability structure aggressively.

The important distinction is this:

- **Do not standardize the page-level visual product.**
- **Do standardize the data, interaction, orchestration, and trust primitives.**

This is how we avoid a theme system while still getting platform leverage.

---

## How To Use This Catalog

Use this document in two places:

1. **Strategic product docs / PRDs**
   - For every new portal or vertical, classify each requested feature as:
     - `reuse now`
     - `reuse with hardening`
     - `new portal-local build`
     - `new platform primitive`

2. **Portal provisioning**
   - Before manifest freeze, produce a capability matrix for the portal:
     - required capability
     - current status
     - reuse path
     - missing contract/schema
     - launch phase

This keeps the roadmap ambitious without letting every portal become a one-off architecture fork.

---

## Status Legend

- `Proven` — production-capable and already used by live or near-live portals.
- `Partial` — real implementation exists, but the abstraction is still narrow or vertical-shaped.
- `Candidate` — strong platform candidate, but not yet a first-class primitive.
- `Concept` — strategy exists, but no meaningful implementation substrate yet.

---

## Capability Domains

### 1. Portal Identity, Shell, and Trust

| Capability | Status | What exists now | Provisioning use | Notes |
|---|---|---|---|---|
| Portal record + slug-based resolution | Proven | `portals` table, `web/lib/portal.ts`, `web/lib/portal-query-context.ts` | Every portal | Core contract: `portal` is slug, `portal_id` is UUID |
| Portal branding + theme injection | Proven | `web/components/PortalTheme.tsx`, `web/components/PortalThemeClient.tsx` | Every portal | Strong reuse layer; styling stays bespoke on top |
| Portal layout shell | Proven | `web/app/[portal]/layout.tsx` | Every portal | Shared provider, metadata, footer, tracker |
| Route dispatch by vertical | Partial | `web/app/[portal]/page.tsx`, `web/app/[portal]/_templates/default.tsx` plus hotel/dog/film/etc. templates | Most portals | Good seam, but vertical routing is still hand-maintained |
| Header variants + nav labels | Proven | `web/components/headers/*`, portal `settings.nav_labels` | Most portals | Useful shared substrate; visual treatment still portal-specific |
| Portal attribution and scope guards | Proven | shared helpers/tests across `web/lib/portal-*` and attribution routes | Every portal | Non-negotiable trust layer |
| Federation source subscriptions + access | Proven | `Live Event Sources`, `Ongoing Opportunity Sources`, manifest/process docs, admin APIs | Every portal with scoped event packs or ongoing opportunity layers | Core platform advantage |
| Portal content / branding / settings JSONB | Proven | `portals.content`, `branding`, `settings` conventions in PRDs and live portals | Most portals | Good operator-editable substrate; schema discipline still needed per vertical |

### 2. Discovery and Browse

| Capability | Status | What exists now | Provisioning use | Notes |
|---|---|---|---|---|
| Feed shell infrastructure | Proven | `CityPulseShell`, `CivicFeedShell`, family and dog feed variants | Many portals | Reuse pattern is strong; shell implementation remains bespoke by vertical |
| Find/search/list/map/calendar surface | Proven | `web/components/find/*`, `MapViewWrapper`, `PortalSpotsView`, `CalendarView` | Discovery-heavy portals | High leverage base, but vocabulary and filters need portal-specific tightening |
| Detail view overlay router | Proven | `web/components/views/DetailViewRouter.tsx` | Most consumer portals | Strong reusable interaction primitive |
| Event / venue / org / series detail pages | Proven | `web/components/views/*` and route pages | Most consumer portals | Shared data/detail spine with portal styling overlays |
| Save / RSVP primitives | Proven | existing `/api/saved`, `/api/rsvp` and UI integrations | Portals with repeat consideration / conversion | Good reuse now |
| List / collection surfaces | Partial | collection routes and existing list pages | Editorial or planning portals | Real but not consistently productized as a portal primitive |
| Portal-specific ranking / section sequencing | Partial | multiple vertical-specific query and scoring paths | Most portals | Common need, but not yet cataloged as reusable strategy modules |

### 3. Personalization, Community, and Planning

| Capability | Status | What exists now | Provisioning use | Notes |
|---|---|---|---|---|
| Interest channels | Partial | schema + APIs + feed section pattern from PRD 028 and community portals | Portals with follow/join loops | Important reusable primitive; should expand beyond civic |
| Hangs | Partial | `hangs` schema, `HangSheet`, live venue strips, feed sections | Social / venue energy portals | Strong nucleus, currently optimized for lightweight presence rather than trip planning |
| Outing planner | Partial | `web/components/outing-planner/*` | Planning-adjacent portals | Useful recommendation/planning substrate |
| Playbook | Partial | playbook routes, editor, shared itinerary logic | Portals needing structured planning | Real and promising, but still nightlife/outing-shaped |
| Notifications / behavioral delivery | Partial | generic notifications infrastructure exists | Repeat-engagement portals | Not yet generalized around channel/quest/conditions style delivery |
| Badges / progress systems | Concept | no first-class badge model shipped | Loyalty / quest portals | Candidate platform primitive if two portals need it |

### 4. Content Operations and Admin

| Capability | Status | What exists now | Provisioning use | Notes |
|---|---|---|---|---|
| Portal factory provisioning flow | Proven | `docs/portal-factory/*`, manifests, `provision-portal.ts`, readiness gate | Every new portal | Strong repeatability layer |
| Source validation and readiness gates | Proven | readiness templates, validation scripts, quality gates | Every new portal | Must remain strict |
| Admin portal/source controls | Proven | admin subscription/config APIs and routes | Operator-facing portals | Clear separation from consumer surface |
| Operator-editable content schema pattern | Partial | content-schema conventions in blueprint docs and some portal implementations | Portals with ongoing curation | Needs more consistent implementation and admin UX |
| Capability health dashboards | Candidate | partial analytics/health across channels and portal ops | Higher-scale portal programs | Good platform investment once capability catalog stabilizes |

---

## Capability Recommendations For Provisioning

The provisioning process should explicitly classify requested features into four buckets:

### A. Reuse Now

Use as-is or with light portal-specific wiring:

- Portal identity, scope, and federation
- Branding/theme injection
- Header/nav label substrate
- Discovery/find/detail routing
- Save/RSVP
- Basic feed shell composition

### B. Reuse With Hardening

Use existing implementation, but require a contract review before promising it in a new PRD:

- Interest channels outside civic
- Hangs in non-nightlife/non-city contexts
- Playbook for broader planning jobs
- Operator-editable content schemas
- Portal-specific ranking and recommendation logic

### C. Build Portal-Local First

Keep bespoke unless a second portal clearly needs the same thing:

- Visual shells and hero composition
- Branded card systems
- Vertical-specific copy systems
- Portal-only content modules with no cross-vertical evidence yet

### D. Promote To Platform Primitive

Promote only when all three are true:

1. At least two portals need it.
2. The data model is stable enough to survive reuse.
3. The capability improves the shared data layer or portal factory speed.

---

## Candidate Next Platform Primitives

These are the most important likely additions to the shared capability layer.

### 1. Commitment Model

**Why:** Yonder's core navigation concept is portable well beyond adventure. Hotels, dog, tourism, and family portals all benefit from "how much time/effort does this take?"  
**Status:** Candidate  
**Likely shared contract:**

- commitment tier (`hour`, `halfday`, `fullday`, `weekend`)
- drive-time / effort metadata
- query/filter support
- ranking boosts by commitment fit

### 2. Conditions Intelligence

**Why:** Weather/season/temperature-aware recommendations are reusable across city, tourism, dog, outdoor, and hotel escape flows.  
**Status:** Candidate  
**Existing adjacency:** city pulse weather-aware headers and weather mapping logic  
**Gap:** no reusable recommendation engine that maps conditions to inventory classes

### 3. Destination Enrichment Pack

**Why:** Multiple portals need better structured place intelligence, not just venue basics.  
**Status:** Candidate  
**Likely shared fields:**

- drive time
- duration
- difficulty
- best season
- amenities
- reservation requirement
- family / dog / group suitability

### 4. Artifact Model

**Why:** Story-rich sub-destinations or editorial discoveries are useful in outdoor, tourism, hidden-city, history, and hotel escape products.  
**Status:** Candidate  
**Existing adjacency:** explore-track style editorial place curation, spot detail artifact sections  
**Gap:** no first-class cross-portal artifact schema

### 5. Quest / Progress Model

**Why:** Repeat visitation and identity-building loops are valuable, but should be platform-grade before multiple portals implement incompatible versions.  
**Status:** Candidate  
**Potential reuse:** Yonder, dog portal, tourism passport experiences, family challenge collections

### 6. Extended Trip Planning

**Why:** Hangs and Playbook already prove planning intent exists; Yonder pushes the next step into multi-day coordination.  
**Status:** Candidate  
**Recommended approach:** extend current planning primitives instead of inventing a disconnected trip system unless constraints force it

### 7. Camping Inventory Layer

**Why:** This is likely outdoor-specific at first, but the structure resembles lodging/inventory comparison and may generalize later.  
**Status:** Candidate, likely portal-first  
**Recommendation:** prove with Yonder before elevating to a platform-wide booking/inventory primitive

---

## What Should Stay Bespoke

To avoid drifting into a theme system, the following should stay portal-specific by default:

- hero framing
- card art direction
- typography and motion rules
- section naming and voice
- vertical narrative framing
- homepage composition

The rule is simple:

- **Shared capabilities decide what the product can do.**
- **Portal-specific design decides what the product feels like.**

---

## Capability Review Template

Every new vertical or major portal should include a table like this in strategy/build docs:

| Capability | Need | Status | Reuse path | Gap | Launch phase |
|---|---|---|---|---|---|
| Example: interest channels | Yes | Partial | Reuse with hardening | Non-civic seed model | Phase 2 |

Minimum questions:

1. Is this already real in code?
2. Is it reusable without breaking portal contracts?
3. If not, should we build it portal-local or platform-first?
4. What schema/API/admin surface is missing?
5. Does this improve future portal provisioning speed?

---

## Immediate Recommendation

For the next wave of portal work, especially Yonder, the default operating posture should be:

- reuse the trust, routing, theming, discovery, and planning substrate aggressively
- keep the frontend composition radically bespoke
- treat commitment, conditions, destination enrichment, artifacts, and quest/progress as the next serious platform-candidate layer

That gives us the right balance of ambition and leverage.
