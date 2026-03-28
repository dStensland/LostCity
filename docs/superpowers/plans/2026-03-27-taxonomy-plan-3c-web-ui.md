# Taxonomy Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the filter UI, category grid, mobile strip, and map pins to show 19 new taxonomy categories. Remove dissolved categories from all filter surfaces. Add an audience filter toggle to the find/search view.

**Architecture:** Four UI surfaces need changes: (1) `FindFilterBar.tsx` mobile category strip and its CIVIC variant; (2) `BrowseByActivity.tsx` subcategory-to-parent mappings; (3) `welcome/page.tsx` onboarding category picker; (4) `submit/org/page.tsx` org category list. Map pin colors in `category-config.ts` were updated in Plan 1. The audience filter toggle (family-friendly / 21+ / all-ages) is a new addition to the Find sheet and search params.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4, Next.js App Router

**Spec:** `docs/superpowers/specs/2026-03-27-event-taxonomy-redesign.md`

**Depends on:** Plan 1 (category constants already updated in `event-taxonomy.ts` and `category-config.ts`). Plan 3b (API migration) should be complete or in progress — the UI changes here are safe to deploy independently since they only affect filter values sent to the API.

---

### Task 1: Update `FindFilterBar.tsx` — mobile category strip

The `MOBILE_CATEGORIES` strip currently shows 9 categories including `nightlife`, `recreation`, `exercise`, and `family` — all dissolved. Replace with 8 categories drawn from the new taxonomy that have the broadest appeal for mobile browsing.

**Files:**
- Modify: `web/components/find/FindFilterBar.tsx`

- [ ] **Step 1: Read the current MOBILE_CATEGORIES definition**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "MOBILE_CATEGORIES\|CIVIC_MOBILE_CATEGORIES" components/find/FindFilterBar.tsx
```

Confirm the exact lines. The current array (lines ~55–65) is:
```typescript
const MOBILE_CATEGORIES = [
  { value: "music",       label: "Music" },
  { value: "food_drink",  label: "Food & Drink" },
  { value: "comedy",      label: "Comedy" },
  { value: "nightlife",   label: "Nightlife" },
  { value: "art",         label: "Art" },
  { value: "sports",      label: "Sports" },
  { value: "recreation",  label: "Recreation" },
  { value: "exercise",    label: "Exercise" },
  { value: "family",      label: "Family" },
] as const;
```

- [ ] **Step 2: Replace MOBILE_CATEGORIES**

Replace the entire `MOBILE_CATEGORIES` constant with:

```typescript
// 8 categories most likely to surface relevant results on mobile.
// Prioritizes high-traffic discovery categories from new taxonomy v2.
const MOBILE_CATEGORIES = [
  { value: "music",       label: "Music" },
  { value: "food_drink",  label: "Food & Drink" },
  { value: "comedy",      label: "Comedy" },
  { value: "games",       label: "Games" },
  { value: "art",         label: "Art" },
  { value: "sports",      label: "Sports" },
  { value: "fitness",     label: "Fitness" },
  { value: "workshops",   label: "Workshops" },
] as const;
```

Rationale: `nightlife` dissolved (DJs/trivia now in music/games), `recreation` dissolved (now fitness/games), `exercise` dissolved (now fitness), `family` dissolved (audience tag, not category). `games` replaces nightlife's social slot. `workshops` replaces family's hands-on activity slot.

- [ ] **Step 3: Replace CIVIC_MOBILE_CATEGORIES**

The civic mobile strip currently shows `government`, `community`, `volunteer`, `family`. Update to use new taxonomy:

```typescript
// Civic portals show only relevant categories on mobile
const CIVIC_MOBILE_CATEGORIES = [
  { value: "civic",       label: "Civic" },
  { value: "volunteer",   label: "Volunteer" },
  { value: "education",   label: "Education" },
  { value: "support",     label: "Support" },
] as const;
```

Note: `civic` replaces `government` and `community`. `support` is now shown here because HelpATL is the one portal where it should be visible.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep "FindFilterBar" | head -5
```

Expected: No errors.

---

### Task 2: Update `BrowseByActivity.tsx` — subcategory-to-parent mappings

`BrowseByActivity` uses a hardcoded `parentMappings` object that maps raw subcategory keys (from the DB) to their parent category display. Many entries map to dissolved categories (`nightlife`, `community`, `family`, `wellness`, `exercise`, `learning`).

**Files:**
- Modify: `web/components/BrowseByActivity.tsx`

- [ ] **Step 1: Read the current parentMappings object**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "parentMappings\|nightlife\|community\|family\|wellness\|exercise\|learning\|gaming" \
  components/BrowseByActivity.tsx | head -40
```

The current mappings reference dissolved categories on lines ~23–65.

- [ ] **Step 2: Replace the dissolved-category entries in `parentMappings`**

Find the entire `parentMappings` object and update only the entries that reference dissolved categories. The correct new mappings are:

```typescript
const parentMappings: Record<string, string> = {
  // Music subcategories — unchanged
  live_music: "music", concert: "music", rock: "music", jazz: "music",
  pop: "music", hiphop: "music", indie: "music", acoustic: "music",
  electronic: "music", classical: "music", country: "music", metal: "music",
  punk: "music", alternative: "music", rnb: "music", live: "music",
  open_mic: "music",
  // Comedy — unchanged
  standup: "comedy", improv: "comedy",
  // Film — unchanged
  cinema: "film", screening: "film", "special-screening": "film",
  // Theater — unchanged
  play: "theater", ballet: "theater", broadway: "theater", performance: "theater",
  // Games (was: nightlife for most of these)
  trivia: "games", pub_quiz: "games", bingo: "games", poker: "games",
  board_games: "games", dnd: "games", warhammer: "games", escape_room: "games",
  // Nightlife → Music/Dance (DJ/karaoke → music; latin night/drag → theater/dance)
  club: "music", karaoke: "music", drag: "theater",
  dj: "music", dj_set: "music",
  // Sports — unchanged
  baseball: "sports", softball: "sports", mens_basketball: "sports",
  womens_basketball: "sports", racing: "sports", football: "sports",
  soccer: "sports", hockey: "sports", tennis: "sports",
  // Fitness (was: exercise, wellness, recreation)
  cycling: "fitness", running: "fitness", yoga: "fitness",
  fitness: "fitness", crossfit: "fitness", pilates: "fitness",
  barre: "fitness", hiking: "outdoors",
  // Dance (was: nightlife, exercise)
  dance: "dance", salsa: "dance", bachata: "dance",
  line_dancing: "dance", latin_night: "dance", swing: "dance",
  // Community/Civic/Volunteer (was: community)
  volunteer: "volunteer", lgbtq: "civic", activism: "civic", social: "civic",
  organizing: "civic", government: "civic",
  // Food & Drink — unchanged
  dining: "food_drink", farmers_market: "food_drink",
  // Words (was: some community)
  literary: "words", book_club: "words", storytime: "words", podcast: "words",
  // Art — unchanged
  gallery: "art", museum: "art", exhibition: "art",
  // Workshops (was: learning, family)
  workshop: "workshops", pottery: "workshops", crafts: "workshops",
  cooking: "workshops", blacksmithing: "workshops",
  // Education (was: learning)
  education: "education", campus: "education",
  seminar: "education", lecture: "education",
  // Outdoors (was: outdoors, recreation, community)
  adventure: "outdoors", sightseeing: "outdoors", outdoor: "outdoors",
  nature: "outdoors", birding: "outdoors", kayaking: "outdoors",
  // Gaming → Games
  gaming: "games", esports: "games",
  // Conventions
  convention: "conventions", expo: "conventions", conference: "conventions",
  // Support (was: community, wellness)
  "support-group": "support", recovery: "support", meditation: "support",
  "health-screening": "support",
  // Religious
  worship: "religious", prayer: "religious", ministry: "religious",
  // Special/other
  special_event: "other", festival: "other", reception: "other",
  experimental: "other",
  // Legacy dissolved-category keys — map forward gracefully
  nightlife: "music",   // catch-all fallback for stale DB data
  community: "civic",   // catch-all fallback
  family: "workshops",  // catch-all fallback
  wellness: "fitness",  // catch-all fallback
  exercise: "fitness",  // catch-all fallback
  learning: "education", // catch-all fallback
  recreation: "fitness", // catch-all fallback
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep "BrowseByActivity" | head -5
```

---

### Task 3: Update `web/app/welcome/page.tsx` — onboarding category picker

The welcome page has a `CATEGORIES` array with labels, icons, and descriptions for the interest-picker. Dissolved categories need to be replaced with new taxonomy categories.

**Files:**
- Modify: `web/app/welcome/page.tsx`

- [ ] **Step 1: Read the current CATEGORIES array**

```bash
cd /Users/coach/Projects/LostCity/web
sed -n '/const CATEGORIES/,/^] *;/p' app/welcome/page.tsx | head -80
```

- [ ] **Step 2: Update the CATEGORIES array**

Replace any entries that reference dissolved categories. The onboarding picker should show the 19 new categories. Remove `nightlife`, `community`, `family`, `recreation`, `wellness`, `exercise`, `learning`, `support_group`. Add `dance`, `games`, `workshops`, `education`, `words`, `conventions`, `support`, `religious`.

The format for each entry is (read the existing format from the file first):
```typescript
{
  id: "games",
  label: "Games",
  description: "Trivia nights, bingo, board games, poker",
  icon: "...",   // use the icon from CategoryIcon component
},
```

Replace the dissolved entries using the correct descriptions from the spec:
- `games` — "Trivia nights, bingo, board games, poker"
- `workshops` — "Pottery, painting, cooking, crafts"
- `education` — "Seminars, lectures, language classes, certifications"
- `words` — "Book clubs, poetry readings, author signings, spoken word"
- `conventions` — "Expos, conferences, fan conventions, trade shows"
- `support` — "Recovery meetings, grief groups, peer support" (may be hidden on non-HelpATL portals)
- `religious` — "Worship services, faith gatherings, spiritual events"
- `dance` — "Salsa nights, swing dancing, line dancing, latin nights"

Remove: `nightlife`, `community`, `family`, `recreation`, `wellness`, `exercise`, `learning`.

- [ ] **Step 3: Update the portal category filter at lines ~212–215**

Find:
```typescript
const displayCategories = portal?.filters?.categories?.length
  ? CATEGORIES.filter((c) => portal.filters.categories!.includes(c.id))
  : CATEGORIES;
```

This code already handles portal-specific category filtering correctly. No change needed to the logic. The `CATEGORIES` array update in Step 2 is sufficient.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep "welcome" | head -5
```

---

### Task 4: Update `web/app/submit/org/page.tsx` — org category list

This page has a hardcoded `CATEGORIES` array for org submission. Update it to remove dissolved categories.

**Files:**
- Modify: `web/app/submit/org/page.tsx`

- [ ] **Step 1: Read the current CATEGORIES array**

```bash
cd /Users/coach/Projects/LostCity/web
sed -n '/const CATEGORIES/,/^] *;/p' app/submit/org/page.tsx | head -40
```

- [ ] **Step 2: Replace dissolved categories**

The org category array is a flat string array. Remove: `nightlife`, `community`, `family`, `recreation`, `wellness`, `exercise`, `learning`.

Add: `dance`, `games`, `workshops`, `education`, `words`, `conventions`, `support`, `religious`.

Keep the existing ones that are already correct: `music`, `art`, `comedy`, `theater`, `film`, `sports`, `food_drink`, `outdoors`, `volunteer`, `civic`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep "submit" | head -5
```

---

### Task 5: Add audience filter to the find/search view

The spec introduces first-class audience filtering: `family-friendly` (shows kids-tagged content), `21+` (shows age-restricted content), `all-ages` (default — neither). This maps to `audience_tags` on events.

**Files:**
- Modify: `web/components/MobileFilterSheet.tsx` (or whichever component contains the filter sheet)
- Modify: `web/lib/search-constants.ts` — add audience filter options
- Modify: `web/app/api/search/route.ts` or the search lib to accept `audience` param

- [ ] **Step 1: Locate the MobileFilterSheet**

```bash
cd /Users/coach/Projects/LostCity/web
ls components/MobileFilterSheet.tsx 2>/dev/null || find components -name "*Filter*Sheet*" -o -name "*Sheet*Filter*"
```

- [ ] **Step 2: Add audience filter options to `search-constants.ts`**

Read `web/lib/search-constants.ts` first to confirm the current `TAG_GROUPS.Access` section.

Currently `TAG_GROUPS.Access` contains:
```typescript
Access: [
  { value: "free", label: "Free" },
  { value: "all-ages", label: "All Ages" },
  { value: "18+", label: "18+" },
  { value: "21+", label: "21+" },
  { value: "family-friendly", label: "Family" },
  { value: "accessible", label: "Accessible" },
  { value: "outdoor", label: "Outdoor" },
],
```

Add a new dedicated `Audience` group above Access:

```typescript
Audience: [
  { value: "audience:general",  label: "All Ages" },
  { value: "audience:family",   label: "Family Friendly" },
  { value: "audience:21plus",   label: "21+ Only" },
],
```

These are filter shortcuts that map to audience_tags queries — not raw tags. The prefix `audience:` distinguishes them from raw tag filters. The API needs to handle these specially (see Step 4).

- [ ] **Step 3: Add audience visual indicator to the filter sheet**

In `MobileFilterSheet.tsx` (or equivalent), find where filter groups are rendered. Add the `Audience` group as the first filter section with a brief label:

```tsx
{/* Audience filter — shown as a 3-way toggle */}
<div>
  <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
    Who's it for?
  </p>
  <div className="flex gap-2">
    {TAG_GROUPS.Audience.map((opt) => (
      <FilterChip
        key={opt.value}
        label={opt.label}
        isActive={audienceFilter === opt.value}
        onClick={() => onAudienceChange(opt.value === audienceFilter ? null : opt.value)}
      />
    ))}
  </div>
</div>
```

This requires wiring `audienceFilter` state and `onAudienceChange` handler from the parent `FindFilterBar`. Follow the existing filter pattern in the codebase — do NOT add new state management patterns; use what's already there.

- [ ] **Step 4: Wire audience filter to the API search param**

In `web/lib/hooks/useFilterEngine.ts` (or wherever URL search params are converted to API params), add handling for the `audience` filter:

```typescript
// audience: "audience:family" → include audience_tags filter
// audience: "audience:21plus" → include 21+ tags
// audience: null or "audience:general" → default (no audience_tags filter)
if (filters.audience === "audience:family") {
  params.append("audience", "family");
} else if (filters.audience === "audience:21plus") {
  params.append("audience", "21plus");
}
```

In the API route (`web/app/api/search/route.ts` or `web/app/api/events/route.ts`), handle the audience param:

```typescript
const audience = searchParams.get("audience");
if (audience === "family") {
  query = query.overlaps("audience_tags", ["toddler", "preschool", "kids", "teen"]);
} else if (audience === "21plus") {
  query = query.overlaps("audience_tags", ["21+"]);
}
// Default: no audience_tags filter → shows general audience events only
```

**Important caveat from the spec:** The audience filter only applies to event-explicit audience tags, not venue-inferred ones. A trivia night at a bar should NOT be hidden from `audience:general` just because the bar is 21+. Only events with `audience_tags` explicitly containing `['21+']` are gated. The API implementation above is correct — it uses `audience_tags` (event-explicit), not `venues.venue_type`.

- [ ] **Step 5: Verify the audience filter doesn't break existing searches**

```bash
cd /Users/coach/Projects/LostCity/web
npm run dev &
sleep 8
# Default search (no audience filter) should return general events
curl -s "http://localhost:3000/api/events?portalSlug=atlanta&limit=5" | python3 -m json.tool | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print([e.get('title','') for e in d.get('events',d.get('data',[]))[:3]])"
# Family filter should return kids events
curl -s "http://localhost:3000/api/events?portalSlug=atlanta&audience=family&limit=5" | python3 -m json.tool | head -20
kill %1 2>/dev/null || true
```

---

### Task 6: Verify map pin colors for all new categories

Map pin colors are managed in `web/lib/category-config.ts` (updated in Plan 1) and rendered via the map components. Verify that all 19 new categories have valid color entries.

**Files:**
- Read: `web/lib/category-config.ts`

- [ ] **Step 1: Check that all 19 categories have color entries**

```bash
cd /Users/coach/Projects/LostCity/web
node -e "
const config = require('./lib/category-config');
const cats = ['music','film','comedy','theater','art','dance','sports','fitness','outdoors','games','food_drink','conventions','workshops','education','words','volunteer','civic','support','religious'];
const missing = cats.filter(c => !config.CATEGORY_CONFIG[c]);
console.log('Missing:', missing);
console.log('Present:', cats.filter(c => config.CATEGORY_CONFIG[c]));
" 2>/dev/null || echo "ESM — check manually"
```

If ESM, read the file directly:
```bash
grep -E "^\s*(games|workshops|education|conventions|support|dance|words|religious|civic):" web/lib/category-config.ts
```

Expected: All 19 new categories have entries. If any are missing, they were not added in Plan 1 — add them now following the existing format:

```typescript
// In CATEGORY_CONFIG, add any missing entries:
games:       { label: "Games",       color: "#4ADE80" },
workshops:   { label: "Workshops",   color: "#FBBF24" },
education:   { label: "Education",   color: "#60A5FA" },
conventions: { label: "Conventions", color: "#38BDF8" },
support:     { label: "Support",     color: "#F9A8D4" },
dance:       { label: "Dance",       color: "#E879F9" },
words:       { label: "Words",       color: "#A78BFA" },
religious:   { label: "Religious",   color: "#FDE68A" },
civic:       { label: "Civic",       color: "#6EE7B7" },
```

- [ ] **Step 2: Verify `CategoryIcon` component handles new categories**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "games\|workshops\|education\|conventions\|support\|dance\|words\|religious\|civic" \
  components/CategoryIcon.tsx | head -20
```

If any new categories are missing from `CategoryIcon`, add them with appropriate Phosphor icons:
- `games` → `GameController`
- `workshops` → `Wrench`
- `education` → `GraduationCap`
- `conventions` → `Buildings`
- `support` → `Heart`
- `dance` → `Person` (or `MusicNotes`)
- `words` → `BookOpen`
- `religious` → `Star`
- `civic` → `Bank` (or `Buildings`)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep "CategoryIcon\|category-config" | head -5
```

---

### Task 7: Browser test at 375px and desktop

- [ ] **Step 1: Start dev server**

```bash
cd /Users/coach/Projects/LostCity/web && npm run dev &
sleep 8
```

- [ ] **Step 2: Desktop browser test checklist**

Open `http://localhost:3000/atlanta` in a browser and verify:
- [ ] The category filter dropdown in FindFilterBar shows all 19 new categories
- [ ] The mobile strip (visible on 375px) shows the 8 new MOBILE_CATEGORIES
- [ ] No dissolved category names appear in any filter surface (`Nightlife`, `Community`, `Family`, `Recreation`, `Wellness`, `Exercise`, `Learning`)
- [ ] The Browse by Activity section doesn't crash with the new parentMappings
- [ ] Map pins render with colors for new categories (open the Map tab)
- [ ] A search for `trivia` returns results with `category: games` not `category: nightlife`
- [ ] A search for `yoga` returns results with `category: fitness` not `category: wellness`
- [ ] A search for `pottery` returns results with `category: workshops` not `category: art`

- [ ] **Step 3: Mobile (375px) browser test checklist**

Set browser to 375px viewport and verify:
- [ ] The mobile category strip shows exactly 8 categories (Music, Food & Drink, Comedy, Games, Art, Sports, Fitness, Workshops)
- [ ] Strip is horizontally scrollable, no overflow clipping
- [ ] Filter chips are at least 44px tall (touch target)
- [ ] Tapping a category chip filters results correctly
- [ ] The filter sheet shows the new Audience section at top
- [ ] Audience chips render correctly at small size

- [ ] **Step 4: HelpATL portal check**

Open `http://localhost:3000/helpatl` and verify:
- [ ] Support category events ARE visible (not suppressed)
- [ ] Mobile strip shows Civic, Volunteer, Education, Support (CIVIC_MOBILE_CATEGORIES)
- [ ] No "Nightlife" or "Community" categories appear

- [ ] **Step 5: Kill dev server**

```bash
kill %1 2>/dev/null || true
```

---

### Task 8: Final TypeScript and lint checks

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | tail -10
```

Expected: No new errors introduced by taxonomy changes. Pre-existing errors are acceptable if they existed before this work.

- [ ] **Step 2: Lint check**

```bash
cd /Users/coach/Projects/LostCity/web && npm run lint 2>&1 | tail -15
```

Expected: No new lint errors.

- [ ] **Step 3: Run tests**

```bash
cd /Users/coach/Projects/LostCity/web && npm test -- --run 2>&1 | tail -10
```

Expected: All existing tests pass.

---

### Task 9: Commit

- [ ] **Step 1: Commit web UI changes**

```bash
cd /Users/coach/Projects/LostCity
git add \
  web/components/find/FindFilterBar.tsx \
  web/components/BrowseByActivity.tsx \
  web/app/welcome/page.tsx \
  web/app/submit/org/page.tsx \
  web/lib/search-constants.ts \
  web/lib/category-config.ts \
  web/components/CategoryIcon.tsx
# Add MobileFilterSheet and useFilterEngine if they were modified
git status | grep -E "MobileFilterSheet|useFilterEngine|hooks" && \
  git add web/components/MobileFilterSheet.tsx web/lib/hooks/useFilterEngine.ts 2>/dev/null || true
git commit -m "feat(web): update filter UI for taxonomy v2 — 19 categories, dissolve nightlife/family/community"
```
