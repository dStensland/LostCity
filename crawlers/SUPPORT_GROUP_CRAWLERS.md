# Support Group Crawlers

Two new crawlers that generate recurring support group events from known static schedules.

## Created Crawlers

### 1. DBSA Atlanta (`sources/dbsa_atlanta.py`)

**Organization**: Depression & Bipolar Support Alliance - Metropolitan Atlanta Chapter
**Website**: https://atlantamoodsupport.org
**Source ID**: 907
**Integration Method**: Static schedule generation

**Venues Created**:
- DBSA Dunwoody (Dunwoody UMC, Dunwoody, GA)
- DBSA Emory (Wesley Woods Center, Druid Hills, Atlanta)
- DBSA Marietta (Mount Bethel UMC, Marietta, GA)

**Meeting Schedule** (generates 12 weeks ahead):
- **Dunwoody**: 1st & 3rd Thursdays, 7:30-9:00 PM
- **Emory**: 2nd & 4th Thursdays, 7:30-9:00 PM
- **Marietta**: 1st & 3rd Thursdays, 7:00-8:30 PM
- **Online**: 2nd & 4th Mondays, 6:45-8:15 PM

**Total Events Generated**: 48 (4 locations × 12 weeks)

**Tags**: `mental-health`, `support-group`, `depression`, `bipolar`, `free`, `peer-support`

---

### 2. Ridgeview Institute (`sources/ridgeview_institute.py`)

**Organization**: Ridgeview Institute Smyrna
**Website**: https://www.ridgeviewsmyrna.com/resources/support-groups/
**Source ID**: 908
**Integration Method**: Static schedule generation

**Venue Created**:
- Ridgeview Institute (Smyrna, GA)

**Meeting Schedule** (generates 8 weeks ahead):

**Monday**:
- AA Big Book Study @ 8:00 PM
- Al-Anon Meeting @ 8:00 PM

**Tuesday**:
- Overeaters Anonymous @ 6:30 PM
- Friends & Family Support Group (Virtual) @ 7:00 PM
- AA Meeting @ 8:00 PM

**Wednesday**:
- 12-Step Addiction Group @ 7:00 PM

**Thursday**:
- Codependents Anonymous @ 7:00 PM
- 12-Step Group @ 8:00 PM

**Friday**:
- AA Finding the Balance @ 8:00 PM

**Saturday**:
- AA Men's Group @ 6:00 PM
- AA Women's Group @ 6:00 PM
- Relationships in Recovery @ 7:30 PM

**Sunday**:
- Narcotics Anonymous @ 10:30 AM
- Adult Children of Alcoholics @ 2:00 PM

**Total Events Generated**: 112 (14 meeting types × 8 weeks)

**Tags**: Varies by meeting type (includes `aa`, `na`, `al-anon`, `oa`, `acoa`, `coda`, `12-step`, `recovery`, `support-group`, `free`, `mental-health`)

---

## Running the Crawlers

```bash
# Run DBSA Atlanta crawler
python3 main.py --source dbsa-atlanta

# Run Ridgeview Institute crawler
python3 main.py --source ridgeview-institute
```

## Data Quality

Both crawlers:
- Generate events from verified static schedules
- Include proper venue data (name, address, coordinates, neighborhood)
- Set `category: "support_group"`
- Mark all events as `is_free: true`
- Set `is_recurring: true` to indicate recurring meetings
- Use content hashing for deduplication
- Set `extraction_confidence: 0.95` (known schedule)
- Mark sources as `is_sensitive: true` (mental health/recovery content)

## Schedule Maintenance

These crawlers use **static schedule generation** rather than web scraping. When meeting schedules change:

1. Update the `SCHEDULE` list in the respective crawler file
2. Re-run the crawler
3. Old events will remain; new events will be created

**Recommended crawl frequency**: Weekly (configured in sources table)

## Adding Similar Sources

To add more support group sources with static schedules:

1. Copy the pattern from `dbsa_atlanta.py` or `ridgeview_institute.py`
2. Define venue(s) and meeting schedule
3. Use the date calculation helpers (`get_next_occurrence`, `get_next_weekday`)
4. Add source to database with `integration_method: "static_schedule"`
5. Mark as `is_sensitive: true` for mental health/recovery content

## Files Created

- `/Users/coach/Projects/LostCity/crawlers/sources/dbsa_atlanta.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/ridgeview_institute.py`
- `/Users/coach/Projects/LostCity/crawlers/add_support_group_sources.py` (one-time setup script)
