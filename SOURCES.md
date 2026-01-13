# Event Sources

## Working Crawlers

| Source | Method | Type | Categories | Events | Last Crawl | Frequency | Data Quality | Coverage |
|--------|--------|------|------------|--------|------------|-----------|--------------|----------|
| The Earl | HTML | venue | music | 44 | 2026-01-12 | Daily | times, prices | ~3 months |
| Eventbrite | JSON-LD | aggregator | mixed | 115 | 2026-01-12 | Daily | full | ~2 months |
| Dad's Garage | HTML | venue | comedy | 69 | 2026-01-12 | Daily | times | ~6 months |
| Atlanta Botanical | HTML | venue | community | 4 | 2026-01-12 | Weekly | dates only | ~2 months |
| High Museum | Playwright | venue | art, family | 11 | 2026-01-12 | Weekly | times | ~1 month |

**Total: 243 events across 5 sources**

## Not Working

| Source | Issue | Priority | Last Checked | Notes |
|--------|-------|----------|--------------|-------|
| Terminal West | 403 Forbidden | High | 2026-01-12 | Major music venue, worth retrying with different approach |
| Variety Playhouse | JS redirect | High | 2026-01-12 | Major music venue, may need Playwright |
| Creative Loafing | Domain redirect | Low | 2026-01-12 | May have shut down event listings |
| Do404 | Site down | Medium | 2026-01-12 | Was a good local aggregator |
| Meetup | Needs API key | Medium | 2026-01-12 | Deprecated location search, need OAuth |

## Not Yet Attempted

| Source | URL | Expected Method | Type | Priority | Potential Volume |
|--------|-----|-----------------|------|----------|------------------|
| Fox Theatre | foxtheatre.org | TBD | venue | High | High - major concerts |
| State Farm Arena | statefarmarena.com | TBD | venue | High | High - concerts, Hawks |
| Mercedes-Benz Stadium | mercedesbenzstadium.com | TBD | venue | High | High - United, concerts |
| Tabernacle | tabernacleatl.com | Likely LiveNation | venue | High | High - mid-size concerts |
| Masquerade | masqueradeatlanta.com | TBD | venue | High | Medium - indie/metal |
| 529 | 529atl.com | TBD | venue | Medium | Medium - indie venue |
| Center Stage | centerstage-atlanta.com | TBD | venue | Medium | Medium |
| Atlanta Symphony | aso.org | TBD | venue | Medium | Medium - classical |
| Alliance Theatre | alliancetheatre.org | TBD | venue | Medium | Medium - theater |
| Woodruff Arts Center | woodruffcenter.org | TBD | aggregator | Low | Low - umbrella org |
| Atlanta Hawks | nba.com/hawks | TBD | venue | Medium | Low - just games |
| Atlanta United | atlutd.com | TBD | venue | Medium | Low - just matches |

## Integration Methods

| Method | Description | When to Use |
|--------|-------------|-------------|
| HTML scraping | BeautifulSoup + requests | Simple static sites |
| JSON-LD | Parse structured data from `<script type="application/ld+json">` | Modern sites with SEO |
| Playwright | Headless browser automation | JS-rendered content |
| API | Direct API integration | When available (often needs keys) |

## Data Quality Fields

| Field | Description |
|-------|-------------|
| full | Has title, date, time, price, description, image |
| times | Has start times |
| prices | Has ticket prices |
| dates only | Just dates, no times |
| descriptions | Has event descriptions |
| images | Has event images |

## Category Mapping

| Category | Description | Sources |
|----------|-------------|---------|
| music | Concerts, live music | The Earl, Eventbrite |
| comedy | Improv, standup | Dad's Garage |
| art | Museum exhibits, galleries | High Museum |
| theater | Plays, musicals | - |
| food_drink | Food festivals, tastings | Eventbrite |
| community | Markets, meetups | Atlanta Botanical |
| sports | Games, athletic events | - |
| family | Kid-friendly events | High Museum |
| film | Movies, screenings | - |
| nightlife | Club events, DJ nights | - |

## Contacts & API Access

| Source | Contact | Status |
|--------|---------|--------|
| Meetup | developer.meetup.com | Need to apply for API access |
| Eventbrite | - | Using public scraping (no API needed) |
| LiveNation/Ticketmaster | developer.ticketmaster.com | Could get API for Tabernacle, Fox, etc. |
