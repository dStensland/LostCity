# Family Portal Web Launch Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing Family Portal web shell to live data and close the remaining gaps for production launch.

**Architecture:** The web shell (FamilyFeed, TodayView, ProgramsBrowser, CrewSetup) is ~70% built. The Weekend API (`/api/weekend`) already exists and is fully implemented (323 lines with federation, rate limiting, section grouping). The main gaps are: (1) first-visit crew onboarding isn't triggered, (2) programs API may not federate correctly, (3) venue image fallbacks needed for 86% of venues with no image, (4) school calendar section needs a data gate.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Tailwind v4, React Query

**Current state of FamilyFeed tabs:**
- **Today** (TodayView.tsx) — Fully wired to 4 APIs: `/api/events`, `/api/family/destinations`, `/api/school-calendar`, `/api/programs/registration-radar`
- **Programs** (ProgramsBrowser.tsx) — Fully wired to `/api/programs` with filters
- **Crew** (CrewSetup.tsx) — Fully wired to `/api/user/kids` CRUD

**Already built (no work needed):**
- `/api/weekend` route — 323-line implementation with federation via `getPortalSourceAccess`, rate limiting, weekend range calculation, and `{ sections: { best_bets, free, easy_wins, big_outings } }` response shape

---

### Task 1: Wire first-visit crew onboarding

**Files:**
- Modify: `web/components/family/FamilyFeed.tsx` (Today tab render section)
- Reference: `web/components/family/CrewSetup.tsx` (existing component)
- Reference: `web/lib/hooks/useKidProfiles.ts` (kid profile hook)

**Context:** CrewSetup component is fully built and works on the Crew tab. But a first-time family portal visitor should see a gentle onboarding prompt on the Today tab — not be left to discover the Crew tab on their own. The trigger: authenticated user with 0 kid profiles, has never dismissed the prompt.

- [ ] **Step 1: Read FamilyFeed.tsx to understand the current tab structure**

Read `web/components/family/FamilyFeed.tsx` — focus on how the Today tab renders content and where the onboarding prompt should insert (above the main TodayView content, not in the Crew tab section).

- [ ] **Step 2: Add first-visit crew prompt to Today tab**

In `FamilyFeed.tsx`, add a dismissable onboarding banner that shows on the Today tab when:
- User is authenticated
- `kids.length === 0`
- User hasn't dismissed it (use `localStorage` key `family-crew-onboarding-dismissed`)

The banner should:
- Be warm and inviting, using FAMILY_TOKENS colors (sage, amber, canvas)
- Say something like "Set up your crew to get age-matched recommendations"
- Have a CTA button that switches to the Crew tab
- Have a dismiss button that sets the localStorage flag

```typescript
// Add to FamilyFeed, rendered above <TodayView> when activeTab === "today"
const [crewDismissed, setCrewDismissed] = useState(() =>
  typeof window !== "undefined"
    ? localStorage.getItem("family-crew-onboarding-dismissed") === "true"
    : false
);

const showCrewPrompt = isAuthenticated && kids.length === 0 && !crewDismissed;
```

- [ ] **Step 3: Test the flow manually**

1. Visit `/atlanta-families` while logged in with no kid profiles
2. Verify the banner appears on the Today tab
3. Click "Set Up My Crew" → verify it switches to Crew tab
4. Go back, dismiss → verify it doesn't reappear
5. Clear localStorage → verify it reappears

- [ ] **Step 4: Commit**

```bash
git add web/components/family/FamilyFeed.tsx
git commit -m "feat(family): add first-visit crew onboarding prompt on Today tab"
```

---

### Task 2: Verify and fix federation in programs API

**Files:**
- Modify (if needed): `web/app/api/programs/route.ts`
- Reference: `web/lib/federation.ts` (`getPortalSourceAccess`)
- Reference: `web/lib/portal-query-context.ts` (`resolvePortalQueryContext`)

**Context:** The programs API filters by `portal_id` directly (line 132: `.eq("portal_id", portalId)`). This means it only returns programs owned by the family portal — NOT programs from subscribed sources. For events, `getPortalSourceAccess` from `web/lib/federation.ts` handles federation. Programs need the same treatment.

The family portal directly owns 3,095 events but has access to 10,849 via federation. The programs story may be similar — sources like YMCA and Children's Museum may have programs attributed to the base Atlanta portal.

- [ ] **Step 1: Check how many programs are directly owned vs accessible**

```bash
cd crawlers && python3 -c "
from db.client import get_client
sb = get_client()

# Direct ownership — find family portal ID first
portal = sb.table('portals').select('id').eq('slug', 'atlanta-families').single().execute()
portal_id = portal.data['id']
direct = sb.table('programs').select('id', count='exact').eq('portal_id', portal_id).execute()
print(f'Direct programs (portal_id match): {direct.count}')

# Programs from subscribed sources
subs = sb.table('source_subscriptions').select('source_id').eq('subscriber_portal_id', portal_id).execute()
source_ids = [s['source_id'] for s in subs.data]
federated = sb.table('programs').select('id', count='exact').in_('source_id', source_ids).execute()
print(f'Federated programs (subscribed sources): {federated.count}')
print(f'Gap: {federated.count - direct.count} programs accessible via federation but not via portal_id')
"
```

- [ ] **Step 2: If federation gap exists, update the query**

In `web/app/api/programs/route.ts`, change the direct `portal_id` filter to use source-based federation. Follow the pattern from `/api/weekend/route.ts` which uses `getPortalSourceAccess`:

```typescript
import { getPortalSourceAccess } from "@/lib/federation";

// Before: direct ownership only
query = query.eq("portal_id", portalId);

// After: federation via subscribed sources
const sourceAccess = await getPortalSourceAccess(portalSlug);
if (sourceAccess.sourceIds.length > 0) {
  query = query.in("source_id", sourceAccess.sourceIds);
}
```

Check `web/lib/federation.ts` for the exact function signature and return type before implementing.

- [ ] **Step 3: Verify the programs count increases**

```bash
curl -s "http://localhost:3001/api/programs?portal=atlanta-families&limit=1" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Total: {d.get(\"total\", \"?\")} programs')"
```

- [ ] **Step 4: Type-check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add web/app/api/programs/route.ts
git commit -m "fix(api): federate programs API via source subscriptions — was showing direct-owned only"
```

---

### Task 3: Add venue image fallback for family design

**Files:**
- Modify: `web/components/family/FamilyDestinationCard.tsx` and/or `web/components/family/ProgramCard.tsx`
- Reference: `web/lib/family-design-tokens.ts` (FAMILY_TOKENS)
- Reference: `web/components/SmartImage.tsx` (has `fallback` prop)

**Context:** 86% of family venues have no `image_url`. The "Afternoon Field" design is warm and photo-forward. Without images, cards will show broken images or blank spaces. We need a graceful fallback that maintains the warm aesthetic.

- [ ] **Step 1: Check how venue cards currently handle missing images**

Read the family card components to see if they already have fallback handling:
- `web/components/family/FamilyDestinationCard.tsx`
- `web/components/family/ProgramCard.tsx`

Check if they use `<SmartImage>` with a `fallback` prop already.

- [ ] **Step 2: Add a themed fallback for missing venue images**

The fallback should use FAMILY_TOKENS colors — a warm gradient with a venue-type icon. Use SmartImage's built-in `fallback` prop:

```typescript
<SmartImage
  src={venue.image_url}
  alt={venue.name}
  fill
  fallback={
    <div className="flex items-center justify-center w-full h-full"
      style={{
        background: `linear-gradient(135deg, ${FAMILY_TOKENS.canvas}, ${FAMILY_TOKENS.moss}40)`,
      }}>
      <span className="text-3xl opacity-60">{VENUE_TYPE_ICONS[venue.venue_type] ?? "🏛️"}</span>
    </div>
  }
/>
```

Apply this to any family card component that renders venue images.

- [ ] **Step 3: Visual verification**

Load `/atlanta-families` in the browser and verify:
- Cards with images look normal
- Cards without images show the warm gradient fallback
- No broken image icons or layout shifts

- [ ] **Step 4: Commit**

```bash
git add web/components/family/
git commit -m "feat(family): add warm venue image fallback for the 86% of family venues without images"
```

---

### Task 4: Hide school calendar until data is refreshed

**Files:**
- Modify: `web/components/family/TodayView.tsx` (school calendar section)

**Context:** Only 13 future school calendar events remain (from 62 seeded in March). The school calendar feature is misleading with nearly-depleted data. Better to hide it until a school calendar crawler is built for 2026-27.

- [ ] **Step 1: Check how school calendar renders in TodayView**

Read `web/components/family/TodayView.tsx` lines 40-60 (fetch) and the rendering section for school calendar.

- [ ] **Step 2: Gate the school calendar section on minimum event count**

Add a guard that only renders the school calendar section when there are ≥5 future events:

```typescript
// In the school calendar fetch callback or render section
const showSchoolCalendar = schoolCalendarEvents.length >= 5;
```

Wrap the school calendar section in `{showSchoolCalendar && (...)}`.

This is better than a hard disable — when the 2026-27 crawler is built and data flows in, the section will automatically reappear without a code change.

- [ ] **Step 3: Verify**

Check that the school calendar section doesn't render with < 5 events.

- [ ] **Step 4: Commit**

```bash
git add web/components/family/TodayView.tsx
git commit -m "fix(family): gate school calendar section on ≥5 future events — currently only 13 remaining"
```

---

### Task 5: Production QA sweep

**Files:** None (verification only)

**Context:** Before declaring the family portal launch-ready, verify the full flow works end-to-end.

- [ ] **Step 1: Run TypeScript build check**

```bash
cd web && npx tsc --noEmit
```

Must pass with 0 errors.

- [ ] **Step 2: Run family-related tests**

```bash
cd web && npx vitest run --reporter=verbose 2>&1 | grep -E "(family|program|weekend|crew)"
```

All must pass.

- [ ] **Step 3: Browser test the full flow**

Using browser automation or manual testing:

1. Navigate to `/atlanta-families`
2. Verify Today tab loads with events, destinations, registration radar
3. Verify Programs tab loads with filterable programs
4. Verify Crew tab shows onboarding prompt (or kid profiles if set up)
5. Check at 375px mobile width — all tabs should be usable
6. Check console for JS errors — must be zero
7. Verify no broken images or empty states that look unfinished

- [ ] **Step 4: If issues found, fix and re-verify**

Each fix should be a separate commit with a descriptive message.
