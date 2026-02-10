# LostCity Monetization Playbook

Revenue models beyond portal subscriptions. Think platforms, marketplaces, data products, and network effects — not just SaaS seats.

---

## Revenue Models

### 1. Event Discovery API — "Stripe for Event Data"

**What It Is:**
RESTful/GraphQL API giving developers programmatic access to Atlanta's event data. Think Stripe for payments, Twilio for SMS, Mapbox for maps — but for "what's happening locally."

**Target Customers:**
- Mobile app developers building "things to do" features
- AI assistant builders (ChatGPT plugins, Alexa skills, personal AI agents)
- Dating apps (Hinge, Bumble, Match) needing date idea suggestions
- CRM platforms (HubSpot, Salesforce) adding "local events" to contact records
- Calendar apps (Fantastical, Notion, Cron) surfacing events by interest
- Travel apps, hotel booking platforms, ride-share apps (contextual recommendations)

**Pricing:**
- **Free tier:** 1,000 API calls/month (for hobbyists, proof-of-concept)
- **Starter:** $49/mo for 10,000 calls
- **Growth:** $199/mo for 100,000 calls
- **Enterprise:** Custom pricing for 1M+ calls (includes SLA, dedicated support)

**Revenue Potential:**
- 200 developer customers at $99/mo average = $238,800 ARR
- 10 enterprise clients at $1,500/mo = $180,000 ARR
- Total: $418,800 ARR

**How to Execute:**
1. Build REST + GraphQL endpoints (already have data, just need API layer)
2. Developer docs site with interactive examples (Stripe-quality)
3. List on RapidAPI, AWS Marketplace, Zapier integrations
4. SDKs for JavaScript, Python, Swift
5. Freemium model drives adoption, usage-based pricing captures value

**Timeline:** 2-3 months to v1 (API + docs + billing)

---

### 2. Venue Analytics Dashboard

**What It Is:**
Flip the data model. Instead of only selling TO consumers, sell insights BACK to the 2,300 venues you crawl. Show them how people discover them.

**Dashboard Features:**
- **Traffic analytics:** "Your venue appeared in 1,247 searches this month"
- **Keyword insights:** "People found you via 'live music Decatur' (34%), 'trivia night' (22%), 'date night restaurant' (18%)"
- **Competitive benchmarking:** "You rank #3 for 'cocktail bars in East Atlanta Village'"
- **SEO score:** "Your website has no event calendar. You're missing 500+ monthly clicks."
- **Referral sources:** "40% of your traffic came from Instagram, 25% from Google, 20% from LostCity"
- **Peak interest times:** "Searches for your venue spike on Thursday afternoons"

**Pricing Tiers:**
- **Basic:** $29/mo — traffic stats, keyword insights
- **Pro:** $99/mo — competitive analysis, SEO recommendations, export data
- **Premium:** $249/mo — white-label event widget for their website + full analytics

**Revenue Potential:**
- 100 venues at $99/mo average = $9,900/mo = $118,800 ARR
- 500 venues at $99/mo average = $49,500/mo = $594,000 ARR

**Target Venues:**
Start with music venues (they're data-savvy, marketing-focused):
- The Earl, Terminal West, Variety Playhouse, Aisle 5, The Masquerade
- Expand to breweries, restaurants, galleries, theaters

**How to Execute:**
1. Build analytics dashboard (2-3 months, reuse existing event data)
2. Freemium model: basic stats are free, advanced features are paid
3. Email campaign to top 200 venues: "Here's how people discover you (for free). Want more insights?"
4. Upsell to white-label widget: "Embed our event feed on your website, co-branded"

---

### 3. Sponsored Event Listings

**What It Is:**
Events are free to list (keep the crawlers running), but venues/promoters can pay to boost visibility.

**Sponsorship Options:**
- **Weekend Boost:** $25 — Top placement Fri-Sun
- **Week-Long Feature:** $100 — Featured slot for 7 days
- **Homepage Takeover:** $500 — Hero placement for 24 hours (festivals, major concerts)
- **Category Sponsorship:** $200/mo — Own "Comedy" or "Live Music" for a month
- **Neighborhood Sponsorship:** $150/mo — "Events in East Atlanta Village, presented by [Venue]"

**Self-Serve Platform:**
- Stripe checkout, no sales calls
- Venues/promoters buy directly via dashboard
- Preview before purchase

**Revenue Potential:**
- 100 events/month at $50 average = $5,000/mo = $60,000 ARR
- Scale to 500 events/month = $25,000/mo = $300,000 ARR

**How to Execute:**
1. Build self-serve sponsorship dashboard (2 months)
2. Email top 50 venues with free $25 credit to test
3. Add "Boost This Event" button to venue dashboards (from Analytics product)
4. Promote via social: "Your event is live. Want more eyes on it?"

---

### 4. Data Licensing to Institutions

**What It Is:**
Sell cleaned, structured event + venue data to organizations that need Atlanta insights but don't want to build their own crawlers.

**Target Buyers:**
- **Tourism boards:** Explore Georgia, Atlanta Convention & Visitors Bureau
- **Economic development:** Invest Atlanta, Metro Atlanta Chamber
- **Research institutions:** Federal Reserve Bank of Atlanta (economic indicators), Georgia State (urban planning)
- **Film/TV:** Georgia Film Office (location scouting, crew entertainment)
- **Real estate developers:** "Cultural Vitality Index" for site selection
- **City/county government:** Mayor's Office of Cultural Affairs, Fulton County Arts Council

**Licensing Models:**
- **One-time export:** $5-10k for full dataset (venues + events, 12-month history)
- **Annual license:** $25-50k/year for quarterly exports + API access
- **Custom dashboards:** $75-150k for white-labeled analytics (e.g., "Atlanta Cultural Dashboard" for city government)

**Revenue Potential:**
- 3-4 institutional contracts = $100-200k ARR
- One city partnership = $75-150k/year

**How to Execute:**
1. Package data: CSV exports, API access, or custom Tableau/Looker dashboards
2. Outreach to Explore Georgia (they spend millions on tourism marketing but lack granular event data)
3. Pitch to Federal Reserve Bank of Atlanta: "Event density is an economic indicator"
4. Georgia Film Office: "We track every event in Atlanta. You need to know when streets are closed for festivals."

---

### 5. Event Intent Leads for Advertisers

**What It Is:**
Sell intent signals without selling ads. User searches "comedy shows this weekend" → you sell that signal to advertisers (Lyft, Resy, SpotHero, hotels).

**How It Works:**
- User searches "live music Friday night" → served results
- Behind the scenes: you ping Lyft API ("user is going to a show, offer $10 off")
- User sees: "Need a ride? $10 off Lyft" (or OpenTable reservation link, parking discount, hotel deal)
- You get: CPM (cost per impression) or CPA (cost per action)

**Target Advertisers:**
- **Ride-share:** Lyft, Uber (event nights = surge demand)
- **Restaurants:** Resy, OpenTable (pre-show dinner reservations)
- **Parking:** SpotHero, ParkWhiz (concerts, sports, festivals)
- **Hotels:** Marriott, Hilton (out-of-town event attendees)
- **Event insurance:** Allianz (last-minute ticket buyers)

**Pricing Models:**
- CPM: $5-15 per 1,000 impressions
- CPA: $2-5 per click, $10-25 per conversion (ride booked, reservation made)

**Revenue Potential:**
- 100,000 monthly users → 1M impressions/mo at $10 CPM = $10,000/mo = $120,000 ARR
- Scale to 500k users → $60,000/mo = $720,000 ARR
- Add conversion tracking (CPA model) → $240,000 ARR

**How to Execute:**
1. Integrate Lyft/Uber/Resy APIs (1 month build)
2. A/B test: control group sees no ads, test group sees contextual offers
3. Track CTR, conversion, user sentiment (don't ruin UX for $5 CPM)
4. Pitch to local advertisers first (Atlanta restaurants, SpotHero), then national (Lyft, OpenTable)

---

## Partnership Structures

### 1. MARTA Integration — Transit + Events

**Partnership Model:**
- Power "Events near your station" feature in MARTA app
- Content for 200 digital screens across rail stations
- Co-branded marketing: "MARTA + LostCity: Where Atlanta Takes You"

**Revenue Models:**
- **Licensing fee:** $5-10k/mo for app integration
- **Screen content fee:** $3-5k/mo (paid by Intersection Media, the ad partner)
- **Affiliate revenue share:** MARTA gets 10% of ticket sales from "near this station" recommendations

**Value to MARTA:**
- Drives ridership (especially nights/weekends when trains run empty)
- World Cup 2026 prep (international visitors need transit + destinations)
- NextGen Bus launch (April 2026) — show riders what's newly accessible

---

### 2. Mixed-Use Development Feeds

**Partnership Model:**
- Power "What's Happening" pages for The Battery, Ponce City Market, Atlantic Station
- Tenant events auto-populate (restaurants, retail, entertainment)
- Replace static CMS with dynamic API feed

**Revenue Models:**
- **Annual license:** $10-25k/year per property
- **Rev share:** 10-15% of affiliate revenue from events discovered via their site
- **Analytics upsell:** $5-10k/year for tenant-facing dashboard

**Target Properties:**
- Ponce City Market (2M+ visitors/year, Jamestown is data-driven)
- The Battery (8M+ visitors, Braves anchor, need year-round traffic)
- Atlantic Station (18M+ visitors, struggling with retail vacancy)

---

### 3. Co-Branded Content with Media

**Partnership Model:**
- License data to Atlanta Magazine, AJC, GPB for "Best Things to Do This Week"
- Trade: they get fresh content, you get distribution + backlinks + brand authority

**Revenue Models:**
- **Licensing fee:** $2-5k/mo (small pubs) to $10-25k/mo (AJC, Atlanta Magazine)
- **Affiliate revenue share:** 50/50 split on ticket sales from their articles
- **Sponsored content:** Publishers pay you to feature certain events in co-branded guides

**Target Partners:**
- Atlanta Magazine (120k subscribers, affluent audience)
- Atlanta Journal-Constitution (200k+ subscribers, daily reach)
- Georgia Public Broadcasting (trusted, statewide reach)
- Thrillist Atlanta, Eater Atlanta (young, engaged, event-focused)

---

### 4. White-Label Embed Widgets

**What It Is:**
JavaScript widget that any website can embed: `<script src="lostcity.com/widget.js"></script>`

**Use Cases:**
- Venues embed on their site: "Other events happening near us"
- Neighborhood associations: "Events in Virginia-Highland this month"
- Hotels: "Things to do this weekend"
- Apartment complexes: "Events near your building"

**Pricing Tiers:**
- **Free:** Widget with LostCity branding
- **Basic:** $19/mo — Remove branding
- **Pro:** $49/mo — Custom styling (colors, fonts)
- **Premium:** $99/mo — Custom styling + analytics ("Your widget drove 1,200 clicks this month")

**Revenue Potential:**
- 200 venues at $49/mo average = $9,800/mo = $117,600 ARR
- 500 websites at $49/mo = $24,500/mo = $294,000 ARR

**How to Execute:**
1. Build embeddable widget (2-3 weeks, similar to Google Maps embed)
2. Email all 2,300 crawled venues: "Add events to your website in 5 minutes"
3. Self-serve signup, Stripe billing
4. SEO benefit: every embed = backlink to LostCity

---

### 5. Corporate Entertainment Packages (B2B2C)

**What It Is:**
Sell curated event packages to corporate clients for employee entertainment, client entertainment, or team building.

**Target Buyers:**
- **Law firms:** King & Spalding, Alston & Bird (client entertainment budgets $50-200k/year)
- **Corporate HQs:** Delta, Coca-Cola, UPS (employee engagement)
- **Agencies:** 22squared, Fitzco, Moxie (team building)

**Packages:**
- **Client Entertainment:** "Impress your client with a curated Atlanta night" ($500-2k per package: dinner reservation + show tickets + car service)
- **Team Building:** "Get your team out of the office" ($1-5k for 10-50 people: brewery tour + escape room + dinner)
- **New Hire Onboarding:** "Welcome to Atlanta" kit ($200-500 per employee: 3-month event guide + discounts)

**Revenue Models:**
- **Per-package pricing:** $500-5k depending on group size
- **Annual retainer:** $5-25k/year for ongoing access ("12 client entertainment nights/year")
- **Corporate dashboard:** $5k setup + $1-3k/mo for self-serve booking

**Revenue Potential:**
- 10 corporate clients at $25k/year average = $250,000 ARR
- 50 one-off packages at $1,500 average = $75,000/year

---

## Inbound / Pull Strategies

### 1. "What Should I Do This Weekend?" Quiz

**What It Is:**
Shareable personality quiz (BuzzFeed-style) that generates personalized event recommendations.

**Quiz Flow:**
- "Are you more brunch or late-night?" → "Outdoors or indoors?" → "Solo, date, or group?"
- Results: "You're an 'Urban Explorer' — here are your 5 perfect events this weekend"
- Shareable results page (Open Graph images, Twitter cards)

**Monetization:**
- Affiliate links to ticketing (SeeTickets, Eventbrite, venue sites)
- Sponsored results: "This event is perfect for you (Sponsored)"
- Email capture: "Get your personalized weekend guide every Thursday"

**Value Beyond Revenue:**
- Viral distribution (people share quiz results)
- Email list growth: 50,000 subscribers in 6 months
- SEO: quiz generates unique result pages for every combination

**Timeline:** 2 weeks to build, $0 marginal cost

---

### 2. Newsletter Empire

**What It Is:**
Weekly "10 Best Things to Do in Atlanta This Weekend" newsletter, auto-generated from event data.

**Newsletter Types:**
- **Flagship (free):** "10 Best Things" (general audience, 50k+ subscribers)
- **Niche (paid):** "Comedy This Week" ($5/mo), "Free & Cheap" ($3/mo), "Family-Friendly" ($5/mo), "Nightlife" ($5/mo)
- **Sponsored:** Sell sponsorships in free newsletter ($3-5k/week per sponsor)

**Revenue Models:**
- **Sponsorships:** $3k/week in flagship newsletter = $156,000/year
- **Paid subscriptions:** 5,000 subs at $5/mo average = $25,000/mo = $300,000/year
- **Affiliate revenue:** Ticket links in every event = $10-30k/year

**Total Revenue Potential:** $180,000 ARR (conservative)

**How to Execute:**
1. Auto-generate newsletter from top-ranked events (already have the data)
2. Launch with free newsletter, build to 10k subs in 3 months
3. Add sponsorships at 25k subs, paid tiers at 50k
4. ConvertKit or Beehiiv for platform (built-in monetization tools)

---

### 3. SEO Content Factory — Programmatic Pages

**What It Is:**
Auto-generate thousands of SEO-optimized pages from existing event data.

**Page Templates:**
- **Category + Month:** "Best Comedy Shows in Atlanta February 2026" (12 months × 20 categories = 240 pages)
- **Neighborhood + Category:** "Live Music in East Atlanta Village" (30 neighborhoods × 20 categories = 600 pages)
- **Events Near Landmarks:** "Events Near Ponce City Market" (50 landmarks × 12 months = 600 pages)
- **Date-Specific:** "Things to Do in Atlanta This Weekend" (52 weekends = 52 pages, evergreen)
- **Niche Combos:** "Free Outdoor Events in Atlanta" (5 price levels × 10 activity types × 30 neighborhoods = 1,500 pages)

**Total Pages:** 2,760+ pages auto-generated from data you already have

**Monetization:**
- Affiliate links on every page (ticketing, restaurants, parking)
- Google AdSense (conservative: $2-5 CPM)
- Sponsored placements: "Featured Event" at top of each page

**Revenue Potential:**
- 100k monthly organic visitors at $1.38 ARPU (affiliate + ads) = $138,000 ARR
- Scale to 500k visitors = $690,000 ARR

**SEO Strategy:**
- Target long-tail keywords ("free things to do in decatur this weekend")
- Schema markup for events (Google rich snippets)
- Internal linking between pages (neighborhood → category → specific events)

**Timeline:** 1 month to build page templates, ongoing content generation is automated

---

### 4. Community Platform — Social Layer

**What It Is:**
Add social features to LostCity: user profiles, RSVPs, friend activity, user-generated lists.

**Features:**
- **User profiles:** "Sarah's been to 47 events this year"
- **Social RSVPs:** "12 people you follow are going to this"
- **User lists:** "Sarah's Date Night Spots" (shareable, SEO-friendly)
- **Activity feed:** "Your friends went to 8 events this week"
- **Recommendations:** "People like you also loved [event]"

**Monetization:**
- **Freemium model:** Free users see ads, premium users ($5/mo) get:
  - Ad-free experience
  - Unlimited saved events
  - Advanced filters
  - Early access to ticket sales
  - Exclusive events (members-only shows)

**Revenue Potential:**
- 25,000 active users, 10% convert to premium = 2,500 paid subs
- 2,500 × $5/mo = $12,500/mo = $150,000 ARR

**How to Execute:**
1. Phase 1: User accounts + saved events (1 month)
2. Phase 2: Social RSVPs + friend activity (2 months)
3. Phase 3: User-generated lists + premium tier (1 month)
4. Network effects kick in: more users = more value = more users

---

## Atlanta-Specific Leverage

### 1. Delta SkyMiles — Events as Mile Redemption

**What It Is:**
Partner with Delta to let SkyMiles members redeem miles for event tickets.

**How It Works:**
- Concert ticket = 15,000 miles
- Museum admission = 5,000 miles
- Festival pass = 25,000 miles
- Delta gets 10-15% of ticket face value, LostCity gets affiliate commission

**Why Delta Cares:**
- 120 million SkyMiles members
- Atlanta is mega-hub (75% of ATL airport traffic)
- "Local experiences" redemptions are growing 40% YoY
- Differentiation: "Only Delta lets you use miles for local events"

**Revenue Potential:**
- 1% of Atlanta-based SkyMiles members (assuming 500k local members) = 5,000 people
- 5,000 people book one $50 event/year = $250,000 in ticket sales
- 10% commission = $25,000/year
- Scale nationally to all Delta hubs = $500,000 ARR

**How to Execute:**
- Pitch to Delta VP of Customer Engagement & Loyalty
- World Cup 2026 angle: "You're flying the world to Atlanta. What do they do here?"
- Pilot: Atlanta-only for 6 months, expand if successful

---

### 2. Film/TV Production Services

**What It Is:**
Georgia is the #1 film production state. Productions need local intel.

**Services:**
- **Crew entertainment:** "What's open late near your shooting location?"
- **Event conflict analysis:** "Your shoot is during Music Midtown — streets will be closed"
- **Location scouting:** "Find venues that look like [aesthetic]"
- **Talent hosting:** "Visiting actor needs weekend recommendations"

**Pricing:**
- $500-2k per production (depending on budget size)
- Annual retainer for studios: $10-25k/year (Marvel, Tyler Perry Studios shoot year-round)

**Revenue Potential:**
- 200+ productions/year in Georgia
- 30 productions at $1,500 average = $45,000/year
- 3 studio retainers at $15k/year = $45,000/year
- **Total:** $60,000 ARR (low-hanging fruit)

**How to Execute:**
- Outreach to Georgia Film Office (they connect you to productions)
- Pitch to production coordinators, not directors
- Tyler Perry Studios first (they shoot constantly, based in Atlanta)

---

### 3. HBCU Student Engagement

**What It Is:**
Atlanta has 4 HBCUs (Morehouse, Spelman, Clark Atlanta, Morris Brown) + AUC Consortium. 20,000+ students.

**Product:**
- Student-priced event portal ("Free & Under $20" emphasis)
- Campus event integration (homecoming, Greek life, campus org events)
- Student discount partnerships with venues

**Monetization:**
- Sell to universities at $10-25k/year per school
- Student freemium model: free with ads, $3/mo premium (ad-free + exclusive discounts)
- Venue partnerships: "Offer a student discount, we drive foot traffic"

**Revenue Potential:**
- 4 HBCUs at $15k/year average = $60,000/year
- 2,000 premium student subs at $3/mo = $6,000/mo = $72,000/year
- Venue partnerships: $5-10k/year (co-marketing)
- **Total:** $150,000 ARR

---

### 4. BeltLine Development Data

**What It Is:**
The Atlanta BeltLine is a $4.8B urban redevelopment project. Developers need data on "cultural vitality" to justify investments.

**Data Products:**
- **Cultural Vitality Index:** Event density per neighborhood along BeltLine corridor
- **Development reports:** "Inman Park has 3x more events than comparable neighborhoods"
- **Foot traffic predictions:** "Opening a brewery here captures 50k annual event-goers"

**Target Buyers:**
- Real estate developers (site selection)
- BeltLine Inc (impact reporting)
- City planning (zoning decisions)

**Pricing:**
- **Annual license:** $25-50k/year for BeltLine Inc
- **Custom reports:** $2-5k per report for developers
- **Ongoing dashboards:** $10-20k setup + $2-5k/mo

**Revenue Potential:** $50-100k ARR

---

### 5. Georgia World Congress Center (GWCC)

**What It Is:**
GWCC is the 4th-largest convention center in the US. Hosts 1M+ convention attendees/year.

**Product:**
- Custom landing page per convention: "Things to Do During [Convention Name]"
- Pre-event email to attendees: "Explore Atlanta between sessions"
- Co-branded with GWCC and convention organizers

**Monetization:**
- **GWCC licensing fee:** $25-50k/year to power all convention guides
- **Affiliate revenue:** Convention attendees book events, you get commission
- **Sponsorships:** Atlanta restaurants/venues sponsor convention guides

**Revenue Potential:**
- GWCC license: $40,000/year
- Affiliate revenue: 1M attendees, 5% book events, $50 avg ticket, 10% commission = $250,000/year
- **Total:** $290,000 ARR

---

## "LostCity Verified" Badge Program

**What It Is:**
Venues claim their listing, verify details, get a badge for their website.

**Badge Benefits:**
- "LostCity Verified" trust badge for venue website
- Free basic listing (name, address, events)
- Venues link back to LostCity (SEO gold: 2,300 backlinks)

**Pricing Tiers:**
- **Free:** Claim listing, basic info, badge
- **Basic ($29/mo):** Analytics (traffic, keywords)
- **Pro ($99/mo):** Priority placement, sponsored events, competitive insights
- **Premium ($249/mo):** White-label widget, API access, full analytics suite

**Revenue Potential:**
- 300 venues at $99/mo average = $29,700/mo = $356,400 ARR
- 1,000 venues at $99/mo = $99,000/mo = $1,188,000 ARR

**Viral Distribution:**
- Every badge on a venue website = backlink to LostCity
- Venues promote their "Verified" status → drives traffic to LostCity
- SEO flywheel: more badges → more backlinks → higher Google rank → more users → more venue signups

---

## White-Label Franchise Model for Other Cities

**What It Is:**
License LostCity tech stack to operators in other cities (Charleston, Savannah, Nashville, Charlotte).

**What You Provide:**
- Full tech stack (crawler framework, database schema, web app)
- Training on crawler development
- Ongoing updates and support

**What They Provide:**
- Local market knowledge (what to crawl, venue relationships)
- Sales and marketing in their city
- Revenue share back to LostCity

**Pricing:**
- **Setup fee:** $10-25k (onboarding, training, customization)
- **Monthly license:** $1-3k/mo (hosting, support, updates)
- **Revenue share:** 30% of their revenue (they keep 70%)

**Revenue Potential:**
- 10 cities at $2k/mo license = $20,000/mo = $240,000 ARR
- 10 cities generating $100k/year each, 30% share = $300,000 ARR
- **Total:** $540,000 ARR (mostly passive once launched)

**Target Cities:**
- **Southeast:** Charleston, Savannah, Nashville, Charlotte, Asheville
- **Tier 2 cities:** Richmond, Raleigh, Greenville SC, Birmingham
- Find local operators who know their city's event scene

---

## Prioritization Summary

### Immediate (0-3 months) — $50-100k ARR Potential
These have low build complexity and fast time-to-revenue:

1. **Event Discovery API** — 2-3 month build, freemium model, developer self-serve
2. **Sponsored Event Listings** — 2 month build, Stripe checkout, venue self-serve
3. **Newsletter Empire** — Auto-generated from data, ConvertKit setup, sponsorships at 25k subs
4. **SEO Content Factory** — 1 month to template, ongoing automated, affiliate revenue

**Combined potential:** $50-100k ARR in first 6 months

---

### Near-Term (3-6 months) — $200-400k ARR Potential
These require partnerships or deeper product builds:

1. **Venue Analytics Dashboard** — 2-3 month build, upsell from free to $99/mo
2. **White-Label Embed Widgets** — 2-3 week build, self-serve signup
3. **Delta SkyMiles Partnership** — 3-6 month sales cycle, pilot in Atlanta
4. **GWCC Convention Center** — Partnership pitch, 2-3 month implementation

**Combined potential:** $200-400k ARR by month 12

---

### Long-Term (6-12 months) — $500k-1M+ ARR Potential
These are platform plays with network effects:

1. **"LostCity Verified" Badge Program** — Viral distribution, 300-1,000 venues
2. **Community Platform** — Social features, freemium model, 25k active users
3. **White-Label Franchise Model** — 10 cities, mostly passive revenue
4. **Data Licensing** — Institutional contracts ($25-150k each)

**Combined potential:** $500k-1M+ ARR by year 2

---

## Execution Roadmap

**Month 1-2:**
- Launch Event Discovery API (freemium, developer docs)
- Build Sponsored Event Listings (self-serve Stripe checkout)
- Start Newsletter (free flagship, build to 10k subs)

**Month 3-4:**
- SEO Content Factory live (2,760+ auto-generated pages)
- Venue Analytics Dashboard beta (free tier, upsell to $99/mo)
- Pitch Delta SkyMiles partnership

**Month 5-6:**
- White-Label Embed Widgets (self-serve signup)
- GWCC partnership (custom convention landing pages)
- Newsletter at 25k subs, add first sponsor ($3k/week)

**Month 7-9:**
- "LostCity Verified" Badge Program launch
- Community Platform phase 1 (user accounts + saved events)
- Data licensing outreach (Explore Georgia, Federal Reserve)

**Month 10-12:**
- Franchise model pilot (Nashville or Charleston)
- Community Platform phase 2 (social features + premium tier)
- Scale API to 200+ developers

**Year 2:**
- 10-city franchise expansion
- Delta partnership scaled to all hubs
- 1,000 venues in Badge Program
- Community platform hits 25k active users

---

## Success Metrics

**Revenue Diversification (avoid single-channel risk):**
- No single revenue stream > 40% of total
- Target: 5+ revenue streams contributing meaningfully

**Customer Acquisition Cost (CAC):**
- API: $50 CAC, $99/mo ARPU → payback in 0.5 months
- Venue Analytics: $100 CAC, $99/mo ARPU → payback in 1 month
- Newsletter: $0 CAC (organic), $0.50/subscriber via ads

**Lifetime Value (LTV):**
- API customers: 24-month avg retention → $2,376 LTV
- Venue Analytics: 18-month avg retention → $1,782 LTV
- Community Premium: 12-month avg retention → $60 LTV

**Target LTV:CAC Ratio:** 3:1 minimum, 5:1+ ideal

---

## Final Thought

The portal subscription model (selling to consumers and B2B) is solid, but these revenue models turn LostCity from a directory into a **platform**. Platforms compound: more users → more data → better API → more developers → more distribution → more users.

You're not just selling access to event listings. You're selling:
- Developer infrastructure (API)
- Business intelligence (analytics)
- Distribution (widgets, newsletters, SEO)
- Intent data (advertising)
- Social proof (community)

Build the flywheel, not just the wheel.
