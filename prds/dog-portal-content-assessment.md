# BP-1b Content Assessment: Atlanta Dog Portal

## Content Strategy

**Data flows Atlanta-first.** New content (trails, parks, venues) gets added to
the base Atlanta app, then the dog portal federates from it — filtering through
a dog-friendly lens and adding dog-only sources on top. This keeps the data model
simple and avoids maintaining parallel content.

**Blended feed.** The portal mixes events and places in a single discovery stream.
"Things to do with your dog" includes both "Adoption event Saturday at Piedmont"
and "Three Dog Bakery — fresh treats on the BeltLine." Events surface when they
happen; places are always there.

---

## Content Inventory: What Exists Today

### Events (~50-80/year)
| Source | Type | Volume | Quality |
|--------|------|--------|---------|
| LifeLine Animal Project | Adoption, vaccines, volunteering | 20-40/yr | High (iCal) |
| Zoo Atlanta | Family events, runs, galas | 10-15/yr | High |
| College Park Main Street | "Dog Days of Summer" | 1-2/yr | Moderate |
| Chattahoochee Nature Center | Wildlife events | 5-10/yr | Moderate |

### Venues (dog-relevant)
| Type | Count | Notes |
|------|-------|-------|
| Animal shelters | ~1 | LifeLine only |
| Parks with dog areas | 0 tagged | Parks exist but not tagged dog-friendly |
| Dog-friendly breweries | 0 tagged | Many breweries allow dogs but vibes not set |

### Schema Support
- `tags` array: supports `pets`, `dog-friendly`, `adoption`
- `vibes` array: has `dog-friendly` as valid value
- `venue_type`: covers parks, organizations, nonprofits
- **No migrations needed** — infrastructure is ready

---

## Content Gaps: What We Need

### Tier 1: Add to Base Atlanta App (dual-value)

These improve the main Atlanta portal AND feed into the dog portal.

**Trails & Hiking**
- Stone Mountain Trail
- Kennesaw Mountain trails
- Sweetwater Creek State Park
- Chattahoochee River NRA (multiple access points)
- BeltLine segments (Eastside, Westside, Southside)
- Arabia Mountain PATH trails
- Morningside Nature Preserve
- Cascade Springs Nature Preserve
- Estimated: 20-30 trail/park venue entries

**Parks & Nature**
- Piedmont Park (with dog park area noted)
- Grant Park
- Chastain Park
- Freedom Park
- Candler Park
- Lullwater Preserve
- Constitution Lakes
- Estimated: 15-25 park venue entries

**Outdoor/Nature Events**
- Park conservancy events
- Trail run clubs
- Outdoor festivals with nature component
- Estimated: 20-40 events/year from new sources

### Tier 2: Dog-Specific (portal only or lightly tagged in Atlanta)

**Dog Parks (dedicated off-leash areas)**
- Piedmont Park Dog Park
- Fetch Dog Park & Bar (Buckhead)
- PupTown Lounge
- Wagging Tail Dog Park
- Mason Mill Dog Park
- Brook Run Dog Park (Dunwoody)
- Newtown Dream Dog Park
- Estimated: 10-15 venues

**Vets & Animal Hospitals**
- BluePearl Emergency Vet
- VCA animal hospitals (multiple locations)
- Neighborhood/independent vets
- Low-cost clinics (PAWS, LifeLine)
- Estimated: 15-25 venues (curated, not exhaustive)

**Dog Bakeries & Treat Shops**
- Three Dog Bakery (multiple locations)
- Woof Gang Bakery
- Local indie treat makers
- Estimated: 5-10 venues

**Pet Supply (indie & specialty)**
- Dog City Bakery & Boutique
- Hollywood Feed
- Indie pet stores (not just Petco/PetSmart)
- Estimated: 10-15 venues

**"Pup Cup" Restaurants & Dog-Welcoming Spots**
- Restaurants with dog menus, water bowls, patio welcome
- Shake Shack (Pooch-ini)
- Breweries with explicit dog-friendly patios
- Coffee shops that welcome dogs
- This is a CURATION play — not every patio, just the ones that actively welcome dogs
- Estimated: 20-40 curated venues

**Groomers & Daycares**
- Top-rated groomers
- Doggy daycares with play areas
- Self-wash stations
- Estimated: 10-15 curated venues

### Tier 3: Event Sources to Crawl

**Priority 1: High-volume**
| Source | Events/Year | Type |
|--------|-------------|------|
| Atlanta Humane Society | 20-40 | Adoption, fundraisers |
| PAWS Atlanta | 10-20 | Rescue events |
| Furkids Animal Rescue | 10-20 | Adoption, galas |
| Petco (Atlanta locations) | 30-50 | Adoption, classes, vaccines |
| PetSmart (Atlanta locations) | 30-50 | Classes, adoption |

**Priority 2: Niche/seasonal**
| Source | Events/Year | Type |
|--------|-------------|------|
| Doggy Con | 1 | Annual costume contest at Woodruff Park |
| Atlanta Pet Expo | 1-2 | Convention center events |
| Fetch Dog Park & Bar | 5-10 | Yappy hours, themed nights |
| Breed-specific meetups | 10-20 | Via Meetup.com or Facebook |
| Dog-friendly brewery nights | 10-20 | Recurring "bring your pup" events |

---

## Content Voice & Tone

**Register**: Warm, playful, slightly irreverent. Like a golden retriever wrote it.

**Sample headlines** (target voice):
- "This weekend: 12 reasons to leave the couch (your dog already has)"
- "Piedmont Dog Park: Yes, the big side. Always the big side."
- "Three Dog Bakery: Treats so good you'll want to try one. Don't."
- "Saturday adoption event at PAWS — come for the puppies, leave with a best friend"

**Anti-voice**:
- "Discover curated pet experiences in metropolitan Atlanta" (too corporate)
- "Find local veterinary services near you" (too directory)
- "Atlanta's premier destination for pet owners" (too self-important)

---

## Content Lifecycle

| Content Type | Changes | Updated By | Frequency |
|--------------|---------|------------|-----------|
| Events | Constantly | Crawlers (automated) | Daily |
| Trail/park info | Rarely | Manual / admin | Monthly |
| Dog park details | Seasonally | Operator | Quarterly |
| Pup-cup restaurant list | Slowly | Curation / community tips | Monthly |
| Vet/service listings | Rarely | Manual / admin | Quarterly |
| Featured picks | Weekly | Operator / editorial | Weekly |
| Hero copy / announcements | Seasonally | Operator (self-service) | As needed |

---

## Hero Content: The Design Benchmark

**Best single piece of content today**: LifeLine Animal Project adoption event
at Piedmont Park on a Saturday morning. Photo of a dog meeting a family. This
is the emotional peak — the design must make this moment sing.

**Best place content**: Fetch Dog Park & Bar — off-leash play area + beer garden.
Photo of dogs playing while owners drink. This is the lifestyle promise.

**If the design can't make these two items irresistible, it fails.**

---

## Content-Driven Design Constraints

1. **Photography will be inconsistent.** Shelters have phone photos. Breweries
   have pro shots. Trail venues have none. Design MUST work beautifully without
   images (illustration fallbacks, color blocks, typography-forward cards).

2. **Blended content types.** A feed mixing "event Saturday" with "dog park open
   daily" with "bakery 2 miles away" needs clear visual differentiation — the user
   must instantly know what kind of thing they're looking at.

3. **Temporal vs. permanent.** Events expire, places don't. The feed needs to
   handle both without stale content feeling like dead content.

4. **Thin metadata on many items.** Dog parks might only have: name, location,
   "off-leash: yes/no." Design can't depend on rich descriptions everywhere.

5. **Map matters.** "Where can I take my dog?" is inherently spatial. AllTrails
   reference reinforces this — map view should be first-class, not an afterthought.

6. **Mobile-first, one-handed.** Dog owners are literally holding a leash. Big
   tap targets, simple gestures, no fiddly interactions.

---

## Volume Projections

| Phase | Events/Year | Places | Total Items |
|-------|-------------|--------|-------------|
| Today | ~60 | ~10 | ~70 |
| + Atlanta trails/parks (Tier 1) | ~100 | ~55 | ~155 |
| + Dog places (Tier 2) | ~100 | ~125 | ~225 |
| + New crawlers (Tier 3 P1) | ~250 | ~125 | ~375 |
| + Full coverage | ~400+ | ~150+ | ~550+ |

**Launch threshold**: 200+ items (mix of events and places) to feel alive.
Achievable with Tier 1 + Tier 2 venue work before any new crawlers.
