# Full Visual Verification Report

**Date:** 2026-04-15
**Viewport:** Desktop 1440px (mobile resize unavailable)
**Pages tested:** Event detail (canonical), Place detail (overlay), Series detail (canonical)

---

## Event Detail — Canonical Page (`/atlanta/events/179139`)

**Event:** Into the Burrow: A Peter Rabbit Tale (Alliance Theatre)

### Correct
- Hero image with top-darkening gradient overlay ✓
- Back button (NeonBackButton) ✓
- Title at ~26px bold cream ✓
- Three separate metadata rows: venue (coral MapPin), date (muted CalendarBlank), price (muted Ticket) ✓
- Pill-shaped CTA with Ticket icon + "Get Tickets" ✓
- RSVP circle button in CTA row ✓
- Secondary action buttons (save, invite, calendar, share) ✓
- ABOUT section with mono header + Phosphor article icon ✓
- SHOW INFO section with time grid ✓
- CONNECTIONS section with Phosphor icons (MapPin, Repeat) in twilight icon boxes ✓
- Connection rows: --night bg, no border, ArrowRight icons ✓
- GETTING THERE section with address in card wrapper ✓
- 8px --night divider bands between sections ✓
- No orphaned section headers ✓
- No genre pills in identity zone ✓

### Issues Found
- None critical or major.

### Minor
- Hero fallback (no-image events) shows very faint category icon — needs manual check at mobile width.

---

## Place Detail — Overlay (`/atlanta/spots/alliance-theatre`)

**Venue:** Alliance Theatre (type: theater → musicVenue manifest)

### Correct
- Hero image with gradient ✓
- Type badge ("THEATER") ✓
- Title bold cream ✓
- Neighborhood + price metadata ✓
- Quick actions grid (Website, Instagram, Call, Directions) ✓
- Instagram icon (fixed from MapPin) ✓
- "Visit Website" outlined CTA (no reservation URL = outlined variant) ✓
- UPCOMING EVENTS section leading content (musicVenue manifest: eventsAtVenue first) ✓
- Date pill strip with event counts ✓
- Event list with titles, times, prices ✓
- No orphaned section headers ✓
- Section divider bands visible ✓

### Issues Found
- None critical or major.

### Minor
- Only one section rendered (Upcoming Events) — venue has limited data. The thin-state fallback wasn't triggered because 1 section >= the threshold (which checks for <3 sections and tries to inject nearby/connections). Need to verify whether the fallback injection worked — it may have found no nearby data.

---

## Series Detail — Canonical Page (`/atlanta/series/into-the-burrow-a-peter-rabbit-tale-1`)

### CRITICAL FINDING

**The canonical series page route (`/app/[portal]/series/[slug]/page.tsx`) does NOT use the new orchestrator architecture.** It's a server-rendered page that imports OLD components:
- `DetailHero` from `detail/index.ts` (old, not `core/DetailHero`)
- `InfoCard`, `MetadataGrid`, `SectionHeader`, `RelatedSection`, `RelatedCard` (all old)
- `DetailStickyBar` (old)

The new `SeriesDetailView.tsx` orchestrator (which uses DetailLayout + section pipeline) is only loaded via the **overlay path** (`?series=slug` query param through DetailOverlayRouter).

**Impact:** Any user arriving at a series page via a direct URL (SEO, shared link, search result) sees the OLD layout with old components. The new architecture only applies when navigating via overlay from the feed.

**Same issue affects:**
- `/app/[portal]/festivals/[slug]/page.tsx` — uses old components
- `/app/[portal]/exhibitions/[slug]/page.tsx` — uses old components  
- `/app/[portal]/artists/[slug]/page.tsx` — uses old components
- `/app/[portal]/programs/[slug]/page.tsx` — uses old components
- `/app/[portal]/showtimes/[slug]/page.tsx` — uses old components

**Only Event detail has a canonical page that uses the new architecture** (`/app/[portal]/events/[id]/page.tsx` passes `initialData` to `EventDetailView` which IS the new orchestrator).

**Place detail has NO canonical page route** — it's overlay-only (`?spot=slug`), so the new architecture applies for all place views.

---

## Summary

| Page Type | Overlay (new arch) | Canonical (page route) | Status |
|-----------|-------------------|----------------------|--------|
| Event | ✓ New orchestrator | ✓ New orchestrator | **Done** |
| Place | ✓ New orchestrator | N/A (overlay only) | **Done** |
| Series | ✓ New orchestrator | ✗ OLD components | **Gap** |
| Festival | ✓ New orchestrator | ✗ OLD components | **Gap** |
| Org | ✓ New orchestrator | ✗ OLD components | **Gap** |

**The rearchitecture is complete for the overlay path.** For canonical page routes (direct URLs), only Event is migrated. Series, Festival, and Org canonical pages still use old components and need separate migration.

---

## Recommendation

The canonical page routes are server-rendered RSCs with SEO metadata, JSON-LD, caching, and breadcrumbs — functionality the overlay orchestrators don't have. Migrating them requires either:

**A)** Refactoring the canonical pages to render the new orchestrators as client components within the RSC shell (keeping SEO + SSR data fetching in the page, delegating rendering to the orchestrator)

**B)** Keeping the canonical pages as-is and accepting the visual divergence until a future pass

For ATLFF: most users will navigate via the feed (overlay path), so the new architecture covers the primary flow. Direct URL hits to series/festival pages will show the old design — which works but doesn't match the Pencil specs.
