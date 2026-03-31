# Event Classification Fix: "Is This a Show?"

## Context

The Venues section's Music tab shows 99 venues — ~20% are skating rinks, murder mystery dinners, MTG leagues, and figure drawing classes. The root cause: `category_id = 'music'` is assigned too broadly at ingestion. Any event with a performer, DJ, or soundtrack gets tagged `music`, whether it's a Ticketmaster concert or karaoke at a restaurant.

Nightlife has the inverse problem: only 3 events, because drag shows, DJ dance nights, and karaoke are routed to `music` instead of `nightlife`.

The fix is upstream — classification at ingestion, not UI-side filtering.

## Problem Data

- 375 events tagged `music` this week. 113 have zero performance signals (no ticket URL, no price, no touring tag).
- "Atlanta Recurring Social Events" source produces 91 music events/week including D&D, murder mystery, Lindy Hop, karaoke.
- Major music venues (Fox Theatre, Tabernacle, Terminal West, Variety Playhouse, Eddie's Attic) are all typed `venue` instead of `music_venue` — invisible to venue-type filters.
- `live-music` tag is on all 375 events (inflated to uselessness by `tag_inference.py` line 140).
- Nightlife: 3 events total. Drag, karaoke, DJ nights all classified as `music`.

## Fix 1: Extraction Prompt — Category Guidance (P0)

**File:** `crawlers/extract.py` — category guidance section

Add explicit guidance for music vs. nightlife routing:

```
- music: Live performances with a named performer, band, or DJ playing a booked set.
  Use for: concerts, shows, headlining acts, residencies, album release shows.
  Do NOT use for: open mic (no named headliner), karaoke, drag shows, dance socials,
  murder mystery dinners, background music at restaurants.
  Key question: Is there a specific named performer being promoted?

- nightlife: Social entertainment formats at bars/clubs. No specific headliner required.
  Use for: karaoke nights, drag shows, DJ dance nights (non-headlining), open mic,
  dance socials (salsa, swing, line dancing), themed club nights, happy hour entertainment.
  Key question: Is this a recurring social format, not a specific booked act?
```

Also add: "Venue type does not determine category. A welding class at a theater is `workshops`, not `theater`. A card game at a bar is `games`, not `music`."

## Fix 2: Venue Place Type Normalization (P0)

**Files:** Individual crawler `VENUE_DATA` dicts + one-time DB update

These venues are typed `venue` but should be `music_venue`:
- Fox Theatre
- Tabernacle
- Variety Playhouse
- Terminal West
- Aisle 5
- Buckhead Theatre
- Eddie's Attic
- The Eastern
- Center Stage
- The Loft (at Center Stage)

Update each crawler's `VENUE_DATA["venue_type"]` to `music_venue`. Also run a one-time migration:

```sql
UPDATE places SET place_type = 'music_venue'
WHERE name IN ('Fox Theatre', 'Tabernacle', 'Variety Playhouse', 'Terminal West',
               'Aisle 5', 'Buckhead Theatre', 'Eddie''s Attic', 'The Eastern',
               'Center Stage', 'The Loft')
AND place_type = 'venue';
```

## Fix 3: `is_show` Boolean Column (P1)

**Files:** Migration + `crawlers/db.py`

Add a column that answers: "Is there a booked act worth planning your evening around?"

```sql
ALTER TABLE events ADD COLUMN is_show BOOLEAN DEFAULT false;
```

Populate at ingestion in `db.py`:

```python
def compute_is_show(event: dict, venue_type: str) -> bool:
    category = event.get("category_id") or event.get("category", "")

    # Theater and film are always shows
    if category in ("theater", "film"):
        return True

    # Comedy at a comedy club is always a show
    if category == "comedy" and venue_type in ("comedy_club", "theater"):
        return True

    # Music: require a booked-show signal
    if category == "music":
        ticket_url = event.get("ticket_url", "") or ""
        ticketing_platforms = ["ticketmaster", "dice.fm", "axs.com", "eventbrite",
                               "seetickets", "bigtickets"]
        has_ticketing = any(p in ticket_url for p in ticketing_platforms)
        has_price = (event.get("price_min") or 0) > 0
        has_open_tag = any(t in (event.get("tags") or [])
                          for t in ["open-mic", "karaoke", "jam", "open-format"])

        if has_open_tag:
            return False
        if has_ticketing or has_price:
            return True
        if venue_type in ("music_venue", "concert_hall", "arena", "amphitheater"):
            return True
        return False

    return False
```

## Fix 4: Tag Inference — `live-music` Deflation (P1)

**File:** `crawlers/tag_inference.py` line ~140

Current (inflated):
```python
if category == "music" and not event.get("is_class"):
    tags.add("live-music")
```

Fixed — only add when there's a performance signal:
```python
if category == "music" and not event.get("is_class"):
    has_show_signal = (
        (event.get("price_min") or 0) > 0
        or bool(event.get("ticket_url"))
        or not event.get("is_recurring", False)
    )
    if has_show_signal:
        tags.add("live-music")
    else:
        tags.add("open-format")
```

## Fix 5: Re-crawl After Prompt Fix (P2)

After fixes 1-2 land, re-crawl:
- `atlanta-recurring-social-events` (91 misclassified events)
- All venue-specific crawlers for the place_type-corrected venues

Events will self-correct on next crawl cycle with the new extraction guidance.

## How the UI Consumes This

**Music tab:** `WHERE category_id = 'music' AND is_show = true`
**Comedy tab:** `WHERE category_id = 'comedy'` (already clean)
**Theater tab:** `WHERE category_id IN ('theater', 'dance') AND is_show = true`
**Nightlife tab:** `WHERE category_id = 'nightlife'` (populated after reclassification)

The shows API (`/api/portals/[slug]/shows`) adds an `is_show=true` query param when the UI requests it.

## Verification

After all fixes + re-crawl:
- Music tab: ~40-60 venues (down from 99), all with actual performances
- Nightlife tab: ~15-25 venues (up from 3), karaoke/drag/DJ nights properly routed
- Theater tab: ~15-20 venues, no welding classes or concerts
- `live-music` tag on ~50-80 events (down from 375)
