# PRD: ROMP Dog Portal — Feature Clusters

## Context

ROMP (`/atl-dogs`) is a dog-owner vertical portal on Lost City. The foundation is built: portal record, theme, hero, data layer, blended feed with live sections, branded header with mobile bottom nav.

This PRD covers the next wave: 8 feature clusters that transform ROMP from a "list of dog-friendly things" into a genuinely useful tool for Atlanta dog owners.

## Product Decisions

- **Navigation model**: The main Explore feed previews and highlights features for discovery. Features live as deeper pages (grouped where natural). Feed sections link into them.
- **Data seeding**: Hybrid — we manually seed known venues with structured tags, community crowdsources the rest over time.
- **Auth**: Tag submission requires login (same as `/atlanta`). Consistent with existing platform patterns.
- **Adoption**: Org profiles + event info using existing capabilities. Pet previews backlogged.

## Target Users

1. **Weekend Explorer** — Wants fun stuff to do with their dog this weekend
2. **New-to-Atlanta Dog Owner** — Needs to find vets, parks, training, community
3. **Daily Dog Parent** — Looking for routine spots (parks, trails, patios)
4. **Adoption-Curious** — Browsing shelters and adoption events

---

## Feature Cluster 1: Crowdsourced Dog-Friendly Tagging

### What
Users can tag any venue as "dog-friendly" and add structured details (water bowls, patio, off-leash area, etc.). This is the engine that builds ROMP's coverage over time.

### Feed Preview
- Community CTA at bottom of feed: "Missing a spot? Tag it as dog-friendly."
- "Recently Tagged" mini-section showing latest community-tagged venues.

### Deep Page
- No dedicated page — the tag flow is a modal/sheet that appears on any venue detail page.
- Tagged venues surface throughout the portal via vibe filters.

### UX Flow
1. User visits a venue detail page (existing)
2. Sees "Tag as dog-friendly" button (new)
3. Taps → auth check (redirect to login if needed)
4. Modal with structured tag options:
   - Dog-friendly (yes) — the primary tag
   - Water bowls available
   - Dog menu / pup cup
   - Outdoor patio
   - Off-leash area
   - Fenced
   - Small dog area
5. Optional: photo upload, note
6. Submit → adds vibes to venue record
7. Thank you state with "Tag another spot" CTA

### Data Model
- Adds to existing `vibes` array on venues table
- New vibes vocabulary: `dog-friendly`, `water-bowls`, `dog-menu`, `pup-cup`, `off-leash`, `fenced`, `small-dog-area`, `shaded-patio`
- Tag submissions go through API route with auth + rate limiting
- Auto-approve v1 (no moderation queue)

### API
- `POST /api/tag-venue` — auth required, rate limited (RATE_LIMITS.write)
- Body: `{ venue_id, vibes: string[] }`
- Merges new vibes into existing array (no duplicates)

---

## Feature Cluster 2: Venue Dog-Info Tags (Structured Metadata)

### What
Structured information about each venue's dog-friendliness, displayed on venue cards and detail pages. This replaces the need for a separate "review" system — the tags ARE the reviews.

### Display
- **On cards**: Small tag chips below venue name (e.g., "Water bowls · Patio · Pup cup")
- **On detail pages**: Dedicated "Dog Info" section with icons and labels
- **In filters**: Filter chips on feed/map to narrow by specific amenities

### Tag Vocabulary

| Tag | Icon/Label | Category |
|-----|-----------|----------|
| `dog-friendly` | Dog-Friendly | Base |
| `water-bowls` | Water Bowls | Amenity |
| `dog-menu` | Dog Menu | Food |
| `pup-cup` | Pup Cup | Food |
| `shaded-patio` | Shaded Patio | Amenity |
| `off-leash` | Off-Leash | Access |
| `fenced` | Fenced | Access |
| `unfenced` | Unfenced | Access |
| `small-dog-area` | Small Dog Area | Access |
| `water-access` | Water Access | Trail |
| `paved` | Paved Path | Trail |
| `dog-wash` | Dog Wash Station | Amenity |

### Seeding Strategy
- Batch 1: Tag all 23 existing `dog-friendly` venues with additional structured vibes
- Batch 2: Tag known Atlanta dog parks with access info (fenced, off-leash, small-dog-area)
- Batch 3: Tag known breweries/restaurants with pup-cup, patio info
- Community fills in the rest via Cluster 1 tagging flow

---

## Feature Cluster 3: Pup Cup Directory

### What
A dedicated section/page for spots that serve dog treats — pup cups, dog biscuits, dog menus. Fun, shareable, the kind of thing that gets posted on Instagram.

### Feed Preview
- Horizontal scroll section: "Pup Cup Spots" — venue cards with the `pup-cup` vibe, showing venue photo + name + what they offer.

### Deep Page
- `/atl-dogs/pup-cups` or category filter: `?category=pup-cups`
- Grid/list of all pup cup venues
- Filterable by neighborhood
- Each card shows: venue photo, name, neighborhood, what dog treats they have (from tags)

### Data
- Venues with `pup-cup` or `dog-menu` vibes
- Seeded from known spots: Starbucks locations (secret menu pup cup), local breweries, ice cream shops

---

## Feature Cluster 4: Off-Leash Finder

### What
Find off-leash areas quickly. The #1 search for dog owners in a new city.

### Feed Preview
- Horizontal scroll section: "Off-Leash Parks" — cards showing park name, neighborhood, key tags (fenced/unfenced, size).

### Deep Page
- `/atl-dogs/off-leash` or `?category=off-leash`
- Map-first view with pins for off-leash areas
- List below map with details: fenced/unfenced, has small dog area, water access, surface type
- Color-coded: green = fenced, yellow = unfenced

### Data
- Venues with `off-leash` vibe + venue_type `park` or `dog_park`
- Additional metadata via tags: `fenced`, `unfenced`, `small-dog-area`, `water-access`
- Seeded: Piedmont Dog Park, Freedom Barkway, Mason Mill Dog Park, Fetch Park, Brook Run Dog Park, etc.

---

## Feature Cluster 5: Trail Ratings

### What
Dog-friendly trails with relevant info: shade, water, leash policy, terrain.

### Feed Preview
- Section: "Trails & Nature" (already exists) — enhanced with trail-specific tags on each card.

### Deep Page
- Group with Off-Leash Finder under a "Parks & Trails" page: `/atl-dogs/parks`
- Two tabs or filter: "Off-Leash" / "Trails"
- Trail cards show: name, length estimate, tags (shaded, water-access, paved, off-leash-ok)

### Data
- Venues with venue_type `park` or `trail` + trail-specific vibes
- Tags: `shaded`, `water-access`, `paved`, `off-leash-ok`, `leash-required`
- Seeded: Chattahoochee trails, BeltLine, Sweetwater Creek, Stone Mountain trails

---

## Feature Cluster 6: Training Classes

### What
Find dog training classes: obedience, agility, puppy socialization, behavioral.

### Feed Preview
- Section: "Training & Classes" — upcoming class events from training facilities.

### Deep Page
- `/atl-dogs/training` or `?category=training`
- List of upcoming training events/classes
- Filterable by type (puppy, obedience, agility, behavioral)
- Links to venue pages for each training facility

### Data
- Events where `is_class = true` AND (tags overlap with dog-relevant tags OR venue is a dog-primary source)
- New event tags: `dog-training`, `puppy-class`, `obedience`, `agility`
- Venue types: training facilities tagged with `dog-training` vibe
- Crawl training event sources: pet store class calendars, local trainers

---

## Feature Cluster 7: Adoption Events + Org Profiles

### What
Dedicated adoption experience with shelter/rescue org profiles and their upcoming events.

### Feed Preview
- Section: "Adopt" — upcoming adoption events with shelter branding.
- Special card treatment: warm styling, shelter logo, "Adoption Event" badge.

### Deep Page
- `/atl-dogs/adopt`
- Top: list of shelter/rescue orgs with profiles (logo, name, description, website, location)
- Below: upcoming adoption events across all orgs, chronological
- Each org card links to org detail page (existing `/[portal]/orgs/[slug]` if available, or venue detail)

### Data
- Organizations: LifeLine Animal Project, Atlanta Humane Society, PAWS Atlanta, Furkids, Angels Among Us, Best Friends Atlanta
- Events tagged `adoption` or from shelter sources
- Crawlers needed for shelter event calendars

### Org Profile Display
- Logo/image
- Name, tagline, location
- Website, social links
- "Upcoming Events" section on profile
- "Visit" CTA linking to their website

---

## Feature Cluster 8: Vet & Services Directory

### What
Find vets, groomers, pet stores, daycares — sorted by type, showing hours and "open now" status.

### Feed Preview
- Section: "Services" — compact row list of nearby services with type badge and open/closed indicator.

### Deep Page
- `/atl-dogs/services`
- Filter tabs: All / Vets / Groomers / Pet Stores / Daycare
- Each listing shows: name, type, address, hours, open/closed now, phone/website
- "Open Now" filter toggle at top

### Data
- Venues with venue_type in: `vet`, `groomer`, `pet_store`, `pet_daycare`, `animal_shelter`
- Hours data from existing `hours_display` field
- Open/closed computed from `hours` JSON field if structured
- Seeded: batch import of Atlanta vets, groomers, pet stores with hours

---

## Information Architecture Summary

```
/atl-dogs (Explore feed)
├── Hero
├── Section: This Weekend (events) → links to events view
├── Section: Off-Leash Parks (venues) → /atl-dogs/parks
├── Section: Pup Cup Spots (venues) → /atl-dogs/pup-cups
├── Section: Adopt (events) → /atl-dogs/adopt
├── Section: Training & Classes (events) → /atl-dogs/training
├── Section: Dog-Friendly Spots (venues) → filtered feed
├── Section: Services (venues) → /atl-dogs/services
├── Section: Trails & Nature (venues) → /atl-dogs/parks#trails
├── Section: Coming Up (events) → events view
├── Community CTA: Tag a spot
│
├── /atl-dogs/parks (Parks & Trails deep page)
│   ├── Tab: Off-Leash
│   └── Tab: Trails
│
├── /atl-dogs/pup-cups (Pup Cup directory)
│
├── /atl-dogs/adopt (Adoption hub)
│   ├── Org profiles
│   └── Upcoming adoption events
│
├── /atl-dogs/training (Training classes)
│
├── /atl-dogs/services (Vet & Services directory)
│   └── Filter: Vets / Groomers / Pet Stores / Daycare
│
└── Tag submission modal (on any venue detail)
```

## Open Questions for UX Design

1. Should deep pages be actual Next.js routes (`/atl-dogs/parks`) or URL-param views (`/atl-dogs?view=parks`)?
2. How should "See all →" links from feed sections work? Direct to deep page or scroll to expanded section?
3. Should the mobile bottom nav change to 4 tabs (Explore / Parks / Services / Saved) or stay at 3?
4. What's the empty state for sections with no seeded data yet? Do we show a "Help us build this" CTA?
5. Filter chip bar at top of feed — always visible or appears on scroll?
