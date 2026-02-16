# BP-5 Build Map: Atlanta Dog Portal

## Existing Infrastructure to Reuse

| Component | Path | Reuse Level |
|-----------|------|-------------|
| Portal routing | `app/[portal]/page.tsx` | Wire in — add `isDog` vertical check |
| Portal layout | `app/[portal]/layout.tsx` | Wire in — add dog vertical styles |
| Detail view router | `components/views/DetailViewRouter` | Full reuse |
| Event detail page | `app/[portal]/events/[id]/page.tsx` | Full reuse (style to portal) |
| Spot detail page | `app/[portal]/spots/[slug]/page.tsx` | Full reuse (style to portal) |
| List page | `app/[portal]/lists/[slug]/page.tsx` | Full reuse |
| Portal context | `lib/portal-context.tsx` | Full reuse |
| Portal theme | `components/PortalTheme.tsx` | Full reuse (branding from DB) |
| Find view (map mode) | `components/find/FindView` | Reference, may customize |
| Admin pages | `app/[portal]/admin/` | Full reuse |
| Save/RSVP APIs | `app/api/saved/`, `app/api/rsvp/` | Full reuse |

## New Components to Build

| Component | Path | Description |
|-----------|------|-------------|
| DogTemplate | `app/[portal]/_templates/dog.tsx` | Main template — blended feed |
| DogFeed | `app/[portal]/_components/dog/DogFeed.tsx` | Blended event + place feed |
| DogCard | `app/[portal]/_components/dog/DogCard.tsx` | Bespoke card (photo + fallback) |
| DogHero | `app/[portal]/_components/dog/DogHero.tsx` | Portal hero section |
| DogMap | `app/[portal]/_components/dog/DogMap.tsx` | Custom map view with branded pins |
| DogHeader | `app/[portal]/_components/dog/DogHeader.tsx` | Custom portal header |
| DogNav | `app/[portal]/_components/dog/DogNav.tsx` | Bottom nav (mobile) / pill nav |
| DogSavedView | `app/[portal]/_components/dog/DogSavedView.tsx` | Saved items view |
| DogListCard | `app/[portal]/_components/dog/DogListCard.tsx` | Curated list card |
| DogTagButton | `app/[portal]/_components/dog/DogTagButton.tsx` | "Tag as dog-friendly" CTA |

## New Data Modules

| Module | Path | Description |
|--------|------|-------------|
| Dog source policy | `lib/dog-source-policy.ts` | Source allowlist, tag contract |
| Dog data | `lib/dog-data.ts` | Queries, ranking, interleaving |
| Dog art | `lib/dog-art.ts` | Theme constants, helper fns |

## Database Changes

| Change | Type | Description |
|--------|------|-------------|
| Portal record | INSERT | Create `atl-dogs` portal in `portals` table |
| Content JSONB | Part of portal record | Hero, sections, featured, lists config |
| Branding JSONB | Part of portal record | Colors, fonts, component styles |
| Venue vibes | UPDATE (batch) | Tag existing dog-friendly venues |
| Dog park venues | INSERT (batch) | Add 10-15 dog park venues |
| Dog service venues | INSERT (batch) | Add bakeries, vets, groomers |

No schema migrations required. All changes use existing columns.

## New Crawlers

| Crawler | Priority | Estimated Effort |
|---------|----------|-----------------|
| Atlanta Humane Society | P1 | 1 session |
| PAWS Atlanta | P1 | 1 session |
| Furkids | P1 | 1 session |
| Petco Atlanta | P2 | 1-2 sessions (multi-location) |
| PetSmart Atlanta | P2 | 1-2 sessions (multi-location) |
| Fetch Dog Park & Bar | P3 | 1 session |

## API Contracts

### Existing APIs (reuse as-is)
- `GET /api/events` — Event queries (filtered by portal)
- `POST /api/saved` — Save event/venue
- `DELETE /api/saved` — Unsave
- `POST /api/rsvp` — RSVP to event

### New API (if needed)
- `POST /api/tag-venue` — Submit "dog-friendly" tag on a venue
  - Auth required
  - Rate limited (RATE_LIMITS.write)
  - Adds `dog-friendly` to venue vibes (auto-approve v1)

## State Model and URL Contract

All state lives in URL params (shareable, bookmarkable):

```
/atl-dogs                              → Explore feed (default)
/atl-dogs?view=map                     → Map view
/atl-dogs?view=saved                   → Saved items
/atl-dogs?category=parks               → Filter: parks only
/atl-dogs?category=events&when=weekend → Filter: weekend events
/atl-dogs?q=training                   → Search
/atl-dogs?event=evt_123                → Event detail overlay
/atl-dogs?spot=ven_456                 → Venue detail overlay
```

No client-side state management needed beyond URL params + React state for
UI interactions (hover, scroll position, etc.).

---

## Phase-by-Phase Build Sequence

### Phase 1: Foundation (data + skeleton)
**Goal**: Portal loads, shows real data, basic feed works.

1. Create portal record in `portals` table (slug, branding, settings, content)
2. Create `lib/dog-source-policy.ts` and `lib/dog-data.ts`
3. Create `lib/dog-art.ts` (theme constants)
4. Batch-add dog park venues (10-15)
5. Batch-tag existing dog-friendly venues (breweries, restaurants, parks)
6. Create `DogTemplate` — wire into `page.tsx` vertical router
7. Create basic `DogFeed` — fetch and display blended content
8. Create basic `DogCard` — photo + fallback variants
9. Verify: portal loads at `/atl-dogs` with real data

### Phase 2: Design Build
**Goal**: Portal looks and feels like the design direction.

10. Build `DogHeader` with Baloo 2 branding, pill nav
11. Build `DogHero` with operator-editable content (hardcoded defaults first)
12. Build `DogNav` (mobile bottom nav: Explore / Map / Saved)
13. Style `DogCard` to final design (color-coded types, chunky radius, bouncy hover)
14. Build no-photo fallback cards (solid color + emoji + bold type)
15. Build feed section carousels ("This Weekend", "Parks Near You", etc.)
16. Build `DogListCard` for curated list navigation
17. Apply full branding: colors, typography, border-radius, shadows, motion
18. `/frontend-design` skill builds the bespoke components
19. `/design` skill reviews visual consistency

### Phase 3: Map + Detail
**Goal**: Map view works, detail views are styled.

20. Build `DogMap` — custom Mapbox style, branded markers, bottom sheet
21. Wire map pins to venues and events
22. Style event detail view to portal branding
23. Style venue detail view with dog-specific info (off-leash, pup cup, etc.)
24. Build "Nearby dog-friendly spots" carousel on detail views
25. Build `DogSavedView`

### Phase 4: Crawlers + Content
**Goal**: Enough content to feel alive.

26. Build Atlanta Humane Society crawler
27. Build PAWS Atlanta crawler
28. Build Furkids crawler
29. Add trail/park venues to base Atlanta
30. Add dog bakeries, vets, groomers
31. Add curated lists ("Best Off-Leash", "Pup Cup Spots", etc.)
32. Run full crawl cycle, verify content volume (target: 200+ items)

### Phase 5: Polish + CMS
**Goal**: Ready for users. Operator can update content.

33. Build `DogTagButton` — crowdsource "dog-friendly" tagging
34. Build `POST /api/tag-venue` endpoint
35. Wire `portals.content` JSONB to template (read with fallbacks)
36. Test operator content editing via Supabase Studio
37. Mobile polish pass (no horizontal overflow, big tap targets)
38. Performance pass (< 2s load, lazy images, Suspense boundaries)
39. Analytics instrumentation (page views, saves, map opens, tag submissions)

### Phase 6: Validation
**Goal**: Quality gates pass, ready to share.

40. Run `/qa` browser tests (mobile + desktop)
41. Run `/design` final review
42. Portal owner gut-check
43. Soft launch to test audience
