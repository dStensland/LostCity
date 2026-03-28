# Taxonomy Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface derived attributes (cost_tier, duration, booking_required, indoor_outdoor, significance) on event cards and detail pages, wire sports watch party detection into the rules classifier, and wire significance signals into the feed scoring function.

**Architecture:** The Phase 1 migration (`20260326300001_taxonomy_redesign_phase1.sql`) already added all required columns to `events` and `feed_events_ready`. The classifier (`crawlers/classify.py`) already populates them. This plan is entirely a read-side wiring task — no schema changes, no crawler changes, no data migrations.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Tailwind v4, Python 3.12 (classify.py only), pytest

---

## Context: What already exists

- `events.cost_tier` TEXT (`free | $ | $$ | $$$`) — populated by classify pipeline
- `events.duration` TEXT (`short | medium | half-day | full-day | multi-day`) — populated by classify pipeline
- `events.booking_required` BOOLEAN — populated by classify pipeline
- `events.indoor_outdoor` TEXT (`indoor | outdoor | both`) — populated by classify pipeline
- `events.significance` TEXT (`low | medium | high`) — populated by classify pipeline
- `events.significance_signals` TEXT[] — populated by classify pipeline
- `feed_events_ready.cost_tier`, `.duration`, `.significance` — already in denormalized table (Phase 1 migration)
- `web/components/event-card/EventCardBadges.tsx` — renders Live, Festival, Big Stuff badges
- `web/components/event-card/EventCardMetadata.tsx` — renders venue, price, skill_level, series, class badges
- `web/components/detail/MetadataGrid.tsx` — accepts `MetadataItem[]` with `label`, `value`, `color`
- `web/lib/city-pulse/scoring.ts` → `scoreEvent()` — accepts `ScorableEvent`, has `is_tentpole` boost (+40) and `featured_blurb` boost (+15)
- `crawlers/sources/_sports_bar_common.py` → `detect_sports_watch_party(title, desc)` — returns `("sports", "watch_party", tags)` or `None`
- `crawlers/classify.py` → `classify_rules()` — has `_VENUE_CATEGORY_HINTS` dict and `_TITLE_PATTERNS` list
- `FeedEventData` type in `web/components/EventCard.tsx` — does NOT currently include cost_tier, duration, booking_required, indoor_outdoor, or significance fields

---

## Task 1: Add derived attribute fields to FeedEventData type and EVENT_SELECT

**Files:**
- `web/components/EventCard.tsx` — `FeedEventData` type definition at line ~91
- `web/lib/city-pulse/pipeline/fetch-events.ts` — `EVENT_SELECT` constant at line ~25

- [ ] Open `web/components/EventCard.tsx`. Find the `FeedEventData` type (starts at line 91 with `export type FeedEventData = {`). Add the new optional fields after `importance`:

```typescript
  // Taxonomy v2 derived attributes
  cost_tier?: string | null;
  duration?: string | null;
  booking_required?: boolean | null;
  indoor_outdoor?: string | null;
  significance?: string | null;
  significance_signals?: string[] | null;
```

- [ ] Open `web/lib/city-pulse/pipeline/fetch-events.ts`. Find `EVENT_SELECT` (line ~25). Add the new columns to the SELECT string, after `importance`:

```typescript
export const EVENT_SELECT = `
  id, title, start_date, start_time, end_date, end_time,
  is_all_day, is_free, price_min, price_max,
  category:category_id, genres, image_url, featured_blurb,
  tags, festival_id, is_tentpole, is_featured, series_id, is_recurring, source_id, organization_id,
  importance, on_sale_date, presale_date, early_bird_deadline, sellout_risk,
  ticket_status, ticket_status_checked_at, ticket_url, source_url,
  cost_tier, duration, booking_required, indoor_outdoor, significance, significance_signals,
  series:series_id(id, frequency, day_of_week, series_type),
  venue:venues(id, name, neighborhood, slug, venue_type, location_designator, city, image_url, active)
`;
```

- [ ] Open `web/lib/city-pulse/pipeline/fetch-feed-ready.ts`. Find the `FeedReadyRow` type and `reshapeToFeedEvent()` function. Add the new fields to `FeedReadyRow`:

```typescript
  cost_tier: string | null;
  duration: string | null;
  significance: string | null;
  // booking_required and indoor_outdoor are NOT in feed_events_ready — skip them here
```

- [ ] In `reshapeWithExtras()` (or directly in `reshapeToFeedEvent()`), attach the new fields to the reshaped object after the `series` field:

```typescript
  cost_tier: row.cost_tier,
  duration: row.duration,
  significance: row.significance,
```

- [ ] Run `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit` and fix any type errors before proceeding.

---

## Task 2: Add cost_tier badge to EventCardBadges

**Files:**
- `web/components/event-card/EventCardBadges.tsx`
- `web/components/EventCard.tsx` — find where `EventCardBadges` is called and pass `costTier`

- [ ] Open `web/components/event-card/EventCardBadges.tsx`. Add `costTier` to the interface and render it:

```typescript
interface EventCardBadgesProps {
  isLive: boolean;
  hasFestivalId: boolean;
  isTentpole: boolean;
  costTier?: string | null;
  size?: "mobile" | "desktop";
}
```

Add this badge after the `isTentpole` block (before the closing `<>`):

```tsx
{costTier && costTier !== "free" && (
  <span
    className={`${shrinkClass} inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[var(--gold)]/10 border-[var(--gold)]/25`}
  >
    <span className="font-mono text-2xs font-medium text-[var(--gold)] uppercase tracking-wide">
      {costTier}
    </span>
  </span>
)}
{costTier === "free" && (
  <span
    className={`${shrinkClass} inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[var(--neon-green)]/15 border-[var(--neon-green)]/30`}
  >
    <span className="font-mono text-2xs font-medium text-[var(--neon-green)] uppercase tracking-wide">
      Free
    </span>
  </span>
)}
```

NOTE: Do not add a "Free" cost_tier badge if `is_free` is already true and the existing price rendering already shows "FREE" — check `EventCardMetadata.tsx` price section. The `is_free` flag already renders a green FREE badge in `EventCardMetadata`. Only render cost_tier from this component when `is_free` is false and `costTier` has a dollar-tier value (`$`, `$$`, `$$$`). Remove the `costTier === "free"` block if there is visual overlap. Verify in browser.

- [ ] Find the `EventCardBadges` usage in `web/components/EventCard.tsx` (search for `<EventCardBadges`). Pass the `costTier` prop:

```tsx
<EventCardBadges
  isLive={isLive}
  hasFestivalId={hasFestivalId}
  isTentpole={isTentpole}
  costTier={event.cost_tier}
  size={...}
/>
```

---

## Task 3: Add duration + booking_required to EventCardMetadata

**Files:**
- `web/components/event-card/EventCardMetadata.tsx`

The `EventCardMetadataProps` interface already has `skillLevel`. Add `duration` and `bookingRequired` to it.

- [ ] Open `web/components/event-card/EventCardMetadata.tsx`. Update the interface:

```typescript
interface EventCardMetadataProps {
  // ... existing props ...
  duration?: string | null;
  bookingRequired?: boolean | null;
}
```

- [ ] Add a `DURATION_LABELS` map at the top of the file (after imports):

```typescript
const DURATION_LABELS: Record<string, string> = {
  "short": "~1hr",
  "medium": "2-3hrs",
  "half-day": "Half Day",
  "full-day": "Full Day",
  "multi-day": "Multi-Day",
};
```

- [ ] In the JSX, add duration and booking_required after the `skillLevel` block (inside `<span className="hidden sm:contents">`):

```tsx
{duration && DURATION_LABELS[duration] && (
  <span className="hidden sm:contents">
    <Dot />
    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/40">
      {DURATION_LABELS[duration]}
    </span>
  </span>
)}
{bookingRequired && (
  <span className="hidden sm:contents">
    <Dot />
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
      Book ahead
    </span>
  </span>
)}
```

- [ ] Find where `EventCardMetadata` is called in `web/components/EventCard.tsx` (search for `<EventCardMetadata`). Pass the new props from the `event` object:

```tsx
<EventCardMetadata
  // ... existing props ...
  duration={event.duration}
  bookingRequired={event.booking_required}
/>
```

- [ ] Run `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit` and fix any type errors.

---

## Task 4: Add derived attributes to event detail page MetadataGrid

**Files:**
- `web/app/[portal]/events/[id]/EventDetailWrapper.tsx` — or wherever MetadataGrid is built for the detail page
- `web/lib/supabase.ts` — `Event` type, verify cost_tier/duration/booking_required are present

The detail page uses `getEventById()` from `web/lib/supabase.ts` which SELECTs `*` from events — so all v2 columns are already returned. The `Event` type needs the fields added.

- [ ] Open `web/lib/supabase.ts`. Find the `Event` type (around line 70). The `skill_level` field is already there at line 96. Add the taxonomy v2 fields after `skill_level`:

```typescript
  cost_tier?: string | null;
  duration?: string | null;
  booking_required?: boolean | null;
  indoor_outdoor?: string | null;
  significance?: string | null;
  significance_signals?: string[] | null;
  audience_tags?: string[] | null;
```

- [ ] Find where `MetadataGrid` is rendered in the event detail page. Run:

```bash
grep -rn "MetadataGrid" /Users/coach/Projects/LostCity/web/app/ 2>/dev/null
grep -rn "MetadataGrid" /Users/coach/Projects/LostCity/web/components/ 2>/dev/null
```

Then open that file. Find the `items` array being built for `MetadataGrid`. Add taxonomy v2 items (only when the field is non-null):

```typescript
const DURATION_LABELS: Record<string, string> = {
  "short": "~1 hour",
  "medium": "2-3 hours",
  "half-day": "Half day",
  "full-day": "Full day",
  "multi-day": "Multiple days",
};

// Inside the items array builder:
...(event.cost_tier ? [{
  label: "Cost",
  value: event.cost_tier === "free" ? "Free" : event.cost_tier,
  color: event.cost_tier === "free" ? "var(--neon-green)" : "var(--gold)",
}] : []),
...(event.duration ? [{
  label: "Duration",
  value: DURATION_LABELS[event.duration] ?? event.duration,
  color: "var(--soft)",
}] : []),
...(event.indoor_outdoor ? [{
  label: "Setting",
  value: event.indoor_outdoor === "both" ? "Indoor & Outdoor" :
         event.indoor_outdoor.charAt(0).toUpperCase() + event.indoor_outdoor.slice(1),
  color: "var(--soft)",
}] : []),
...(event.booking_required ? [{
  label: "Booking",
  value: "Required",
  color: "var(--neon-cyan)",
}] : []),
```

- [ ] Run `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit` and fix any type errors.

---

## Task 5: Wire sports watch party into classify.py

**Files:**
- `crawlers/classify.py`
- `crawlers/tests/test_classify_rules.py`

The function `detect_sports_watch_party(title, desc)` in `crawlers/sources/_sports_bar_common.py` returns `("sports", "watch_party", tags_list)` or `None`. It only fires when BOTH a sport keyword AND a watch cue (`watch party`, `viewing party`, `game day`, `gameday`, `match day`, `matchday`) are present.

- [ ] Open `crawlers/classify.py`. Add the import at the top (after existing imports):

```python
from sources._sports_bar_common import detect_sports_watch_party
```

- [ ] In `classify_rules()`, find Step 3 (venue type hints). Add a new step between Step 2 (dance-party override) and Step 3 (venue type hints). Insert after the dance-party block (around line 452):

```python
    # ------------------------------------------------------------------
    # Step 2b: Sports watch party at sports bar
    # When venue is sports_bar AND title/description signals a watch party
    # with a known sport keyword, override to sports category.
    # This runs AFTER the dance-party check but BEFORE general venue hints
    # so the specific detection wins over the generic sports_bar → film fallback.
    # ------------------------------------------------------------------
    if venue_type == "sports_bar":
        watch_party_result = detect_sports_watch_party(title, description)
        if watch_party_result is not None:
            _wp_category, _wp_genre, _wp_tags = watch_party_result
            result.category = _wp_category  # "sports"
            result.genres = [_wp_genre]  # ["watch_party"]
            result.confidence = 0.88
            # Merge sport-specific tags into result — callers can use them
            # but ClassificationResult has no tags field so we skip
```

NOTE: `ClassificationResult` has no `tags` field — only `category`, `genres`, `audience`, `confidence`, `source`, and derived attributes. The tags are returned by `detect_sports_watch_party` for the crawler layer, not the classification layer. Just set `category` and `genres`.

- [ ] Open `crawlers/tests/test_classify_rules.py`. Add two test cases at the end of the file:

```python
def test_sports_watch_party_at_sports_bar():
    """Super Bowl watch party at sports bar → sports/watch_party."""
    result = classify_rules(
        title="Super Bowl Watch Party",
        description="Come watch the big game!",
        venue_type="sports_bar",
    )
    assert result.category == "sports"
    assert "watch_party" in result.genres
    assert result.confidence >= 0.85


def test_sports_bar_no_sport_keyword_stays_film():
    """Sports bar with 'viewing party' but no sport keyword → no sports override."""
    result = classify_rules(
        title="Movie Viewing Party",
        description="Watch a film together.",
        venue_type="sports_bar",
    )
    # Should NOT be classified as sports — no sport keyword
    assert result.category != "sports"
```

- [ ] Run the tests:

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_classify_rules.py -v
```

Fix any failures before proceeding.

---

## Task 6: Wire significance signals into scoreEvent()

**Files:**
- `web/lib/city-pulse/scoring.ts`
- `web/lib/city-pulse/types.ts` — check if `ScorableEvent` type is here or in scoring.ts

`ScorableEvent` is defined in `web/lib/city-pulse/scoring.ts` starting at line 36. The type currently has `is_tentpole` and `featured_blurb` but no significance fields.

- [ ] Open `web/lib/city-pulse/scoring.ts`. Update `ScorableEvent` to add significance fields after `featured_blurb`:

```typescript
export interface ScorableEvent {
  // ... existing fields ...
  featured_blurb?: string | null;
  // Taxonomy v2 significance
  significance?: string | null;
  significance_signals?: string[] | null;
}
```

- [ ] In `scoreEvent()`, find the "Tentpole event (+40)" block (around line 261). Add significance scoring after it:

```typescript
  // Significance level (+15 to +30)
  if (event.significance === "high") {
    score += 30;
    // Only add "Major event" reason if is_tentpole didn't already add it
    if (!event.is_tentpole) {
      reasons.push({ type: "trending", label: "High-profile event" });
    }
  } else if (event.significance === "medium") {
    score += 15;
  }

  // Significance signal bonuses (+5 each, capped at 20)
  const SIGNAL_SCORES: Record<string, number> = {
    "touring": 5,
    "large_venue": 5,
    "festival": 5,
    "limited_run": 5,
    "opening": 5,
    "championship": 5,
    "high_price": 3,
    // "known_name" intentionally omitted — lowest-confidence signal per spec
  };
  if (event.significance_signals && event.significance_signals.length > 0) {
    const signalBonus = event.significance_signals.reduce(
      (sum, signal) => sum + (SIGNAL_SCORES[signal] ?? 0),
      0,
    );
    score += Math.min(20, signalBonus);
  }
```

- [ ] Find where `scoreEvent()` is called in the pipeline (it will be in `web/lib/city-pulse/pipeline/build-sections.ts` or similar). Verify the events passed to it already have `significance` and `significance_signals` available (they will if Task 1 wired them into `FeedEventData`). If the pipeline casts `FeedEventData` to `ScorableEvent`, the fields pass through as long as they're on both types.

- [ ] Run `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit` and confirm no errors.

---

## Task 7: Verify and commit

- [ ] Run the full TypeScript check:

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] Run the classifier test suite:

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_classify_rules.py tests/test_classify_pipeline.py -v
```

- [ ] Browser-verify: start the dev server and load an Atlanta event card. Confirm:
  - Cost tier badge appears when event has `cost_tier = "$"` or `"$$"` or `"$$$"`
  - Duration label appears on desktop (hidden on mobile — `hidden sm:contents` wrapper)
  - "Book ahead" badge appears on desktop when `booking_required = true`
  - An event detail page shows cost/duration/setting/booking in MetadataGrid

```bash
cd /Users/coach/Projects/LostCity/web && npm run dev
# Load http://localhost:3000/atlanta
```

- [ ] Commit:

```bash
cd /Users/coach/Projects/LostCity
git add web/components/EventCard.tsx \
        web/components/event-card/EventCardBadges.tsx \
        web/components/event-card/EventCardMetadata.tsx \
        web/lib/city-pulse/pipeline/fetch-events.ts \
        web/lib/city-pulse/pipeline/fetch-feed-ready.ts \
        web/lib/city-pulse/scoring.ts \
        web/lib/supabase.ts \
        crawlers/classify.py \
        crawlers/tests/test_classify_rules.py
git commit -m "feat: surface taxonomy v2 derived attributes on event cards + feed scoring

- Add cost_tier, duration, booking_required badges to EventCard
- Add significance scoring to scoreEvent() (+30/+15 for high/medium)
- Wire sports watch party detection into classify_rules() sports_bar path
- Extend FeedEventData and ScorableEvent types with v2 fields
- No schema changes needed (Phase 1 migration already added columns)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
