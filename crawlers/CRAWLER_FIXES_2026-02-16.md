# Crawler Garbage Title Fixes - 2026-02-16

## Summary

Fixed 7 crawlers that were producing garbage event titles (dates, calendar grid cells, month headers) instead of real event data. The title validator in `db.py` was already rejecting these at insert time, but the crawlers have been fixed to skip them during parsing.

## Fixes Applied

### Priority 1 - High-Traffic Venues

#### 1. `sources/atlanta_motor_speedway.py`
**Problem**: Produced 33 date-only titles like "Thursday, February 5 - Monday, February 9, 2026"
**Fix**: Added pre-insertion check to skip titles matching date range patterns:
```python
if re.match(
    r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d",
    title,
    re.IGNORECASE
):
    continue
```

#### 2. `sources/variety_playhouse.py`
**Problem**: Produced month+year titles like "AUGUST 2026" (calendar navigation headers)
**Fix**: 
- Expanded month header regex to catch "Activities/Events/Calendar" suffixes
- Added explicit skip check for month+year titles that slip through

#### 3. `sources/believe_music_hall.py`
**Problem**: Produced "Fri, March 6th!" formatted date titles
**Fix**: Added skip check for abbreviated day + month + date patterns after title extraction

#### 4. `sources/round_trip_brewing.py`
**Problem**: Produced 24 date-only titles like "July 25, 2025"
**Fix**: Added skip check for "Month Day, Year" pattern before processing

### Priority 2 - Calendar Widget Bugs

#### 5. `sources/atlvets.py`
**Problem**: Produced 30 calendar grid cell titles like "Tue24", "Mon16"
**Fix**: Added calendar grid pattern checks:
```python
# Skip calendar grid cells ("Tue24", "Mon16", "0 events16")
if re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\d+$", title, re.IGNORECASE):
    continue
if re.match(r"^\d+\s*events?\d+$", title, re.IGNORECASE):
    continue
```

#### 6. `sources/st_vincent_de_paul_ga.py`
**Problem**: Same "Tue24" calendar widget pattern
**Fix**: Same calendar grid cell checks as ATLVets

#### 7. `sources/georgia_transplant_foundation.py`
**Problem**: Produced "0 events16" calendar grid cells
**Fix**: Same calendar grid cell checks as ATLVets

## Impact

- **No breaking changes**: All existing tests pass (207 passed)
- **Defense in depth**: The validator in `db.py` already catches these, but skipping earlier is more efficient
- **Cleaner logs**: Fewer validation rejections in crawl logs
- **Better data quality**: Crawlers now only attempt to insert legitimate event data

## Patterns Fixed

All fixes target the same patterns that `validate_event_title()` in `db.py` rejects:

- Date-only titles: "Thursday, February 5 - Monday, February 9, 2026"
- Abbreviated dates: "Fri, March 6th!", "Sat, Jan 24"
- Month labels: "AUGUST 2026", "January Activities"
- Calendar grid cells: "Tue24", "Mon16", "0 events16"
- Month + day only: "July 25, 2025"

## Testing

Run individual crawlers to verify they now skip garbage and only parse real events:

```bash
python main.py --source atlanta-motor-speedway --dry-run
python main.py --source variety-playhouse --dry-run
python main.py --source believe-music-hall --dry-run
python main.py --source round-trip-brewing --dry-run
python main.py --source atlvets --dry-run
python main.py --source st-vincent-de-paul-ga --dry-run
python main.py --source georgia-transplant-foundation --dry-run
```

All pytest tests pass:
```bash
python3 -m pytest tests/ --tb=short -q
# 207 passed, 15 warnings in 5.47s
```
