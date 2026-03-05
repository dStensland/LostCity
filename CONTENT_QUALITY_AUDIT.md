# Content Quality Audit — 2026-03-04

**Scope**: 15,186 active future events visible in the Atlanta portal (14,831 with Atlanta portal_id + 355 with NULL portal_id).

---

## Executive Summary

| Dimension | Score | Key Issue |
|-----------|-------|-----------|
| Descriptions | B | 4.4% missing, 434 duplicate templates, 138 encoding artifacts, 178 truncated |
| Titles | C+ | 713 duplicate title+date pairs (film showings), 173 ALL CAPS, 42 overstuffed |
| Categories | B- | "other" is 90% Ticketmaster miscategorization, keyword mismatches inflated by false positives |
| Source URLs | B | 597 listing-page URLs (4%), 7 sources at 100% listing URLs |
| Images | B+ | 89.1% coverage overall; Ticketmaster (331 missing) is the biggest gap |
| Prices | D | **59.8% completely unknown**, only 9.7% have actual price data |
| Times | B+ | 93.9% have start_time, 153 suspicious midnight times |

**Top 3 systemic issues:**
1. **Price data is mostly absent** — 60% of events have zero price info. This is the weakest dimension by far.
2. **Ticketmaster crawler is high-volume, low-quality** — 772 events, 53% missing descriptions, 43% missing images. Biggest single source of quality problems.
3. **Duplicate descriptions from recurring events** — 434 templates used 3+ times. Stone Mountain alone has 243x and 237x duplicate descriptions for attractions.

**Good news:**
- AA/NA/Pulmonary Fibrosis are already isolated in `atlanta-support` portal — they don't pollute Atlanta.
- Music genre tagging is 100% coverage.
- Image coverage is 89.1% overall (healthy).
- 80% of descriptions are 300+ chars.

---

## 1. Description Quality

| Metric | Count | % of 15,186 |
|--------|-------|-------------|
| Missing description | 675 | 4.4% |
| Length 300+ chars | 11,623 | 80.1% |
| Generic filler ("Join us for...") | 331 | 2.3% |
| Duplicate text (3+ events) | 434 templates | — |
| Encoding artifacts (HTML/entities) | 138 | 0.9% |
| Truncation (ends mid-sentence) | 178 | 1.2% |

### Duplicate descriptions — the real story

Most "duplicates" are **recurring events or class series** with legitimately shared descriptions. The top offenders:
- **Stone Mountain Park**: 243x (cable car) and 237x (historic village) — same attraction, daily entries
- **Starlight Drive-In**: 123x — same movie description across multiple showtimes
- **Callanwolde**: 110x pottery class, 106x blacksmithing class — same recurring class

These aren't data quality issues — they're a product of how recurring events are stored. The real question is whether the product should deduplicate or collapse these in the feed.

### Actual description problems

| Source | Issue | Count | Fix |
|--------|-------|-------|-----|
| Ticketmaster | Missing descriptions | 412 | Extract from TM event pages |
| Helium Comedy Club | Raw HTML in descriptions | 36 | Strip HTML tags in crawler |
| The Eastern | HTML entities | 19 | Decode entities in crawler |
| Boggs Social & Supply | HTML entities | 13 | Decode entities in crawler |
| The Masquerade | Truncated mid-sentence | 72 | Fix char limit / sentence boundary |
| The Springs Cinema | Truncated | 34 | Same fix |
| Cinemark Atlanta | Truncated | 32 | Same fix |
| Mobilize (API) | Generic "Join us" filler | 89 | Crawler produces template text |
| Atlanta-Fulton Library | Generic "Join us" starts | 74 | These are real descriptions that happen to start with "Join us" — borderline |

### Recommended fixes
1. **Systemic**: Add HTML entity decoder + tag stripper as post-processing in `utils.py` (fixes 138 events across multiple sources)
2. **`the_masquerade` / `the_springs_cinema` / `cinemark`**: Fix description truncation — likely hitting a char limit before sentence boundary
3. **`helium_comedy_club`**: Strip `<p>`, `<img>`, `<strong>` tags from description output
4. **`mobilize`**: Consider whether political campaign template text adds value

---

## 2. Title Quality

| Metric | Count | % |
|--------|-------|---|
| ALL CAPS | 173 | 1.1% |
| Metadata-stuffed (>100 chars) | 42 | 0.3% |
| Very short (<10 chars) | 2,023 | 13.3% |
| Duplicate title+date | 713 pairs | — |

### Context — what's real vs noise

**Short titles are overwhelmingly movie titles** — AMC Theatres alone accounts for most. "Scream 7", "K-Pops!", "Pillion" are real titles. Not a bug.

**Duplicate title+date is multi-venue film showings** — "Scream 7" on 2026-03-04 at 76 theaters. Correct data. The product needs to handle this at the display layer (collapsing film showtimes by title).

**ALL CAPS sources (173 total):**
| Source | Count | Fix |
|--------|-------|-----|
| Helium Comedy Club | 25 | `.title()` |
| Kai Lin Art | 21 | `.title()` |
| MJQ Concourse | 20 | `.title()` |
| Zoo Atlanta | 18 | `.title()` |
| The Masquerade | 16 | `.title()` |
| Aurora Theatre | 12 | `.title()` |
| Georgia World Congress Center | 8 | `.title()` |

### Recommended fixes
1. Add `.title()` normalization to the 7 ALL CAPS sources above
2. `a_cappella_books` / `charis_books`: Truncate overly long titles at a natural break point (author + book title, drop the venue/date suffix)

---

## 3. Category & Tag Accuracy

**Distribution (Atlanta portal):**
| Category | Count | % |
|----------|-------|---|
| film | 2,757 | 18.2% |
| community | 2,524 | 16.6% |
| music | 1,761 | 11.6% |
| learning | 1,574 | 10.4% |
| nightlife | 1,528 | 10.1% |
| art | 1,026 | 6.8% |
| family | 847 | 5.6% |
| sports | 610 | 4.0% |
| food_drink | 451 | 3.0% |
| other | 136 | 0.9% |
| wellness | 34 | 0.2% |

**"other" is 88% Ticketmaster** (120/136). Ticketmaster events that don't get categorized. Fix: improve TM category inference from genre/subgenre fields.

**Keyword mismatches (888) — mostly false positives:**
- "art" appears in venue names ("Kai Lin Art"), "market" in "food market" events categorized as food_drink (correct), "concert" in "film concert" (a movie screening of a concert — correct)
- Real mismatches are small: ~20 improv shows in `learning`, ~14 comedy shows in `nightlife`, ~13 theatre shows in `other`

**Music genre tags**: 100% coverage. Tag inference is working perfectly.

### Recommended fixes
1. Improve Ticketmaster category inference (120 events stuck in "other")
2. Move improv shows from `learning` → `comedy` when title contains "improv"

---

## 4. Source URL Quality

| Metric | Count | % |
|--------|-------|---|
| Missing URL | 167 | 1.1% |
| Listing page (not detail) | 597 | 4.0% |

**100% listing URL sources:**
| Source | Events | Impact |
|--------|--------|--------|
| Georgia Tech Athletics | 82 | High — no way to click through to event detail |
| Kennesaw State Athletics | 43 | Medium |
| Trees Atlanta | 18 | Low |
| Earl Smith Strand Theatre | 16 | Low |
| Hotel Clermont | 11 | Low |
| The Bakery | 11 | Low |
| Southern Fried Queer Pride | 11 | Low |

### Recommended fixes
- These crawlers scrape calendar pages but don't extract per-event URLs. Each needs a fix to follow through to individual event pages.
- Priority: Georgia Tech Athletics (82 events) and Variety Playhouse (41/49 = 84% listing URLs)

---

## 5. Image Coverage

**Overall: 89.1%** (13,530 / 15,186) — healthy.

**By category (worst):**
| Category | Coverage | Notes |
|----------|----------|-------|
| other | 15.4% | Ticketmaster miscategorized events |
| food_drink | 58.3% | Venue Specials Scraper has no images |
| meetup | 65.4% | Meetup.com often lacks images |
| sports | 79.0% | Athletics sources |
| nightlife | 80.8% | Recurring social events |

**Top sources missing images:**
| Source | Missing | Total | % Missing | Fix |
|--------|---------|-------|-----------|-----|
| Ticketmaster | 331 | 772 | 43% | Images exist on TM — extract them |
| Atlanta Recurring Social Events | 266 | 665 | 40% | Use venue images as fallback |
| Emory Healthcare | 114 | 127 | 90% | Low priority (healthcare events) |
| Mobilize (API) | 105 | 761 | 14% | Political campaigns rarely have images |
| Team Trivia | 55 | 120 | 46% | Use venue images as fallback |
| Cook's Warehouse | 52 | 52 | 100% | Scrape class images from site |
| Georgia Tech Arts | 24 | 24 | 100% | Fix crawler to extract images |

### Recommended fixes
1. **Ticketmaster** image extraction — 331 events, highest single-source impact
2. **Atlanta Recurring Social Events** — venue image fallback for 266 events
3. **Team Trivia / Geeks Who Drink** — venue image fallback for trivia nights

---

## 6. Price Data Completeness

| Status | Count | % |
|--------|-------|---|
| Has price data ($X-$Y) | 1,471 | 9.7% |
| Marked free | 4,675 | 30.8% |
| **Completely unknown** | **9,077** | **59.8%** |

**This is the weakest dimension.** Nearly 60% of events have zero price information.

The `is_free` flag works well (30.8% marked free). But actual dollar amounts are rare — under 10%.

**Price distribution (where known):** $21-50 is the most common range (56% of priced events).

### Recommended fixes
- This is largely a crawler-level problem — most event pages display prices but crawlers don't extract them
- **High-impact targets**: Ticketmaster (prices on every listing), music venues (door price usually on event page), theater venues
- **Product-level**: Consider venue-level "prices typically $X-Y" ranges as a fallback signal

---

## 7. Time Data Quality

| Metric | Count | % |
|--------|-------|---|
| Has start_time | 14,266 | 93.9% |
| Missing start_time | 920 | 6.1% |
| Suspicious 00:00 | 153 | 1.1% |

**00:00 offenders:**
| Source | Count | Fix |
|--------|-------|-----|
| Chattahoochee Nature Center | 100 | Set `is_all_day=True` instead of midnight |
| Ameris Bank Amphitheatre | 27 | Extract real show times from TM |
| Marietta Cobb Museum | 9 | Set `is_all_day=True` |

**Missing start_time sources (100%):**
| Source | Events |
|--------|--------|
| Georgia Tech Athletics | 82 |
| Georgia World Congress Center | 51 |
| NASCAR | 20 |
| Atlanta Film Society | 19 |
| FanCons Georgia | 16 |

### Recommended fixes
- `chattahoochee_nature_center`: Change midnight times to `is_all_day=True`
- `ameris_bank_amphitheatre`: Extract real times from linked Ticketmaster pages
- `venue_specials_scraper`: 120/349 missing times (34%) — specials without defined hours

---

## Composite Source Rankings

### Bottom 10 (worst quality, Atlanta portal)
| Source | Score | Events | Top Issues |
|--------|-------|--------|------------|
| Hotel Clermont | 42 | 11 | No desc, no img, listing URLs |
| Discover Atlanta | 51 | 11 | No desc, no time |
| Georgia State Athletics | 62 | 3 | No img, no time |
| Monday Night Brewing | 65 | 3 | No time, CAPS, listing URLs |
| PAWS Atlanta | 66 | 10 | No img, listing URLs |
| Monster Energy Supercross | 68 | 8 | No img, no time |
| Trees Atlanta | 70 | 18 | No img, listing URLs |
| Studio Movie Grill | 70 | 18 | No desc |
| Atlanta BeltLine | 71 | 16 | No img, no time |
| **Ticketmaster** | **75** | **772** | **No desc (53%), no img (43%)** |

### Priority actions

**P0 — High volume, fixable (biggest bang for buck):**
1. **Ticketmaster crawler** — 772 events. Fix image extraction (331 events) and description extraction (412 events). Single biggest quality improvement possible.
2. **HTML entity/tag stripping** — Systemic fix in `utils.py`. Fixes 138 events across Helium, Eastern, Boggs, NCCHR, Velvet Note, etc.
3. **Description truncation** — Fix sentence-boundary truncation in Masquerade (72), Springs Cinema (34), Cinemark (32).

**P1 — Medium effort, noticeable improvement:**
4. **ALL CAPS title normalization** — `.title()` on 7 sources (173 events)
5. **Midnight time fix** — Chattahoochee Nature Center (100 events) → `is_all_day=True`
6. **Listing URL fixes** — Georgia Tech Athletics (82), Variety Playhouse (41), Tabernacle (34)

**P2 — Category cleanup:**
7. **Ticketmaster "other" → proper categories** — 120 events
8. ~~**NULL portal_id sources** — Venue Specials Scraper (349 events) needs `owner_portal_id` set~~ — **FIXED 2026-03-05**: Source 1177 food/drink events (207) migrated to `venue_specials` and deactivated. 34 real events kept.
9. ~~**Source 349 category mismatches**~~ — **FIXED 2026-03-05**: 54 events → gaming (D&D, Warhammer, Poker, Bingo), 16 events → family (Family Skate, Saturday Skate). Duplicate venue 2542 merged into venue 928 (Ormsby's).

**P3 — Longer term:**
9. **Price extraction** — Crawlers don't extract prices from most sources. Biggest gap in the data.
10. **Recurring event dedup in product** — Stone Mountain, Starlight, Callanwolde generate hundreds of identical entries. Product-level collapsing needed.
