# ROMP Content Strategy

**Portal:** `/atl-dogs`
**Version:** 1.0
**Last Updated:** 2026-02-14

---

## Executive Summary

ROMP is not a directory. It's a discovery engine for Atlanta dog owners who want to live a richer life with their dogs. The content strategy balances three tensions:

1. **Curation vs. Community** - We seed the best spots, community fills in the rest
2. **Temporal vs. Permanent** - Events come and go, places stay. The feed must handle both gracefully.
3. **Utility vs. Delight** - Essential info (vet hours, park fencing) meets joyful discovery (pup cup crawls, adoption events)

The voice is warm, modern, slightly playful. A friend who really knows dogs, not a pet store marketing team.

---

## 1. Tag Vocabulary Specification

### Philosophy

Tags are the content's metadata backbone. Each tag must:
- Have a clear, unambiguous meaning
- Apply consistently across venue types
- Enable useful filtering (not just decorative)
- Be crowdsourceable (users can accurately apply them)

### Complete Tag Set

#### Category: BASE
The foundational tag that marks something as dog-relevant.

| Machine Name | Display Label | Icon | Applies To |
|--------------|---------------|------|------------|
| `dog-friendly` | Dog-Friendly | 🐕 | All venues |

#### Category: AMENITIES
Physical features that improve the dog experience.

| Machine Name | Display Label | Icon | Applies To |
|--------------|---------------|------|------------|
| `water-bowls` | Water Bowls | 💧 | Restaurants, breweries, parks, patios |
| `dog-wash` | Dog Wash Station | 🚿 | Parks, pet stores, self-wash facilities |
| `shade` | Shaded Area | 🌳 | Parks, trails, patios |
| `benches` | Seating | 🪑 | Parks, trails |
| `parking` | Parking Available | 🅿️ | Parks, trails, venues |
| `water-access` | Water Access | 🏊 | Trails, parks (streams, ponds, lake) |
| `agility-equipment` | Agility Equipment | 🏃 | Dog parks |

#### Category: ACCESS
Critical information about space usage and restrictions.

| Machine Name | Display Label | Icon | Applies To |
|--------------|---------------|------|------------|
| `off-leash` | Off-Leash Area | 🦮 | Parks, dog parks, trails |
| `leash-required` | Leash Required | 🔗 | Parks, trails, venues |
| `fenced` | Fully Fenced | 🚧 | Dog parks, daycare |
| `unfenced` | Unfenced/Open | 🌾 | Parks, trails |
| `small-dog-area` | Small Dog Section | 🐕‍🦺 | Dog parks |
| `large-dog-area` | Large Dog Section | 🐕 | Dog parks |
| `indoor` | Indoor Space | 🏠 | Daycare, training, play facilities |
| `outdoor-only` | Outdoor Only | ☀️ | Dog parks, patios |

#### Category: FOOD & DINING
Special offerings for dogs.

| Machine Name | Display Label | Icon | Applies To |
|--------------|---------------|------|------------|
| `pup-cup` | Pup Cup | 🧁 | Coffee shops, ice cream, fast food |
| `dog-menu` | Dog Menu | 🍖 | Restaurants, breweries, cafes |
| `treats-available` | Treats Available | 🦴 | Retail, vet, groomer, any venue |

#### Category: SURFACE & TERRAIN
Important for paw health and mobility.

| Machine Name | Display Label | Icon | Applies To |
|--------------|---------------|------|------------|
| `paved` | Paved Path | 🛤️ | Trails, parks |
| `gravel` | Gravel | 🪨 | Trails, parks |
| `grass` | Grass | 🌱 | Parks, dog parks |
| `mulch` | Mulch | 🍂 | Parks, dog parks |
| `dirt-trail` | Dirt Trail | 🥾 | Trails |

#### Category: SERVICES
Professional services offered.

| Machine Name | Display Label | Icon | Applies To |
|--------------|---------------|------|------------|
| `emergency-vet` | Emergency Vet | 🚑 | Vets |
| `boarding` | Boarding | 🛏️ | Vet, daycare, boarding facility |
| `grooming` | Grooming | ✂️ | Groomers, pet stores |
| `training` | Training Classes | 🎓 | Training facilities, pet stores |
| `daycare` | Daycare | 🏫 | Daycare facilities |
| `adoption` | Adoption Services | ❤️ | Shelters, rescues |
| `low-cost-vet` | Low-Cost Vet | 💰 | Clinics, nonprofits |

#### Category: EVENTS
Event-specific tags (applied to events, not venues).

| Machine Name | Display Label | Icon | Applies To |
|--------------|---------------|------|------------|
| `adoption-event` | Adoption Event | 🏠 | Events |
| `yappy-hour` | Yappy Hour | 🍺 | Events |
| `dog-training` | Training Class | 📚 | Events |
| `dog-social` | Dog Social | 🎉 | Events |
| `vaccination` | Vaccination Clinic | 💉 | Events |
| `fundraiser` | Fundraiser | 💵 | Events |

### Tag Application Guidelines

**Consistency Rules:**

1. **Fenced vs. Unfenced:** Never apply both. If partially fenced, choose based on off-leash area.
2. **Off-Leash vs. Leash-Required:** Can both apply (e.g., off-leash area within a leash-required park).
3. **Surface tags:** Apply all that are present (trail can have paved + dirt sections).
4. **Size-specific areas:** Only apply if there's a designated, separated space.

**Crowdsourcing Quality Control:**

- Tag submission UI should show definitions/examples for ambiguous tags
- Auto-suggest related tags (e.g., "off-leash" often implies "fenced")
- Community reporting for incorrect tags (future feature)

---

## 2. Seeding Plan

### Atlanta Dog Parks (Add as New Venues)

#### ITP Core Parks

| Venue Name | Neighborhood | Key Tags | Notes |
|------------|--------------|----------|-------|
| Piedmont Park Dog Park | Midtown | `off-leash`, `fenced`, `small-dog-area`, `large-dog-area`, `water-bowls`, `shade`, `grass` | Two separate areas, always busy |
| Freedom Park Off-Leash | Candler Park | `off-leash`, `fenced`, `grass`, `shade` | Smaller, neighborhood feel |
| Grant Park Off-Leash | Grant Park | `off-leash`, `fenced`, `grass`, `parking` | Near Zoo Atlanta |
| Newtown Dream Dog Park | Decatur | `off-leash`, `fenced`, `small-dog-area`, `large-dog-area`, `agility-equipment`, `water-bowls`, `parking` | Premium facilities, well-maintained |

#### OTP/Suburban Parks

| Venue Name | Neighborhood | Key Tags | Notes |
|------------|--------------|----------|-------|
| Brook Run Dog Park | Dunwoody | `off-leash`, `fenced`, `small-dog-area`, `large-dog-area`, `water-access`, `trails`, `parking` | Creek runs through it |
| Fetch Dog Park & Bar | Buckhead | `off-leash`, `fenced`, `pup-cup`, `dog-menu`, `indoor`, `outdoor-only`, `agility-equipment` | Bar + dog park combo |
| Mason Mill Dog Park | Decatur | `off-leash`, `fenced`, `water-access`, `parking` | Large, wooded |
| East Roswell Park Dog Park | Roswell | `off-leash`, `fenced`, `small-dog-area`, `large-dog-area`, `parking` | Well-maintained suburban park |
| Wagging Tail Dog Park | Sandy Springs | `off-leash`, `fenced`, `grass`, `parking` | Neighborhood park |

#### Specialty Venues

| Venue Name | Type | Key Tags | Notes |
|------------|------|----------|-------|
| PupTown Lounge | Play & Daycare | `indoor`, `off-leash`, `daycare`, `boarding`, `training` | Indoor play facility |
| Play Dog Play | Daycare | `indoor`, `daycare`, `boarding`, `water-bowls` | Sandy Springs location |

### Trails & Nature (Add to Atlanta, Tag for ROMP)

#### Urban Trails

| Venue Name | Neighborhood | Key Tags | Notes |
|------------|--------------|----------|-------|
| BeltLine Eastside Trail | Old Fourth Ward | `paved`, `leash-required`, `shade`, `water-access`, `parking` | Piedmont Park to Krog |
| BeltLine Westside Trail | West Midtown | `paved`, `leash-required`, `shade` | Washington Park to White St |
| Chattahoochee River Trail (Cochran Shoals) | Vinings | `paved`, `dirt-trail`, `leash-required`, `water-access`, `parking`, `shade` | Popular river access |
| Murphey Candler Park Trail | Brookhaven | `paved`, `leash-required`, `water-access`, `parking` | Lake loop |
| Stone Mountain Walk-Up Trail | Stone Mountain | `paved`, `leash-required`, `parking` | 1 mile to summit |

#### Nature Trails

| Venue Name | Neighborhood | Key Tags | Notes |
|------------|--------------|----------|-------|
| Sweetwater Creek State Park | Douglasville | `dirt-trail`, `leash-required`, `water-access`, `shade`, `parking` | Ruins + creek |
| Arabia Mountain Trail | Lithonia | `paved`, `dirt-trail`, `leash-required`, `parking` | Granite outcrop, unique |
| Cascade Springs Nature Preserve | Southwest Atlanta | `dirt-trail`, `leash-required`, `shade`, `water-access` | Hidden gem |
| Morningside Nature Preserve | Virginia-Highland | `dirt-trail`, `leash-required`, `shade` | Urban forest |
| Lullwater Preserve | Druid Hills | `dirt-trail`, `leash-required`, `shade`, `water-access` | Emory campus adjacent |

### Pup Cup Spots (Tag Existing + Add New)

#### National Chains (Add to Atlanta)

| Venue Name | Tags | What They Offer | Locations |
|------------|------|-----------------|-----------|
| Starbucks | `pup-cup`, `treats-available` | Free whipped cream "puppuccino" | Multiple locations |
| Shake Shack | `pup-cup`, `dog-menu`, `outdoor-only` | Pooch-ini (dog biscuit + custard) | Ponce City Market, Avalon |
| Dunkin' | `pup-cup` | Free cup of whipped cream | Multiple locations |

#### Local Favorites (Add as New Venues)

| Venue Name | Neighborhood | Tags | What They Offer |
|------------|--------------|------|-----------------|
| Three Dog Bakery | Virginia-Highland | `dog-menu`, `treats-available`, `dog-wash` | Dog bakery + boutique |
| Woof Gang Bakery | Decatur, Brookhaven | `dog-menu`, `treats-available`, `grooming` | Bakery + grooming |
| The Local No. 7 | Inman Park | `pup-cup`, `dog-friendly`, `outdoor-only` | Water bowls, treats |
| Atlanta Coffee Roasters | Candler Park | `pup-cup`, `dog-friendly`, `outdoor-only` | Pup cups, patio |

#### Breweries (Tag Existing)

| Venue Name | Add Tags |
|------------|----------|
| Monday Night Brewing (all locations) | `dog-friendly`, `outdoor-only`, `water-bowls`, `treats-available` |
| Orpheus Brewing | `dog-friendly`, `outdoor-only`, `water-bowls` |
| New Realm Brewing | `dog-friendly`, `outdoor-only`, `water-bowls` |
| SweetWater Brewing | `dog-friendly`, `outdoor-only`, `water-bowls` |
| Wild Heaven Beer | `dog-friendly`, `outdoor-only`, `water-bowls` |

### Vets & Services (Add New Venues)

#### Emergency Vets

| Venue Name | Neighborhood | Tags | Hours |
|------------|--------------|------|-------|
| BluePearl Pet Hospital | Sandy Springs, Avondale Estates | `emergency-vet`, `24/7` | 24/7 |
| AVECCC (Avondale) | Avondale Estates | `emergency-vet`, `24/7` | 24/7 |
| Georgia Veterinary Specialists | Sandy Springs | `emergency-vet`, `24/7` | 24/7 |

#### Low-Cost Clinics

| Venue Name | Neighborhood | Tags | Notes |
|------------|--------------|------|-------|
| LifeLine Community Vet Clinic | DeKalb County | `low-cost-vet`, `vaccination`, `adoption` | Nonprofit |
| PAWS Atlanta Clinic | Decatur | `low-cost-vet`, `vaccination` | Appointment-based |
| Furkids Clinic | Cumming | `low-cost-vet`, `vaccination` | For Furkids adopters |

#### Groomers

| Venue Name | Neighborhood | Tags | Notes |
|------------|--------------|------|-------|
| Hollywood Feed | Multiple locations | `grooming`, `treats-available`, `dog-wash` | Self-wash + full grooming |
| Woof Gang Bakery & Grooming | Decatur, Brookhaven | `grooming`, `dog-menu`, `treats-available` | Bakery + grooming |
| Doggie DoLittle | Grant Park, Candler Park | `grooming`, `dog-wash` | Mobile + storefront |

#### Pet Stores (Indie Focus)

| Venue Name | Neighborhood | Tags | Notes |
|------------|--------------|------|-------|
| The Natural Pet Market | Decatur, Smyrna | `treats-available`, `training` | Natural food focus |
| Bone Appetite | East Atlanta | `dog-menu`, `treats-available` | Raw food specialist |
| Dog City Bakery & Boutique | Inman Park | `dog-menu`, `treats-available` | Local treats + gear |

### Shelter & Rescue Orgs (Add New Orgs)

#### Major Shelters

| Org Name | Tags | Notes |
|----------|------|-------|
| LifeLine Animal Project | `adoption`, `low-cost-vet`, `vaccination` | County partner, high volume |
| Atlanta Humane Society | `adoption`, `vaccination` | Howell Mill location |
| PAWS Atlanta | `adoption`, `low-cost-vet` | Decatur-based |
| Furkids | `adoption`, `low-cost-vet` | No-kill, cat + dog |

#### Breed-Specific & Specialty Rescues

| Org Name | Tags | Focus |
|----------|------|-------|
| Angels Among Us Pet Rescue | `adoption` | Foster-based, all breeds |
| Best Friends Atlanta | `adoption` | National network, foster-based |
| Atlanta Lab Rescue | `adoption` | Labrador specialists |
| Georgia English Bulldog Rescue | `adoption` | Bulldog specialists |
| Atlanta Boxer Rescue | `adoption` | Boxer specialists |
| Second Chance Rescue | `adoption` | Senior + special needs |

### Training Facilities (Add New Venues)

| Venue Name | Neighborhood | Tags | Services |
|------------|--------------|------|----------|
| Zoom Room | Midtown, Decatur | `training`, `indoor`, `agility-equipment` | Classes + open play |
| Karma Dog Training | Decatur | `training` | Positive reinforcement focus |
| Off Leash K9 Training | Multiple locations | `training` | E-collar specialists |
| Who's Walking Who | East Atlanta | `training`, `daycare` | Classes + daycare |

---

## 3. Section Copy

### Feed Section: This Weekend

**Title:** This Weekend
**Subtitle:** Things happening Friday through Sunday
**Empty State:**
> Nothing on the calendar yet. Check back later this week.

**Primary Action:** Tap event card to see details + RSVP
**Secondary Action:** "See all weekend events →"

---

### Feed Section: Off-Leash Parks

**Title:** Off-Leash Parks
**Subtitle:** Let them run free
**Empty State:**
> Know a great off-leash spot? Tag it and help other dog owners find it.

**Primary Action:** Tap park card to see details (fence status, size, amenities)
**Secondary Action:** "See all parks →"

**Card Display Priority:**
1. Venue photo (if available)
2. Venue name
3. Neighborhood
4. Tags: Fenced/Unfenced, Small Dog Area (if applicable)
5. Distance (if location permission granted)

---

### Feed Section: Pup Cup Spots

**Title:** Pup Cup Spots
**Subtitle:** Treats, menus, and puppuccinos
**Empty State:**
> Know a spot that serves pup cups or dog treats? Tag it so we can all go.

**Primary Action:** Tap venue card to see menu details
**Secondary Action:** "See all pup cup spots →"

**Card Display Priority:**
1. Venue photo
2. Venue name
3. What they offer (parsed from tags: "Pup cups · Dog menu")
4. Neighborhood

---

### Feed Section: Adopt

**Title:** Adopt
**Subtitle:** Meet your new best friend
**Empty State:**
> No upcoming adoption events right now. Check back soon.

**Primary Action:** Tap event to see details + directions
**Secondary Action:** "See all shelters & rescues →"

**Card Treatment:**
- Warm color scheme (use adoption-specific styling)
- Shelter logo prominently displayed
- "Adoption Event" badge
- Date/time/location clearly visible

---

### Feed Section: Training & Classes

**Title:** Training & Classes
**Subtitle:** Puppy school, obedience, agility, and more
**Empty State:**
> No upcoming classes right now. Check the venues below for schedules.

**Primary Action:** Tap class to register/get details
**Secondary Action:** "See all training facilities →"

---

### Feed Section: Dog-Friendly Spots

**Title:** Dog-Friendly Spots
**Subtitle:** Patios, breweries, and places that welcome your pup
**Empty State:**
> We're just getting started. Tag your favorite dog-friendly spots.

**Primary Action:** Tap venue to see amenities (patio, water bowls, etc.)
**Secondary Action:** "See all dog-friendly venues →"

---

### Feed Section: Services

**Title:** Services
**Subtitle:** Vets, groomers, pet stores, and daycare
**Empty State:**
> Looking for something specific? Use Find to search by type.

**Primary Action:** Tap service to see hours/website/contact
**Secondary Action:** "See all services →"

**Card Display Priority:**
1. Service type badge (Vet, Groomer, Pet Store, Daycare)
2. Venue name
3. Open/Closed indicator (if hours available)
4. Neighborhood
5. Distance

---

### Feed Section: Trails & Nature

**Title:** Trails & Nature
**Subtitle:** Hiking, walking, and exploring
**Empty State:**
> Know a great trail? Tag it and share the details.

**Primary Action:** Tap trail to see surface, distance, water access
**Secondary Action:** "See all trails →"

**Card Display Priority:**
1. Trail photo (or nature illustration fallback)
2. Trail name
3. Key tags: Paved/Dirt, Water Access, Leash Required
4. Estimated distance/length (if available)

---

### Feed Section: Coming Up

**Title:** Coming Up
**Subtitle:** Events, classes, and adoption days
**Empty State:**
> The calendar's quiet right now. Check back soon.

**Primary Action:** Tap event to see details
**Secondary Action:** None (this is the catch-all)

---

### Tag Submission Modal

**Header:** Tag This Spot
**Subheader:** Help other dog owners discover this place

**Instructions:**
> Select all that apply. This helps everyone know what to expect.

**Sections:**

1. **Dog-Friendly Basics**
   - [ ] Dog-friendly
   - [ ] Water bowls available
   - [ ] Dog treats or pup cups

2. **Outdoor Spaces** (if applicable)
   - [ ] Outdoor patio
   - [ ] Off-leash area
   - [ ] Fully fenced
   - [ ] Unfenced / open space
   - [ ] Shaded area

3. **Amenities** (if applicable)
   - [ ] Dog wash station
   - [ ] Parking available
   - [ ] Water access (stream, pond, lake)
   - [ ] Agility equipment

4. **Surface** (if trail/park)
   - [ ] Paved
   - [ ] Grass
   - [ ] Dirt trail
   - [ ] Gravel

**Optional:** Add a photo (future feature)
**Optional:** Add a note (free text, 200 char max)

**Button Labels:**
- Primary: "Submit Tags"
- Secondary: "Cancel"

**Success Message:**
> Thanks for tagging this spot! Your contribution helps the ROMP community.
> [Tag Another Spot]

**Error States:**
- "You must select at least one tag."
- "Please log in to tag venues."
- "Something went wrong. Try again."

---

### Deep Page: Parks & Trails (`/atl-dogs/parks`)

**Header:** Parks & Trails
**Description:** Off-leash parks, hiking trails, and outdoor spaces where your dog can explore.

**Tabs:**
1. **Off-Leash** (default) - Shows `off-leash` tagged venues
2. **Trails** - Shows trail/nature venues

**Map View:**
- Green pins = Fenced off-leash
- Yellow pins = Unfenced off-leash
- Blue pins = Leash-required trails

**List View (Below Map):**
- Sortable: Distance, Name, Rating (future)
- Filterable: Fenced/Unfenced, Small Dog Area, Water Access, Surface Type

**Empty State:**
> We're building the map. Know a great park or trail? Tag it.

---

### Deep Page: Pup Cups (`/atl-dogs/pup-cups`)

**Header:** Pup Cup Spots
**Description:** Coffee shops, ice cream parlors, and restaurants that serve treats for dogs.

**Filter:** Neighborhood dropdown

**Empty State:**
> We're compiling the list. Know a spot that serves pup cups? Tag it.

**Card Display:**
- Venue photo (or treat illustration fallback)
- Venue name
- What they offer: "Pup cups · Dog biscuits · Water bowls"
- Neighborhood
- Distance

---

### Deep Page: Adopt (`/atl-dogs/adopt`)

**Header:** Adopt a Dog
**Description:** Atlanta shelters, rescues, and upcoming adoption events.

**Section 1: Shelters & Rescues**
- Grid of org cards with logos
- Each card: Org name, tagline, location, "Visit Website" CTA

**Section 2: Upcoming Adoption Events**
- Chronological list
- Event cards with shelter branding
- Date/time/location prominent

**Empty State (Events):**
> No adoption events scheduled yet. Check individual shelter websites for updates.

**Empty State (Orgs):**
> We're building the directory. Know a rescue org? Contact us.

---

### Deep Page: Training (`/atl-dogs/training`)

**Header:** Training & Classes
**Description:** Obedience, agility, puppy socialization, and behavioral training.

**Filter Tabs:**
- All
- Puppy Classes
- Obedience
- Agility
- Behavioral

**List View:**
- Event/class cards with facility logo
- Date/time/location
- Class type badge
- Registration CTA

**Bottom Section: Training Facilities**
- List of venues offering training
- Each card: Venue name, services offered, contact

**Empty State:**
> No upcoming classes right now. Check back soon or visit the facilities below.

---

### Deep Page: Services (`/atl-dogs/services`)

**Header:** Vets, Groomers & Pet Services
**Description:** Find veterinarians, groomers, pet stores, and daycare near you.

**Filter Tabs:**
- All
- Vets
- Groomers
- Pet Stores
- Daycare

**Toggle:** "Open Now" (filter by current hours)

**List View:**
- Service type badge (color-coded)
- Venue name
- Open/Closed indicator (green dot or red dot)
- Address
- Phone/website icons
- Distance

**Emergency Banner (Top):**
> **Need emergency care?** [See 24/7 emergency vets →]

**Empty State:**
> No services found. Try adjusting filters or check back later.

---

## 4. Voice & Tone Guidelines

### Brand Personality

ROMP is:
- **Warm** - Welcoming, inclusive, empathetic
- **Modern** - Clean, clear, unpretentious
- **Playful** - A little humor, but not childish
- **Knowledgeable** - Trustworthy, helpful, experienced

ROMP is NOT:
- Corporate/sterile
- Overly cutesy (no "furbaby" talk)
- Snarky or cynical
- Dense or jargon-heavy

### Voice Principles

1. **Active, not passive**
   - ✅ "Let them run free"
   - ❌ "Off-leash areas are provided"

2. **Conversational, not formal**
   - ✅ "Know a great spot? Tag it."
   - ❌ "Users may submit venue recommendations via the tagging interface."

3. **Specific, not vague**
   - ✅ "Fenced area with separate small dog section"
   - ❌ "Dog-friendly amenities available"

4. **Encouraging, not demanding**
   - ✅ "Help us build the map"
   - ❌ "You must submit tags to use this feature"

### Copy Examples

#### Headlines (Good)

- "This weekend: 12 reasons to leave the couch"
- "Piedmont Dog Park: The big side. Always."
- "Three Dog Bakery: Fresh treats on the BeltLine"
- "Saturday adoption event — come for the puppies, leave with a best friend"
- "Off-leash parks within 3 miles"
- "Pup cups, dog menus, and treats worth the drive"

#### Headlines (Bad)

- "Discover curated pet experiences in metropolitan Atlanta" (too corporate)
- "Find local veterinary services near you" (too generic)
- "Atlanta's premier destination for pet owners" (too self-important)
- "Woof! Check out these paw-some spots!" (too cutesy)
- "Your furbaby deserves the best" (avoid "furbaby")

#### Empty States (Good)

- "Nothing on the calendar yet. Check back later this week."
- "Know a great off-leash spot? Tag it and help other dog owners find it."
- "We're just getting started. Tag your favorite dog-friendly spots."
- "The calendar's quiet right now. Check back soon."

#### Empty States (Bad)

- "No events found." (too blunt)
- "Sorry, we don't have any data for this section yet." (apologetic)
- "Be the first to contribute!" (pressuring)
- "Oops! Nothing here!" (too casual)

#### Error Messages (Good)

- "Something went wrong. Try again."
- "You must select at least one tag."
- "Please log in to tag venues."

#### Error Messages (Bad)

- "Error: Invalid input." (too technical)
- "Oops! Something broke!" (too casual)
- "Sorry, this feature isn't working right now." (apologetic)

### Tone Spectrum

| Context | Tone | Example |
|---------|------|---------|
| Empty state (no content yet) | Encouraging | "We're building the map. Know a great trail? Tag it." |
| Success confirmation | Warm, affirming | "Thanks for tagging this spot! Your contribution helps the ROMP community." |
| Error message | Clear, calm | "Something went wrong. Try again." |
| Feature explanation | Helpful, friendly | "Select all that apply. This helps everyone know what to expect." |
| Section headers | Playful, inviting | "Let them run free" / "Treats, menus, and puppuccinos" |

### Word Choices

**Use:**
- Dog (not "pup" except in "pup cup")
- Owner or "dog owner" (not "pet parent" or "dog mom/dad")
- Adoption (not "rescue" as a verb)
- Off-leash area (not "dog run")
- Fenced / unfenced (not "secured")

**Avoid:**
- Furbaby, fur kid, doggo (except in very casual contexts)
- Pupper, pupperino (internet slang)
- Hooman (baby talk)
- Furriend (cutesy portmanteau)
- Pawsome, pawsitive (pun overload)

### Writing for Scannability

Users are holding a leash. They're scrolling one-handed. Copy must be:
- **Short** - Sentences under 20 words
- **Scannable** - Key info first, details second
- **Actionable** - Clear next steps

**Before (verbose):**
> This venue has been tagged by the community as dog-friendly. Amenities that have been reported include water bowls, outdoor patio seating, and complimentary dog treats. Please note that availability may vary.

**After (concise):**
> Water bowls · Outdoor patio · Dog treats

---

## 5. Content Hierarchy Per Section

### This Weekend (Events)

**Primary Info:**
1. Event name
2. Date + time
3. Venue name + neighborhood

**Secondary Info:**
1. Event photo
2. Price (free vs. paid)
3. Category badge (adoption, social, training)

**Tertiary Info:**
1. Tags (dog-social, yappy-hour, etc.)
2. Venue address
3. RSVP count (future feature)

**Primary Action:** Tap to see event details + RSVP

---

### Off-Leash Parks (Venues)

**Primary Info:**
1. Park name
2. Fenced/Unfenced status
3. Distance from user

**Secondary Info:**
1. Neighborhood
2. Small dog area (if applicable)
3. Photo

**Tertiary Info:**
1. Other amenities (water bowls, agility, etc.)
2. Surface type
3. Parking availability

**Primary Action:** Tap to see full park details + directions

---

### Pup Cup Spots (Venues)

**Primary Info:**
1. Venue name
2. What they offer (pup cups, dog menu, treats)
3. Photo

**Secondary Info:**
1. Neighborhood
2. Distance

**Tertiary Info:**
1. Hours (if available)
2. Outdoor patio (if applicable)
3. Other tags

**Primary Action:** Tap to see menu details + directions

---

### Adopt (Events)

**Primary Info:**
1. Shelter/rescue name + logo
2. "Adoption Event" badge
3. Date + time + location

**Secondary Info:**
1. Event photo (dogs available, if provided)
2. Event description

**Tertiary Info:**
1. Shelter website link
2. Adoption process info (future feature)

**Primary Action:** Tap to see event details + shelter info

---

### Training & Classes (Events)

**Primary Info:**
1. Class name
2. Class type (puppy, obedience, agility)
3. Date + time

**Secondary Info:**
1. Facility name
2. Location
3. Price

**Tertiary Info:**
1. Instructor name (if available)
2. Prerequisites (if any)
3. Registration link

**Primary Action:** Tap to register or get details

---

### Dog-Friendly Spots (Venues)

**Primary Info:**
1. Venue name
2. Amenity tags (water bowls, patio, etc.)
3. Neighborhood

**Secondary Info:**
1. Venue type (brewery, restaurant, cafe)
2. Photo
3. Distance

**Tertiary Info:**
1. Hours
2. Website
3. Other vibes/tags

**Primary Action:** Tap to see full venue details

---

### Services (Venues)

**Primary Info:**
1. Service type badge (Vet, Groomer, etc.)
2. Venue name
3. Open/Closed indicator

**Secondary Info:**
1. Address
2. Phone number
3. Distance

**Tertiary Info:**
1. Hours details
2. Services offered (tags)
3. Website

**Primary Action:** Tap to see hours + contact info

---

### Trails & Nature (Venues)

**Primary Info:**
1. Trail name
2. Surface type (paved, dirt)
3. Leash policy

**Secondary Info:**
1. Distance/length (if available)
2. Water access
3. Photo

**Tertiary Info:**
1. Parking availability
2. Shade
3. Difficulty (future feature)

**Primary Action:** Tap to see full trail details + directions

---

## 6. Content Operations

### Seed Data Workflow

**Phase 1: Foundation (Week 1)**
1. Add 15 dog parks with full tag coverage
2. Add 20 trails with surface/access tags
3. Add 10 pup cup spots
4. Add 5 emergency vets, 3 low-cost clinics
5. Add 6 shelter/rescue orgs

**Phase 2: Breadth (Week 2)**
1. Add 30 breweries/restaurants with dog-friendly tags
2. Add 10 groomers
3. Add 10 pet stores
4. Add 5 training facilities
5. Tag all existing events with dog-relevant tags

**Phase 3: Depth (Week 3-4)**
1. Add missing trails (target: 30 total)
2. Add missing parks (target: 25 total)
3. Expand pup cup list (target: 40 venues)
4. Add daycare facilities (target: 8)

**Launch Threshold:** 150 venues + 50 events = 200 total items

### Community Tag Moderation (Future)

**Auto-approve in V1** - No moderation queue initially

**Future moderation features:**
- Flag incorrect tags
- Community voting on tag accuracy
- Admin review dashboard
- Auto-remove tags with negative votes

### Editorial Calendar

**Weekly:**
- Curate "This Weekend" picks (manual highlights)
- Check for stale empty states
- Add new events from crawlers

**Monthly:**
- Review tag accuracy
- Add 5-10 new venues from community suggestions
- Update service hours
- Audit dead links

**Quarterly:**
- Major venue batch imports (groomers, vets, etc.)
- Update shelter/rescue org profiles
- Refresh hero imagery
- Review voice/tone consistency

---

## Appendix: Copy Matrix

Quick reference for common UI strings.

| UI Element | Copy |
|------------|------|
| Portal tagline | "Things to do with your dog in Atlanta" |
| Mobile nav: Feed | Explore |
| Mobile nav: Find | Find |
| Mobile nav: Saved | Saved |
| Tag CTA (feed) | Missing a spot? Tag it as dog-friendly. |
| Tag CTA (venue page) | Tag as dog-friendly |
| Tag modal header | Tag This Spot |
| Tag modal submit | Submit Tags |
| Tag success | Thanks for tagging this spot! |
| Empty state (generic) | Nothing here yet. Check back soon. |
| Empty state (CTA) | Know a great spot? Tag it. |
| Filter: All | All |
| Filter: Fenced | Fenced |
| Filter: Unfenced | Unfenced |
| Filter: Paved | Paved |
| Sort: Distance | Nearest |
| Sort: Name | A-Z |
| "Open Now" toggle | Open Now |
| Emergency vet banner | Need emergency care? See 24/7 vets |
| See all link | See all → |
| Login prompt | Log in to tag venues |
| Error (generic) | Something went wrong. Try again. |

---

## Success Metrics

**Content Coverage (Launch Goals):**
- 150+ venues tagged
- 50+ events
- 15+ off-leash parks with full tag coverage
- 25+ trails with surface/access tags
- 6+ shelter orgs with profiles

**Community Contribution (Month 1 Goals):**
- 20+ community-submitted tags
- 5+ new venues tagged by users
- 10+ tag corrections/updates

**Engagement (Month 1 Goals):**
- 50% of visitors scroll past 3 feed sections
- 20% of visitors tap into a deep page
- 10% of authenticated users submit at least 1 tag

---

## Next Steps

1. **Seed Data Batch 1** - Load 15 dog parks, 20 trails, 10 pup cup spots (data team)
2. **Tag Vocabulary Implementation** - Update database schema with full tag set (engineering)
3. **Copy Integration** - Implement all section headers, CTAs, empty states (product/design)
4. **Tag Submission UI** - Build modal with grouped tag options (engineering)
5. **Deep Pages** - Implement `/parks`, `/pup-cups`, `/adopt`, `/training`, `/services` (product)

