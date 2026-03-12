# PRD 033: Venue Publisher Tool

**Status:** Scoping
**Surface:** Both (venue-facing dashboard + consumer-facing embed widget)
**Strategic alignment:** Principle 7 (Crawlers Bootstrap, Federation Sustains), Principle 1 (Data Layer Is the Product), Principle 10 (Endgame Is Infrastructure)

---

## Problem

Small venues (bars, restaurants, galleries, music venues) have no good way to publish structured event/programming data. Their options:

- Facebook events (algorithm-buried, not embeddable, no structured data)
- Instagram stories (ephemeral, zero discoverability)
- Static website pages (no structure, out of date within a week)
- Eventbrite (designed for ticketed events, not weekly trivia or happy hours)
- Nothing (most common)

This forces LostCity to crawl fragmented, unstructured sources — building and maintaining 500+ individual scrapers for data that's often stale, incomplete, or wrong. The crawlers are a workaround for a data origination problem.

## Opportunity

Venues told us directly: they want a tool that helps them publish their programming and increase discoverability. They're not asking us to scrape them better — they're asking for a tool they'd use themselves.

If we give venues a calendar tool that improves their own website AND feeds structured data into the discovery ecosystem, we flip the data model. Venues maintain their own data because it serves them. Clean, normalized data flowing to LostCity is a byproduct, not a request.

## What This Is

A free embeddable calendar/programming widget that venues manage through a simple dashboard. Think "Calendly for venue programming" — dead simple to set up, looks good on their site, and makes their events discoverable on LostCity and beyond.

## What This Is Not

- Not an event ticketing platform (Eventbrite owns that)
- Not a listing management tool (Yext owns that)
- Not a reservation system (Resy/OpenTable own that)
- Not a point-of-sale marketing add-on (Toast/Square own that)

The gap is: **structured programming management + embeddable display + discovery syndication.** Nobody does this for the bar with trivia on Tuesdays and a DJ on Fridays.

---

## MVP Scope

### Venue Claim + Dashboard

**Venue claim flow:**
1. Venue searches for their business on LostCity (we already have ~2,000 venue records)
2. Verification via email domain, Google Business ownership, or manual approval
3. Claimed venue gets a dashboard at `lostcity.com/manage/[venue-slug]`

**Dashboard — Event Management:**
- Add/edit single events (title, date, time, category, description, image, ticket link)
- Create recurring programming (e.g., "Trivia Tuesdays" — set once, generates events weekly)
- Manage specials (happy hours, brunch deals — day-of-week + time window)
- Bulk actions (cancel a week, shift times)
- Simple image upload (crop/resize built in)

**Dashboard — Venue Profile:**
- Hours of operation
- Tags/vibes (from LostCity's taxonomy, presented as selectable chips)
- Description, images, links
- Category and venue type

**Dashboard — NOT in MVP:**
- Analytics (Phase 2 — requires enough traffic to show meaningful numbers)
- Multi-user access / permissions
- Social media auto-posting
- Reservation integration
- Menu management

### Embeddable Widget

A `<script>` tag venues drop into their website that renders a clean event calendar.

```html
<script src="https://lostcity.com/embed/v1/venue-slug.js"></script>
<div id="lostcity-calendar"></div>
```

**Widget features:**
- Upcoming events list (default view)
- Weekly calendar view (toggle)
- Recurring programming displayed with series branding
- Active specials shown contextually (happy hour visible during applicable hours)
- Responsive (works on mobile, desktop, sidebar, full-width)
- Minimal default styling, inherits parent page fonts
- "Powered by LostCity" footer link (free tier)
- Links to event detail on venue's own site first, LostCity as fallback

**Widget — NOT in MVP:**
- Custom color theming (use sensible defaults)
- RSVP/save directly from widget
- Multiple widget layouts
- White-label (remove LostCity branding)

### Data Pipeline

Events created through the dashboard flow into LostCity's existing data model:

- **Source type:** `claimed` (vs. `crawler` for scraped sources)
- **Validation:** Same tag inference, category validation, and quality checks as crawled events
- **Priority:** Venue-managed data is authoritative — overrides any crawler data for the same venue
- **Conflict resolution:** If a crawler and a claimed venue both produce events, the claimed data wins. Crawler can be auto-disabled for claimed venues.
- **Schema:** No new tables needed. Events, venues, venue_specials, and sources all exist. Add `source.source_type = 'claimed'` and `source.claimed_by_user_id`.

---

## Pricing Model

### Free (Forever)

- Event/programming management dashboard
- Basic embeddable calendar widget with "Powered by LostCity" footer
- LostCity listing (auto-enriched from dashboard data)
- Google Search structured data injection (Event + LocalBusiness JSON-LD)
- AI chatbot discoverability (canonical links to LostCity event pages)
- Up to 50 active events at a time

This tier is the growth engine. Search/AI discoverability is included free because: (a) it's the strongest hook for adoption, (b) every widget deployed builds LostCity's domain authority, and (c) the structured data improves our data quality regardless of whether the venue pays. Do not gate this behind payment.

### Pro (~$39/mo)

Gate on analytics, customization, and advanced data management:

- Analytics dashboard: views, clicks, discovery attribution ("12 people found your trivia night on LostCity this week"), Google Search impressions for their events
- Custom widget styling (brand colors, fonts)
- Recurring event templates with advanced scheduling
- Specials management (happy hours, brunch deals)
- Priority placement in LostCity search/feed
- Remove "Powered by LostCity" from widget
- Unlimited active events
- Search performance report: which events are appearing in Google rich results, which AI assistants are citing them

### Featured (~$99/mo)

Gate on distribution and promotion:

- Everything in Pro
- Promoted placement across LostCity portals (show up on FORTH for hotel guests, etc.)
- Cross-portal visibility controls
- Monthly performance report with competitive benchmarking
- Featured venue spotlights in LostCity feed
- Co-marketing opportunities
- Enhanced `sameAs` management — we actively maintain consistency across their GBP, Yelp, and Facebook profiles

### Pricing rationale

- Small venues spend $50-200/mo on marketing they can't measure (Instagram boosts, Yelp ads). $39/mo with clear attribution is competitive.
- $99/mo is less than one night of Instagram ads. Cross-portal distribution (hotel guests finding your bar through FORTH) is unique value.
- The free tier must be genuinely useful, not a crippled trial. Data quality and domain authority depend on adoption; adoption depends on a free tier worth using.
- **Search/AI discoverability is the wedge.** "Your events show up in Google and ChatGPT" is a sentence that gets a venue owner's attention. It's free because every deployment benefits LostCity's platform. The paid tiers upsell on measuring and amplifying that discoverability.

---

## Strategic Value

### For LostCity's data layer
- Eliminates crawler maintenance for claimed venues
- Structured data at the source — no parsing, no inference, no stale scrapes
- Venue-maintained = always current (they have the incentive)
- Enriches the platform for every portal customer

### For the platform business
- Every embed widget is a "Powered by LostCity" distribution touchpoint
- Makes portal subscriptions more valuable (FORTH is better when 200 venues actively manage their data)
- Creates venue-level lock-in (once the calendar is on their site, switching is painful)
- Opens a direct venue revenue stream alongside portal subscriptions

### For the consumer product
- Better data = better discovery = more people going out
- Venues that manage their own data have richer descriptions, current hours, accurate event details
- Reduces the "stale event" and "missing info" problems that hurt consumer trust

---

## Architecture Notes

### What already exists
- Venue records (~2,000 in Atlanta)
- Event data model with full taxonomy (categories, tags, genres, vibes)
- Venue specials table
- Source model with crawl pipeline
- Auth system (Supabase Auth)
- API routes for events, venues, search

### What needs building

**New:**
- Venue claim/verification flow
- Venue management dashboard (React, behind auth)
- Event CRUD API routes (venue-scoped)
- Recurring event generation (cron or on-save expansion)
- Embed widget (standalone JS bundle, not part of Next.js app)
- Embed API endpoint (public, venue-scoped, cacheable)

**Modified:**
- Source model: add `source_type` enum (`crawler`, `claimed`, `manual`)
- Source model: add `claimed_by_user_id` FK
- Event pipeline: claimed events skip crawler validation, go through same tag inference
- Conflict resolution: claimed source takes priority over crawler source for same venue

### Embed widget architecture

The widget serves two audiences — human visitors and machine crawlers — and the architecture must handle both.

**Critical constraint: AI crawlers cannot execute JavaScript.** GPTBot (ChatGPT), ClaudeBot, PerplexityBot, and other AI crawlers fetch raw HTML only. A standard JS widget that injects content into a div is invisible to every AI crawler. Googlebot can execute JS but with significant delay (hours to days) and no guarantee.

**Hybrid approach (recommended):**

The widget does two things simultaneously:

1. **For human visitors:** JavaScript renders a live, interactive event calendar into the target div. Fetches from a cacheable API endpoint. This is the visual product — the calendar venues show their customers.

2. **For search engines and AI crawlers:** The embed script writes a block of JSON-LD structured data directly into the page's `<head>` via `document.createElement('script')`. This includes:
   - `LocalBusiness` schema for the venue (name, address, hours, type, `sameAs` links to GBP/Yelp/Facebook)
   - Individual `Event` schema for each upcoming event (name, startDate, location, offers, image, performer)
   - `BreadcrumbList` linking back to the venue's canonical page on LostCity

   Googlebot renders JS and can read this. For AI crawlers that can't execute JS, the fallback is the canonical link strategy below.

3. **Canonical link strategy:** Each event in the widget links to its canonical page on LostCity's domain (`lostcity.com/atlanta/events/[slug]`). These pages are fully server-rendered with complete JSON-LD in the initial HTML response. AI crawlers that can't execute JS on the venue's site will follow these links and index LostCity's canonical pages instead. This means:
   - Googlebot gets structured data from both the venue's site AND LostCity's canonical pages
   - AI crawlers get structured data from LostCity's canonical pages via link-following
   - LostCity's domain accumulates search authority from every embedded widget pointing back to it
   - The venue gets a working calendar + `LocalBusiness` schema for their Knowledge Panel

**Installation:**
```html
<script src="https://lostcity.com/embed/v1/venue-slug.js" async></script>
<div id="lostcity-calendar"></div>
```

**Technical requirements:**
- Standalone JS bundle, not part of Next.js app
- Minimal footprint (<30KB gzipped)
- No framework dependency (vanilla JS or Preact)
- Shadow DOM for the visual calendar to avoid CSS conflicts with host site
- JSON-LD injection into `<head>` happens outside Shadow DOM (must be in page scope for crawlers)
- Lazy-loads images
- Fetches from a public cacheable API endpoint (`/api/embed/[venue-slug]`) that returns both display data and structured data payloads
- Cache TTL: 5 minutes for display data, 1 hour for structured data (events don't change that frequently)

---

## Search & AI Discoverability

This is the widget's strongest differentiator. No existing tool for independent venues provides dual-channel optimization for traditional search and AI search.

### Google Search: Event Rich Results

Google surfaces events in a dedicated carousel above organic results for queries like "events in Atlanta tonight" or "live music near me." This triggers from JSON-LD `Event` schema on the page. Eventbrite documented a 100% increase in traffic after implementing structured data across their event pages.

**The problem for venues today:** When a venue uses Eventbrite's embed widget, Eventbrite's domain gets the rich result — not the venue's website. The venue's own site earns zero search equity from their own events.

**What our widget does differently:** Injects `Event` JSON-LD directly onto the venue's page. The venue's domain earns the rich result. Google sees the venue as the authoritative source.

**Required Event schema properties:**
- `name` — full event title
- `startDate` — ISO 8601 datetime
- `location` — `Place` with `name` and full `PostalAddress`

**Recommended properties that improve rich result display:**
- `endDate`, `description`, `image` (1920px+ preferred)
- `eventStatus` — `EventScheduled` / `EventCancelled` / `EventPostponed`
- `offers` — price, currency, availability (`InStock`/`SoldOut`), ticket URL
- `performer` — `Person` or `MusicGroup`
- `organizer` — `Organization` with name and URL

**Recurring events:** Google does NOT support `EventSeries` or `Schedule` types for rich results. Each occurrence needs a separate `Event` record — which matches how LostCity already structures recurring event data.

### Google Search: Knowledge Panel / Local SEO

Separate from events, the widget injects `LocalBusiness` JSON-LD on the venue's homepage to improve their Google Knowledge Panel (the right-rail card when someone searches a venue by name).

**Schema type should match the venue:**
- `BarOrPub` for bars
- `Restaurant` for restaurants
- `MusicVenue` for music venues
- `ArtGallery` for galleries
- `NightClub` for clubs

**The `sameAs` array is critical.** It explicitly links all of a venue's profiles:
```json
{
  "@type": "BarOrPub",
  "name": "Manuel's Tavern",
  "sameAs": [
    "https://www.google.com/maps/place/...",
    "https://www.yelp.com/biz/manuels-tavern-atlanta",
    "https://www.facebook.com/ManuelsTavern",
    "https://www.instagram.com/manuelstavern"
  ]
}
```

This tells Google (and AI systems) "all these profiles describe the same entity." Without it, mentions across different platforms are treated as separate entities with lower confidence.

### AI Chatbot Discoverability

When someone asks ChatGPT, Gemini, or Perplexity "what's happening tonight in Atlanta," the response quality depends on:

1. **Perplexity** — Best for real-time queries. Does on-demand crawling, prioritizes frequently-updated pages. An events calendar page that changes weekly gets more crawl attention than a static page. Perplexity will follow links from the widget to LostCity's canonical event pages and index them.

2. **Gemini** — Pulls from Google's Knowledge Graph and Google Business Profiles. Venues with complete `LocalBusiness` schema and consistent entity data across sources are more likely to surface. The `sameAs` links and `openingHoursSpecification` in our widget feed directly into this.

3. **ChatGPT** — Leans heavily on aggregators (~48% of citations from Yelp/TripAdvisor/similar). Less likely to cite venue websites directly. However, ChatGPT does cite LostCity-scale aggregators — so the canonical links from embedded widgets back to LostCity's event pages benefit us here. The more widgets deployed, the more inbound signals pointing to LostCity's domain, the more likely ChatGPT cites LostCity as a source.

**The flywheel:** Every embedded widget creates links from venue websites to LostCity's canonical pages. This builds LostCity's domain authority for both traditional search and AI citation. 200 venue websites all linking to `lostcity.com/atlanta/events/...` is a powerful signal that LostCity is the authoritative source for Atlanta event data.

### What this means for the pitch

Don't say "schema.org" or "JSON-LD" to a venue owner. Say:

> "Right now, when someone asks Google or ChatGPT 'what's happening tonight in Atlanta,' your events don't show up — because your website can't talk to these systems. Drop one line of code on your site and we fix that. Your events start appearing in Google search results and AI assistant answers. You don't have to do anything else."

The venue gets:
- Events in Google's event carousel (rich results)
- Better Google Knowledge Panel (correct hours, consistent identity)
- Visibility in AI assistant responses (Perplexity, Gemini, ChatGPT)
- A working event calendar on their own website

LostCity gets:
- Clean structured data from the source
- Inbound links from hundreds of venue websites building domain authority
- AI crawlers indexing LostCity's canonical pages via link-following
- Reduced crawler maintenance burden

---

## Validation Plan

Before building the full product:

1. **Warm lead test (Week 1):** Take 5-10 venues from active conversations. Show them a mockup or prototype. Ask: "If this existed today, would you set it up this week?" Not "would you use it" — would they act now.

2. **Manual MVP (Week 2-3):** For the 3-5 venues that say yes, manually onboard them. Simple dashboard, basic widget. Measure: do they actually input events? Do they keep it updated? Does data quality improve vs. their crawled data?

3. **Build decision (Week 4):** If 3+ venues are actively maintaining their data after 2 weeks, build the real product. If they input data once and abandon it, the tool doesn't solve a real workflow problem — reconsider.

---

## Future Phases

### Phase 2: GBP & Directory Syndication

The MVP widget injects structured data on the venue's own website and links to LostCity's canonical pages. Phase 2 pushes event data directly to third-party platforms via their APIs.

**Google Business Profile API push:**
- Programmatically create "local posts" (event type) on the venue's GBP
- Venue enters events once in our dashboard → appears on their website (widget), on LostCity (data pipeline), AND on their Google Business Profile (API push)
- Requires OAuth per business — venue authorizes LostCity to manage their GBP posts during onboarding
- GBP events surface in Google Maps, Google Search Knowledge Panel, and Gemini responses
- This is the single most tangible upsell: "Your events appear on your Google Business Profile automatically"

**Other directory targets (evaluate in order of ROI):**
- Facebook Events (Graph API — create events on venue's FB page)
- Yelp Events (limited API, may require partnership)
- Apple Business Connect (event support is nascent)

**What this is NOT:**
- Not full listing management (NAP sync across 100+ directories). That's Yext's land war and a commodity. We don't sync hours to Bing Places.
- The strategic frame: **Yext manages your identity. We manage your programming.** Complementary, not competitive.

**Positioning in the market:**

| Layer | What it is | Who does it today |
|-------|-----------|-------------------|
| Listing management | NAP, hours, photos across directories | Yext, Moz Local, BrightLocal |
| Programming management | Events, specials, recurring series | **Nobody for independent venues** |
| Discovery distribution | Getting events in front of consumers | Eventbrite (ticketed only), LostCity |

We own layer 3 already. The venue publisher tool is a layer 2 product that connects to layer 3. Layer 1 is out of scope — but the `LocalBusiness` schema in our free widget gives small venues ~60% of Yext's listing-consistency value as a side effect, for free.

### Phase 3: Analytics & Search Performance

- Discovery attribution: "12 people found your trivia night on LostCity this week, 8 clicked through to your site"
- Google Search Console integration: which events are appearing as rich results, impression counts, CTR
- AI citation tracking: monitoring when Perplexity/Gemini/ChatGPT cite the venue's events (harder, may require periodic query sampling)
- Competitive benchmarking: how the venue's discoverability compares to similar venues in their neighborhood
- This is the Pro tier justification — free tier gets the discoverability, paid tier gets the measurement

### Phase 4: Multi-Venue & Restaurant Group Management

- Group dashboard for operators running 3-5+ venues
- Role-based access (owner vs. manager vs. staff)
- Cross-venue analytics
- Bulk event creation across multiple locations
- This becomes relevant when adoption reaches restaurant groups, not individual operators

---

## Open Questions

1. **Verification method:** Email domain matching works for venues with custom domains. What about venues using Gmail/Yahoo? Google Business Profile ownership check? Manual approval with delay?

2. **Crawler coexistence:** When a venue claims their listing, do we immediately disable their crawler? Or run both in parallel for a transition period and diff the results?

3. **Multi-venue operators:** Some operators run 3-5 venues (restaurant groups). Do we need a group management layer in MVP, or is per-venue login sufficient?

4. **Event ownership:** If a venue creates an event through the dashboard, and that event also appears on Eventbrite, who owns the canonical record? Merge logic needed?

5. **`sameAs` collection:** The `LocalBusiness` schema is most powerful when it links to the venue's GBP, Yelp, Facebook, and Instagram profiles. Do we ask venues to provide these URLs during onboarding? Or auto-detect them from existing data?

6. **Scope boundary with portals:** A venue managing their data through the publisher tool is NOT the same as a portal customer. A restaurant doesn't need federation, bespoke UX, or branded discovery. Keep these products distinct. The publisher tool feeds the data layer; portals consume it.

7. **Canonical URL ownership:** Our architecture routes AI crawlers to LostCity's canonical event pages (good for our domain authority). Venues might eventually want canonical URLs on their own domain. Is this a Pro/Featured tier differentiator, or do we always keep canonical ownership?

8. **Structured data freshness:** The widget injects JSON-LD when the page loads. If a venue cancels an event, the structured data on their site is stale until the next page load + cache expiry. For Google, stale `EventScheduled` status when an event is cancelled hurts trust. Cache TTL and `eventStatus` updates need to be fast.
