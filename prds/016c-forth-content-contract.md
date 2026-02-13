# PRD-016c: FORTH Content Contract (BP-4)

Companion to:
- `prds/016-forth-full-redesign-program.md`
- `prds/005-forth-portal-content-strategy.md`
- `prds/005a-forth-strategy-context.md`

## 1. Purpose
Define what content is federated from Atlanta, what content is FORTH-owned, where current gaps are, and how each content class is maintained.

## 2. Source-of-Truth Split

### A. Federated from Atlanta Portal (shared backbone)
Use for city-wide and near-FORTH discovery.

1. Events
- title, date/time, venue, image, category/subcategory, description
- confidence/freshness signals

2. Destinations/venues
- venue profile, venue type, neighborhood, image, proximity metrics

3. Specials
- active-now, starting-soon, price note, verification timestamp

4. Geographic context
- corridor/neighborhood clusters
- walkable vs short ride vs destination tiering

Primary use surfaces:
- Tonight best bets
- Near FORTH now
- Plan-ahead event discovery

### B. FORTH-owned content (property expression)
Use for brand-native value and conversion.

1. In-house venues
- Il Premio, Elektra, Bar Premio, Moonlight
- service windows, positioning notes, premium tags

2. Amenities + service layer
- spa, fitness, pool, concierge desk, in-room service options

3. Reservation pathways
- official booking links or concierge routing notes

4. Club layer
- policy snippets, guest allowance, member pathways

5. Editorial overlays
- concierge spotlight cards
- seasonal/property callouts

Primary use surfaces:
- Stay route
- Dining route
- Club route
- Hero/spotlight moments on Tonight and Plan Ahead

## 3. Recommended Mix by Route

1. `/{portal}` (Tonight)
- 70% federated, 30% FORTH-owned

2. `/{portal}/plan` (Plan Ahead)
- 60% federated, 40% FORTH-owned

3. `/{portal}/dining`
- 55% federated, 45% FORTH-owned

4. `/{portal}/stay`
- 15% federated, 85% FORTH-owned

5. `/{portal}/club`
- 10% federated, 90% FORTH-owned

## 4. Current Gaps

### Gap 1: Coverage depth
- Several high-value Atlanta sources are still missing or unstable.
- Result: weaker confidence for premium nightly recommendations.

### Gap 2: Specials consistency
- Specials availability and verification is uneven by venue cluster.
- Result: "active now" quality varies.

### Gap 3: Reservation structure
- Reservation links/rules are not uniformly modeled.
- Result: plan-ahead conversion path is inconsistent.

### Gap 4: Future-night horizon
- Upcoming inventory for future-date planning can be sparse.
- Result: plan-ahead experience can look thin on certain dates.

### Gap 5: Property-owned updates
- FORTH editorial/amenity updates need explicit ownership + cadence.
- Result: premium layer risks staleness.

## 5. Content Ownership Model

### Federated owner
- Lost City ingestion + federation pipeline
- Responsibilities:
  - source reliability
  - dedupe quality
  - confidence/freshness tags

### Property owner
- FORTH content steward (or Lost City concierge ops proxy)
- Responsibilities:
  - in-house venue notes
  - reservation links
  - club/policy snippets
  - editorial callouts

### Shared owner
- Product/UX
- Responsibilities:
  - section mix and routing rules
  - copybook adherence
  - quality gate enforcement

## 6. Freshness SLA

1. Live specials and now/soon states
- target freshness: <24h verification where possible

2. Event listings
- target freshness: daily crawl/update cadence

3. FORTH-owned editorial/reservation notes
- target freshness: weekly review + ad-hoc updates for events/seasonality

4. Club/policy copy
- target freshness: monthly review or immediate on policy change

## 7. Content Schema Additions (Needed)

1. Reservation block
- `reservation_url`
- `reservation_method` (`direct`, `concierge`, `phone`)
- `reservation_notes`

2. Property spotlight metadata
- `spotlight_priority`
- `spotlight_window_start`
- `spotlight_window_end`
- `spotlight_context` (`tonight`, `plan_ahead`, `club`, `stay`)

3. Future planning hints
- `recommended_booking_lead_time_hours`
- `advanced_planning_confidence`

## 8. Publishing Cadence

1. Daily
- federated events/specials refresh

2. Weekly
- FORTH editorial and reservation QA pass

3. Monthly
- content mix review by route
- stale asset/image audit

## 9. Success Checks

1. Tonight route
- first-click relevance and confidence improve

2. Plan route
- future-date event visibility + reservation action clicks improve

3. Stay and Club routes
- property-owned pathways feel complete and current

4. Repeatability
- same contract works for next hotel vertical with minimal changes
