# PRD 019a: Atlanta Film Portal Implementation Checklist

Companion to:
- `prds/019-atlanta-film-portal-reset-blueprint.md`

Status: Planned
Owner: Product + Design + Frontend
Date: 2026-02-13

## 1. Strategy + IA Freeze
- [ ] Confirm section order and scope from PRD 019.
- [ ] Confirm sponsor inventory types and placement rules.
- [ ] Confirm north-star metric and event taxonomy.
- [ ] Confirm copy tone and content governance owner.

## 2. Comp Sprint (No Production UI Changes)
- [ ] Build Comp A (Festival-forward premium) desktop/mobile.
- [ ] Build Comp B (Editorial cinema journal) desktop/mobile.
- [ ] Include sponsor modules in both comps.
- [ ] Include trust/freshness treatments in both comps.
- [ ] Hold selection review and lock one direction.

## 3. Data Contracts
- [ ] Validate `/api/showtimes?mode=by-film&meta=true` payload for all required fields.
- [ ] Validate feed section coverage for `now-showing`, `festivals-series`, `film-community`.
- [ ] Define fallback behavior for missing images/times/venues.
- [ ] Define trust metadata contract (freshness/provenance/confidence).

## 4. Production Build Targets
- [ ] `web/app/[portal]/_templates/film.tsx`
- [ ] `web/app/[portal]/_components/film/FilmPortalExperience.tsx`
- [ ] Optional tracking surfaces for sponsor events:
- [ ] `web/app/api/portals/[slug]/track/route.ts`
- [ ] `web/app/api/portals/[slug]/track/action/route.ts`

## 5. Section-by-Section Implementation
- [ ] Hero identity + primary CTA cluster.
- [ ] Tonight engine (film cards + venue/time chips + full-grid CTA).
- [ ] Date rail (today + next 6 days).
- [ ] Venue pulse module.
- [ ] Curated programs module.
- [ ] Festivals/series module.
- [ ] Community module.
- [ ] Partner modules with native styling.
- [ ] Existing feed tail integration.

## 6. Sponsor + Tracking
- [ ] Add placement identifiers for sponsor modules.
- [ ] Track sponsor impression events (section in-view).
- [ ] Track sponsor CTA clicks.
- [ ] Track assisted conversion events tied to later ticket-out.
- [ ] Build lightweight sponsor report view spec (for follow-up build).

## 7. Quality Gates
- [ ] No strategy scaffolding text appears in user-facing UI.
- [ ] No horizontal overflow on iPhone Safari and Android Chrome.
- [ ] All CTAs are functional with valid destinations.
- [ ] Image fallback quality is acceptable in all modules.
- [ ] Empty-state UX is premium and readable.
- [ ] Section hierarchy remains clear on first load.

## 8. Validation Commands
- [ ] `cd web && npm run lint`
- [ ] `cd web && npm run build`
- [ ] `cd web && npm run dev` then verify `http://localhost:3000/atlanta-film`

## 9. Launch Readiness Checklist
- [ ] Comp-selected direction is reflected 1:1.
- [ ] Sponsor modules are native, restrained, and measurable.
- [ ] Trust/freshness indicators are live in key decision areas.
- [ ] Core actions complete in <=2 interactions.
- [ ] Demo script prepared for ATLFF/Plaza stakeholder review.
