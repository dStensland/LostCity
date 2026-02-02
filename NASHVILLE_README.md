# Nashville Portal Launch Package

Complete content strategy and implementation guide for launching LostCity Nashville.

---

## Package Contents

This package contains everything needed to launch a Nashville portal for the LostCity events discovery platform:

### 1. NASHVILLE_SUMMARY.md (10 KB)
**Start here.** Executive summary with key numbers, decisions, and overview.

- Key metrics and targets
- Nashville vs Atlanta comparison
- Unique challenges (honky-tonks, songwriter rounds)
- White-label opportunities
- Revenue projections
- Success metrics

**Read this first** for a quick overview of the entire strategy.

---

### 2. NASHVILLE_CONTENT_STRATEGY.md (38 KB)
**Complete strategy document.** Comprehensive analysis and planning.

**Contents:**
- Market analysis (Music City demographics, culture, competition)
- Complete source list (150+ crawlers with URLs)
- Venue curation strategy (300+ venues)
- Organization partnerships
- Content categories and taxonomy
- Portal branding recommendations
- 12-week launch timeline
- Risk mitigation
- Revenue model

**Use this** as the authoritative reference for all strategic decisions.

---

### 3. NASHVILLE_QUICK_START.md (9.5 KB)
**Implementation roadmap.** Week-by-week action plan.

**Contents:**
- Phase-by-phase breakdown (4 phases, 12 weeks)
- Priority crawler list (top 20 sources)
- Honky-tonk event strategy
- Nashville-specific features
- Critical decisions and trade-offs
- Technical gotchas
- Success criteria

**Use this** as your weekly implementation checklist.

---

### 4. NASHVILLE_SOURCES_MASTER_LIST.md (16 KB)
**Complete data source inventory.** Every crawler to implement.

**Contents:**
- 150+ sources organized by phase
- Full details: URL, events/month, type, priority
- Category breakdown (55 music venues, 15 museums, etc.)
- Geographic coverage by neighborhood
- Implementation priority guide (P0, P1, P2, P3)
- Nashville-specific source types

**Use this** as your crawler implementation checklist.

---

### 5. crawlers/sources/nashville_example.py (21 KB)
**Working code templates.** Copy-paste crawler implementations.

**Contents:**
- 5 crawler templates with full code:
  1. Simple venue crawler (Ryman, Exit/In, etc.)
  2. Honky-tonk continuous music generator
  3. Aggregator crawler (Nashville Scene, Do615)
  4. Songwriter round venues (Bluebird Cafe)
  5. Festival/multi-day events (CMA Fest)
- Nashville-specific utilities
- Neighborhood detection
- Honky-tonk detection

**Use this** to accelerate crawler development.

---

## Quick Start

### Week 1: Get Oriented

1. **Read NASHVILLE_SUMMARY.md** (15 minutes)
   - Understand the opportunity
   - Review key metrics
   - Note unique challenges

2. **Skim NASHVILLE_CONTENT_STRATEGY.md** (30 minutes)
   - Focus on Sections 1-2 (Market Analysis, Sources Strategy)
   - Understand Nashville's unique identity
   - Review competitive landscape

3. **Review NASHVILLE_QUICK_START.md** (20 minutes)
   - Understand the 12-week timeline
   - Note Week 1-2 priorities
   - Review critical decisions

### Week 2: Start Implementation

1. **Set up Nashville portal in database:**
   ```sql
   INSERT INTO portals (slug, name, filters, branding, settings)
   VALUES (
     'nashville',
     'LostCity Nashville',
     '{"city": "Nashville", "geo_center": [36.1627, -86.7816], "geo_radius_km": 40}',
     '{"visual_preset": "nightlife"}',
     '{"show_map": true}'
   );
   ```

2. **Clone existing crawlers:**
   - Adapt `sources/ticketmaster.py` for Nashville (change geo coordinates)
   - Adapt `sources/eventbrite.py` for Nashville (change location filter)

3. **Build first aggregator scraper:**
   - Use Visit Music City or Nashville Scene
   - Follow template in `nashville_example.py`

### Week 3+: Follow the Plan

Use **NASHVILLE_QUICK_START.md** as your weekly guide:
- Week 1-2: Foundation (5 aggregators)
- Week 3-4: Iconic venues (15 venues)
- Week 5-8: Depth (60 sources)
- Week 9-12: Specialization (65 sources)

Check off sources in **NASHVILLE_SOURCES_MASTER_LIST.md** as you complete them.

---

## Key Numbers

| Metric | Target | Timeline |
|--------|--------|----------|
| Active Crawlers | 150+ | 12 weeks |
| Events/Month | 5,000+ | Week 12 |
| Venues | 300+ | Week 10 |
| White-Label Portals | 3+ | Month 12 |
| Monthly Active Users | 10,000+ | Month 6 |
| Annual Revenue | $50k+ | Year 1 |

---

## Nashville-Specific Challenges

### 1. Honky-Tonks
**Problem:** 12 honky-tonks on Broadway with continuous live music (11am-2am) but no formal event listings.

**Solution:** Generate recurring daily "Live Music" events. See `nashville_example.py` Template 2.

### 2. Songwriter Rounds
**Problem:** Unique Nashville format (3-4 songwriters perform acoustically in rotation).

**Solution:** Special "songwriter-round" subcategory and tagging. See `nashville_example.py` Template 4.

### 3. CMA Fest Deduplication
**Problem:** 100+ events over 4 days, multiple sources = massive duplicates.

**Solution:** Enhanced content hashing (artist + venue + datetime). See `nashville_example.py` Template 5.

---

## Implementation Priorities

### P0 (Week 1): Foundation
**5 Critical Aggregators**
- Ticketmaster Nashville (API)
- Eventbrite Nashville (API)
- Visit Music City (scrape)
- Nashville Scene (scrape)
- Do615 (scrape)

**Target:** 1,200+ events from 5 sources

### P1 (Weeks 2-4): Iconic Venues
**20 Must-Have Venues**
- Grand Ole Opry
- Ryman Auditorium
- Bluebird Cafe
- Top 15 music venues
- TPAC, Schermerhorn, Frist

**Target:** 2,000+ events from 25 sources

### P2 (Weeks 5-8): Depth
**60 Sources for Breadth**
- 12 honky-tonks (continuous music)
- 18 additional music venues
- 15 breweries/distilleries
- 10 museums
- 5 family attractions

**Target:** 3,500+ events from 85 sources

### P3 (Weeks 9-12): Specialization
**65 Long Tail Sources**
- 10 theater/comedy venues
- 6 universities
- 6 LGBTQ+ venues
- 15 library branches
- Festivals, neighborhoods, fitness

**Target:** 5,000+ events from 150 sources

---

## White-Label Opportunities

### Hotels
- **Omni Nashville** - Downtown events, 5km radius filter
- **Gaylord Opryland** - Family events, Music Valley focus
- **Thompson Nashville** - Upscale nightlife, The Gulch

**Pricing:** $500-2,000/month per hotel

### Tourism
- **Visit Music City** - Official tourism calendar
- **Nashville Downtown Partnership** - Broadway events

**Pricing:** $5k-15k/month

### Music Industry
- **Country Music Association** - Industry events
- **Americana Music Association** - Festival + year-round

**Pricing:** $1k-5k/month

### Corporate
- **Nashville Area Chamber** - Business networking

**Pricing:** $2k-8k/month

**Year 1 Revenue Target:** $50k
**Year 2 Revenue Target:** $150k

---

## Nashville vs Atlanta

| Aspect | Nashville | Atlanta | Advantage |
|--------|-----------|---------|-----------|
| Population | 1.4M metro | 6M metro | ATL (4x larger) |
| Music Venues | 180+ | 100+ | NASH (2x density) |
| Music Events % | 40% | 25% | NASH (Music City) |
| Tourism | 16M/year | 55M/year | ATL (but Nash = bachelorettes) |
| Complexity | Lower | Higher | NASH (easier to launch) |
| White-Label Demand | High | Medium | NASH (hotels, tourism) |

**Nashville is a perfect second market:** Smaller, more focused, clear identity, strong white-label demand.

---

## Success Metrics

### Content Quality (Week 12)
- [ ] 150+ active crawlers
- [ ] 5,000+ events/month
- [ ] 300+ venues in database
- [ ] <5% duplicate event rate
- [ ] 90%+ extraction confidence
- [ ] All top 50 venues covered
- [ ] All 13 neighborhoods represented

### User Engagement (Month 6)
- [ ] 10,000+ monthly active users
- [ ] 30,000+ page views/month
- [ ] 3+ pages/session average
- [ ] 60%+ mobile usage
- [ ] 70%+ discover non-obvious events

### Business (Month 12)
- [ ] 3+ white-label portals live
- [ ] 1+ hotel partner signed
- [ ] Tourism board discussions active
- [ ] Featured in Nashville Scene or Do615
- [ ] $25k+ annual recurring revenue

---

## Team & Investment

### Team (12 weeks)
- 1 Backend Engineer (Python crawlers)
- 1 Frontend Engineer (portal customization)
- 0.5 DevOps (deployment, monitoring)
- 1 Content Manager (QA, curation)
- 0.5 Designer (portal branding)

### Budget
**Development (Weeks 1-12):** $77k
- Engineering: $60k
- Content: $15k
- Infrastructure: $2k

**Ongoing (Monthly):** $9.5k
- Infrastructure: $500
- Content Manager: $4k
- BD Manager: $5k (Month 6+)

### ROI Timeline
- **Month 6:** Break even on infrastructure
- **Month 12:** Break even on development ($50k revenue)
- **Year 2:** Profitable ($150k revenue vs $120k costs)

---

## Next Steps

### This Week
1. Read all 4 documents in this package
2. Create Nashville portal in database
3. Set up Nashville geo filters
4. Clone Ticketmaster/Eventbrite crawlers

### Next Week
1. Adapt Ticketmaster crawler (Nashville geo)
2. Adapt Eventbrite crawler (Nashville location)
3. Build Visit Music City scraper
4. Test initial event ingestion
5. Verify deduplication working

### Next Month
1. Deploy 15 iconic venue crawlers
2. Implement honky-tonk event generator
3. Add 50 Tier 1 venues to database
4. Configure Nashville neighborhoods
5. Test quality metrics

### Next Quarter (Months 2-3)
1. Complete all 150 source crawlers
2. Quality assurance and data cleanup
3. Build white-label demo (hotel partner)
4. Prepare marketing materials
5. Soft launch to beta users

---

## Document Map

```
NASHVILLE_README.md (you are here)
├── Start here for overview
│
├── NASHVILLE_SUMMARY.md
│   └── Executive summary (read first)
│
├── NASHVILLE_CONTENT_STRATEGY.md
│   └── Complete strategy (authoritative reference)
│
├── NASHVILLE_QUICK_START.md
│   └── Weekly implementation guide
│
├── NASHVILLE_SOURCES_MASTER_LIST.md
│   └── Complete source inventory
│
└── crawlers/sources/nashville_example.py
    └── Code templates and examples
```

---

## Support & Questions

### Technical Questions
See `nashville_example.py` for code templates and patterns.

### Strategic Questions
See `NASHVILLE_CONTENT_STRATEGY.md` for detailed analysis.

### Implementation Questions
See `NASHVILLE_QUICK_START.md` for week-by-week guidance.

### Source Questions
See `NASHVILLE_SOURCES_MASTER_LIST.md` for complete source list.

---

## File Versions

- **NASHVILLE_README.md** - v1.0 (February 2, 2026)
- **NASHVILLE_SUMMARY.md** - v1.0 (February 2, 2026)
- **NASHVILLE_CONTENT_STRATEGY.md** - v1.0 (February 2, 2026)
- **NASHVILLE_QUICK_START.md** - v1.0 (February 2, 2026)
- **NASHVILLE_SOURCES_MASTER_LIST.md** - v1.0 (February 2, 2026)
- **nashville_example.py** - v1.0 (February 2, 2026)

---

## Recommendation

**Proceed with Nashville portal launch.**

Nashville represents an ideal second market for LostCity:
- Smaller, manageable scale (1.4M vs 6M)
- Higher event density (180+ music venues)
- Clear identity (Music City = music focus)
- Tourism boost (16M visitors/year)
- Strong white-label demand (hotels, tourism board)
- Unique content (honky-tonks, songwriter rounds)

**12-week timeline is achievable with current team and resources.**

---

**Let's bring LostCity to Music City.**
