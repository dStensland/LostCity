# Data Red Flags and Opportunities - Pass 2
Generated: 2026-02-17
Database target: production

## Scope
Second-pass audit after baseline report, focused on hidden operational risk:
- Source freshness and crawl health
- Portal assignment leakage concentration
- Link coverage
- Placeholder venue trust issues
- Venue entity fragmentation (duplicate real-world venues split across records)

## Baseline (from pass 1)
- Future events: 19,475
- Unassigned future events: 4,031 (20.7%)
- Duplicate future event slot groups: 27
- Invalid categories: 28
- Future events missing description: 998 (5.1%)
- Future events missing image: 8,958 (46.0%)
- Future events missing start_time: 1,272 (6.5%)
- Venue highlight duplicate groups: 170 (120 venues)

## Additional Red Flags (pass 2)
1. Source concentration risk
- Largest single source: Alcoholics Anonymous - Atlanta = 4,169 events (21.4% of all future events)
- HHI source concentration: 0.0624 (moderate concentration; meaningful exposure to top source disruptions)

2. Portal leakage is highly concentrated
- Total unassigned: 4,031
- Top source contributors to unassigned inventory:
  - Callanwolde Fine Arts Center: 985 (24.4% of unassigned)
  - Mobilize (API): 699 (17.3%)
  - Narcotics Anonymous - Georgia: 661 (16.4%)
  - Painting With a Twist: 548 (13.6%)
  - Roswell365: 165 (4.1%)
- The top 4 sources account for 72% of all unassigned events.

3. Canonical link coverage gaps
- Missing `source_url`: 529 events
- Missing both `source_url` and `ticket_url`: 527 events

4. Placeholder/private venue trust debt
- "This event’s address is private. Sign up for more details": 106 future events
- High-volume venues with missing geo:
  - Online / Virtual Event: 172
  - This event’s address is private...: 106
  - Community Location: 81

5. Venue entity fragmentation (duplicate real venues)
- 3rd & Lindsley split across two venue records: 291 combined events
- 365 Center Inc vs 365 Center, Inc split: 134 combined events
- Sister Louisa's Church variants split: 70 combined events
- The Earl has duplicate record variants
- Terminal West and Basement East have duplicate record variants

6. Duplicate title bursts worth review
- Springs Cinema source shows repeated same-title/same-day bursts (e.g., "Wuthering Heights", "GOAT", "Send Help")
- Likely mixed pattern of valid multi-showtimes and duplicate extraction; needs source-specific dedupe tuning.

## Positive Signals (what is healthy)
- No far-future date anomalies (>365 days out)
- Source recency is generally healthy: only 1 source stale >30 days, none >90 days
- Most never-crawled sources are inactive rather than silently failing active sources

## Revenue / Product Opportunities
1. Fastest quality lift for buyer trust
- Target top 10 low-quality sources for image + time normalization; card quality improvement will be immediately visible on homepage and portal demos.

2. Unassigned inventory monetization
- Assign portal routing for the top 4 unassigned sources first; this alone can recover most discovery leakage and improve vertical portal density.

3. Venue enrichment backlog with highest ROI
- Prioritize high-volume venues missing short_description/image/geo:
  - Callanwolde Fine Arts Center
  - MJCCA
  - Shepherd Center
  - Springs Cinema
  - NA/AA high-volume meeting locations

4. Data trust for white-label sales demos
- Eliminate duplicate highlights and fragmented venues for marquee spots (Oakland, High Museum, Atlanta History Center) to avoid visible credibility hits in buyer demos.

5. Vertical packaging based on existing density
- Support/health community track is already deep (`support_group` is the largest category); package as a healthcare/community portal product line.
- Arts + music + family inventory is strong enough for concierge/city planner portal positioning.

## Suggested 2-week sequence
1. Portal assignment rules for top 4 unassigned sources.
2. DB-side uniqueness constraint for `venue_highlights` and venue alias merge pass for top fragmented entities.
3. Source-specific extractor fixes for top 5 low-image sources.
4. Venue metadata backfill for top 20 high-volume venues.
5. Add automated daily audit with alert thresholds:
   - unassigned > 15%
   - duplicate slots > 10 groups
   - highlight duplicate groups > 20
