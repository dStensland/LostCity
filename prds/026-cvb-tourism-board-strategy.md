# PRD 026: CVB / Tourism Board Vertical Strategy

**Status:** Research
**Date:** 2026-02-22
**Vertical:** Tourism Boards / CVBs / DMOs

## Market Context

### The incumbent: Simpleview (Granicus)

Simpleview is the dominant platform for destination marketing organizations (DMOs). Acquired by Granicus (Vista Equity-backed, $1.2B raised, 2,000 employees, 7,000+ public sector clients). Serves 900+ destination clients.

**Their product suite:**
- **Simpleview CMS** — Brochure website builder with event calendars, partner listings, itinerary builders
- **Simpleview CRM** — Stakeholder/partner relationship management, convention bid tracking, membership dues
- **Simpleview DAM** — Media asset library for press/partners
- **Book Direct** — Referral engine for partner booking pages
- **BI Suite** — Visitor engagement reporting
- **Ticketed Event Feed** — Integration with ticketing platforms (Ticketmaster, etc.) to populate event calendars

Pricing: ~$199/mo entry, real metro deployments $50K-150K+/year with services.

**Other players:** Tempest (enterprise alternative), Locable (small/mid CVBs), Tourismo (newer entrant), CrowdRiff (UGC layer), Bandwango (digital passes/experiences).

### Where they're weak

- Event calendars are **manually maintained** by DMO staff or submitted by paying members. Coverage is thin — they only know what partners submit.
- Consumer-facing output is **brochure-ware** — static directories, not live discovery.
- No real-time "what's happening tonight" capability.
- No long-tail coverage (dive bars, pop-ups, gallery openings).
- Data is **siloed per DMO** — no network effects across destinations.

### Where LostCity fits

We are **not a CRM, not a CMS, not a convention sales tool**. We are the **real-time event data infrastructure layer** that these platforms lack. A CVB running Simpleview has a static event page with 12 manually-entered events. We can make it 200 live ones overnight.

**Positioning: complementary, not competitive.** We fit alongside Simpleview, not in place of it.

## Go-to-Market Approach

### Bottom-up, not top-down

A Granicus enterprise partnership is a multi-year BD cycle with misaligned incentives. Instead:

1. **Sell the CVB directly** — they're the buyer, Simpleview is the furniture they already own
2. **Be compatible with Simpleview** — work alongside it, don't require replacing it
3. **Prove value with a widget** — zero-friction entry, no integration contract needed
4. **Let adoption create partnership leverage** — if 50 CVBs embed our widget, Simpleview has incentive to formalize

### Target segmentation

| Segment | Example | Approach |
|---------|---------|----------|
| **Small county CVBs** | Henry County, Cobb County | Widget on WordPress/Simpleview site. No budget for custom dev. Needs turnkey. |
| **Mid-market metro CVBs** | Visit Savannah, Visit Chattanooga | API integration or branded portal. Has some dev resources. |
| **Large metro DMOs** | Discover Atlanta, Nashville CVC | Full branded portal, API license, venue analytics. Enterprise relationship. |

**Start small.** County CVBs around metro Atlanta are the proving ground — they're underserved, nearby, and easy to demo with existing Atlanta data + geographic expansion.

## Required Capabilities

### P0: Embeddable Widget SDK

The wedge product. A `<script>` tag or iframe a CVB drops onto any existing website.

- Standalone bundle (not a Next.js route)
- Live "what's happening" feed, filterable by date/category/area
- Configurable theming (match CVB brand colors, fonts)
- Scoped to arbitrary geography (county, region, neighborhood, radius)
- Responsive, lightweight, fast-loading
- "Powered by LostCity" branding (removable at higher tiers)

**Why first:** Zero friction. No API contract, no dev shop, no integration deal. A CVB marketing manager can add it in 10 minutes.

### P1: Public Read-Only API

RESTful, documented, key-authenticated, rate-limited.

Core endpoints:
- `GET /v1/events` — filtered by date, category, geography, keyword
- `GET /v1/venues` — filtered by bounds, type, features
- `GET /v1/happening-now` — real-time contextual feed
- `GET /v1/categories` — available taxonomy for a region

**Why second:** Enables CVBs with dev resources (or their Simpleview dev shop) to build custom integrations. Also serves the broader API licensing revenue surface.

### P2: Flexible Geographic Scoping

CVBs operate at county/region/micro-destination level, not city level.

- Polygon-based or radius-based portal scoping (not just city name)
- Fast portal spin-up for any arbitrary geography
- Crawler coverage expansion for suburban/exurban venues
- Ability to include/exclude specific areas (e.g., "Henry County minus Stockbridge")

**Dependency:** This is also needed for neighborhood portals, multi-city expansion, and other verticals. High platform leverage.

### P3: Partner Analytics Dashboard

CVBs report to boards and justify budgets. They need numbers.

- Widget impressions, click-throughs, engagement
- Top events driving traffic
- Visitor intent signals (search terms, category interest, time-of-day patterns)
- Exportable PDF/CSV for board presentations
- Monthly summary emails

**Keep it simple.** This doesn't need to be Mixpanel — it needs to exist and be presentable in a quarterly board deck.

### P4: Venue/Member Attribution

CVBs have dues-paying members (restaurants, hotels, attractions). They need to show those members value.

- Per-venue impression/appearance counts ("Your venue appeared in 2,400 searches this month")
- Member-facing reports (CVB shares with their partners)
- Potential upsell: venue owners claim and enhance their listings

**Why this matters:** CVB member retention is a constant struggle. If we make the CVB look good to their members, we're sticky.

## What We Do NOT Build

- **Simpleview CRM integration** — Their CRM manages partner relationships, not event data. No value in connecting.
- **Event submission portal** — CVBs already have this. Our value is the data they *can't* get through submissions.
- **Convention/sports bid workflow** — Completely different product. Not our market.
- **Itinerary builder** — Low-value feature that Simpleview already covers.

## Revenue Model

| Tier | Target | Includes | Price Range |
|------|--------|----------|-------------|
| **Starter** | Small county CVBs | Widget embed, LostCity branding, basic analytics | $200-500/mo |
| **Professional** | Mid-market CVBs | Branded widget, API access, full analytics, venue reports | $1,000-2,500/mo |
| **Enterprise** | Metro DMOs | Full branded portal, API license, venue analytics, custom geography, white-label | $5,000-15,000/mo |

## Competitive Risks

- **Simpleview builds it** — Possible but unlikely near-term. Granicus is optimizing for government compliance and convention sales. Live event crawling is operationally alien to them. Their "Ticketed Event Feed" only covers ticketed venues (Ticketmaster partners), missing the entire long tail.
- **Eventbrite/Ticketmaster go direct** — They only cover their own inventory. No long-tail, no non-ticketed events.
- **Another startup** — Possible. Our moat is crawler coverage and data depth. The 500+ source advantage compounds over time.

## Next Steps

1. Build a proof-of-concept embeddable widget using existing Atlanta event data
2. Identify 3-5 target county CVBs in the Atlanta metro area for pilot outreach
3. Validate pricing and value prop through conversations with CVB directors
4. Assess crawler coverage gaps for suburban/exurban venues in target counties
