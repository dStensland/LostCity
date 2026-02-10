# Code Quality & Architecture Review -- Post Phase A-M

**Date:** 2026-02-10
**Scope:** All files touched during Phases A-M of the development sprint
**Reviewer:** Claude Opus 4.6 (Automated Architecture Review)

---

## Executive Summary

The codebase is architecturally sound overall. The new files follow established patterns well, with proper auth checks, rate limiting, and separation of concerns. However, this review surfaces **7 HIGH**, **12 MEDIUM**, and **9 LOW** severity findings that should be addressed before the next release cycle.

The most critical issues are: dead code left behind from the onboarding refactor, missing input validation on two API routes, a stale dependency array causing an infinite re-render risk, and missing rate limiting on a public GET endpoint.

---

## Findings

### FINDING 1: Dead Code -- NeighborhoodPicker and SubcategoryPicker are orphaned
**Severity:** HIGH | **Category:** Dead Code | **Phase:** G (Onboarding Rewire)

The onboarding flow was rewired from `categories -> subcategories -> neighborhoods` to `categories -> genres`. Two step components are now orphaned with zero imports anywhere in the codebase:

- `/Users/coach/Projects/LostCity/web/app/onboarding/steps/NeighborhoodPicker.tsx` (85 lines)
- `/Users/coach/Projects/LostCity/web/app/onboarding/steps/SubcategoryPicker.tsx` (114 lines)

Neither file is imported by `page.tsx` or any other module. The `OnboardingStep` type in `types.ts:956` was correctly updated to `"categories" | "genres"` and the `OnboardingProgress` component at `OnboardingProgress.tsx:12` correctly references only `["categories", "genres"]`, confirming these components are fully abandoned.

**Recommendation:** Delete both files. They add confusion for future developers.

---

### FINDING 2: Missing input validation on POST /api/onboarding/complete
**Severity:** HIGH | **Category:** Security | **Phase:** G

`/Users/coach/Projects/LostCity/web/app/api/onboarding/complete/route.ts:27-28`

The request body is destructured directly with no validation:

```typescript
const body: OnboardingCompleteRequest = await request.json();
const { selectedCategories, selectedGenres } = body;
```

There is no check that `selectedCategories` is actually an array of strings, or that `selectedGenres` is a record of string arrays. A malicious client could send arbitrary objects that get written directly into `user_preferences.favorite_categories` and `inferred_preferences.signal_value` via the upsert at lines 42-44 and 71-76.

**Specific risks:**
- `selectedCategories` could contain non-string values or thousands of entries (no length cap)
- `selectedGenres` values could contain non-string arrays
- No body size check (unlike the tag vote route which uses `checkBodySize`)

**Recommendation:** Add `checkBodySize()`, validate `selectedCategories` is `string[]` with max length, validate each genre value is a string. Allowlist categories against `PREFERENCE_CATEGORIES`.

---

### FINDING 3: Missing input validation on POST /api/preferences
**Severity:** HIGH | **Category:** Security | **Phase:** H

`/Users/coach/Projects/LostCity/web/app/api/preferences/route.ts:16-26`

The preferences endpoint destructures 8 fields from the request body with no validation of types, lengths, or allowed values:

```typescript
const {
  favorite_categories,
  favorite_neighborhoods,
  favorite_vibes,
  favorite_genres,
  price_preference,
  needs_accessibility,
  needs_dietary,
  needs_family,
} = body;
```

Any of these could be non-arrays, excessively large, or contain values outside the allowed set. The `(supabase as any)` cast at line 31 makes this worse since it bypasses TypeScript's type checking for the upsert.

**Recommendation:** Validate each field type and allowlist values against the constants in `preferences.ts`. Add `checkBodySize()`. Replace `as any` with a properly typed insert.

---

### FINDING 4: Missing rate limiting on GET /api/tags/vote
**Severity:** HIGH | **Category:** Security | **Phase:** M

`/Users/coach/Projects/LostCity/web/app/api/tags/vote/route.ts:188-258`

The `GET` handler is a standard `async function` (not wrapped in `withAuth`), which is correct since it allows unauthenticated access. However, it has **no rate limiting** -- unlike every other API route in the codebase which consistently applies `applyRateLimit()` at the top.

The POST and DELETE handlers apply rate limiting at line 23, but GET does not. This endpoint makes two database queries (tag summary + user votes) and could be abused.

**Recommendation:** Add `applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request))` at the top of the GET handler, matching the pattern used in `/api/genres/route.ts` and `/api/tags/route.ts`.

---

### FINDING 5: `useEffect` with `tagGroups` array default causes re-fetches on every render
**Severity:** HIGH | **Category:** Performance | **Phase:** M

`/Users/coach/Projects/LostCity/web/components/NeedsTagList.tsx:37,69`

```typescript
export function NeedsTagList({
  tagGroups = ["accessibility", "dietary", "family"],  // line 37
}: NeedsTagListProps) {
  // ...
  useEffect(() => {
    // fetch logic
  }, [entityType, entityId, tagGroups]);  // line 69
```

The `tagGroups` default value is a new array literal on every render. Since arrays are compared by reference in the `useEffect` dependency array, this will trigger the fetch effect on **every single render** when the prop is not explicitly passed. This creates an infinite re-fetch loop:

1. Render -> new `tagGroups` array created
2. `useEffect` sees new reference -> fires fetch
3. `setTags` triggers re-render -> go to step 1

**Recommendation:** Hoist the default to a module-level constant:

```typescript
const DEFAULT_TAG_GROUPS = ["accessibility", "dietary", "family"];
// then in the component:
tagGroups = DEFAULT_TAG_GROUPS,
```

---

### FINDING 6: `window.location.origin` used in server-side rendered context
**Severity:** HIGH | **Category:** Runtime Error | **Phase:** K

`/Users/coach/Projects/LostCity/web/app/admin/portals/create/steps/ReviewStep.tsx:70`

```tsx
{window.location.origin}{previewUrl}
```

While this file is marked `"use client"`, the `ReviewStep` is rendered as part of the portal wizard which lives under `/admin/portals/create/`. During SSR or static generation, `window` is undefined and this will throw a `ReferenceError`. Even with `"use client"` directive, Next.js still server-renders the initial HTML.

**Recommendation:** Guard with `typeof window !== "undefined"` or use a `useEffect`-based approach to capture `window.location.origin`.

---

### FINDING 7: `user_preferences` type definition is stale
**Severity:** HIGH | **Category:** Type Safety | **Phase:** G/H

`/Users/coach/Projects/LostCity/web/lib/types.ts:116-149`

The `user_preferences` table type in `types.ts` does **not** include `favorite_genres`, `needs_accessibility`, `needs_dietary`, or `needs_family` -- all of which were added in migrations 165 and 171. The preferences page at `page.tsx:12-17` works around this with a local type extension:

```typescript
type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"] & {
  favorite_genres?: Record<string, string[]> | null;
  needs_accessibility?: string[] | null;
  needs_dietary?: string[] | null;
  needs_family?: string[] | null;
};
```

And the preferences API at `route.ts:31` uses `(supabase as any)` to bypass the missing types entirely.

**Recommendation:** Update the canonical `Database` type in `types.ts` to include the new columns. This eliminates the local type patch in `page.tsx` and the `as any` cast in `route.ts`.

---

### FINDING 8: `eslint-disable` comments suppress legitimate dependency warnings
**Severity:** MEDIUM | **Category:** Code Quality | **Phase:** G

Three `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions exist:

1. `/Users/coach/Projects/LostCity/web/app/onboarding/page.tsx:80` -- `handleGenreComplete` missing `completeOnboarding` from deps
2. `/Users/coach/Projects/LostCity/web/app/onboarding/page.tsx:86` -- `handleGenreSkip` missing `completeOnboarding` from deps
3. `/Users/coach/Projects/LostCity/web/app/onboarding/steps/GenrePicker.tsx:42` -- `fetchGenres` useEffect missing `categoriesToFetch`

For items 1-2, the `completeOnboarding` function is defined with `const` (not `useCallback`) and captures `selectedCategories` via closure, which means `handleGenreComplete`/`handleGenreSkip` could close over stale `selectedCategories`. Since `completeOnboarding` is called immediately after setting the state, the current code likely works due to React's batching, but this is fragile.

For item 3, `categoriesToFetch` is derived from `selectedCategories` which is also a prop -- this means genres will never re-fetch if categories change after initial render. This is probably intentional (categories are set before reaching this step) but should be documented.

**Recommendation:** Wrap `completeOnboarding` in `useCallback` with proper deps, or restructure to pass categories as a parameter rather than relying on closure. Add a comment explaining the intentional behavior in GenrePicker.

---

### FINDING 9: `supabase` in useEffect dependency creates new client on every render
**Severity:** MEDIUM | **Category:** Performance | **Phase:** G

`/Users/coach/Projects/LostCity/web/app/onboarding/page.tsx:28,60`

```typescript
const supabase = createClient();  // line 28
// ...
useEffect(() => {
  async function loadPortal() { /* uses supabase */ }
  loadPortal();
}, [portalSlug, supabase]);  // line 60
```

`createClient()` is called in the render body (not in a `useMemo` or outside the component). If `createClient()` returns a new reference each time, this will cause the portal loading effect to re-fire on every render. This depends on whether `createClient` is memoized internally.

**Recommendation:** Move `createClient()` outside the component or wrap in `useMemo`. Alternatively, remove `supabase` from the dependency array if it is guaranteed to be stable.

---

### FINDING 10: `as any` casts in tag vote route weaken type safety
**Severity:** MEDIUM | **Category:** Type Safety | **Phase:** M

`/Users/coach/Projects/LostCity/web/app/api/tags/vote/route.ts:122,195`

Two instances of `entity_type as any` to satisfy `.includes()`:

```typescript
if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type as any)) {
```

This is a common pattern when comparing a `string` against a `readonly` tuple. However, a better approach preserves type narrowing.

**Recommendation:** Use a type guard function:

```typescript
function isValidEntityType(v: string): v is typeof VALID_ENTITY_TYPES[number] {
  return (VALID_ENTITY_TYPES as readonly string[]).includes(v);
}
```

Also at line 245, `(tagSummary || []) as Array<any>` loses all type information. Define a proper `TagSummaryRow` interface.

---

### FINDING 11: HotelQRCode depends on external third-party API
**Severity:** MEDIUM | **Category:** Architecture / Reliability | **Phase:** J

`/Users/coach/Projects/LostCity/web/app/[portal]/_components/hotel/HotelQRCode.tsx:25`

```typescript
const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?...`;
```

The QR code component uses `api.qrserver.com`, a free third-party service with no SLA. For a hotel concierge product that may be displayed on in-room tablets:

1. No availability guarantee -- the free API could go down or rate-limit
2. The QR code image is loaded client-side, so it requires internet access from the tablet
3. Uses a raw `<img>` tag instead of Next.js `<Image>`, bypassing image optimization
4. No fallback if the service is unavailable

**Recommendation:** Use a local QR code library (e.g., `qrcode` npm package) for server-side or client-side generation. This eliminates the third-party dependency and works offline.

---

### FINDING 12: Portal wizard uses `confirm()` for destructive action
**Severity:** MEDIUM | **Category:** UX / Code Quality | **Phase:** K

`/Users/coach/Projects/LostCity/web/app/admin/portals/create/page.tsx:79`

```typescript
if (confirm("Are you sure you want to cancel? All progress will be lost.")) {
```

The browser `confirm()` dialog is a blocking synchronous call that does not match the application's design system. It is also not available in SSR contexts. The rest of the wizard uses custom styled modals and buttons.

**Recommendation:** Replace with a styled confirmation modal that matches the design system.

---

### FINDING 13: `handleVoteChange` triggers full refetch instead of optimistic update
**Severity:** MEDIUM | **Category:** Performance | **Phase:** M

`/Users/coach/Projects/LostCity/web/components/NeedsTagList.tsx:71-94`

The `handleVoteChange` function calls `refetchTags()` which makes a full API request to reload all tags. The `TagVoteChip` component already maintains optimistic local state (incrementing/decrementing counts). After the chip's local state updates, `NeedsTagList` also refetches, causing a flicker where the count briefly shows the optimistic value then gets replaced by the server value.

Additionally, the `tagSlug` parameter in `handleVoteChange` is accepted but never used -- the function always refetches all tags regardless.

**Recommendation:** Either trust the optimistic updates and skip the refetch, or debounce the refetch with a reasonable delay (e.g., 2 seconds) to batch multiple rapid votes.

---

### FINDING 14: Preferences route uses non-standard auth pattern
**Severity:** MEDIUM | **Category:** Architecture Consistency | **Phase:** H

`/Users/coach/Projects/LostCity/web/app/api/preferences/route.ts:11-14`

The POST handler uses `getUser()` directly:

```typescript
const user = await getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Meanwhile, the tag vote route at `/api/tags/vote/route.ts` uses the `withAuth` middleware wrapper which provides both `user` and `serviceClient`. The onboarding complete route at `/api/onboarding/complete/route.ts:17-25` uses a third pattern: `supabase.auth.getUser()` directly.

Three different auth patterns across closely related routes increases maintenance burden.

**Recommendation:** Standardize on `withAuth` middleware for all authenticated routes. It provides consistent error handling, user extraction, and service client access.

---

### FINDING 15: `PortalDraft` type is defined 3 times
**Severity:** MEDIUM | **Category:** Code Organization | **Phase:** K

The `PortalDraft` type is independently defined in:

1. `/Users/coach/Projects/LostCity/web/app/admin/portals/create/page.tsx:13-36`
2. `/Users/coach/Projects/LostCity/web/app/admin/portals/create/steps/IdentityStep.tsx:5-13` (subset)
3. `/Users/coach/Projects/LostCity/web/app/admin/portals/create/steps/ReviewStep.tsx:14-30` (subset)

Each step component defines its own partial version. Changes to the wizard schema require updating all three files.

**Recommendation:** Extract a shared `PortalDraft` type to a common file (e.g., `web/app/admin/portals/create/types.ts`) and import it in each step.

---

### FINDING 16: Missing `is_all_day` in select query causes false positives in data triage
**Severity:** MEDIUM | **Category:** Bug | **Phase:** B

`/Users/coach/Projects/LostCity/crawlers/scripts/data_quality_triage.py:214-215`

```python
result = client.table("events").select(
    "id,title,start_date,start_time,description,image_url,source_id,category"
).gte("start_date", sixty_days_ago).limit(5000).execute()
```

The query does not include `is_all_day` in the select, but line 228 checks:

```python
if not event.get("start_time") and not event.get("is_all_day"):
```

Since `is_all_day` is never fetched, `event.get("is_all_day")` always returns `None`, causing all-day events to be incorrectly counted as "missing start_time".

**Recommendation:** Add `is_all_day` to the select clause.

---

### FINDING 17: Potential division by zero in data triage
**Severity:** MEDIUM | **Category:** Bug | **Phase:** B

`/Users/coach/Projects/LostCity/crawlers/scripts/data_quality_triage.py:238-241`

```python
print(f"  Missing start_time:   {len(issues['missing_start_time'])} ({len(issues['missing_start_time'])/len(events)*100:.1f}%)")
```

If `len(events)` is 0 (no events in the last 60 days), this produces a `ZeroDivisionError`. The same pattern appears on lines 239-241.

**Recommendation:** Add a guard: `if not events: print("No events found in last 60 days"); return issues`.

---

### FINDING 18: Materialized view refresh not scheduled
**Severity:** MEDIUM | **Category:** Operations | **Phase:** M

`/Users/coach/Projects/LostCity/database/migrations/173_community_needs_tags.sql:197-203`

The migration creates `refresh_entity_tag_summary()` function and adds a comment saying to "Refresh every 5 minutes via cron" (line 207). However, no `pg_cron` job or external scheduler is created in the migration.

Without a refresh schedule, the `entity_tag_summary` materialized view will contain stale data after votes are cast. The GET endpoint at `/api/tags/vote` reads from this view.

**Recommendation:** Add a `pg_cron` job in the migration or a Supabase edge function to call `refresh_entity_tag_summary()` on a schedule. Alternatively, switch to a regular view (with a performance tradeoff) for realtime accuracy.

---

### FINDING 19: `handleLaunch` sets `launching` to false even on error
**Severity:** LOW | **Category:** UX Bug | **Phase:** K

`/Users/coach/Projects/LostCity/web/app/admin/portals/create/steps/ReviewStep.tsx:41-45`

```typescript
const handleLaunch = async () => {
  setLaunching(true);
  await onLaunch();
  setLaunching(false);  // Always runs, even if onLaunch throws
};
```

If `onLaunch()` throws (which it can, per `page.tsx:91`), the parent catches the error and sets an error message, but `ReviewStep` always resets `launching` to false. This is actually correct behavior (the button becomes clickable again). However, the error from the parent's `handleComplete` is caught silently in `ReviewStep` since `onLaunch` does not re-throw after catching.

Looking at `page.tsx:84-110`, `handleComplete` catches errors and sets state but does **not** re-throw, so `ReviewStep.handleLaunch` will always reach `setLaunching(false)`. This is fine but would be clearer with a try/finally.

**Recommendation:** Use try/finally for clarity.

---

### FINDING 20: Venue-only crawlers return (0, 0, 0) which may trigger "zero-event" alerts
**Severity:** LOW | **Category:** Architecture | **Phase:** C

All 5 new crawler files (`barcelona_wine_bar.py`, `clermont_lounge.py`, `sweetwater_brewery.py`, `two_urban_licks.py`, `village_corner.py`) follow the destination-first pattern and return `(0, 0, 0)`.

This is correct per CLAUDE.md -- "We capture DESTINATIONS, not just events." However, the data quality triage script at `data_quality_triage.py:116-124` flags sources with zero events as problematic:

```python
zero_event = [s for s in health_report if s["is_active"] and s["total_runs"] >= 3 and s["total_events"] == 0]
```

These venue-only crawlers will appear as "zero-event sources" in every triage report, creating noise.

**Recommendation:** Either add a `source_type` filter in the triage script to exclude venue-only crawlers, or mark them as `crawl_frequency: "once"` in the sources table so they only run once and do not appear in recurring health reports.

---

### FINDING 21: Hardcoded output path in data quality triage
**Severity:** LOW | **Category:** Code Quality | **Phase:** B

`/Users/coach/Projects/LostCity/crawlers/scripts/data_quality_triage.py:406`

```python
output_file = f"/Users/coach/Projects/LostCity/crawlers/reports/data_quality_triage_{...}.md"
```

This hardcodes an absolute path specific to one developer's machine. If another contributor or CI pipeline runs this, it will fail if the directory does not exist.

**Recommendation:** Use a relative path from the script location, or derive from `__file__`.

---

### FINDING 22: GenrePicker fetches genres but never re-fetches when categories change
**Severity:** LOW | **Category:** Behavior | **Phase:** G

`/Users/coach/Projects/LostCity/web/app/onboarding/steps/GenrePicker.tsx:29-43`

The `useEffect` for fetching genres has an empty dependency array (`[]`), meaning it only runs once on mount. The `categoriesToFetch` is derived from `selectedCategories` prop, which is set before this component mounts. This works in the current flow (categories are selected on the previous step) but would break if the wizard ever allowed going back to change categories and then returning to genres.

**Recommendation:** Add a comment documenting this is intentional. If back-navigation is ever added, add `categoriesToFetch` to the dependency array.

---

### FINDING 23: onboarding layout metadata references "neighborhoods" (stale copy)
**Severity:** LOW | **Category:** Dead Code | **Phase:** G

`/Users/coach/Projects/LostCity/web/app/onboarding/layout.tsx:6`

```typescript
description: "Personalize your Lost City experience - choose your favorite categories, neighborhoods, and organizers.",
```

The description mentions "neighborhoods" which is no longer part of the onboarding flow (removed in Phase G). This shows in search results and browser tab metadata.

**Recommendation:** Update to "choose your favorite categories and genres."

---

### FINDING 24: `PREFERENCE_SUBCATEGORIES` is exported but unused by any consumer
**Severity:** LOW | **Category:** Dead Code | **Phase:** G

`/Users/coach/Projects/LostCity/web/lib/preferences.ts:22-75`

`PREFERENCE_SUBCATEGORIES` and `CATEGORIES_WITH_SUBCATEGORIES` are defined and exported but only consumed by the now-orphaned `SubcategoryPicker.tsx`. After deleting that component, these exports become dead code.

**Recommendation:** Remove after deleting `SubcategoryPicker.tsx`, or keep if there is a future plan to use subcategories elsewhere.

---

### FINDING 25: No test coverage for new API routes
**Severity:** LOW | **Category:** Testing | **Phase:** G/H/M

The events API has proper test coverage at `__tests__/route.test.ts` (378 lines, Phase L). However, the following new API routes have zero test coverage:

- `POST /api/onboarding/complete` (Phase G)
- `GET/POST /api/preferences` (Phase H)
- `GET/POST/DELETE /api/tags/vote` (Phase M)
- `GET /api/genres` (Phase G)

The tag vote route in particular has complex validation logic and three HTTP methods -- it would benefit most from testing.

**Recommendation:** Prioritize tests for `/api/tags/vote` (highest complexity), then `/api/onboarding/complete` (input validation gaps), then `/api/preferences`.

---

### FINDING 26: Migration 173 assumes `entity_type` column exists on `tag_definitions`
**Severity:** LOW | **Category:** Migration Safety | **Phase:** M

`/Users/coach/Projects/LostCity/database/migrations/173_community_needs_tags.sql:13-15`

```sql
UPDATE tag_definitions
SET entity_types = ARRAY[entity_type]::TEXT[]
WHERE entity_types = ARRAY['venue']::TEXT[];
```

This assumes a column `entity_type` (singular) already exists on `tag_definitions`. If the table was freshly created (e.g., in a new environment), this column may not exist and the update would fail.

**Recommendation:** Add `IF EXISTS` guards or make the migration idempotent with a PL/pgSQL check.

---

### FINDING 27: Vertical template `visual_preset` references may not exist
**Severity:** LOW | **Category:** Type Safety | **Phase:** K

`/Users/coach/Projects/LostCity/web/lib/vertical-templates.ts:106,163,220`

Templates reference presets like `"cosmic_dark"` and `"vibrant_community"`. These string literals are typed as `VisualPresetId` (imported from `visual-presets.ts`), so TypeScript will catch invalid values at build time. However, the `IdentityStep` at line 99 checks for preset names like `"corporate_clean"`, `"family_friendly"`, and `"minimal_modern"` to determine light/dark mode. If those presets are renamed or removed, the logic silently falls through to dark mode.

**Recommendation:** Add a `theme_mode` property to `VisualPresetId` configuration rather than hardcoding preset-to-theme mapping in the wizard step.

---

## Summary Table

| # | Severity | Category | File | Finding |
|---|----------|----------|------|---------|
| 1 | HIGH | Dead Code | `onboarding/steps/NeighborhoodPicker.tsx`, `SubcategoryPicker.tsx` | Orphaned after Phase G rewire |
| 2 | HIGH | Security | `api/onboarding/complete/route.ts` | No input validation on POST body |
| 3 | HIGH | Security | `api/preferences/route.ts` | No input validation on POST body |
| 4 | HIGH | Security | `api/tags/vote/route.ts` | Missing rate limiting on GET |
| 5 | HIGH | Performance | `components/NeedsTagList.tsx` | Default array in props causes infinite re-fetch |
| 6 | HIGH | Runtime Error | `portals/create/steps/ReviewStep.tsx` | `window.location.origin` during SSR |
| 7 | HIGH | Type Safety | `lib/types.ts` | `user_preferences` missing 4 columns |
| 8 | MEDIUM | Code Quality | `onboarding/page.tsx`, `GenrePicker.tsx` | `eslint-disable` masking real dep issues |
| 9 | MEDIUM | Performance | `onboarding/page.tsx` | `supabase` in useEffect deps |
| 10 | MEDIUM | Type Safety | `api/tags/vote/route.ts` | `as any` casts weaken type narrowing |
| 11 | MEDIUM | Architecture | `hotel/HotelQRCode.tsx` | External API dependency for hotel product |
| 12 | MEDIUM | UX | `portals/create/page.tsx` | `confirm()` dialog breaks design system |
| 13 | MEDIUM | Performance | `components/NeedsTagList.tsx` | Refetch after optimistic update |
| 14 | MEDIUM | Consistency | `api/preferences/route.ts` | Non-standard auth pattern |
| 15 | MEDIUM | Organization | `portals/create/` (3 files) | `PortalDraft` type defined 3 times |
| 16 | MEDIUM | Bug | `scripts/data_quality_triage.py` | `is_all_day` not in select |
| 17 | MEDIUM | Bug | `scripts/data_quality_triage.py` | Division by zero when no events |
| 18 | MEDIUM | Operations | Migration 173 | Materialized view refresh not scheduled |
| 19 | LOW | UX | `portals/create/steps/ReviewStep.tsx` | try/finally clarity |
| 20 | LOW | Architecture | New crawler files | (0,0,0) return triggers false alerts |
| 21 | LOW | Code Quality | `scripts/data_quality_triage.py` | Hardcoded absolute path |
| 22 | LOW | Behavior | `onboarding/steps/GenrePicker.tsx` | Empty dep array on genre fetch |
| 23 | LOW | Dead Code | `onboarding/layout.tsx` | Stale metadata description |
| 24 | LOW | Dead Code | `lib/preferences.ts` | `PREFERENCE_SUBCATEGORIES` unused |
| 25 | LOW | Testing | Multiple API routes | No test coverage for new routes |
| 26 | LOW | Migration | Migration 173 | Assumes `entity_type` column exists |
| 27 | LOW | Type Safety | `lib/vertical-templates.ts` | Hardcoded preset-to-theme mapping |

---

## Architecture Observations (Non-Issues)

These patterns were reviewed and found to be acceptable:

1. **Admin portal wizard auth** -- Protected by the admin layout at `/Users/coach/Projects/LostCity/web/app/admin/layout.tsx` which checks `is_admin` before rendering any child routes. No additional auth needed in the wizard itself.

2. **Tag vote route uses `withAuth` for POST/DELETE but not GET** -- This is correct. GET allows anonymous users to see tag counts while requiring auth only for mutations.

3. **`as never` casts on Supabase upserts** -- This is the established pattern in the codebase per CLAUDE.md for working around Supabase type inference limitations. Acceptable.

4. **Crawlers returning (0, 0, 0)** -- Per CLAUDE.md: "We capture DESTINATIONS, not just events." Venue-only crawlers that ensure venue records exist are architecturally correct.

5. **Migration 173 data migration from `venue_tag_votes` to `entity_tag_votes`** -- Properly uses `ON CONFLICT DO NOTHING` and wraps in existence checks. Safe for re-runs.

6. **Cache headers on API responses** -- Consistently applied with appropriate `s-maxage` values. The preferences route correctly uses `private` caching.

7. **Vertical templates lib** -- Clean separation of configuration from UI. Proper TypeScript typing with `VerticalId` union type.

---

## Recommended Priority Order

**This week (Critical):**
1. Fix Finding 5 (infinite re-fetch in NeedsTagList) -- quick one-line fix
2. Fix Finding 4 (missing rate limiting on GET /api/tags/vote) -- quick addition
3. Fix Finding 6 (window.location.origin SSR error) -- guard or useEffect
4. Delete orphaned files (Finding 1)

**Next sprint:**
5. Add input validation to onboarding/complete and preferences routes (Findings 2, 3)
6. Update `types.ts` with missing columns (Finding 7)
7. Fix data_quality_triage.py bugs (Findings 16, 17, 21)
8. Schedule materialized view refresh (Finding 18)
9. Standardize auth patterns (Finding 14)
10. Add test coverage for new API routes (Finding 25)

**When convenient:**
11. Extract shared `PortalDraft` type (Finding 15)
12. Replace `confirm()` with styled modal (Finding 12)
13. Swap HotelQRCode to local library (Finding 11)
14. Clean up eslint-disable comments (Finding 8)
15. Remove dead subcategory exports (Finding 24)
