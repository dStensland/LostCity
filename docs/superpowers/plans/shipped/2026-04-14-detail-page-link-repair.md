# Detail Page Link Repair — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken venue links, stale PostgREST joins, and non-canonical event leakage across detail pages — making the detail page ecosystem actually navigable.

**Architecture:** The `venues → places` table rename was only partially propagated. Three classes of breakage: (1) PostgREST embedded joins still reference `venues` (returns null venue data), (2) URL patterns reference `/venues/` or `/places/` routes that don't exist (only `/spots/` does), (3) `?venue=` query params are unrecognized by the overlay router (only `?spot=` works). Additionally, non-canonical events render full detail pages without redirect.

**Tech Stack:** Next.js 16, Supabase PostgREST, TypeScript

---

## File Map

| File | Change | Priority |
|------|--------|----------|
| `web/app/api/events/[id]/route.ts` | Fix `venue_id` → `place_id` in type + guard | P0 |
| `web/lib/series.ts` | Fix `venues (` → `places (` in PostgREST join | P0 |
| `web/lib/artists.ts` | Fix `venues (` → `places (` in PostgREST join | P0 |
| `web/app/api/exhibitions/[slug]/route.ts` | Remove stale `venue_id` from select | P0 |
| `web/app/[portal]/programs/[slug]/page.tsx` | Remove stale `venue_id` from select; fix `?venue=` → `?spot=` | P1 |
| `web/app/[portal]/exhibitions/[slug]/page.tsx` | Fix `/venues/` → `/spots/` | P1 |
| `web/components/best-of/BestOfPlaceCard.tsx` | Fix `/venues/` → `/spots/` | P1 |
| `web/components/profile/ProfileView.tsx` | Fix `/venues/` → `/spots/` | P1 |
| `web/app/[portal]/volunteer/[id]/page.tsx` | Fix `?venue=` → `?spot=` (2 locations) | P1 |
| `web/app/[portal]/meetings/[id]/page.tsx` | Fix `?venue=` → `?spot=` | P1 |
| `web/components/find/classes/ClassStudioSchedule.tsx` | Fix `/places/` → `/spots/` | P1 |
| `web/components/find/shows/VenueShowsCard.tsx` | Fix `/places/` → `/spots/` | P1 |
| `web/components/feed/sections/HangFeedSection.tsx` | Fix dead `/venues/${id}` fallback | P1 |
| `web/components/community/CommunityHub.tsx` | Fix dead `/venues/${id}` fallback | P1 |
| `web/app/groups/[id]/page.tsx` | Fix dead `/venues/${id}` fallback | P1 |
| `web/components/hangs/ActiveHangBanner.tsx` | Fix dead `/venues/${id}` fallback | P1 |
| `web/components/profile/ProfilePlaces.tsx` | Add portal prefix to `/spots/` links | P1 |
| `web/components/profile/ProfileActivity.tsx` | Add portal prefix to `/spots/` and `/events/` links | P1 |
| `web/lib/supabase.ts` | Add canonical redirect for non-canonical events | P2 |
| `web/app/[portal]/events/[id]/page.tsx` | Redirect non-canonical events to canonical | P2 |
| `web/components/ShareEventButton.tsx` | Share canonical URL, not overlay URL | P2 |

---

### Task 1: Fix PostgREST `venues` → `places` joins (P0 — silent data failures)

**Files:**
- Modify: `web/lib/series.ts:115`
- Modify: `web/lib/artists.ts:213`

These PostgREST embedded resource joins reference the old `venues` table name. PostgREST resolves table names at query time — since `venues` no longer exists, the join silently returns null. Series detail pages show showtimes with no venue. Artist pages show zero events.

- [ ] **Step 1: Fix series.ts PostgREST join**

In `web/lib/series.ts`, change the embedded resource name from `venues` to `places`:

```typescript
// Line 115 — old:
      venues (
        id,
        name,
        slug,
        neighborhood
      )

// new:
      places (
        id,
        name,
        slug,
        neighborhood
      )
```

Also update the mapping at line 144 that references `event.venues`:

```typescript
// Line 144 — old:
    venue: event.venues,

// new:
    venue: event.places,
```

And the `RawSeriesEvent` type at line 13 — rename the `venues` property:

```typescript
// Line 13 — old:
  venues: {

// new:
  places: {
```

- [ ] **Step 2: Fix artists.ts PostgREST join**

In `web/lib/artists.ts`, change the nested embedded resource from `venues` to `places`:

```typescript
// Line 213 — old:
        venues (
          id, name, slug, neighborhood
        )

// new:
        places (
          id, name, slug, neighborhood
        )
```

Check the `RawArtistEvent` type (should be near the top of the file) and update the nested type if it references `venues`. Also update any mapping code that reads from `events.venues` to `events.places`.

- [ ] **Step 3: Run tsc to verify no type errors**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors related to `venues` or `places` in series.ts/artists.ts.

- [ ] **Step 4: Commit**

```bash
git add web/lib/series.ts web/lib/artists.ts
git commit -m "fix: update PostgREST joins from venues to places in series.ts and artists.ts

Series detail pages were showing showtimes with no venue name because
the PostgREST embedded resource join referenced the old 'venues' table.
Artist pages showed zero events for the same reason."
```

---

### Task 2: Fix event API `venue_id` → `place_id` (P0 — "More at this venue" always empty)

**Files:**
- Modify: `web/app/api/events/[id]/route.ts:57,105`

The `EventDataShape` type uses `venue_id` but the column was renamed to `place_id`. The guard at line 105 checks `eventData.venue_id` which is always undefined, so `fetchVenueEvents` always returns `[]`.

- [ ] **Step 1: Fix the type and guard**

In `web/app/api/events/[id]/route.ts`:

```typescript
// Line 57 — old:
  venue_id?: number;

// new:
  place_id?: number;
```

```typescript
// Line 105 — old:
  if (!eventData.venue_id) return [];

// new:
  if (!eventData.place_id) return [];
```

```typescript
// Line 115 — old:
    .eq("place_id", eventData.venue_id)

// new:
    .eq("place_id", eventData.place_id)
```

- [ ] **Step 2: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep -i "route.ts" | head -10`
Expected: No errors in `events/[id]/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/events/[id]/route.ts
git commit -m "fix: update venue_id to place_id in event detail API

The EventDataShape type and fetchVenueEvents guard referenced the old
venue_id column name. After the places rename, this was always undefined,
causing the 'More at this venue' section to be empty on every event page."
```

---

### Task 3: Remove stale `venue_id` selects from exhibitions and programs (P0)

**Files:**
- Modify: `web/app/api/exhibitions/[slug]/route.ts:33`
- Modify: `web/app/[portal]/programs/[slug]/page.tsx:68`

Both files select `venue_id` in their Supabase queries, but the column was renamed to `place_id`. The join (`venue:places(...)`) already works correctly — only the bare column select is stale.

- [ ] **Step 1: Fix exhibitions API route**

In `web/app/api/exhibitions/[slug]/route.ts`, remove `venue_id` from the select string (line 33). The venue data is already fetched via the `venue:places(...)` join at line 51:

```typescript
// Line 33 — old:
        venue_id,

// new:
        place_id,
```

- [ ] **Step 2: Fix programs page**

In `web/app/[portal]/programs/[slug]/page.tsx`, remove `venue_id` from the select string (line 68). The venue data is already fetched via the `venue:places(...)` join at line 95:

```typescript
// Line 68 — old:
      venue_id,

// new:
      place_id,
```

- [ ] **Step 3: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: Clean or no new errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/exhibitions/[slug]/route.ts web/app/[portal]/programs/[slug]/page.tsx
git commit -m "fix: update stale venue_id column selects to place_id

Exhibitions API and programs page were selecting the old venue_id column.
The join alias venue:places(...) already resolves correctly — this fixes
the bare column reference."
```

---

### Task 4: Fix all `/venues/` route links → `/spots/` (P1 — 404s)

**Files:**
- Modify: `web/app/[portal]/exhibitions/[slug]/page.tsx:467`
- Modify: `web/components/best-of/BestOfPlaceCard.tsx:46`
- Modify: `web/components/profile/ProfileView.tsx:69`

These three files link to `/{portal}/venues/{slug}` which has no detail route — only `/{portal}/spots/{slug}` exists.

- [ ] **Step 1: Fix exhibition detail page**

In `web/app/[portal]/exhibitions/[slug]/page.tsx`:

```typescript
// Line 467 — old:
                    href={`/${activePortalSlug}/venues/${venue.slug}`}

// new:
                    href={`/${activePortalSlug}/spots/${venue.slug}`}
```

- [ ] **Step 2: Fix BestOfPlaceCard**

In `web/components/best-of/BestOfPlaceCard.tsx`:

```typescript
// Line 46 — old:
      router.push(`/${portalSlug}/venues/${venue.slug}`);

// new:
      router.push(`/${portalSlug}/spots/${venue.slug}`);
```

- [ ] **Step 3: Fix ProfileView SpotCard**

In `web/components/profile/ProfileView.tsx`:

```typescript
// Line 69 — old:
  const href = slug ? `/${portalSlug}/venues/${slug}` : null;

// new:
  const href = slug ? `/${portalSlug}/spots/${slug}` : null;
```

- [ ] **Step 4: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -10`
Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add web/app/[portal]/exhibitions/[slug]/page.tsx web/components/best-of/BestOfPlaceCard.tsx web/components/profile/ProfileView.tsx
git commit -m "fix: change /venues/ links to /spots/ — exhibitions, best-of, profile

These three files linked to /{portal}/venues/{slug} which has no detail
route. The correct venue detail route is /{portal}/spots/{slug}."
```

---

### Task 5: Fix all `/places/` route links → `/spots/` (P1 — 404s)

**Files:**
- Modify: `web/components/find/classes/ClassStudioSchedule.tsx:162`
- Modify: `web/components/find/shows/VenueShowsCard.tsx:39`

These link to `/{portal}/places/{slug}` which has no route.

- [ ] **Step 1: Fix ClassStudioSchedule**

In `web/components/find/classes/ClassStudioSchedule.tsx`:

```typescript
// Line 162 — old:
                href={`/${portalSlug}/places/${studioSlug}`}

// new:
                href={`/${portalSlug}/spots/${studioSlug}`}
```

- [ ] **Step 2: Fix VenueShowsCard**

In `web/components/find/shows/VenueShowsCard.tsx`:

```typescript
// Line 39 — old:
  const venueHref = `/${portalSlug}/places/${venue.slug}`;

// new:
  const venueHref = `/${portalSlug}/spots/${venue.slug}`;
```

- [ ] **Step 3: Commit**

```bash
git add web/components/find/classes/ClassStudioSchedule.tsx web/components/find/shows/VenueShowsCard.tsx
git commit -m "fix: change /places/ links to /spots/ — classes and venue shows

ClassStudioSchedule and VenueShowsCard linked to /{portal}/places/{slug}
which doesn't exist. The correct route is /{portal}/spots/{slug}."
```

---

### Task 6: Fix all `?venue=` overlay params → `?spot=` (P1 — silent no-ops)

**Files:**
- Modify: `web/app/[portal]/programs/[slug]/page.tsx:429`
- Modify: `web/app/[portal]/volunteer/[id]/page.tsx:300,466`
- Modify: `web/app/[portal]/meetings/[id]/page.tsx:214`

The detail overlay router (`detail-entry-contract.ts`) only recognizes `?spot=`, not `?venue=`. These links navigate to the feed with no overlay triggered.

- [ ] **Step 1: Fix programs page**

In `web/app/[portal]/programs/[slug]/page.tsx`:

```typescript
// Line 429 — old:
                      href={`/${activePortalSlug}?venue=${program.venue.slug}`}

// new:
                      href={`/${activePortalSlug}?spot=${program.venue.slug}`}
```

- [ ] **Step 2: Fix volunteer page (two locations)**

In `web/app/[portal]/volunteer/[id]/page.tsx`:

```typescript
// Line 300 — old:
                  href={`/${activePortalSlug}?venue=${venue.slug}`}

// new:
                  href={`/${activePortalSlug}?spot=${venue.slug}`}
```

```typescript
// Line 466 — old:
              href={`/${activePortalSlug}?venue=${venue.slug}`}

// new:
              href={`/${activePortalSlug}?spot=${venue.slug}`}
```

- [ ] **Step 3: Fix meetings page**

In `web/app/[portal]/meetings/[id]/page.tsx`:

```typescript
// Line 214 — old:
              href={`/${portalSlug}?venue=${event.venue.slug}`}

// new:
              href={`/${portalSlug}?spot=${event.venue.slug}`}
```

- [ ] **Step 4: Commit**

```bash
git add web/app/[portal]/programs/[slug]/page.tsx web/app/[portal]/volunteer/[id]/page.tsx web/app/[portal]/meetings/[id]/page.tsx
git commit -m "fix: change ?venue= overlay params to ?spot= — programs, volunteer, meetings

The detail overlay router only recognizes ?spot=, not ?venue=. These
venue links silently did nothing when clicked."
```

---

### Task 7: Fix dead `/venues/${id}` fallbacks in hang/community components (P1)

**Files:**
- Modify: `web/components/feed/sections/HangFeedSection.tsx:28-29`
- Modify: `web/components/community/CommunityHub.tsx:43-44`
- Modify: `web/app/groups/[id]/page.tsx:53-54`
- Modify: `web/components/hangs/ActiveHangBanner.tsx:129`

All four files have a `venueHref` helper: `slug ? /spots/${slug} : /venues/${id}`. The fallback path is dead — no `/venues/[id]` route exists. When a venue has no slug, the link 404s.

- [ ] **Step 1: Fix HangFeedSection**

In `web/components/feed/sections/HangFeedSection.tsx`:

```typescript
// Line 28-29 — old:
function venueHref(slug: string | null, id: number): string {
  return slug ? `/spots/${slug}` : `/venues/${id}`;
}

// new:
function venueHref(slug: string | null): string | null {
  return slug ? `/spots/${slug}` : null;
}
```

Update all call sites in this file to handle null return (wrap venue name in a `<span>` instead of `<Link>` when null). Search the file for `venueHref(` calls and update the arguments — remove the `id` argument.

- [ ] **Step 2: Fix CommunityHub**

In `web/components/community/CommunityHub.tsx`:

```typescript
// Line 43-44 — old:
function venueHref(slug: string | null, id: number): string {
  return slug ? `/spots/${slug}` : `/venues/${id}`;
}

// new:
function venueHref(slug: string | null): string | null {
  return slug ? `/spots/${slug}` : null;
}
```

Update call sites similarly.

- [ ] **Step 3: Fix groups page**

In `web/app/groups/[id]/page.tsx`:

```typescript
// Line 53-54 — old:
function venueHref(slug: string | null, id: number): string {
  return slug ? `/spots/${slug}` : `/venues/${id}`;
}

// new:
function venueHref(slug: string | null): string | null {
  return slug ? `/spots/${slug}` : null;
}
```

Update call sites similarly.

- [ ] **Step 4: Fix ActiveHangBanner**

In `web/components/hangs/ActiveHangBanner.tsx`:

```typescript
// Line 129 — old:
  const venueHref = hang.venue.slug ? `/spots/${hang.venue.slug}` : `/venues/${hang.venue.id}`;

// new:
  const venueHref = hang.venue.slug ? `/spots/${hang.venue.slug}` : null;
```

Where `venueHref` is used in a `<Link>`, conditionally render a `<span>` when null.

- [ ] **Step 5: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`
Expected: Clean or only pre-existing errors.

- [ ] **Step 6: Commit**

```bash
git add web/components/feed/sections/HangFeedSection.tsx web/components/community/CommunityHub.tsx web/app/groups/[id]/page.tsx web/components/hangs/ActiveHangBanner.tsx
git commit -m "fix: remove dead /venues/\${id} fallback from hang and community components

When a venue has no slug, these components linked to /venues/{id} which
has no route. Now they render the venue name as plain text instead of
a dead link."
```

---

### Task 8: Add portal prefix to profile venue and event links (P1)

**Files:**
- Modify: `web/components/profile/ProfilePlaces.tsx:64`
- Modify: `web/components/profile/ProfileActivity.tsx:106,111,127`

These components link to `/spots/{slug}` and `/events/{id}` without a portal prefix. The root-level redirects work but always send to the Atlanta portal regardless of context.

- [ ] **Step 1: Check how ProfilePlaces gets its data**

Read the component to understand where `portalSlug` can come from. If there's already a `portalSlug` prop or a `usePortal()` hook available, use it. If not, check if the parent component passes one.

- [ ] **Step 2: Fix ProfilePlaces**

In `web/components/profile/ProfilePlaces.tsx`, add portal context. The component likely needs a `portalSlug` prop or a `usePortal()` hook import:

```typescript
// Line 64 — old:
          href={`/spots/${venue.slug}`}

// new:
          href={`/${portalSlug}/spots/${venue.slug}`}
```

- [ ] **Step 3: Fix ProfileActivity**

In `web/components/profile/ProfileActivity.tsx`, add portal context:

```typescript
// Line 106 — old:
              <Link href={`/events/${activity.event.id}`}

// new:
              <Link href={`/${portalSlug}/events/${activity.event.id}`}
```

```typescript
// Line 111 — old:
              <Link href={`/spots/${activity.venue.slug}`}

// new:
              <Link href={`/${portalSlug}/spots/${activity.venue.slug}`}
```

```typescript
// Line 127 — old:
              <Link href={`/spots/${activity.venue.slug}`}

// new:
              <Link href={`/${portalSlug}/spots/${activity.venue.slug}`}
```

- [ ] **Step 4: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add web/components/profile/ProfilePlaces.tsx web/components/profile/ProfileActivity.tsx
git commit -m "fix: add portal prefix to profile venue and event links

Profile links to /spots/{slug} and /events/{id} without portal prefix
always redirected to Atlanta portal. Now uses portal context to generate
correct portal-aware URLs."
```

---

### Task 9: Redirect non-canonical events to canonical (P2)

**Files:**
- Modify: `web/app/[portal]/events/[id]/page.tsx` (~line 27-29)
- Modify: `web/lib/supabase.ts:161-189`

Non-canonical (duplicate) events render full detail pages. They should redirect to the canonical event.

- [ ] **Step 1: Add canonical redirect in the page component**

In `web/app/[portal]/events/[id]/page.tsx`, after fetching the event, check for `canonical_event_id` and redirect:

```typescript
// After line 28 (const event = await getCachedEventById(...))
// Add inside the page component, after getting the event and before rendering:

import { redirect } from "next/navigation";

// In the page function, after fetching event:
if (event && event.canonical_event_id && event.canonical_event_id !== event.id) {
  const request = await resolveDetailPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/events/${id}`,
  });
  redirect(`/${request.activePortalSlug}/events/${event.canonical_event_id}`);
}
```

Note: `redirect` is already imported from `next/navigation` at line 4 (`notFound`). Add `redirect` to that import.

- [ ] **Step 2: Run tsc to verify**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/app/[portal]/events/[id]/page.tsx
git commit -m "fix: redirect non-canonical events to their canonical version

Non-canonical (duplicate) events were rendering full detail pages with
potentially worse data. Now they 308 redirect to the canonical event.
Protects against stale bookmarks and Google-indexed duplicate pages."
```

---

### Task 10: Fix ShareEventButton to use canonical URL (P2)

**Files:**
- Modify: `web/components/ShareEventButton.tsx:52`

The share button generates `/{portal}?event={id}` (overlay URL) instead of `/{portal}/events/{id}` (canonical, SSR, OG tags). Shared links open as feed overlays with no metadata.

- [ ] **Step 1: Fix share URL**

In `web/components/ShareEventButton.tsx`:

```typescript
// Line 52 — old:
    const url = `${window.location.origin}/${portalSlug}?event=${eventId}`;

// new:
    const url = `${window.location.origin}/${portalSlug}/events/${eventId}`;
```

- [ ] **Step 2: Commit**

```bash
git add web/components/ShareEventButton.tsx
git commit -m "fix: share canonical event URL instead of overlay URL

Shared event links used the ?event= overlay pattern which has no SSR,
OG tags, or JSON-LD. Now shares the canonical /events/{id} URL which
renders a full page with proper social metadata."
```

---

### Task 11: Final verification

- [ ] **Step 1: Full tsc check**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean build (or only pre-existing errors unrelated to this work).

- [ ] **Step 2: Grep for any remaining `/venues/` link patterns**

Run: `grep -rn "'/venues/" web/components/ web/app/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test." | grep -v "api/venues"`

Expected: No results (all `/venues/` navigation links should be gone). API routes like `/api/venues/` are fine — those are server endpoints, not navigation.

- [ ] **Step 3: Grep for any remaining `?venue=` navigation patterns**

Run: `grep -rn "?venue=" web/app/ web/components/ --include="*.tsx" --include="*.ts" | grep -v ".test."`

Expected: No results.

- [ ] **Step 4: Grep for any remaining `/places/` navigation patterns**

Run: `grep -rn "'/places/" web/components/ web/app/ --include="*.tsx" | grep -v "api/places"`

Expected: No results for navigation links (API calls to `/api/places/` are fine).
