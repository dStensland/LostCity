# ROMP Dog Portal Roadmap
**Created**: 2026-02-14
**Status**: Active
**Goal**: Transform ROMP from a solid prototype into Atlanta's ultimate dog owner portal

---

## Current State Assessment

**Overall Grade: C+** (strong foundation, critical execution gaps)

After a comprehensive 4-agent audit (product design, data quality, competitive intelligence, QA), the portal has excellent architecture and design but critical content and feature gaps.

### Strengths
- 264 dog-friendly venues, 1,441 tagged events
- 5 deep pages with clean routing and navigation
- Warm, distinctive visual identity (cream/orange design system)
- Competitive white space (no competitor combines events + venues + services + community)
- Tag vocabulary and API endpoint built and ready

### Critical Blockers
1. Pet services not appearing in portal (tagging bug - 17 venues exist but excluded)
2. Training section completely empty (0 events)
3. Adoption section nearly empty (1 event, LifeLine events mistagged)
4. All 7 dog parks missing images
5. Tag submission modal exists but isn't rendered anywhere
6. Stone Mountain over-representation (847/1,441 events)

---

## Sprint 1: Emergency Data Fixes (Day 1)

**Goal**: Fix broken sections so every deep page shows real content.

### 1.1 Fix pet services visibility
- Add `dog-friendly` vibe to all venues where `venue_type IN ('vet', 'groomer', 'pet_store', 'pet_daycare', 'animal_shelter')`
- OR update `getDogServices()` query to not require `dog-friendly` vibe for pet service types
- **Impact**: 17 venues appear in Services section (currently 0)

### 1.2 Tag adoption events correctly
- Query all LifeLine Animal Project events with "adoption" in title
- Add `adoption-event` tag to matching events
- Check other shelter sources (Angels Among Us, Furkids, Best Friends)
- **Impact**: ~10+ adoption events (currently 1)

### 1.3 Tag training events
- Search events with "training", "puppy class", "obedience", "agility" in title
- Tag with `dog-training` or `puppy-class`
- **Impact**: Training section populated (currently 0)

### 1.4 Reduce Stone Mountain over-representation
- Remove `dog-friendly` tag from generic Stone Mountain events (zip lines, concerts, lake activities)
- Keep only events with dog/puppy/pet in title or description
- **Impact**: Feed goes from 59% Stone Mountain to balanced mix

### 1.5 Nashville data contamination
- Filter out Nashville venues from Atlanta portal queries
- Add geographic validation to source policy

---

## Sprint 2: Visual & Content Polish (Day 2-3)

**Goal**: Make every section look good with real images and content.

### 2.1 Dog park images
- Run image discovery for all 7 dog parks (Google Places API, manual curation)
- Priority: Piedmont Park Dog Park, Fetch Dog Park & Bar, Brook Run Dog Park
- **Impact**: #1 content type goes from 0% to 100% image coverage

### 2.2 Deduplicate Piedmont Park
- Merge 5 duplicate Piedmont Park venue entries
- Keep canonical entry, reassign events
- **Impact**: Off-leash section no longer confusing

### 2.3 Image coverage sweep
- Target 80%+ image coverage for all dog-friendly venues (currently 61%)
- Focus on parks, patios, and pet stores

### 2.4 Price data inference
- Add "free" inference for park events, farmers markets, volunteer events
- **Impact**: 79% missing pricing reduced significantly

---

## Sprint 3: Wire Up Core Features (Day 3-5)

**Goal**: Activate the features that differentiate ROMP from a static directory.

### 3.1 Tag submission modal activation (CRITICAL DIFFERENTIATOR)
- DogTagModal component exists, API endpoint exists (`/api/tag-venue`)
- Need to: render modal on venue detail pages + deep page cards
- Add "Tag this spot" button to venue cards
- Show success state with confetti/celebration
- **Impact**: Core engagement loop goes live

### 3.2 Feed-level filter chips
- Add sticky filter chip bar to main feed: `[All] [Events] [Parks] [Patios] [Services]`
- DogFilterChips component already exists
- Wire up to feed query with URL param state
- **Impact**: Feed becomes interactive tool, not passive scroll

### 3.3 Save/bookmark on cards
- Add bookmark icon to DogVenueCard and DogEventCard
- Wire to existing `/api/saved` endpoint
- Show saved items in "Saved" tab (filter by dog portal)
- **Impact**: Users can build "My Spots" list

### 3.4 RSVP on adoption/training events
- Add RSVP button to event cards in adopt and training sections
- Wire to existing `/api/rsvp` endpoint
- **Impact**: Events become actionable, not just informational

### 3.5 "See all" counts
- Update DogSectionHeader to show item count: "See all (23)"
- **Impact**: Users know there's more content worth exploring

---

## Sprint 4: Map View & Services Utility (Week 2)

**Goal**: Add the utility features that make ROMP indispensable.

### 4.1 Map view for Parks page
- Add Mapbox to Parks deep page (Off-Leash tab)
- Color-coded pins: green = fenced, yellow = unfenced
- Click pin to show venue card with "Get Directions" button
- Mobile: sticky List/Map toggle
- **Impact**: Parks page goes from "nice list" to "essential tool"

### 4.2 Open/closed status for Services
- Implement hours computation from venue `hours` field
- Show green "Open" / red "Closed" indicator on service rows
- Add "Open Now" toggle filter to Services page
- **Impact**: Services page becomes useful for urgent needs (emergency vet)

### 4.3 Share buttons
- Add share button to venue and event cards
- Use Web Share API on mobile, clipboard fallback on desktop
- **Impact**: Dog content is inherently shareable (Instagram, friend recommendations)

---

## Sprint 5: Content & Community Polish (Week 2-3)

**Goal**: Add the personality and community features that build habit.

### 5.1 Hero imagery
- Add hero image or illustration to main feed
- Options: photo carousel of dogs at Atlanta parks, or custom illustration
- **Impact**: First impression goes from "text page" to "destination"

### 5.2 "Recently Tagged" feed section
- Show latest 5-8 community tag contributions
- Format: "[User] tagged [Venue] as [tag]" with timestamp
- **Impact**: Social proof, drives more tagging participation

### 5.3 Pup cup variety expansion
- Currently 11/20 pup cup spots are Starbucks
- Research and seed: Jeni's Ice Cream, local bakeries, food trucks
- **Impact**: Pup Cup section feels curated, not algorithmic

### 5.4 Dog-specific event sources
- Add crawlers for: Atlanta Humane Society events, PetSmart/Petco class calendars
- Add yappy hour detection from brewery event calendars
- **Impact**: Training and adoption sections become rich

---

## Sprint 6: Advanced Features (Month 2+)

### 6.1 Emergency vet finder
- Prominent "Emergency Vet" card with 24/7 badge, phone number, distance
- Always visible in Services section (top slot)

### 6.2 Structured dog metadata
- Add `dog_amenities` JSON to venues (water bowls, fenced, surface type, size)
- Display as icons on venue detail pages

### 6.3 User photos
- Allow photo uploads on venue pages (auth required)
- Moderate via admin queue
- Display in venue photo carousel

### 6.4 Recurring event series
- Detect recurring dog socials (e.g., "Yappy Hour every Thursday")
- Create series records for easier discovery

### 6.5 Neighborhood-based discovery
- "Dog-friendly [Neighborhood]" landing pages
- SEO play for "dog parks in Midtown Atlanta" etc.

---

## Success Criteria

### Soft Launch (end of Sprint 4)
- [ ] Every deep page shows 5+ real items (no empty states)
- [ ] Tag submission modal works end-to-end
- [ ] Map view on Parks page
- [ ] 80%+ venue image coverage
- [ ] Stone Mountain < 20% of feed
- [ ] 10+ adoption events tagged
- [ ] 20+ training events tagged

### Product-Market Fit Signals (Month 2)
- [ ] 50+ community-submitted tags
- [ ] 30% weekly return rate
- [ ] At least 1 section generates social shares
- [ ] Users can answer "what should I do with my dog this weekend?" in one visit

---

## Competitive Positioning

**vs. BringFido**: "BringFido is a travel guide. ROMP is a weekly magazine for Atlanta dog owners."
**vs. Yelp/Google**: "Google shows everything. ROMP shows what's worth your time."
**vs. AllTrails**: "AllTrails is great for hiking. ROMP shows trails PLUS 100 other dog-friendly adventures."
**vs. Rover**: "Rover helps you leave your dog with someone. ROMP helps you take your dog somewhere."

---

## Files Reference

### Data Layer
- `web/lib/dog-data.ts` - All data queries
- `web/lib/dog-tags.ts` - Tag vocabulary and display
- `web/lib/dog-art.ts` - Visual theme and content classification
- `web/lib/dog-source-policy.ts` - Source filtering

### Components
- `web/app/[portal]/_components/dog/` - All dog portal components
- `web/app/[portal]/_templates/dog.tsx` - Portal template
- `web/components/headers/DogHeader.tsx` - Header/navigation

### Deep Pages
- `web/app/[portal]/parks/page.tsx`
- `web/app/[portal]/pup-cups/page.tsx`
- `web/app/[portal]/adopt/page.tsx`
- `web/app/[portal]/training/page.tsx`
- `web/app/[portal]/services/page.tsx`

### API
- `web/app/api/tag-venue/route.ts` - Tag submission endpoint

### Reports
- `DOG_PORTAL_DATA_QUALITY_REPORT.md` - Full data quality analysis
- `prds/dog-portal-features-prd.md` - Feature clusters
- `prds/dog-portal-ux-design.md` - UX design spec
- `prds/dog-portal-content-strategy.md` - Content strategy
- `prds/dog-portal-architecture.md` - Architecture build plan
