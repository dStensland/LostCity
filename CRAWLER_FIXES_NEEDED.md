# Crawler Fixes Needed - Permanent Attractions & Series

**Priority:** P0  
**Estimated Time:** 4-6 hours  
**Goal:** Convert 119 high-frequency event titles into proper series or delete permanent attractions

---

## Overview

The audit found 119 event titles appearing more than 20 times each. These fall into 4 categories:

1. **Permanent attractions** (should be deleted)
2. **Recurring shows** (should use series_hint)
3. **Support group meetings** (should use series_hint)
4. **Special cases** (need manual review)

---

## Category 1: Permanent Attractions - DELETE

### Stone Mountain Park (Source 343)

**Issues:**
- "Historic Square: A Collection Of Georgia Homes and Antiques" (237 events)
- "Summer at the Rock" (51 events)

**Action:** These are permanent exhibitions, not events. Delete all instances.

**Crawler Fix:**
- File: `sources/stone_mountain_park.py`
- Action: Add exclusion filter for permanent exhibitions
- Code change:
  ```python
  # Skip permanent attractions
  SKIP_TITLES = [
      'Historic Square',
      'Summer at the Rock',
      'Summit Skyride',
      'Scenic Railroad'
  ]
  
  if any(skip in title for skip in SKIP_TITLES):
      continue
  ```

**Verification:**
```bash
python3 main.py --source stone-mountain-park
# Should crawl 0 events or only date-specific special events
```

---

## Category 2: Recurring Shows - CONVERT TO SERIES

### 3rd & Lindsley (Source 463) - Nashville

**Issues:**
- "The Time Jumpers" (74 events) - Weekly Monday show
- "Backstage Nashville! Daytime Hit Songwriters Show" (70 events) - Recurring show

**Action:** Add series_hint to group these properly.

**Crawler Fix:**
- File: `sources/third_and_lindsley.py`
- Current state: Unknown (need to check if file exists)
- Required change:

```python
# In the crawl function, when creating events:
series_hint = None

# Detect recurring shows
if "Time Jumpers" in title:
    series_hint = {
        "series_type": "recurring_show",
        "series_title": "The Time Jumpers",
        "frequency": "weekly",
        "day_of_week": "monday"
    }
elif "Backstage Nashville" in title:
    series_hint = {
        "series_type": "recurring_show",
        "series_title": "Backstage Nashville! Daytime Hit Songwriters Show",
        "frequency": "weekly",
        "day_of_week": "tuesday"
    }

insert_event(event_data, series_hint=series_hint)
```

**Verification:**
```bash
python3 main.py --source third-and-lindsley --verbose
# Check that events are grouped into series
psql -c "SELECT series_id, COUNT(*) FROM events WHERE title LIKE '%Time Jumpers%' GROUP BY series_id;"
# Should show one series_id with all events
```

---

### Atlanta Recurring Social Events (Source 349)

**Issues:**
- "Open Mic Night" (72 events)
- "Karaoke Night" (53 events)

**Action:** This source already should be using series. Verify implementation.

**Crawler Fix:**
- File: `sources/atlanta_recurring_social.py`
- Check if series_hint is being set
- If not, add:

```python
# Extract event type from title
event_type = title.lower()

if "open mic" in event_type:
    series_hint = {
        "series_type": "recurring_show",
        "series_title": "Open Mic Night",
        "frequency": "weekly"
    }
elif "karaoke" in event_type:
    series_hint = {
        "series_type": "recurring_show",
        "series_title": "Karaoke Night",
        "frequency": "weekly"
    }
```

---

### Ticketmaster Nashville (Source 479)

**Issue:**
- "Grand Ole Opry: OPRY 100" (48 events)

**Action:** These are VALID separate events (different performers each night), but title should be more specific.

**Crawler Fix:**
- File: `sources/ticketmaster.py`
- Enhance title extraction to include performer name:
  - Bad: "Grand Ole Opry: OPRY 100"
  - Good: "Grand Ole Opry: OPRY 100 - Dolly Parton"

**Code change:**
```python
# When parsing Opry events, extract performer from description
if "Grand Ole Opry" in title and "OPRY 100" in title:
    # Try to extract performer name from description
    # This will vary by Ticketmaster's data format
    pass
```

**Verification:**
```bash
python3 main.py --source ticketmaster-nashville
# Each Opry event should have unique title with performer
```

---

## Category 3: Support Group Meetings - CONVERT TO SERIES

### Alcoholics Anonymous - Atlanta (Source 851)

**Issue:**
- "New Start" (44 events)

**Action:** AA meetings should be grouped as series.

**Crawler Fix:**
- File: `sources/aa_atlanta.py`
- Add series_hint for each meeting type:

```python
# Each meeting name becomes a series
series_hint = {
    "series_type": "recurring_show",  # Or create new type: "support_group"
    "series_title": meeting_name,  # e.g., "New Start"
    "frequency": "weekly",  # or daily, as appropriate
    "day_of_week": day_name if weekly else None
}
```

---

### Narcotics Anonymous - Georgia (Source 854)

**Issue:**
- "New Beginnings Group" (39 events)

**Action:** Same as AA - use series_hint.

**Crawler Fix:**
- File: `sources/na_georgia.py`
- Same pattern as AA above

---

## Category 4: Classes & Programs - CONVERT TO SERIES

### Callanwolde Fine Arts Center (Source 809)

**Issues:**
- "Blacksmithing BLA 01" (39 events)
- "DAP 15 – Class Portraiture (Holston)" (38 events)

**Action:** These are class series with multiple sessions.

**Crawler Fix:**
- File: `sources/callanwolde.py`
- Add series detection:

```python
# Detect class codes (BLA, DAP, etc.)
class_code_match = re.match(r'^([A-Z]{2,4}\s+\d+)', title)

if class_code_match:
    series_hint = {
        "series_type": "class_series",
        "series_title": title,  # Keep full class name
        "frequency": "weekly"  # or based on schedule
    }
```

---

### Atlanta-Fulton Public Library (Source 43)

**Issue:**
- "Resume Building Class" (44 events)

**Action:** Library classes should be series.

**Crawler Fix:**
- File: `sources/atlanta_fulton_library.py`
- Pattern match class names:

```python
if "class" in title.lower() or "workshop" in title.lower():
    series_hint = {
        "series_type": "class_series",
        "series_title": title,
        "frequency": "weekly"
    }
```

---

### Shepherd Center (Source 911)

**Issues:**
- "Adaptive Yoga Class with Best Health Wellness" (39 events)
- "Family Dinner" (39 events)
- "Adaptive Strength Class with Best Health Wellness" (39 events)
- "Adaptive Cardio Class with Best Health Wellness" (39 events)

**Action:** Recurring programs should be series.

**Crawler Fix:**
- File: `sources/shepherd_center.py`
- Add series_hint for all recurring programs

---

### Mobilize API (Source 1081)

**Issues:**
- "Call Voters with Aaron Baker for House District 51" (90 events)
- "IND Cobb We The People Wednesdays Rally" (39 events)

**Action:** Volunteer shifts should be series.

**Crawler Fix:**
- File: `sources/mobilize.py`
- This is likely already structured for series, but verify:

```python
# Use event name + location as series key
series_hint = {
    "series_type": "recurring_show",  # Or "volunteer_shift"
    "series_title": event_name,
    "frequency": "weekly" if "weekly" in description else "irregular"
}
```

---

## Crawler Checklist

- [ ] `sources/stone_mountain_park.py` - Skip permanent exhibitions
- [ ] `sources/third_and_lindsley.py` - Add series_hint for weekly shows
- [ ] `sources/atlanta_recurring_social.py` - Verify series_hint implementation
- [ ] `sources/ticketmaster.py` - Enhance Opry titles with performers
- [ ] `sources/aa_atlanta.py` - Add series_hint for meetings
- [ ] `sources/na_georgia.py` - Add series_hint for meetings
- [ ] `sources/callanwolde.py` - Add series_hint for classes
- [ ] `sources/atlanta_fulton_library.py` - Add series_hint for classes
- [ ] `sources/shepherd_center.py` - Add series_hint for programs
- [ ] `sources/mobilize.py` - Verify series_hint for volunteer shifts

---

## Testing Plan

After each crawler fix:

1. **Test crawl:**
   ```bash
   python3 main.py --source [slug] --verbose
   ```

2. **Verify series creation:**
   ```sql
   SELECT s.title, COUNT(e.id) as event_count
   FROM series s
   JOIN events e ON s.id = e.series_id
   WHERE s.source_id = [source_id]
   GROUP BY s.title
   ORDER BY event_count DESC;
   ```

3. **Check for remaining high-frequency titles:**
   ```sql
   SELECT title, COUNT(*) as count
   FROM events
   WHERE source_id = [source_id]
   GROUP BY title
   HAVING COUNT(*) > 10
   ORDER BY count DESC;
   ```

---

## Final Validation

After all crawler fixes:

```sql
-- Should return < 20 rows (only valid weekly shows with different details)
SELECT title, COUNT(*) as count
FROM events
GROUP BY title
HAVING COUNT(*) > 20
ORDER BY count DESC;
```

**Expected results:**
- Grand Ole Opry: 0 (titles now unique with performer names)
- Time Jumpers: 1-2 series, not 74 individual events
- AA/NA meetings: Series per meeting group
- Classes: Series per class
- Stone Mountain: 0 (deleted)

---

## Files to Check

Run this to see which crawler files exist:

```bash
for source in stone_mountain_park third_and_lindsley atlanta_recurring_social aa_atlanta na_georgia callanwolde atlanta_fulton_library shepherd_center; do
    if [ -f "sources/${source}.py" ]; then
        echo "✓ sources/${source}.py exists"
    else
        echo "✗ sources/${source}.py MISSING"
    fi
done
```

---

## Estimated Time Breakdown

- Stone Mountain: 15 min (skip filter)
- 3rd & Lindsley: 30 min (series hints)
- Atlanta Recurring: 20 min (verify/fix series)
- Ticketmaster: 45 min (enhance Opry titles)
- AA/NA: 30 min each (series hints)
- Callanwolde: 30 min (class series)
- Library: 20 min (class series)
- Shepherd Center: 30 min (program series)
- Mobilize: 20 min (verify series)
- Testing: 1 hour (run all crawls, verify results)

**Total: 4-5 hours**
