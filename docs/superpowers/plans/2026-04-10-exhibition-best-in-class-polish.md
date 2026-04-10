# Exhibition Best-in-Class Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the exhibition system from "good" to "best in class" — fix stale data, mobile navigation, broken filter tabs, and missing images at landmark venues.

**Architecture:** Five independent fixes. Each can be done in any order. All are important but not blocking the core product.

**Tech Stack:** Next.js, TypeScript, Python, PostgreSQL

---

### Task 1: Run Stale Exhibition Deactivation in Production

**Context:** The auto-deactivation script was built and wired into post_crawl_report, but the data specialist found 30 stale exhibitions still active. Need to run the script manually to clean up, then verify the post-crawl hook works.

**Files:**
- No code changes — operational task

- [ ] **Step 1: Run the deactivation script**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from scripts.deactivate_past_exhibitions import deactivate_past_exhibitions
count = deactivate_past_exhibitions()
print(f'Deactivated {count} stale exhibitions')
"
```

Expected: ~30 deactivated.

- [ ] **Step 2: Verify**

```bash
python3 -c "
from db.client import get_client
client = get_client()
stale = client.table('exhibitions').select('id', count='exact').eq('is_active', True).lt('closing_date', '2026-04-10').execute()
print(f'Stale exhibitions remaining: {stale.count}')
"
```

Expected: 0.

---

### Task 2: Fix ArtsSecondaryNav Mobile Visibility

**Context:** `ArtsSecondaryNav` has `hidden sm:flex` — invisible on mobile. The Arts portal's entire sub-navigation (Exhibitions, Open Calls, Artists, Studios) is unreachable on phones.

**Files:**
- Modify: `web/components/arts/ArtsSecondaryNav.tsx`

- [ ] **Step 1: Read the component**

Read `web/components/arts/ArtsSecondaryNav.tsx` to understand the current layout. Find the `hidden sm:flex` class.

- [ ] **Step 2: Replace with a horizontal scroll strip on mobile**

Change the container from `hidden sm:flex` to a horizontally scrollable strip that works on all viewports:

```typescript
<nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-4 sm:px-0 sm:justify-center">
```

This follows the same pattern as `SimpleFilterBar` and `FilterChip` strips elsewhere in the app — horizontal scroll on mobile, centered flex on desktop.

Ensure the tab items have `flex-shrink-0` so they don't collapse on mobile.

- [ ] **Step 3: Verify at 375px**

The nav should show all tabs in a horizontally scrollable row on mobile. No wrapping, no overflow hidden.

- [ ] **Step 4: Run tsc**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add web/components/arts/ArtsSecondaryNav.tsx
git commit -m "fix(arts): make ArtsSecondaryNav visible on mobile

Was hidden sm:flex — invisible on phones. Now horizontally scrollable
strip matching the SimpleFilterBar pattern."
```

---

### Task 3: Fix ExhibitionFeed "Opening Soon" Tab

**Context:** The ExhibitionFeed has tabs for "Currently Showing" / "Opening Soon" / "Closing Soon" but the server always fetches `showing=current`. Clicking "Opening Soon" shows the same data.

**Files:**
- Modify: `web/components/arts/ExhibitionFeed.tsx`

- [ ] **Step 1: Read the component**

Read `web/components/arts/ExhibitionFeed.tsx` to understand:
- How the tabs work
- What data is fetched and when
- How the filter state is managed

- [ ] **Step 2: Add client-side re-fetch on tab change**

When the showing filter changes to "upcoming" or "past", the component needs to fetch new data from the exhibitions API with the appropriate `showing` parameter:

```typescript
// When tab changes, fetch new data
useEffect(() => {
  if (showingFilter === "current") {
    // Use the initial server-fetched data
    setExhibitions(initialExhibitions);
    return;
  }
  
  // Fetch for other tabs
  const fetchFiltered = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/exhibitions?portal=${portalSlug}&showing=${showingFilter}&limit=100`
      );
      if (res.ok) {
        const data = await res.json();
        setExhibitions(data.exhibitions || []);
      }
    } catch {
      // Silent fail — keep current data
    } finally {
      setLoading(false);
    }
  };
  fetchFiltered();
}, [showingFilter, portalSlug, initialExhibitions]);
```

The exact implementation depends on the component's current structure — read it first.

- [ ] **Step 3: Verify the API supports the showing parameter**

Check `web/app/api/exhibitions/route.ts` — confirm it accepts `showing=upcoming` and `showing=past` and returns the correct filtered results.

- [ ] **Step 4: Run tsc**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add web/components/arts/ExhibitionFeed.tsx
git commit -m "fix(exhibitions): fetch new data when switching showing tabs

Opening Soon and Closing Soon tabs were showing the same data as
Currently Showing because the component only used server-fetched
initial data. Now re-fetches with the correct showing parameter."
```

---

### Task 4: Add Fox Theatre Feature Images

**Context:** Fox Theatre has 7 features but 0 images despite being the most visually distinctive building in Atlanta. The earlier agent added features but didn't add images (the website may not have had easily extractable ones).

**Files:**
- Modify: `crawlers/sources/fox_theatre.py`

- [ ] **Step 1: Research images**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
import requests
from bs4 import BeautifulSoup
headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
for path in ['', '/about', '/venue-info', '/private-events', '/history']:
    url = f'https://www.foxtheatre.org{path}'
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(resp.text, 'html.parser')
        og = soup.find('meta', property='og:image')
        imgs = [img for img in soup.find_all('img') if img.get('src') and not any(x in img.get('src','').lower() for x in ['logo','icon','sprite','svg'])]
        print(f'{path or \"/\"} ({resp.status_code}): og={og[\"content\"][:60] if og else \"none\"}, {len(imgs)} images')
        for img in imgs[:3]:
            print(f'  {img.get(\"alt\",\"\")[:30]:30s} {img.get(\"src\",\"\")[:60]}')
    except Exception as e:
        print(f'{path}: {e}')
"
```

- [ ] **Step 2: Add image URLs to the venue features**

Read `crawlers/sources/fox_theatre.py` and find where venue features are defined. Add `"image_url"` to each feature. If feature-specific images aren't available from the site, use the og:image with `"image_source": "og_image"`.

- [ ] **Step 3: Dry-run and production write**

```bash
python3 main.py --source fox-theatre --dry-run 2>&1 | tail -5
python3 main.py --source fox-theatre --allow-production-writes --skip-run-lock 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/fox_theatre.py
git commit -m "feat(crawler): add images to Fox Theatre venue features"
```

---

### Task 5: Run Stale Deactivation Script and Push

**Files:**
- No code changes — final operational task

- [ ] **Step 1: Final tsc check**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 2: Push everything**

```bash
cd /Users/coach/Projects/LostCity && git push origin main
```

- [ ] **Step 3: Verify Vercel deploy**

Check Vercel dashboard for successful build.

---

## Verification

After all tasks:

1. `/atlanta` feed shows "What's On Now" section with exhibitions
2. Georgia Aquarium detail page shows features at position #1 with "Exhibits & Habitats" header
3. Search "aquarium" returns multiple Georgia Aquarium exhibitions
4. `/arts/exhibitions/[slug]` for a non-art exhibition shows platform-standard rendering (no Playfair)
5. ArtsSecondaryNav visible on 375px mobile
6. ExhibitionFeed "Opening Soon" tab shows different data than "Currently Showing"
7. Fox Theatre features have images
8. Zero stale exhibitions (past closing_date) in active records
