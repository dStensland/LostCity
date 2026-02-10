# LostCity Product Roadmap

Active initiatives, prioritized by what's needed to sell and scale.

---

## Tier 1: Demo Sprint

What we need to walk into a sales meeting. The portal system is largely built (admin dashboard, branding, federation, analytics, QR codes, feed sections). These are the gaps.

### 1.1 Demo Portal for First Vertical (Hotel Concierge)
- [ ] Add `vertical` field to portal settings
- [ ] Create hotel-specific route group with independent layout
- [ ] Hotel concierge UI: tonight's picks, neighborhood guides, "ask concierge" CTA
- [ ] Distinct visual language from default city portal
- [ ] Demo data: configure FORTH Hotel portal with curated sections

### 1.2 Portal Onboarding Flow
- [ ] Step-by-step setup wizard (replace single create modal)
- [ ] Steps: name/type -> branding/colors -> filters/location -> sections -> preview -> launch
- [ ] Template presets by vertical (hotel, film, community, etc.)
- [ ] Live preview during setup

### 1.3 Portal Admin UI Polish
- [ ] Portal member management UI (invite, roles, remove)
- [ ] Gallery page template (stub exists, needs implementation)
- [ ] Timeline page template (stub exists, needs implementation)
- [ ] Content moderation UI for user submissions

### 1.4 Personalization & Tagging Audit
- [ ] Audit current tagging taxonomy: event categories, venue types, vibes, spot_type — are they consistent and complete?
- [ ] Assess tag coverage: what % of events/venues have meaningful tags vs. generic/missing?
- [ ] Review user preference model: how are inferred_preferences built, what signals feed them?
- [ ] Evaluate "For You" feed quality: does personalization produce meaningfully different results per user?
- [ ] Identify tag gaps: are there categories/vibes users would filter by that we don't capture?
- [ ] Assess tag inference pipeline (tag_inference.py): accuracy, coverage, false positives
- [ ] Review how tags flow from crawlers → DB → API → frontend filters → personalization
- [ ] Recommend taxonomy cleanup: merge redundant tags, add missing ones, standardize naming
- [ ] Audit venue_tag_definitions vs vibes array — are these two systems in sync or fragmented?
- [ ] Assess community tag voting/moderation pipeline (venue_tags, venue_tag_votes, venue_tag_suggestions) — is it functional and surfaced in UI?

### 1.5 Data Quality & Crawler Health Assessment
- [ ] Run `python data_health.py` and assess all entity health scores (venues, events, series, festivals, organizations)
- [ ] Run data quality queries from CRAWLER_STRATEGY.md: category distribution, duplicate detection, missing data by source, source health
- [ ] Identify top 20 broken/degraded crawlers (success rate < 90%, zero recent events, last crawl > 7 days)
- [ ] Assess event field coverage vs targets: start_time (>98%), description (>80%), image_url (>75%), is_free (>95%)
- [ ] Assess venue field coverage vs targets: lat/lng (>95%), neighborhood (>90%), image_url (>80%), website (>70%)
- [ ] Audit content hash dedup effectiveness — what's the actual duplicate rate?
- [ ] Review extraction confidence scores — are they trending up or down?
- [ ] Identify sources producing the lowest quality data (most missing fields, worst descriptions)
- [ ] Check pre-insert validation gaps per PV1-PV3 in TECH_DEBT.md
- [ ] Produce actionable report: which crawlers to fix, disable, or rewrite

### 1.6 Venue Specials, Happy Hours & Time-Boxed Content
Restaurants and bars have recurring time-sensitive offerings (happy hours, daily specials, taco tuesdays) that are distinct from events. Museums and galleries have temporary exhibits that are time-boxed but not single-day events. We need a data model and crawling strategy for these.

**Data Model**
- [ ] Design `venue_specials` table (or equivalent) for time-boxed venue features
  - Types: `happy_hour`, `daily_special`, `recurring_deal`, `exhibit`, `installation`, `seasonal_menu`, `pop_up`
  - Timing: `time_start`/`time_end` (daily window), `days_of_week` (recurring), `start_date`/`end_date` (seasonal/exhibit bounds)
  - Recurrence: iCal-style RRULE or simple `days_of_week` array
  - Content: title, description, image_url, price/discount info
- [ ] Decide relationship to events table — specials are NOT events (no dedup, no content hash, no ticket_url) but may appear in feeds alongside events
- [ ] Add API endpoint(s) to surface specials: per-venue detail, filterable lists ("happy hours near me right now")
- [ ] Design frontend display: inline on venue cards, dedicated "Specials" section in hotel/city feeds, time-aware visibility (only show happy hour card during/near happy hour window)

**Crawling Strategy**
- [ ] Audit which existing bar/restaurant crawlers could also capture specials (many venue websites have a "specials" or "happy hour" page)
- [ ] Research structured data sources for specials: Google Business profiles, Yelp, BeerMenus, Untappd
- [ ] Design crawler pattern for specials extraction (separate from event extraction — different page, different schema)
- [ ] For museums/galleries: identify exhibit pages to crawl (High Museum, MOCA GA, Atlanta Contemporary, etc.)
- [ ] Determine update frequency — specials change less often than events, maybe weekly crawl vs daily

**Integration with Hotel Concierge**
- [ ] Surface happy hours in "Where to Drink" carousel (badge: "Happy Hour 5-7pm")
- [ ] Surface current exhibits in "Explore" category of neighborhood section
- [ ] Add "Happy Hour Now" section to concierge feed (time-aware, only shows during relevant hours)

### 1.7 Main Product Polish
- [ ] Audit and fix any rough edges in core event/venue experience
- [ ] Ensure portal branding looks great across all page types
- [ ] Test custom domain flow end-to-end
- [ ] Mobile responsiveness audit on portal pages

---

## Tier 2: Close-Critical

What converts a demo into a paying customer. Not needed for first meeting, needed before signing.

### 2.1 Portal Analytics (Basic)
- [x] Page views, traffic sources, top events (exists in portal admin)
- [ ] Export capability (CSV/PDF)
- [ ] Engagement metrics: saves, RSVPs, shares per portal
- [ ] Comparative metrics: this week vs. last week

### 2.2 Self-Service Portal Creation
- [ ] Public-facing "Create Your Portal" flow (not just admin)
- [ ] Plan selection with feature comparison
- [ ] Stripe billing integration (can defer, invoice manually initially)

---

## Tier 3: Network Effect Layer

What makes the platform compound. Build after first paying customers.

### 3.1 Cross-Portal Enrichment Routing
- [ ] Audit portal_content: which actions are facts vs. preferences
- [ ] Route fact-type enrichments to global tables with `contributed_by_portal_id`
- [ ] Keep display-order and pinning in portal_content
- [ ] Add `enrichment_source` column to venue_tags

### 3.2 Venue Self-Service
- [ ] Post-claim venue management dashboard
- [ ] Edit venue details (hours, description, images, vibes, accessibility)
- [ ] Submit events directly (bypass crawler for claimed venues)
- [ ] View analytics (portal appearances, view counts, saves)
- [ ] "Verified" badge displayed across all portals

### 3.3 Cross-Portal User Graph
- [ ] Add portal_id to activities and inferred_preferences for attribution
- [ ] "For You" feed reflects full cross-portal taste profile
- [ ] Privacy: users can see which portals have their data

---

## Tier 4: Shelved

Validated ideas, not needed yet. Revisit after revenue.

### 4.1 Billing Integration
- Stripe subscriptions per portal mapped to plan tier
- Webhook handler for subscription lifecycle events
- Plan limits enforced at API level
- Usage-based billing for API product

### 4.2 Embeddable Widget
- Lightweight embed for hospitals, apartments, etc. who don't want a full portal
- Configurable: event list, calendar, or map view
- Script tag or iframe with branding options

### 4.3 Public Developer API
- `withApiKey()` middleware alongside `withAuth()`
- Rate limits by plan: free (1k/day) -> enterprise (unlimited)
- OpenAPI spec auto-generated from route definitions
- Developer portal at /developers

### 4.4 Multi-City Expansion
- Nashville, Charlotte, Austin as next cities
- Crawler strategy for new cities (see CRAWLER_STRATEGY.md)
- Per-city portal templates

### 4.5 Additional Vertical Layouts
- Film festival (schedule builder, screening rooms, Q&A sessions)
- Hospital/corporate (proximity-focused, accessible, employee engagement)
- Community/neighborhood (enrichment-focused, low-cost)
- Fitness/wellness (class schedules, instructor profiles)

### 4.6 System Health Dashboard
- Source health: active / degrading / broken / disabled
- Trend tracking: events_found, rejection_rate over time
- Weekly digest emails
- Anomaly detection and alerts
- See TECH_DEBT.md for details

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| STRATEGIC_PRINCIPLES.md | Core hypotheses and decision framework |
| ARCHITECTURE_PLAN.md | Gap analysis and implementation phases |
| TECH_DEBT.md | Code-level debt and system health items |
| COMPETITIVE_INTEL.md | Competitor analysis and battle cards |
| GTM_STRATEGY.md | Go-to-market sequencing and target prioritization |
| NOVEL_TARGETS.md | 15 novel B2B target segments |
| MONETIZATION_PLAYBOOK.md | Revenue models beyond portal subscriptions |
| SALES_ENABLEMENT.md | Demo scripts, one-pagers, objection handlers |
