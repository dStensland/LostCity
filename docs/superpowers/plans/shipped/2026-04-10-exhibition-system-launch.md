# Exhibition System Launch Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the exhibition system from "built" to "live" — populate production data, push to Vercel, fix broken crawlers, integrate remaining portals, and clean up hygiene issues.

**Architecture:** Mix of operational tasks (production writes, git push), crawler debugging (Playwright extraction fixes), frontend integration (FORTH/Family portals), and housekeeping (schema sync, mobile audit).

**Tech Stack:** Python crawlers, Playwright, Next.js, Supabase, Vercel

---

## File Structure

| Area | Files | Purpose |
|------|-------|---------|
| Crawler ops | `crawlers/sources/*_features.py` (7 files) | Production write runs |
| Crawler debug | `crawlers/sources/scad_fash.py`, `abv_gallery.py`, `mint_gallery.py` | Fix Playwright extraction |
| Frontend | `web/components/feed/sections/WhatsOnNowSection.tsx` | Already built — wire into FORTH/Family |
| Frontend | FORTH/Family portal surfaces (TBD per investigation) | Cross-portal exhibition visibility |
| Schema | `database/schema.sql` | Sync with applied migrations |
| DB barrel | `crawlers/db/__init__.py` | Verify/fix stale imports |

---

### Task 1: Fix db/__init__.py Barrel Imports

**Context:** Test collection fails with `ImportError: cannot import name 'cancel_crawl_log' from 'db.sources'`. The working tree may have diverged from committed state during a stash operation. This task verifies and fixes.

**Files:**
- Modify: `crawlers/db/__init__.py`

- [ ] **Step 1: Verify the current import state**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "import db; print('barrel import OK')"
```

If this succeeds, skip to Step 4 (commit if changes pending). If it fails, proceed to Step 2.

- [ ] **Step 2: Identify broken imports**

```bash
python3 -c "
import importlib, ast, sys
with open('db/__init__.py') as f:
    tree = ast.parse(f.read())
for node in ast.walk(tree):
    if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith('db.'):
        mod = importlib.import_module(node.module)
        for alias in node.names:
            name = alias.name
            if not hasattr(mod, name):
                print(f'BROKEN: {node.module}.{name}')
"
```

- [ ] **Step 3: Remove broken imports**

For each broken import reported in Step 2, remove the corresponding line from `crawlers/db/__init__.py`. Common culprits:
- `cancel_crawl_log` — removed from `db/sources.py`
- `cancel_stale_crawl_logs` — removed from `db/sources.py`
- `_error_indicates_missing_relation` — check `db/screenings.py` line 15

- [ ] **Step 4: Verify fix**

```bash
python3 -c "import db; print('barrel import OK')"
python3 -m pytest tests/test_exhibition_dedup.py tests/test_venue_feature_validation.py -v
```

Expected: import succeeds, tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/db/__init__.py
git commit -m "fix(db): remove stale imports from barrel export"
```

---

### Task 2: Production Write Runs for All 7 Venue Crawlers

**Context:** All 7 venue feature crawlers were dry-run only. No data is in production. Each crawler produces venue_features (permanent attractions) and exhibitions (time-boxed). Run them with `--allow-production-writes` to populate the database.

**Files:**
- No code changes — operational task

- [ ] **Step 1: Run Georgia Aquarium**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source georgia-aquarium-features --allow-production-writes
```

Verify: query `venue_features` and `exhibitions` for Georgia Aquarium's place_id.

```bash
python3 -c "
from db.client import get_client
client = get_client()
vf = client.table('venue_features').select('id,title,feature_type').eq('place_id', 29).eq('is_active', True).execute()
print(f'Georgia Aquarium features: {len(vf.data)}')
for f in vf.data:
    print(f'  {f[\"title\"]} ({f[\"feature_type\"]})')
"
```

Expected: 7 features.

- [ ] **Step 2: Run Zoo Atlanta**

```bash
python3 main.py --source zoo-atlanta-features --allow-production-writes
```

Verify:
```bash
python3 -c "
from db.client import get_client
client = get_client()
# Find Zoo Atlanta place_id
p = client.table('places').select('id').eq('slug', 'zoo-atlanta').execute()
pid = p.data[0]['id'] if p.data else None
print(f'Zoo Atlanta place_id: {pid}')
vf = client.table('venue_features').select('id,title').eq('place_id', pid).eq('is_active', True).execute()
print(f'Features: {len(vf.data)}')
"
```

Expected: 9 features + seasonal exhibitions.

- [ ] **Step 3: Run Atlanta Botanical Garden**

```bash
python3 main.py --source atlanta-botanical-garden-features --allow-production-writes
```

Expected: 9 features + 4 exhibitions.

- [ ] **Step 4: Run Fernbank Museum**

```bash
python3 main.py --source fernbank-museum-features --allow-production-writes
```

Expected: 7 features.

- [ ] **Step 5: Run Children's Museum of Atlanta**

```bash
python3 main.py --source childrens-museum-atlanta-features --allow-production-writes
```

Expected: 6 features + 3 traveling exhibitions.

- [ ] **Step 6: Run World of Coca-Cola**

```bash
python3 main.py --source world-of-coca-cola-features --allow-production-writes
```

Expected: 7 features.

- [ ] **Step 7: Run High Museum features**

```bash
python3 main.py --source high-museum-features --allow-production-writes
```

Expected: 7 collection features.

- [ ] **Step 8: Verify total coverage**

```bash
python3 -c "
from db.client import get_client
client = get_client()

# Total venue features
vf = client.table('venue_features').select('id', count='exact').eq('is_active', True).execute()
print(f'Total active venue features: {vf.count}')

# Features with images
vfi = client.table('venue_features').select('id', count='exact').eq('is_active', True).not_.is_('image_url', 'null').execute()
print(f'Features with images: {vfi.count}')

# Total exhibitions
ex = client.table('exhibitions').select('id', count='exact').eq('is_active', True).execute()
print(f'Total active exhibitions: {ex.count}')
"
```

---

### Task 3: Update database/schema.sql

**Context:** The canonical schema file doesn't include the `venue_features` table definition or the columns added by migrations 20260410010001 and 20260410010002. Regenerate from the live database.

**Files:**
- Modify: `database/schema.sql`

- [ ] **Step 1: Dump current schema from Supabase**

```bash
cd /Users/coach/Projects/LostCity
npx supabase db dump --schema public > /tmp/current_schema.sql
```

If `supabase db dump` isn't available, manually update `database/schema.sql` with the venue_features table and exhibition column additions.

- [ ] **Step 2: Update venue_features in schema.sql**

Add or update the `venue_features` table definition in `database/schema.sql` to include all columns:

```sql
CREATE TABLE venue_features (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  place_id    BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  feature_type TEXT NOT NULL DEFAULT 'attraction',
  description TEXT,
  image_url   TEXT,
  url         TEXT,
  is_seasonal BOOLEAN DEFAULT false,
  start_date  DATE,
  end_date    DATE,
  price_note  TEXT,
  is_free     BOOLEAN DEFAULT false,
  sort_order  SMALLINT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  source_id   INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  portal_id   UUID REFERENCES portals(id) ON DELETE SET NULL,
  admission_type TEXT,
  admission_url TEXT,
  source_url  TEXT,
  tags        TEXT[],
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(place_id, slug)
);

CREATE INDEX idx_venue_features_source ON venue_features(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX idx_venue_features_portal ON venue_features(portal_id) WHERE portal_id IS NOT NULL;

CREATE TRIGGER update_venue_features_updated_at
  BEFORE UPDATE ON venue_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 3: Update exhibitions in schema.sql**

Add `related_feature_id` column and update CHECK constraints in the exhibitions table definition:

```sql
  related_feature_id BIGINT REFERENCES venue_features(id) ON DELETE SET NULL,
  exhibition_type TEXT CHECK (exhibition_type IN ('solo','group','installation','retrospective','popup','permanent','seasonal','special-exhibit','attraction')),
  admission_type TEXT CHECK (admission_type IN ('free','ticketed','donation','suggested','included')),
```

Add index:
```sql
CREATE INDEX idx_exhibitions_related_feature ON exhibitions(related_feature_id) WHERE related_feature_id IS NOT NULL;
```

- [ ] **Step 4: Verify schema.sql parses cleanly**

```bash
python3 -c "
with open('database/schema.sql') as f:
    content = f.read()
assert 'venue_features' in content, 'venue_features table missing'
assert 'related_feature_id' in content, 'related_feature_id missing from exhibitions'
assert 'seasonal' in content, 'seasonal type missing from exhibitions'
assert 'source_id' in content and 'portal_id' in content, 'new venue_features columns missing'
print('schema.sql looks complete')
"
```

- [ ] **Step 5: Commit**

```bash
git add database/schema.sql
git commit -m "docs(schema): sync schema.sql with venue_features expansion and exhibitions changes"
```

---

### Task 4: Debug and Fix SCAD FASH Crawler

**Context:** SCAD FASH crawler (`crawlers/sources/scad_fash.py`) returns 0 events/exhibitions. Investigation shows it hits `scadfash.org/events` and `scadfash.org/exhibitions` via Playwright, but Cloudflare may be blocking. The crawler has a PDF catalog fallback that should trigger when blocked. Need to determine why it's returning 0 and fix it.

**Files:**
- Modify: `crawlers/sources/scad_fash.py`
- Test: dry-run validation

- [ ] **Step 1: Diagnose the failure**

```bash
cd /Users/coach/Projects/LostCity/crawlers
LOG_LEVEL=DEBUG python3 main.py --source scad-fash --dry-run 2>&1 | tee /tmp/scad_debug.log
```

Check the log for:
- "Cloudflare" or "challenge" detection messages
- Whether the PDF fallback was triggered
- What text was extracted from the page (if any)
- Whether any date patterns were found

```bash
grep -i "cloudflare\|challenge\|fallback\|catalog\|found\|exhibition\|event\|date\|error\|warn" /tmp/scad_debug.log
```

- [ ] **Step 2: Visit the site manually to understand current structure**

```bash
python3 -c "
import requests
from bs4 import BeautifulSoup
headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
for url in ['https://scadfash.org/', 'https://scadfash.org/events', 'https://scadfash.org/exhibitions']:
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        print(f'{url}: {resp.status_code}')
        soup = BeautifulSoup(resp.text, 'html.parser')
        title = soup.title.get_text(strip=True) if soup.title else 'no title'
        headings = [h.get_text(strip=True)[:60] for h in soup.find_all(['h1','h2','h3'], limit=10)]
        print(f'  Title: {title}')
        print(f'  Headings: {headings}')
    except Exception as e:
        print(f'{url}: ERROR - {e}')
"
```

- [ ] **Step 3: Fix based on diagnosis**

Common fixes based on what Step 1/2 reveal:

**If Cloudflare blocks Playwright:** The existing fallback should handle this (line 699-708). If it's not triggering, check the Cloudflare detection regex at line 119. The body text check may not be matching the current Cloudflare challenge page format.

**If pages load but no content found:** The CSS selectors or text parsing may not match the current site layout. Update selectors to match current HTML structure.

**If the site has been redesigned:** The crawler may need a rewrite of the parsing section. Focus on the exhibitions page first — that's what we care about most.

- [ ] **Step 4: Dry-run to verify**

```bash
python3 main.py --source scad-fash --dry-run
```

Expected: > 0 found (either exhibitions or at least the catalog fallback data).

- [ ] **Step 5: Activate and commit**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()
client.table('sources').update({'is_active': True}).eq('id', 399).execute()
print('SCAD FASH activated')
"
```

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/scad_fash.py
git commit -m "fix(crawler): update SCAD FASH for current site structure"
```

---

### Task 5: Debug and Fix ABV Gallery + Mint Gallery Crawlers

**Context:** Both ABV Gallery (`abv_gallery.py`) and Mint Gallery (`mint_gallery.py`) return 0 using Playwright. Both target `/exhibitions` pages and parse body text for date patterns. The issue is likely that these small gallery sites may not currently have any listed exhibitions, OR the text parsing isn't matching the site's date format.

**Files:**
- Modify: `crawlers/sources/abv_gallery.py`
- Modify: `crawlers/sources/mint_gallery.py`

- [ ] **Step 1: Check if galleries actually have content**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
import requests
from bs4 import BeautifulSoup
headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}

for name, url in [('ABV', 'https://www.abvgallery.com/exhibitions'), ('Mint', 'https://mintgallery.com/events')]:
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(resp.text, 'html.parser')
        title = soup.title.get_text(strip=True) if soup.title else 'no title'
        body_text = soup.get_text()[:500]
        print(f'=== {name} ({resp.status_code}) ===')
        print(f'Title: {title}')
        print(f'Body preview: {body_text[:200]}')
        print()
    except Exception as e:
        print(f'{name}: ERROR - {e}')
"
```

- [ ] **Step 2: Diagnose based on findings**

**If site has no current exhibitions:** The galleries may genuinely be between shows. This is not a bug — deactivate the source and check back monthly. Small galleries have gaps.

```bash
python3 -c "
from db.client import get_client
client = get_client()
for sid in [156, 455]:
    client.table('sources').update({'is_active': False}).eq('id', sid).execute()
print('ABV and Mint deactivated (no current content)')
"
```

**If site has exhibitions but crawler misses them:** The date regex or text parsing needs updating. Check what date format the site uses and update the regex in the crawler.

- [ ] **Step 3: Fix if content exists, deactivate if not**

If fixing, update the specific crawler's parsing logic, then dry-run to verify.

```bash
python3 main.py --source abv-gallery --dry-run
python3 main.py --source mint-gallery --dry-run
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/abv_gallery.py crawlers/sources/mint_gallery.py
git commit -m "fix(crawler): update ABV/Mint gallery extraction or deactivate pending content"
```

---

### Task 6: Venue Detail Page Mobile Audit (375px)

**Context:** The product designer flagged that high-content venues (Georgia Aquarium with 7 features + exhibitions) could create an overly long detail page on mobile. After production writes, audit the actual rendering at 375px.

**Files:**
- Possibly modify: `web/components/views/PlaceDetailView.tsx`
- Possibly modify: `web/components/detail/PlaceFeaturesSection.tsx`

- [ ] **Step 1: Open Georgia Aquarium detail page in browser at 375px**

Navigate to the Georgia Aquarium venue detail page in the running app. Resize browser to 375px width (iPhone SE size). Take a screenshot or note the layout.

Check:
- How many features render? Are they all visible or is there a long scroll?
- Is there an "On View" section with exhibitions?
- Does the page feel cluttered with features + exhibitions + events?
- Are feature cards rendering with images (96x96 thumbnails) or text-only?

- [ ] **Step 2: Evaluate whether capping is needed**

If the page is too long at 375px with 7+ features:
- Option A: Cap features at 3-4, add "Show all X features" expandable
- Option B: Collapse into a horizontal scrollable strip
- Option C: Accept the length (features are the value, not clutter)

If exhibitions + features create redundancy:
- Consider merging into a single "What's Here" section with type badges

- [ ] **Step 3: Implement fix if needed**

Only modify if the audit reveals a real problem. Don't preemptively "fix" something that may look fine.

If capping: add a `MAX_VISIBLE_FEATURES = 4` constant and a "Show all" toggle in `PlaceFeaturesSection.tsx`.

- [ ] **Step 4: Commit if changed**

```bash
cd /Users/coach/Projects/LostCity
git add web/components/detail/PlaceFeaturesSection.tsx web/components/views/PlaceDetailView.tsx
git commit -m "fix(detail): cap venue features display on mobile for high-content venues"
```

---

### Task 7: Push to Vercel and Verify

**Context:** 36+ commits on main, none pushed to the remote. Vercel deploys from main on push. This must be the LAST task — everything else should be committed first.

**Files:**
- No code changes — operational task

- [ ] **Step 1: Final verification**

```bash
cd /Users/coach/Projects/LostCity

# TypeScript check
cd web && npx tsc --noEmit && cd ..

# Crawler test check (if barrel imports are fixed)
cd crawlers && python3 -m pytest tests/test_exhibition_dedup.py tests/test_venue_feature_validation.py -v && cd ..

# Check for uncommitted changes
git status
```

- [ ] **Step 2: Review commit log**

```bash
git log --oneline origin/main..HEAD
```

Review the list. Are there any commits that should be squashed or amended? Any that shouldn't go to production?

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

- [ ] **Step 4: Monitor Vercel deployment**

Check Vercel dashboard for build success. Common issues:
- TypeScript errors that tsc --noEmit doesn't catch (different TS config)
- Missing dependencies
- Environment variable issues

- [ ] **Step 5: Verify in production**

After deploy completes:
1. Visit `/atlanta/exhibitions` — should show "What's On" with current exhibitions
2. Visit `/arts/exhibitions` — should show "What's Showing" (unchanged)
3. Search for "aquarium" — should return Georgia Aquarium place + any exhibitions
4. Visit Georgia Aquarium venue detail — should show features in "What's Here" section
5. Click an exhibition card — should go to internal detail page, not external URL

---

## Execution Order

Tasks can run in any order with these constraints:
- **Task 1** (barrel imports) should run first — unblocks test verification
- **Task 2** (production writes) should run before Task 6 (mobile audit) — need data to audit
- **Task 7** (push) must be last — everything committed first

Recommended order: 1 → 2 → 3 → 4 → 5 → 6 → 7

Tasks 3, 4, 5 are independent and can run in parallel.
