# Atlanta Portal Design Review - February 4, 2026

**Overall Grade: 4.5/10 (D+)**
**Judged against:** Spotify, Airbnb, Apple-level quality

---

## Scores

| Category | Score |
|---|---|
| Visual Hierarchy | 4/10 |
| Typography System | 3/10 |
| Color & Brand Consistency | 6/10 |
| Spacing & Layout | 4/10 |
| Information Architecture | 5/10 |
| Card Design Quality | 5/10 |
| Navigation & Wayfinding | 5/10 |
| First Impression / "Wow Factor" | 3/10 |
| Mobile Readiness | 5/10 |
| Overall Polish | 4/10 |

---

## P0 - Critical Issues (Must Fix)

### 1. Event Detail Hero Image is Catastrophically Bad
Hero "images" are tiny centered icons on dark backgrounds. The #1 most important page looks broken. Users will think the page failed to load.

**Fix:** Full-width hero images (16:9), fallback to venue photos, branded gradient if no images. Reference: Eventbrite, Dice, Resident Advisor.

**Files:** `web/components/detail/DetailHero.tsx`

### 2. "TODAY ALL DAY" Pattern is Confusing
Every event shows "TODAY ALL DAY" in stacked label. Visual noise, unclear meaning, unprofessional.

**Fix:** Show "All Day" once for all-day events, actual times for timed events. Simplify time display.

**Files:** `web/components/EventCard.tsx`, `web/lib/formats.ts`

### 3. Typography Has No Hierarchy System
Mixing uppercase, sentence case, monospace with no logic. Event titles inconsistent ("WINE FEATURES: WINE DOWN WEDNESDAYS" vs normal case).

**Fix:** Establish clear type scale (h1/h2/h3/body/caption), normalize titles to sentence case, remove arbitrary monospace. Use font weight/size for hierarchy, not caps.

**Files:** `web/app/globals.css`, `web/components/EventCard.tsx`, all component files

### 4. Loading Skeletons Visible on Page Load
Main feed shows skeleton states on first load - broken first impression.

**Fix:** Ensure content ready before rendering, or show polished intentional loading state.

**Files:** `web/components/EventCardSkeleton.tsx`, `web/components/feed/FeedSection.tsx`

### 5. No Pricing on Cards or Detail
Can't see ticket prices without clicking through to external site.

**Fix:** Show price prominently on cards ("Free", "$15", "$20-50").

**Files:** `web/components/EventCard.tsx` (price display already exists in code but may not be rendering)

---

## P1 - Major Issues (Should Fix)

### 6. Feed is Category-Heavy, Event-Light
Main feed dominated by "What are you in the mood for?" categories instead of events.

**Fix:** Lead with events. Categories should be filters, not hero content.

**Files:** `web/components/feed/CuratedContent.tsx`, `web/components/feed/ForYouView.tsx`

### 7. Discover/For You Toggle Looks Like a CTA
Bright coral toggle looks like a Submit button, not a view switcher.

**Fix:** Use subtle toggle UI, not full-width colored buttons.

**Files:** `web/components/feed/FeedShell.tsx` or wherever the toggle lives

### 8. Map View Lacks Polish
Generic Leaflet map, default controls, no custom pins.

**Fix:** Custom map pins with category colors, smooth animations, branded controls.

**Files:** `web/components/MapView.tsx`, `web/components/MapViewWrapper.tsx`

### 9. Event Cards Lack Visual Hierarchy
Title, venue, location, price all have similar visual weight.

**Fix:** Title (large) > Time > Venue > Location/Price. Use whitespace to separate.

**Files:** `web/components/EventCard.tsx`

### 10. No Social Proof
No friend activity, RSVP counts, or "X interested" badges on events.

**Fix:** Add social context badges to cards and detail pages.

**Files:** `web/components/EventCard.tsx`, `web/components/WhosGoing.tsx`

### 11. Search is Generic
No instant results, suggestions, or trending.

**Fix:** Add instant search, recent searches, trending events.

**Files:** `web/components/SearchOverlay.tsx`, `web/components/SearchBar.tsx`

### 12. Missing Key Event Info
No organizer, capacity, ticket types on detail pages.

**Fix:** Add comprehensive event metadata section.

**Files:** `web/components/views/EventDetailView.tsx`

### 13. Category Icons Too Small
Nice icons but they're tiny and hard to see.

**Fix:** Increase icon size, use color more boldly.

**Files:** `web/components/CategoryIcon.tsx`

---

## P2 - Minor Issues (Nice to Fix)

14. Navigation active states too subtle
15. Series cards look too similar
16. "Check it out" CTA is vague → "Get Tickets", "RSVP Free"
17. Community empty state centered too low
18. Filter chips lack clear active states
19. List/Cal/Map toggle too small
20. No transition animations

---

## What Works Well (Preserve)

1. Dark aesthetic - burgundy/coral palette is distinctive
2. Category color system - smart and scalable
3. Community empty state copy - "Your friends are suspiciously quiet"
4. Navigation structure - Feed/Find/Community makes sense
5. Colored card borders - left border accent on series cards
6. Search bar prominence in Find view

---

## Top 5 Highest-Impact Changes

1. **Fix Event Detail Hero** - Replace tiny icon with full-width hero images
2. **Establish Typography System** - Type scale, normalize titles, consistency
3. **Redesign Event Cards** - Clear hierarchy, prominent pricing, bigger icons
4. **Add Social Proof** - Friend activity, RSVP counts throughout
5. **Polish the Feed** - Lead with events, not categories
