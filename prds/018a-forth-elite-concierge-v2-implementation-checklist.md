# PRD 018a: FORTH Elite Concierge V2 Implementation Checklist

Companion to:
- `prds/018-forth-elite-concierge-v2-remaining-scope.md`
- `prds/017-forth-24h-concierge-design-thinking-blueprint.md`
- `prds/016a-vertical-blueprint-packet-template.md`

Status: In Progress
Owner: Product + Design + Frontend
Date: 2026-02-13

## 1. Route Map (Execution Surface)
- [x] `web/app/[portal]/page.tsx` -> default FORTH concierge (`TonightExperienceView`)
- [x] `web/app/[portal]/plan/page.tsx` -> plan-ahead route
- [x] `web/app/[portal]/dining/page.tsx` -> dining route
- [x] `web/app/[portal]/stay/page.tsx` -> stay route
- [x] `web/app/[portal]/club/page.tsx` -> club route
- [x] `web/app/[portal]/_templates/hotel.tsx` -> FORTH variant route handoff
- [x] `web/app/[portal]/_components/hotel/forth/views/TonightExperienceView.tsx`
- [x] `web/app/[portal]/_components/hotel/forth/views/PlanAheadExperienceView.tsx`
- [x] `web/app/[portal]/_components/hotel/forth/views/DiningExperienceView.tsx`
- [x] `web/app/[portal]/_components/hotel/forth/views/StayExperienceView.tsx`
- [x] `web/app/[portal]/_components/hotel/forth/views/ClubExperienceView.tsx`

## 2. IA + Flow Simplification (Guest-First)
- [ ] Reorder top-of-page stack to: Hero CTAs -> Amenities preview carousel -> Guided chooser -> Best Bets -> Near FORTH -> Week/Weekend.
- [ ] Keep detailed planner as collapsed optional utility in guest mode.
- [ ] Remove duplicate/overlapping control groups in guest mode.
- [ ] Keep advanced tuning visible only when `showStudioControls` is true.
- [ ] Confirm nav labels remain guest-friendly: `Tonight`, `Plan Ahead`, `Dining`, `Stay`, `Club`.

Primary file targets:
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`
- `web/app/[portal]/_components/hotel/HotelHeader.tsx`

## 3. Guided Chooser (When + What + Daypart)
- [ ] Keep first decision row limited to `When`, `What`, `Time of day`.
- [ ] Ensure `For later` mode defaults to next available future date.
- [ ] Ensure `What` category selection updates both events and destinations sections.
- [ ] Ensure daypart selection updates labels and ranking context across cards.

Primary file targets:
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`
- `web/app/[portal]/_components/hotel/forth/state/guestJourneyState.ts`

## 4. Time-Aware Curation Rails (24-Hour Concierge)
- [ ] Add explicit morning rail: coffee, breakfast, markets, low-friction starts.
- [ ] Add day rail: lunch, treats, daytime destinations.
- [ ] Add evening rail: dinner, bars, event-forward picks.
- [ ] Add late-night rail: options open after 9 PM with open-late indicators.
- [ ] Add happy hour rail with strict time-window logic and specials-only inclusion.
- [ ] Add `This Week` and `This Weekend` curated event rails.

Primary file targets:
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`
- `web/app/api/portals/[slug]/feed/route.ts`
- `web/app/api/portals/[slug]/destinations/specials/route.ts`

## 5. Content-Aware Secondary Options (No Empty Chips)
- [x] Only show second-level discovery options when matching content exists.
- [x] Only show second-level food/drink options when matching content exists.
- [x] Auto-fallback to `Surprise Me` if selected option loses backing data.
- [ ] Add optional visible counts per option for transparency in studio mode.

Primary file targets:
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`

## 6. Hotel Amenities Strategy (Preview, Not Dominance)
- [ ] Keep compact amenities carousel on default route.
- [ ] Move deep property operations emphasis to `/stay`.
- [ ] Keep hero CTA links to stay sections (`Dining + Bars`, `Amenities`, `In-Room Requests`).
- [ ] Ensure `/stay` has clear return path to discovery routes.

Primary file targets:
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`
- `web/app/[portal]/stay/page.tsx`

## 7. Click-Through Integrity (No Dead Ends)
- [ ] Ensure featured event hero clicks always resolve to valid event detail routes.
- [ ] Ensure event list cards always navigate to detail route or fallback search route.
- [ ] Ensure destination cards always navigate to spot details, maps search, or reservation path.
- [ ] Add fallback `href` strategy for missing slugs/IDs to prevent no-op click states.

Primary file targets:
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`
- `web/app/[portal]/_components/hotel/HotelHeroCard.tsx`
- `web/app/[portal]/_components/hotel/HotelEventCard.tsx`
- `web/app/[portal]/_components/hotel/HotelDestinationCard.tsx`

## 8. Photography + Image Reliability
- [ ] Define preferred photo source order: live venue/event image -> FORTH editorial -> curated premium fallback.
- [ ] Ensure card image masks always clip correctly on hover/focus.
- [ ] Ensure image fallback never renders blank slots or broken corners.
- [ ] Run broken-image pass across hero, choice cards, event cards, and destination cards.

Primary file targets:
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`
- `web/app/[portal]/_components/hotel/HotelHeroCard.tsx`
- `web/app/[portal]/_components/hotel/HotelEventCard.tsx`
- `web/app/[portal]/_components/hotel/HotelDestinationCard.tsx`

## 9. Motion + Background Controls (Per Portal)
- [ ] Keep FORTH rain/background effect disabled by default.
- [ ] Confirm per-portal overrides work via `settings.forth_background_mode` and `settings.forth_motion_mode`.
- [ ] Verify FORTH page force-disables global rain/grain overlays when mounted.
- [ ] Document admin setting values (`off`, `subtle`, `cinematic`) in internal notes.

Primary file targets:
- `web/components/PortalThemeClient.tsx`
- `web/app/globals.css`
- `web/components/ambient/AmbientBackground.tsx`
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`

## 10. Copy + Tone (Guest-Friendly)
- [ ] Remove remaining technical phrases in guest-visible labels and helper copy.
- [ ] Replace night-only language where inappropriate with full-stay language.
- [ ] Keep copybook synchronized for hero/section labels.
- [ ] Add route-specific copy sets for `Tonight`, `Plan Ahead`, `Dining`, `Stay`, `Club`.

Primary file targets:
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`
- `web/app/[portal]/_components/hotel/forth/content/copybook.ts`

## 11. Data + Integration Layer
- [ ] Ensure orchestrated payload contains enough context for daypart and weekly rails.
- [ ] Preserve federated source transparency and confidence/freshness metadata.
- [ ] Keep concierge request integration optional and non-blocking for tenants.
- [ ] Add structured reservation pathway fields where available.

Primary file targets:
- `web/app/api/portals/[slug]/concierge/orchestrated/route.ts`
- `web/app/api/portals/[slug]/destinations/specials/route.ts`
- `web/app/api/portals/[slug]/concierge/requests/route.ts`

## 12. Analytics + QA Gates
- [ ] Track first meaningful action timing.
- [ ] Track daypart and category selection events.
- [ ] Track happy hour/weekend rail engagement.
- [ ] Track reservation/map route/open-event CTA clicks.
- [ ] Verify no horizontal overflow on iPhone Safari and Android Chrome.
- [ ] Verify route parity and navigation states across all FORTH routes.

Primary file targets:
- `web/app/[portal]/_components/PortalTracker.tsx`
- `web/app/api/portals/[slug]/track/route.ts`
- `web/app/api/portals/[slug]/track/action/route.ts`
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`

## 13. Validation Commands
- [ ] `cd web && npm run lint`
- [ ] `cd web && npm run build`
- [ ] `cd web && npm run dev` and manually verify:
- [ ] `http://localhost:3000/forth`
- [ ] `http://localhost:3000/forth/plan`
- [ ] `http://localhost:3000/forth/dining`
- [ ] `http://localhost:3000/forth/stay`
- [ ] `http://localhost:3000/forth/club`

## 14. Release Readiness (Demo)
- [ ] Home route feels premium in first viewport without scrolling through setup controls.
- [ ] Guests can discover now or later quickly, without building a locked plan.
- [ ] Time-aware curation feels useful across morning/day/evening/late-night.
- [ ] Week/weekend and happy-hour sections are visibly curated and actionable.
- [ ] Experience demonstrates shared federated backbone + distinct FORTH expression.
