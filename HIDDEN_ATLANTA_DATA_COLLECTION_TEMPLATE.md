# Hidden Atlanta: Data Collection Template

Use this template when researching each venue during browser sessions.

---

## Quick Copy-Paste Format

For each venue found, collect this data and format as follows:

```python
VENUE_DATA = {
    "name": "",                    # Official name from their website
    "slug": "",                    # lowercase-with-dashes
    "address": "",                 # Full street address
    "neighborhood": "",            # Atlanta neighborhood
    "city": "Atlanta",
    "state": "GA",
    "zip": "",
    "lat": None,                   # Get from Google Maps
    "lng": None,                   # Get from Google Maps
    "venue_type": "",              # See taxonomy below
    "spot_type": "",               # Same as venue_type usually
    "website": "",                 # Official website
    "vibes": [],                   # 2-4 tags describing atmosphere
}
```

---

## Venue Type Taxonomy (Choose One)

**Music/Performance:**
- `music_venue` - General live music
- `nightclub` - Dancing, DJs
- `jazz_club` - Specifically jazz
- `comedy_club` - Stand-up, improv

**Arts/Culture:**
- `gallery` - Art gallery
- `arts_center` - Multi-purpose arts venue
- `theater` - Performance theater
- `cinema` - Movie theater

**Food/Drink:**
- `bar` - Primarily drinks
- `restaurant` - Full service food
- `brewery` - Brewery/taproom
- `coffee_shop` - Coffee house
- `food_hall` - Multiple vendors

**Community:**
- `community_center` - Community space
- `makerspace` - Fabrication/workshop
- `bookstore` - Books, events
- `record_store` - Vinyl, music culture
- `coworking` - Shared workspace

**Recreation:**
- `park` - Outdoor park/garden
- `garden` - Botanical/community garden
- `arcade` - Video games/pinball
- `game_bar` - Games + drinks
- `sports_venue` - Sports facility

**Other:**
- `museum` - Museum/historical
- `church` - Religious venue
- `event_space` - General event space
- `farm` - Urban farm

---

## Vibe Tags (Choose 2-4)

**Atmosphere:**
- `dive-bar`, `upscale`, `casual`, `intimate`, `warehouse`, `underground`

**Scene:**
- `live-music`, `DJ`, `punk`, `hip-hop`, `electronic`, `jazz`, `experimental`
- `art`, `performance`, `poetry`, `comedy`

**Community:**
- `LGBTQ+`, `community`, `family-friendly`, `late-night`, `underground`

**Activity:**
- `dancing`, `games`, `workshops`, `classes`, `markets`

**Food/Drink:**
- `cocktails`, `craft-beer`, `wine`, `coffee`, `food`

---

## How to Get Lat/Lng from Google Maps

1. Go to google.com/maps
2. Search for the venue address
3. Right-click on the red pin
4. Select "What's here?"
5. Click the coordinates at the bottom of the screen
6. They'll copy to clipboard in format: `33.7891, -84.4214`
7. First number = lat, second = lng

---

## Neighborhood Reference

**Core Atlanta:**
- Downtown, Midtown, Buckhead, Virginia-Highland, Inman Park
- Old Fourth Ward, Poncey-Highland, Little Five Points
- East Atlanta Village, Grant Park, Reynoldstown, Cabbagetown
- Edgewood, Sweet Auburn, Castleberry Hill

**Westside:**
- West Midtown, Westside, West End, Bankhead

**Northeast:**
- Lindbergh, Cheshire Bridge, Brookhaven, Chamblee

**DeKalb:**
- Decatur, Avondale Estates, Clarkston, Doraville, Tucker

**Outer Metro:**
- Marietta, Smyrna, Vinings, Roswell, Alpharetta
- Stone Mountain, Lithonia, Riverdale

---

## Research Checklist for Each Venue

- [ ] Official name confirmed from website
- [ ] Full street address found
- [ ] Coordinates from Google Maps
- [ ] Neighborhood identified
- [ ] Venue type selected from taxonomy
- [ ] Website URL confirmed (https://)
- [ ] 2-4 vibe tags chosen
- [ ] Public events confirmed (yes/no)
- [ ] Event calendar URL found (if applicable)
- [ ] Social media links collected (Instagram, Facebook)
- [ ] Operating hours noted
- [ ] Photos found (for image_url field)

---

## Priority Assessment

After collecting basic data, assess:

### Crawler Priority
- **IMMEDIATE** - Active events, easy to scrape, genuinely hidden
- **HIGH** - Regular events, needs research on scrape method
- **MEDIUM** - Occasional events, may need manual curation
- **LOW** - Destination without regular events (add to venues, no crawler)

### Hidden Factor (1-5)
- **5** - Truly underground, locals-only, no tourist presence
- **4** - Known to scene insiders, not on mainstream radar
- **3** - Some online presence, but niche community
- **2** - Getting more known, but still not tourist map
- **1** - Well-known to locals, approaching mainstream

### Event Frequency
- **Daily** - Every day or most days
- **Weekly** - Specific weekly events
- **Monthly** - Monthly recurring
- **Occasional** - Irregular schedule
- **None** - Destination only, no events

---

## Example: Completed Entry

```python
VENUE_DATA = {
    "name": "Freeside Atlanta",
    "slug": "freeside-atlanta",
    "address": "675 Metropolitan Pkwy SW #1070",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7406,
    "lng": -84.3692,
    "venue_type": "makerspace",
    "spot_type": "makerspace",
    "website": "https://www.freesideatlanta.org",
    "vibes": ["hackerspace", "maker", "community", "workshops"],
}
```

**Notes:**
- **Hidden Factor:** 4/5 - Known to maker/hacker community, not to general public
- **Event Frequency:** Weekly - Open hack nights Tuesday/Thursday
- **Crawler Priority:** HIGH - Regular calendar, events on website
- **Event Calendar:** https://www.freesideatlanta.org/calendar
- **Social:** @freesideatl on Twitter/Instagram
- **What makes it hidden:** DIY warehouse space, you'd never find it without insider knowledge
- **Public access:** Yes, open hack nights are free and public
- **Special notes:** Also has paid classes (welding, electronics, CNC)

---

## Batch Collection Workflow

When doing browser research:

### Session 1: Discovery (2 hours)
1. Run all search queries from main research doc
2. Scan Instagram hashtags
3. Check Facebook groups
4. Note everything that looks promising
5. Create initial list of 30-50 candidates

### Session 2: Validation (2 hours)
1. Visit website of each candidate
2. Confirm they're still operating
3. Verify they have public events or open hours
4. Check if they're genuinely hidden (not just small)
5. Narrow to 20-30 solid prospects

### Session 3: Data Collection (3 hours)
1. For each validated venue, collect full data using template
2. Get coordinates from Google Maps
3. Note event calendar URL
4. Screenshot any useful info
5. Assess crawler priority

### Session 4: Organization (1 hour)
1. Sort by priority and neighborhood
2. Group by venue type
3. Identify which need new crawlers vs manual addition
4. Create GitHub issues for crawler tasks
5. Generate summary report

---

## Red Flags (Skip These)

**Don't include if:**
- Permanently closed (check Google, recent reviews)
- Tourist trap masquerading as "hidden" (many are)
- No public access (truly private clubs)
- Franchise/chain (we want local/unique)
- Already well-covered in mainstream guides
- No events and not a meaningful destination
- Just a normal business with no cultural significance

**Examples to skip:**
- "Secret" speakeasies that are heavily marketed
- Pop-ups that are one-time only
- Closed venues from old blog posts
- National chains even if quirky themed
- Places that explicitly say "no visitors" or "members only"

---

## Common Pitfalls

1. **Assuming a place is hidden because you haven't heard of it**
   - Check: Is it on Discover Atlanta? Eater Atlanta? Thrillist?
   - If yes, it's not hidden

2. **Confusing "small" with "hidden"**
   - A tiny coffee shop on a main street isn't hidden
   - A warehouse space with no signage is

3. **Old information**
   - Many DIY spaces close, reopen, move
   - Always verify current status with recent social posts

4. **Missing the cultural significance**
   - Not every weird place is culturally important
   - Look for active communities, not just odd decor

5. **Incomplete address data**
   - "Suite 1070" matters for warehouse spaces
   - Building names often more helpful than street address

---

## Output Files

After research sessions, create these files:

1. **`HIDDEN_ATLANTA_VENUES_[DATE].md`**
   - List of all discovered venues with full data
   - Organized by category and priority

2. **`HIDDEN_ATLANTA_CRAWLERS_TODO.md`**
   - List of venues needing new crawlers
   - Include scrape difficulty assessment
   - Sample event data if available

3. **`HIDDEN_ATLANTA_MANUAL_ADDS.sql`**
   - SQL INSERT statements for venues without events
   - Or venues with events that need manual addition

4. **`HIDDEN_ATLANTA_RESEARCH_SUMMARY.md`**
   - Executive summary of findings
   - Key themes/scenes discovered
   - Gaps identified
   - Next steps

---

## Questions to Answer During Research

1. **What scenes are most active?**
   - Is the underground house scene really thriving?
   - How strong is the DIY arts community?
   - Where's the experimental music happening?

2. **What neighborhoods are hubs?**
   - Is Little Five Points still the weird capital?
   - Has Westside become the DIY art district?
   - Where are refugee communities actually gathering?

3. **What's missing from our coverage?**
   - Are we getting immigrant cultural events?
   - Do we have maker/hacker spaces?
   - Are niche sports covered?

4. **What's overhyped vs. actually hidden?**
   - Which "secret" spots are marketing gimmicks?
   - Which genuinely underground scenes exist?

5. **What crawlers give us the most value?**
   - Which venues have rich event calendars?
   - Which are worth manual curation vs. automation?

---

## Success Criteria

Research session is successful if you can answer:

- [ ] Found at least 15 genuinely hidden venues
- [ ] Identified 3+ active subcultures with multiple venues each
- [ ] Mapped at least 2 ethnic enclaves with specific venues
- [ ] Discovered 3+ maker/hacker/community spaces
- [ ] Found 5+ venues with scrapable event calendars
- [ ] Validated that suggested scenes actually exist
- [ ] Ruled out 10+ venues as not-actually-hidden
- [ ] Created actionable crawler to-do list
- [ ] Have complete venue data for immediate adds

---

## Final Notes

- **Quality over quantity** - 10 genuinely hidden > 30 kinda weird
- **Verify current status** - Don't trust old blog posts
- **Document your sources** - Note where you found each lead
- **Think like a tourist** - Would they find this on their own? If yes, skip it
- **Think like a savvy local** - Would they know about this? If yes, it's not hidden enough
- **Think like a subculture member** - These are the real gatekeepers

The goal is to surface scenes that genuinely exist but aren't visible to outsiders. We're not manufacturing quirk—we're documenting real underground culture.
