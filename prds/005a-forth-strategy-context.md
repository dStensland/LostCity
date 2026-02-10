# PRD-005a: FORTH Portal — Strategy Context

Companion to PRD-005 (execution spec). This captures the strategic reasoning behind the FORTH portal decisions.

---

## Three Bets the FORTH Portal Proves

1. **"Active and accurate" beats static curation.** Specials, happy hours, time-aware content prove the crawler infrastructure's value in a way events alone can't. Google can tell you a restaurant exists. We tell you their happy hour ends in 40 minutes and it's a 5-minute walk.

2. **The BeltLine corridor is a geographic cluster.** FORTH data investment is shared with PCM and future BeltLine customers. Every venue we enrich for FORTH also serves a PCM portal, a Krog Street Market portal, or a BeltLine community portal.

3. **World Cup urgency compresses the sales timeline.** Atlanta hosts FIFA World Cup matches June 11 — July 19, 2026. Hotels will be at capacity with international visitors who know nothing about the city. A concierge portal that answers "where do I eat tonight?" and "where do I watch the match?" is immediately valuable. This is 4 months away.

---

## Guest Journey Model

The portal serves the guest's actual decision flow, not content categories.

### Questions Guests Ask (by frequency)

1. "Where should we eat?" (every day)
2. "What's near the hotel?" (arrival day)
3. "What should we do tonight?" (every evening)
4. "What's happening this weekend?" (once)
5. "Where can I get coffee?" (every morning)
6. "What's the BeltLine?" (when they see it from the hotel)
7. "Where can I watch the match?" (World Cup, match days)

Homepage answers 1-4 immediately. 5-7 are one tap away.

### Why Time-Aware Ordering Matters

A hotel guest at 5:30pm doesn't want to scroll past coffee shops and morning activities. They want: what's for dinner, what's happening tonight, is there a happy hour right now. The same guest at 8am wants coffee and daytime plans.

Current implementation shows the same section order 24/7. The fix isn't hiding content — it's reordering what appears FIRST. Every section still exists, the lead section just shifts.

---

## Why Specials Are the Differentiator (Not Events)

Events prove breadth. Specials prove freshness and depth.

- **Events**: "Jazz at Venkman's, 8pm" — Google also has this. Eventbrite has this. Every hotel concierge desk has a printed list of this week's events.
- **Specials**: "Happy Hour at Sound Table — $6 cocktails until 7pm, 5 min walk" — Google doesn't have this. No one aggregates this. It changes daily. It's time-sensitive. It requires active crawling.

When the FORTH GM sees live specials updating throughout the day, they understand:
1. This data can't be maintained manually
2. Their guests would actually use this (everyone wants happy hour info)
3. This is categorically different from a static PDF or a Google search

Specials are the demo closer. Events are table stakes.

---

## The Specials Automation Strategy

The original PRD had "1-2 days manual research" for happy hours. That's pre-AI thinking.

**Agent approach**: Build `scrape_venue_specials.py` that:
1. Takes a list of venue website URLs from the DB
2. Crawls each venue's website (happy hour page, specials page, menu page)
3. LLM-extracts structured data: type, days, times, description, prices
4. Seeds the `venue_specials` table

This turns "research 30 venues" from 2 days of Googling into a script run. It also makes it repeatable for every new corridor we sell into.

For venues without websites (or with specials only on Instagram), manual seeding is still needed — but that's 5-10 venues, not 30.

---

## PCM / Cluster Reuse

Everything built for FORTH directly benefits the PCM pitch:

| FORTH Component | PCM Equivalent |
|----------------|---------------|
| Walking time from hotel | Walking time from market entrance |
| FORTH venue specials | PCM tenant specials (30+ restaurants) |
| BeltLine section | BeltLine section (PCM IS on the trail) |
| Tonight's events | "Happening at PCM Tonight" |
| Where to Eat | PCM food hall + restaurants |
| World Cup watch parties | World Cup at PCM (rooftop, bars) |

Two customers from one corridor of data investment. The components are reusable with different portal branding.

### Other Geographic Clusters (post-FORTH)

1. **Downtown/MBS** — World Cup epicenter. Mercedes-Benz Stadium, Centennial Park, CNN Center, hotels (Omni, Marriott Marquis, Hilton). Highest World Cup urgency.
2. **BeltLine Corridor** — FORTH → PCM → Krog → Inman Park. Already invested.
3. **Midtown/Arts District** — High Museum, Woodruff Arts Center, Fox Theatre, Colony Square. Arts/culture vertical.
4. **Decatur** — Independent restaurants/bars cluster. Walkable downtown. Community portal natural fit.
5. **East Side** — L5P, EAV, Edgewood. Counterculture/nightlife. Creator vertical.
6. **Buckhead** — Luxury hotels, upscale dining. Hotel vertical expansion.
7. **Airport/College Park** — Airport hotels. High volume, captive audience. Gateway portal.
8. **West Midtown** — Monday Night, Ormsby's, Painted Duck. Brewery/entertainment cluster.

---

## World Cup Specifics

Atlanta hosts group stage + knockout round matches at Mercedes-Benz Stadium. Dates: June 11 — July 19, 2026.

**What matters for FORTH**:
- Match-day guide: today's teams, kickoff time, MARTA directions from FORTH to MBS
- Watch parties: bars near FORTH showing matches (crawl + tag)
- Between-matches: "You have 48 hours — here's what to do" (regular portal content, reframed)
- Fan zone: Centennial Olympic Park events, fan festival schedule (crawl when announced)
- Consider Spanish/Portuguese labels for key UI elements (match info, MARTA directions)

**Timeline pressure**: Match schedule published by FIFA well in advance. Watch parties won't be announced until closer to June. Fan zone details typically 2-3 months before tournament.

---

## Content Voice (reference)

Per PRD-001a, warm/knowing/confident. "Good evening. Here's what's happening around FORTH." Never: exclamation marks, emoji in titles, "Check it out!", "Don't miss!", "Hot pick!" Use "Complimentary" not "free."

---

## Sales Leverage Chain

FORTH portal success enables:
- **PCM/Jamestown** — "We already have the BeltLine corridor data. Here's FORTH's portal, here's what yours would look like."
- **Downtown hotels** — "World Cup is 4 months away. Your guests need this."
- **Bellyard/Clermont** — "Hotel vertical is proven. Here are the metrics from FORTH."
- **MARTA/Intersection** — "Station-proximity features work. We can do this for every MARTA station."
