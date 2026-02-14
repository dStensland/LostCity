# Emory Consumer Portal Audit (2026-02-13)

## Scope
- Surface audited: Emory **consumer portal** only (not admin).
- Focus: clarity, accessibility, consumer task completion, and strict separation from admin/operator concerns.
- Code reviewed in:
  - `/Users/coach/Projects/LostCity/web/app/[portal]/page.tsx`
  - `/Users/coach/Projects/LostCity/web/components/headers/EmoryDemoHeader.tsx`
  - `/Users/coach/Projects/LostCity/web/app/[portal]/_components/hospital/HospitalPortalExperience.tsx`
  - `/Users/coach/Projects/LostCity/web/app/[portal]/_components/hospital/EmoryCommunityExperience.tsx`
  - `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/page.tsx`
  - `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/[hospital]/page.tsx`
  - `/Users/coach/Projects/LostCity/web/lib/emory-copywriter.ts`
  - `/Users/coach/Projects/LostCity/web/lib/emory-personas.ts`
  - `/Users/coach/Projects/LostCity/web/lib/emory-community-feed.ts`
  - `/Users/coach/Projects/LostCity/web/lib/emory-federation-showcase.ts`

## Severity-Ranked Findings

### P0: Consumer experience still leaks operator/system language
- Evidence:
  - `Source Clarity` and trust framing in consumer feed copy: `/Users/coach/Projects/LostCity/web/lib/emory-copywriter.ts:62`, `/Users/coach/Projects/LostCity/web/lib/emory-copywriter.ts:63`
  - `Trust Guardrail` and source-policy injection in directory copy: `/Users/coach/Projects/LostCity/web/lib/emory-copywriter.ts:92`, `/Users/coach/Projects/LostCity/web/lib/emory-copywriter.ts:93`
  - `Source Confidence` and attribution messaging in companion copy: `/Users/coach/Projects/LostCity/web/lib/emory-copywriter.ts:125`, `/Users/coach/Projects/LostCity/web/lib/emory-copywriter.ts:126`
  - Persona copy includes provenance/system policy notes: `/Users/coach/Projects/LostCity/web/lib/emory-personas.ts:41`, `/Users/coach/Projects/LostCity/web/lib/emory-personas.ts:57`, `/Users/coach/Projects/LostCity/web/lib/emory-personas.ts:89`, `/Users/coach/Projects/LostCity/web/lib/emory-personas.ts:105`
- Why this matters:
  - Consumer portal intent is simple “what should I do now?” guidance.
  - This language reads like admin policy and increases cognitive load during stressful moments.

### P0: Legacy Find contract still exists in Emory data links
- Evidence:
  - Emory federation event links still emit `view=find`: `/Users/coach/Projects/LostCity/web/lib/emory-federation-showcase.ts:181`
  - Venue links still emit `view=find`: `/Users/coach/Projects/LostCity/web/lib/emory-federation-showcase.ts:206`
  - Header active-nav logic still checks for `view=find` and other Find-era params: `/Users/coach/Projects/LostCity/web/components/headers/EmoryDemoHeader.tsx:52`
- Why this matters:
  - Even with route remapping, stale contracts keep Emory conceptually tied to the Atlanta “Find” model.
  - This creates regression risk and future confusion in product architecture.

### P1: Community hub still presents trust/source telemetry as user-facing value
- Evidence:
  - “Trusted Sources / Upcoming Events / Active Places / Partner Orgs” metrics grid in consumer community hub: `/Users/coach/Projects/LostCity/web/app/[portal]/_components/hospital/EmoryCommunityExperience.tsx:122`
  - Repeated `Source:` labels and dedicated `Source` CTA on cards: `/Users/coach/Projects/LostCity/web/app/[portal]/_components/hospital/EmoryCommunityExperience.tsx:173`, `/Users/coach/Projects/LostCity/web/app/[portal]/_components/hospital/EmoryCommunityExperience.tsx:206`
  - Source-centric framing in feed community section: `/Users/coach/Projects/LostCity/web/app/[portal]/_components/hospital/HospitalPortalExperience.tsx:381`
- Why this matters:
  - Users need clear actions and outcomes, not trust telemetry.
  - Trust should be enforced in pipeline and curation policy, not foregrounded as UI content.

### P1: Hospital pages are visually dense for high-stress consumer use
- Evidence:
  - Hero image-heavy treatment and animation on directory: `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/page.tsx:98`, `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/page.tsx:90`
  - Photo-card-heavy hospital grid with decorative framing: `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/page.tsx:220`
  - Similar photo-heavy, chip-heavy companion hero: `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/[hospital]/page.tsx:474`, `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/[hospital]/page.tsx:568`
- Why this matters:
  - In healthcare utility flows, high visual decoration competes with core tasks (book, route, call, locate essentials).

### P1: Fallback data strategy can misrepresent real-world options
- Evidence:
  - Hardcoded fallback services and nearby venues appear as normal content when live data is absent: `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/[hospital]/page.tsx:88`, `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/[hospital]/page.tsx:130`, `/Users/coach/Projects/LostCity/web/app/[portal]/hospitals/[hospital]/page.tsx:425`
- Why this matters:
  - In a hospital context, users may act on stale or synthetic recommendations as if they are current.
  - This is a trust and safety risk, even if the UI is polished.

### P2: Personalization promise is not fully wired in community digest
- Evidence:
  - `mode` is currently ignored in digest cache computation: `/Users/coach/Projects/LostCity/web/lib/emory-community-feed.ts:587`
- Why this matters:
  - Consumer mode/persona is a key differentiator only if it changes outcomes.
  - Today, “mode” UX can look personalized while returning nearly identical community data.

### P2: Header interaction model is not task-first
- Evidence:
  - Top utility strip contains corporate links not tied to immediate consumer tasks: `/Users/coach/Projects/LostCity/web/components/headers/EmoryDemoHeader.tsx:93`
  - Search icon button has no action handler, creating dead affordance: `/Users/coach/Projects/LostCity/web/components/headers/EmoryDemoHeader.tsx:99`
- Why this matters:
  - Dead controls and non-task links reduce confidence and increase confusion.

### P2: Accessibility readability is at risk in repeated tiny labels
- Evidence:
  - Kicker/chip baseline styles use very small text (`10px`, `11px`): `/Users/coach/Projects/LostCity/web/lib/hospital-art.ts:46`, `/Users/coach/Projects/LostCity/web/lib/hospital-art.ts:71`
- Why this matters:
  - In caregiver/patient contexts, low-vision and stress conditions demand larger readable defaults.

## What “Best-in-Market” Should Mean for Emory Consumer Portal

### Core principle
- One question per screen: **What is the next best action for this person right now?**

### Hub architecture (consumer only)
- Hospital Hub (operational care logistics)
  - Primary jobs: route, call, book/manage visit, parking/entry, essential on-site services.
- Community Hub (non-clinical support around care)
  - Primary jobs: food support, temporary stay support, caregiver relief/wellness, practical household continuity.

### Lost City differentiation to highlight (without admin language)
- Real-time practical utility: open-now, near-campus, and mode-aware options.
- Cross-source orchestration: one calm surface that merges hospital-adjacent and community support.
- Context memory: adapt by need state (urgent, treatment, visitor, staff) and keep actions stable.
- Network effect: better local recommendations as partner graph grows, but shown as better outcomes, not telemetry.

## Recommended Next Steps

### Phase 1 (Immediate: clarity reset)
1. Remove source-confidence and provenance language from all consumer copy surfaces.
2. Remove source/partner metric cards from consumer pages.
3. Replace “Source” CTA pattern with a single clear primary action per card.
4. Remove dead search affordance in header and prune non-essential top-strip links.

### Phase 2 (IA hardening)
1. Delete Emory `view=find` link generation in all Emory-specific modules.
2. Replace stale `find` deep links with hospital-hub/community-hub canonical routes.
3. Keep compatibility handling server-side, but stop emitting Find semantics from Emory UI/data contracts.

### Phase 3 (Task-first UX)
1. Hospital Hub first viewport: `Call`, `Directions`, `Book/Manage`, `Parking` only.
2. Demote decorative hero treatments; simplify to clean hierarchy and plain language.
3. Standardize card anatomy to: `Action`, `When`, `Where`, `What to expect`.

### Phase 4 (Data integrity + personalization quality)
1. Replace hardcoded fallback venues/services with either:
   - explicit “currently unavailable” states, or
   - verified evergreen resources with stricter freshness controls.
2. Make community digest truly mode-aware (remove `void mode`; apply mode-specific ranking and section order).
3. Add QA assertions to prevent operator/admin vocabulary in consumer copy.

### Phase 5 (Accessibility hardening)
1. Raise minimum body/support text sizes in chips/kickers.
2. Ensure all primary actions meet touch-target guidance.
3. Run keyboard and screen-reader sweep for hospital and community hubs.

## Suggested Execution Order
1. Consumer copy and UI simplification (Phase 1).
2. Remove Find contract leakage (Phase 2).
3. Task-first layout reduction on directory + companion pages (Phase 3).
4. Data/personalization integrity fixes (Phase 4).
5. Accessibility pass and regression checklist (Phase 5).

## Definition of Done for This Audit
- Emory consumer portal no longer displays operator/admin language.
- Emory portal no longer emits `view=find` in generated links.
- First viewport on each hub resolves primary consumer tasks in one tap.
- No synthetic fallback content is presented as live without explicit status.
- Consumer and admin concerns are structurally and linguistically separated.
