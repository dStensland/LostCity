# Plan: Summer Camp Programs Conversion

**Goal:** Convert ~2,000 summer camp events from the `events` table into `programs` records, source by source. Camps are structured multi-session activities with registration, age ranges, and enrollment deadlines — not one-time events. The programs table and API already exist with 4,789 programs. The conversion script pattern is proven from Georgia Gymnastics Academy.

**Architecture:**
- Extend `crawlers/scripts/convert_events_to_programs.py` with a `--camps` mode that handles title normalization, age range inference, and session span grouping for camp sources.
- Run source-by-source: dry-run first, review, live run, deactivate events (not sources).
- Verify against the programs API after each source.

**Tech Stack:** Python, Supabase REST API, `requests` library

---

## Task 1: Extend conversion script with `--camps` mode

**Files:**
- `crawlers/scripts/convert_events_to_programs.py` (modify)

The existing script (line 236–377) implements `convert_georgia_gymnastics()`. The camps mode follows the same pattern but generalizes across sources.

**Steps:**

- [ ] Read the current script end-to-end before editing:
  ```bash
  wc -l /Users/coach/Projects/LostCity/crawlers/scripts/convert_events_to_programs.py
  ```

- [ ] Add the list of approved family sources near the top of the file, after the existing GGA decode table:
  ```python
  # ---------------------------------------------------------------------------
  # Approved camp sources (--camps mode)
  # ---------------------------------------------------------------------------

  CAMP_SOURCES = [
      "dekalb-family-programs",
      "woodward-summer-camps",
      "mjcca-day-camps",
      "high-museum-summer-art-camp",
      "spruill-summer-camps",
      "girl-scouts-greater-atlanta-camps",
      "trinity-summer-camps",
      "pace-summer-programs",
      "zoo-atlanta-summer-safari-camp",
      "lovett-summer-programs",
      # Cobb Parks is also a candidate but not in top 10 — add later
  ]
  ```

- [ ] Add a title normalizer for camp events. Camp titles follow patterns like:
  - `"Adventure Camp - Week 1 (Ages 6-8)"`
  - `"Junior Naturalist Camp | Session 3"`
  - `"Coding Bootcamp for Kids - June 16-20"`
  Strip session numbers, week numbers, date ranges, and age-band suffixes so that all sessions of the same program collapse to one record:

  ```python
  # ---------------------------------------------------------------------------
  # Camp title normalization
  # ---------------------------------------------------------------------------

  # Strip " - Week N", " | Session N", " (Session N)", " Week N"
  _SESSION_RE = re.compile(
      r"\s*[-|]\s*(?:week|session|wk|ses)\s*\d+\b.*$"
      r"|\s*\(?(?:week|session|wk|ses)\s*\d+\)?.*$"
      r"|\s*[-|]\s*(?:june|july|august|jun|jul|aug)\s+\d{1,2}[-–]\d{1,2}.*$"
      r"|\s*\d{1,2}/\d{1,2}[-–]\d{1,2}/\d{2,4}.*$",
      re.I,
  )

  # Strip trailing age band: " (Ages 5-8)", " Ages 6-10", " | 6-8yrs"
  _AGE_SUFFIX_RE = re.compile(
      r"\s*[-|]?\s*\(?ages?\s*\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:yrs?)?\)?.*$"
      r"|\s*[-|]?\s*\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:yrs?|years?).*$",
      re.I,
  )

  # Strip trailing date ranges: " - June 16-20", " (June 9 - August 1)"
  _DATE_SUFFIX_RE = re.compile(
      r"\s*[-–|]?\s*\(?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}.*$",
      re.I,
  )

  # Strip trailing parentheticals (safety net)
  _TRAILING_PAREN_RE_CAMP = re.compile(r"\s*\([^)]*\)\s*$")


  def normalize_camp_title(raw_title: str) -> str:
      """
      Normalize a camp event title to a canonical program name.

      Examples:
        "Adventure Camp - Week 1 (Ages 6-8)"  → "Adventure Camp"
        "Junior Naturalist Camp | Session 3"   → "Junior Naturalist Camp"
        "Coding Bootcamp - June 16-20"         → "Coding Bootcamp"
        "Art Camp for Kids (Ages 7-10)"        → "Art Camp for Kids"
        "Summer Safari Camp Week 2"            → "Summer Safari Camp"
      """
      t = raw_title.strip()
      t = _SESSION_RE.sub("", t)
      t = _DATE_SUFFIX_RE.sub("", t)
      t = _AGE_SUFFIX_RE.sub("", t)
      t = _TRAILING_PAREN_RE_CAMP.sub("", t)
      return t.strip()
  ```

- [ ] Add age range inference from title (supplement existing `age_min`/`age_max` columns):
  ```python
  # ---------------------------------------------------------------------------
  # Age range inference from camp titles
  # ---------------------------------------------------------------------------

  _AGE_RANGE_RE = re.compile(r"ages?\s*(\d{1,2})\s*[-–]\s*(\d{1,2})", re.I)
  _AGE_SINGLE_RE = re.compile(r"ages?\s*(\d{1,2})\s*\+?", re.I)


  def infer_age_range_from_title(title: str) -> tuple[int | None, int | None]:
      """Extract age_min, age_max from title if present."""
      m = _AGE_RANGE_RE.search(title)
      if m:
          return int(m.group(1)), int(m.group(2))
      m = _AGE_SINGLE_RE.search(title)
      if m:
          age = int(m.group(1))
          return age, age + 4  # reasonable default span for a single-age marker
      return None, None
  ```

- [ ] Add the core `convert_camps()` function. This is the largest addition:
  ```python
  # ---------------------------------------------------------------------------
  # Core conversion: camp events → program records
  # ---------------------------------------------------------------------------


  def convert_camps(source_slug: str, dry_run: bool) -> tuple[int, int]:
      """
      Convert summer camp events from a single source into program records.
      Returns (events_found, programs_created).

      Criteria:
        - is_active = true
        - title ILIKE '%camp%'
        - end_date IS NOT NULL  (can't determine session span without it)
      """
      logger.info(f"Fetching source: {source_slug}")

      sources = supabase_get(
          "sources",
          {"slug": f"eq.{source_slug}", "select": "id,owner_portal_id,name"},
      )
      if not sources:
          logger.error(f"Source '{source_slug}' not found in sources table.")
          return 0, 0

      source = sources[0]
      source_id = source["id"]
      portal_id = source.get("owner_portal_id")
      provider_name = source.get("name", source_slug)
      logger.info(f"Source ID: {source_id}, Portal ID: {portal_id}, Provider: {provider_name}")

      # Fetch camp events: title must contain 'camp', end_date must be present
      # Use limit=3000 — DeKalb alone has 289, most sources are under 250
      events = supabase_get(
          "events",
          {
              "source_id": f"eq.{source_id}",
              "is_active": "eq.true",
              "title": "ilike.*camp*",
              "end_date": "not.is.null",
              "select": (
                  "id,title,start_date,end_date,start_time,end_time,"
                  "price_min,venue_id,source_url,tags,age_min,age_max,"
                  "ticket_url"
              ),
              "order": "start_date.asc",
              "limit": "3000",
          },
      )
      logger.info(f"Found {len(events)} camp events from {source_slug}")

      if not events:
          return 0, 0

      # Group by normalized title
      programs_by_title: dict[str, list[dict]] = defaultdict(list)
      for ev in events:
          normalized = normalize_camp_title(ev["title"])
          if not normalized:
              normalized = ev["title"]  # shouldn't happen, but be safe
          programs_by_title[normalized].append(ev)

      logger.info(f"Collapsed to {len(programs_by_title)} distinct program titles")

      # Resolve venue_id — most camp sources use one venue; pick modal
      all_venue_ids = [ev["venue_id"] for ev in events if ev.get("venue_id")]
      venue_id: int | None = None
      if all_venue_ids:
          from collections import Counter
          venue_id = Counter(all_venue_ids).most_common(1)[0][0]

      converted = 0

      for camp_name, event_instances in sorted(programs_by_title.items()):
          # Session span = earliest start_date → latest end_date across all instances
          session_start = min(ev["start_date"] for ev in event_instances)
          session_end = max(
              ev.get("end_date") or ev["start_date"] for ev in event_instances
          )
          season = infer_season(session_start)

          # Age range: prefer explicit DB values, fall back to title inference
          # Use the range that covers all instances
          db_age_mins = [ev["age_min"] for ev in event_instances if ev.get("age_min") is not None]
          db_age_maxs = [ev["age_max"] for ev in event_instances if ev.get("age_max") is not None]
          if db_age_mins and db_age_maxs:
              age_min: int | None = min(db_age_mins)
              age_max: int | None = max(db_age_maxs)
          else:
              # Try inferring from the original (non-normalized) title
              all_ages = [infer_age_range_from_title(ev["title"]) for ev in event_instances]
              inferred_mins = [a[0] for a in all_ages if a[0] is not None]
              inferred_maxs = [a[1] for a in all_ages if a[1] is not None]
              age_min = min(inferred_mins) if inferred_mins else None
              age_max = max(inferred_maxs) if inferred_maxs else None

          # Cost: modal price_min
          prices = [ev["price_min"] for ev in event_instances if ev.get("price_min") is not None]
          cost_amount: float | None = None
          if prices:
              from collections import Counter as _Counter
              cost_amount = float(_Counter(prices).most_common(1)[0][0])

          # Registration URL: first non-null ticket_url, fall back to source_url
          registration_url: str | None = None
          for ev in event_instances:
              if ev.get("ticket_url"):
                  registration_url = ev["ticket_url"]
                  break
          if not registration_url:
              for ev in event_instances:
                  if ev.get("source_url"):
                      registration_url = ev["source_url"]
                      break

          # Schedule days: day-of-week distribution across instances
          # Compute from start_dates — will be a rough signal
          from datetime import date as _date
          dow_counts: dict[int, int] = defaultdict(int)
          for ev in event_instances:
              try:
                  d = _date.fromisoformat(ev["start_date"][:10])
                  # ISO weekday: 1=Mon, 7=Sun
                  dow_counts[d.isoweekday()] += 1
              except ValueError:
                  pass
          # Keep days that appear in >= 20% of instances
          total_instances = len(event_instances)
          schedule_days = sorted(
              day for day, count in dow_counts.items()
              if total_instances > 0 and count / total_instances >= 0.20
          ) or None

          program_slug = f"{slugify(source_slug)}-{slugify(camp_name)}"

          # Build description
          age_str = f"ages {age_min}–{age_max}" if age_min is not None else "all ages"
          description = (
              f"{camp_name} at {provider_name}. {season.capitalize() if season else 'Seasonal'} camp "
              f"for {age_str}. Sessions run {session_start} through {session_end}."
          )

          program_record = {
              "portal_id": portal_id,
              "source_id": source_id,
              "venue_id": venue_id,
              "name": camp_name,
              "slug": program_slug,
              "description": description,
              "program_type": "camp",
              "provider_name": provider_name,
              "age_min": age_min,
              "age_max": age_max,
              "season": season,
              "session_start": session_start,
              "session_end": session_end,
              "schedule_days": schedule_days,
              "cost_amount": cost_amount,
              "cost_period": "per_session" if cost_amount else None,
              "registration_status": "open",
              "registration_url": registration_url,
              "tags": ["camp", "kids", "summer", "family-friendly"],
              "status": "active",
          }

          if dry_run:
              age_label = f"ages {age_min}–{age_max}" if age_min is not None else "age unknown"
              logger.info(
                  f"[DRY RUN] {camp_name} | {age_label} | "
                  f"{len(event_instances)} instances | season={season} | "
                  f"{session_start} → {session_end} | cost=${cost_amount}"
              )
              converted += 1
              continue

          # Check for existing program by slug (idempotent re-runs)
          existing = supabase_get("programs", {"slug": f"eq.{program_slug}", "select": "id"})
          if existing:
              logger.info(f"Already exists: {program_slug}, skipping")
              continue

          try:
              result = supabase_post("programs", program_record)
              logger.info(f"Created program {result.get('id')}: {camp_name}")
              converted += 1
          except Exception as exc:
              logger.error(f"Failed to create '{camp_name}': {exc}")

      return len(events), converted
  ```

- [ ] Add a `deactivate_camp_events()` function (deactivates events, NOT the source):
  ```python
  def deactivate_camp_events(source_slug: str, dry_run: bool) -> None:
      """
      Deactivate camp events from a source that have been converted to programs.
      Does NOT deactivate the source — it will produce new events next year.
      """
      sources = supabase_get("sources", {"slug": f"eq.{source_slug}", "select": "id"})
      if not sources:
          logger.error(f"Source '{source_slug}' not found.")
          return

      source_id = sources[0]["id"]

      if dry_run:
          logger.info(
              f"[DRY RUN] Would deactivate camp events from source {source_id} ({source_slug})"
          )
          return

      supabase_patch(
          "events",
          {
              "source_id": f"eq.{source_id}",
              "is_active": "eq.true",
              "title": "ilike.*camp*",
          },
          {"is_active": False},
      )
      logger.info(f"Deactivated camp events from source {source_id} ({source_slug})")
  ```

- [ ] Update the `argparse` block in `main()` to add `--camps` flag and expand `--source` choices:
  ```python
  parser.add_argument(
      "--source",
      choices=["georgia-gymnastics-academy"] + CAMP_SOURCES,
      help="Specific source to convert",
  )
  parser.add_argument(
      "--camps",
      action="store_true",
      help="Convert camp events (title ILIKE %%camp%%) from the specified source",
  )
  parser.add_argument(
      "--dry-run",
      action="store_true",
      help="Preview without writing to DB",
  )
  parser.add_argument(
      "--deactivate",
      action="store_true",
      help="After conversion, deactivate camp events (not the source). "
           "Must be explicit — not implied by --camps alone.",
  )
  ```

- [ ] Update the dispatch logic in `main()`:
  ```python
  if args.source == "georgia-gymnastics-academy" and not args.camps:
      found, converted = convert_georgia_gymnastics(args.dry_run)
      mode = "would be created" if args.dry_run else "created"
      logger.info(f"Summary: {found} events found → {converted} programs {mode}")
      if args.deactivate:
          deactivate_georgia_gymnastics(args.dry_run)
  elif args.camps:
      if args.source not in CAMP_SOURCES:
          logger.error(f"--camps requires a source from the approved list: {CAMP_SOURCES}")
          sys.exit(1)
      found, converted = convert_camps(args.source, args.dry_run)
      mode = "would be created" if args.dry_run else "created"
      logger.info(f"Summary: {found} camp events → {converted} programs {mode}")
      if args.deactivate:
          deactivate_camp_events(args.source, args.dry_run)
      elif not args.dry_run:
          logger.info(
              "Programs created. Pass --deactivate to disable camp events "
              "after verifying program output."
          )
  ```

- [ ] Run lint and type check:
  ```bash
  cd /Users/coach/Projects/LostCity/crawlers && ruff check scripts/convert_events_to_programs.py
  ```

---

## Task 2: Convert DeKalb Family Programs (289 events)

**Steps:**

- [ ] Dry run — review title normalization and age inference:
  ```bash
  cd /Users/coach/Projects/LostCity/crawlers
  python3 scripts/convert_events_to_programs.py \
    --source dekalb-family-programs \
    --camps \
    --dry-run 2>&1 | head -60
  ```

  Review output for:
  - Title normalization looks correct (week/session numbers stripped)
  - Age ranges are being picked up (either from DB columns or title inference)
  - Session spans look right (June–August for summer camps)
  - Cost amounts are reasonable

- [ ] If age ranges are mostly missing, inspect the raw events:
  ```bash
  # Check a sample of DeKalb camp event titles and their age columns
  # via Supabase dashboard or psql:
  # SELECT title, age_min, age_max FROM events
  # WHERE source_id = (SELECT id FROM sources WHERE slug = 'dekalb-family-programs')
  #   AND title ILIKE '%camp%' AND is_active
  # LIMIT 20;
  ```

- [ ] Live run:
  ```bash
  cd /Users/coach/Projects/LostCity/crawlers
  python3 scripts/convert_events_to_programs.py \
    --source dekalb-family-programs \
    --camps \
    2>&1 | tee /tmp/dekalb-camps-conversion.log
  ```

- [ ] Verify programs appear:
  ```bash
  curl "https://lost.city/api/programs?portal=family&source=dekalb-family-programs&limit=5" | jq '.[] | {name, age_min, age_max, season, cost_amount}'
  ```

  Or hit local dev:
  ```bash
  curl "http://localhost:3000/api/programs?portal=family&source=dekalb-family-programs&limit=5" | jq '.'
  ```

- [ ] Spot-check 5 programs: correct name, age range, session span, cost, registration_url.

- [ ] Deactivate events after confirming programs are correct:
  ```bash
  cd /Users/coach/Projects/LostCity/crawlers
  python3 scripts/convert_events_to_programs.py \
    --source dekalb-family-programs \
    --camps \
    --deactivate \
    --dry-run
  # Review, then:
  python3 scripts/convert_events_to_programs.py \
    --source dekalb-family-programs \
    --camps \
    --deactivate
  ```

---

## Task 3: Convert Woodward Summer Camps (213 events)

Same pattern as Task 2.

**Steps:**

- [ ] Dry run:
  ```bash
  cd /Users/coach/Projects/LostCity/crawlers
  python3 scripts/convert_events_to_programs.py \
    --source woodward-summer-camps \
    --camps \
    --dry-run 2>&1 | head -60
  ```

  Note: Woodward is a private school with structured naming. Titles likely follow "Woodward X Camp - Week N" patterns. Verify normalization collapses sessions correctly.

- [ ] Live run + verify:
  ```bash
  python3 scripts/convert_events_to_programs.py \
    --source woodward-summer-camps \
    --camps
  ```

- [ ] Spot-check 5 programs via API.

- [ ] Deactivate events:
  ```bash
  python3 scripts/convert_events_to_programs.py \
    --source woodward-summer-camps \
    --camps \
    --deactivate
  ```

---

## Task 4: Convert MJCCA Day Camps (113 events)

Same pattern. MJCCA is age-banded — age ranges should be explicit in their event titles or DB columns.

**Steps:**

- [ ] Dry run:
  ```bash
  cd /Users/coach/Projects/LostCity/crawlers
  python3 scripts/convert_events_to_programs.py \
    --source mjcca-day-camps \
    --camps \
    --dry-run 2>&1 | head -60
  ```

- [ ] Verify age range extraction is picking up MJCCA's age bands (e.g., "Camp Ramah for Ages 8-12").

- [ ] Live run + verify + deactivate:
  ```bash
  python3 scripts/convert_events_to_programs.py --source mjcca-day-camps --camps
  # spot-check API
  python3 scripts/convert_events_to_programs.py --source mjcca-day-camps --camps --deactivate
  ```

---

## Task 5: Batch convert remaining smaller sources

Convert the remaining 7 sources. They're small enough to batch, but still dry-run each first.

**Sources:** `high-museum-summer-art-camp` (41), `spruill-summer-camps` (40), `girl-scouts-greater-atlanta-camps` (33), `trinity-summer-camps` (32), `pace-summer-programs` (28), `zoo-atlanta-summer-safari-camp` (28), `lovett-summer-programs` (25)

**Steps:**

- [ ] Dry run all seven:
  ```bash
  cd /Users/coach/Projects/LostCity/crawlers
  for SOURCE in \
    high-museum-summer-art-camp \
    spruill-summer-camps \
    girl-scouts-greater-atlanta-camps \
    trinity-summer-camps \
    pace-summer-programs \
    zoo-atlanta-summer-safari-camp \
    lovett-summer-programs; do
    echo "=== DRY RUN: $SOURCE ==="
    python3 scripts/convert_events_to_programs.py \
      --source "$SOURCE" \
      --camps \
      --dry-run 2>&1 | grep -E "DRY RUN|Summary|ERROR"
  done
  ```

- [ ] Review output for any sources where age ranges are missing or titles aren't normalizing well. Fix `normalize_camp_title()` or `infer_age_range_from_title()` if needed, then re-run dry runs.

- [ ] Live run all seven:
  ```bash
  for SOURCE in \
    high-museum-summer-art-camp \
    spruill-summer-camps \
    girl-scouts-greater-atlanta-camps \
    trinity-summer-camps \
    pace-summer-programs \
    zoo-atlanta-summer-safari-camp \
    lovett-summer-programs; do
    echo "=== CONVERTING: $SOURCE ==="
    python3 scripts/convert_events_to_programs.py \
      --source "$SOURCE" \
      --camps \
      2>&1 | tail -5
  done
  ```

- [ ] Spot-check one program per source via API:
  ```bash
  for SOURCE in high-museum-summer-art-camp spruill-summer-camps girl-scouts-greater-atlanta-camps; do
    echo "=== $SOURCE ==="
    curl -s "http://localhost:3000/api/programs?source=$SOURCE&limit=2" | \
      jq '.[] | {name, age_min, age_max, season, cost_amount}'
  done
  ```

- [ ] Deactivate events for all seven after confirming:
  ```bash
  for SOURCE in \
    high-museum-summer-art-camp \
    spruill-summer-camps \
    girl-scouts-greater-atlanta-camps \
    trinity-summer-camps \
    pace-summer-programs \
    zoo-atlanta-summer-safari-camp \
    lovett-summer-programs; do
    echo "=== DEACTIVATING EVENTS: $SOURCE ==="
    python3 scripts/convert_events_to_programs.py \
      --source "$SOURCE" \
      --camps \
      --deactivate \
      2>&1 | tail -3
  done
  ```

---

## Task 6: Deactivate converted events, verify Family portal, refresh

**Steps:**

- [ ] Confirm total programs created across all sources:
  ```bash
  # In Supabase SQL editor or psql:
  # SELECT source_id, s.slug, COUNT(*) as programs
  # FROM programs p
  # JOIN sources s ON s.id = p.source_id
  # WHERE p.program_type = 'camp'
  # GROUP BY source_id, s.slug
  # ORDER BY programs DESC;
  ```

  Expected: ~250–350 programs across 10 sources (events collapse many sessions into single programs).

- [ ] Confirm camp events are deactivated:
  ```bash
  # SELECT s.slug, COUNT(*) as still_active
  # FROM events e
  # JOIN sources s ON s.id = e.source_id
  # WHERE e.is_active = true
  #   AND e.title ILIKE '%camp%'
  #   AND s.slug IN (<list>)
  # GROUP BY s.slug;
  ```

  Expected: 0 active camp events for converted sources.

- [ ] Confirm sources are still active (they should be — will produce next year's events):
  ```bash
  # SELECT slug, is_active FROM sources
  # WHERE slug IN (<list>)
  # ORDER BY slug;
  ```

- [ ] Hit the Family portal programs API and confirm programs appear:
  ```bash
  curl "http://localhost:3000/api/programs?portal=family&program_type=camp&limit=10" | \
    jq '.[] | {name, age_min, age_max, season, provider_name}'
  ```

- [ ] Refresh `feed_events_ready` materialized view if it caches event counts:
  ```bash
  # In Supabase SQL editor:
  # REFRESH MATERIALIZED VIEW CONCURRENTLY feed_events_ready;
  ```

- [ ] Commit:
  ```bash
  cd /Users/coach/Projects/LostCity
  git add crawlers/scripts/convert_events_to_programs.py
  git commit -m "feat(programs): add --camps mode to conversion script; convert 10 summer camp sources"
  ```

---

## What NOT to Convert

Per the spec, skip:
- Events without `end_date` — can't determine session span (~11% of camp events per the audit)
- Sources with < 5 camp events — overhead not worth it
- Non-camp events from these sources (workshops, classes, activities without "camp" in the title) — they stay as events

The `coder-school` (179 camp events) and `cobb-family-programs` (74 events) are not in the initial list. Add them in a follow-up batch once the pattern is proven with the top 10.
