# BP-2 Consumer IA: Atlanta Dog Portal

## Primary Navigation

Bottom nav with 3 tabs (mobile) / top nav pills (desktop):

| Tab | Label | URL | Purpose |
|-----|-------|-----|---------|
| 1 | **Explore** | `/atl-dogs` | Blended discovery feed (events + places) |
| 2 | **Map** | `/atl-dogs?view=map` | Full-screen map with all dog-friendly pins |
| 3 | **Saved** | `/atl-dogs?view=saved` | Your saved events and places |

**Why 3, not 4+**: One-handed use. Fewer tabs = bigger tap targets = easier with
a leash in the other hand. "Explore" is the clear default.

---

## Route Map

### Consumer Routes

| Route | Purpose | Template |
|-------|---------|----------|
| `/atl-dogs` | Main blended feed | DogTemplate (new) |
| `/atl-dogs?view=map` | Map discovery | DogTemplate map mode |
| `/atl-dogs?view=saved` | Saved items | DogTemplate saved mode |
| `/atl-dogs?category=parks` | Category filter (parks, events, services, trails) | DogTemplate filtered |
| `/atl-dogs/events/[id]` | Event detail | Existing DetailViewRouter |
| `/atl-dogs/spots/[slug]` | Place detail (park, bakery, vet) | Existing DetailViewRouter |
| `/atl-dogs/lists/[slug]` | Curated list | Existing list page |

### URL Parameters

| Param | Values | Purpose |
|-------|--------|---------|
| `view` | `feed` (default), `map`, `saved` | Primary view switch |
| `category` | `parks`, `events`, `services`, `trails`, `food` | Content type filter |
| `when` | `today`, `weekend`, `week` | Temporal filter (events only) |
| `near` | `me`, lat/lng | Proximity sort |
| `q` | search string | Text search |

### Admin Routes (existing infra)

| Route | Purpose |
|-------|---------|
| `/atl-dogs/admin` | Portal admin dashboard |
| `/atl-dogs/admin/sources` | Source management |
| `/atl-dogs/admin/analytics` | Portal analytics |

---

## Section Hierarchy: Explore Feed

What appears on the main page, in order. This is the "open the app, what do I
see" experience.

### 1. Hero / Welcome (above the fold)

**What**: Portal name + tagline + single CTA
**Example**:
```
ROMP
All the dog-friendly stuff in Atlanta.
[Explore the map 🗺️]
```
**Why first**: Emotional hook. Sets the tone immediately. "Kinda dumb, like dogs."
**Operator-editable**: Yes (headline, subhead, CTA text, CTA link)

### 2. This Weekend (time-sensitive carousel)

**What**: Horizontal carousel of events happening this weekend
**Example cards**: "Adoption event at Piedmont • Sat 10am" / "Yappy Hour at Fetch • Fri 6pm"
**Why second**: Answers "what can I do with my dog this weekend?" — the primary JTBD
**Source**: Events with `start_date` within next 7 days, filtered by dog source policy
**Empty state**: "Quiet weekend? Here are parks that never cancel." (link to parks)

### 3. Dog Parks Near You (proximity-sorted places)

**What**: Horizontal carousel of dog parks, sorted by distance
**Example cards**: "Piedmont Off-Leash • 0.3 mi" / "Fetch Dog Park • 1.2 mi"
**Why third**: Always-available content. Even if no events this weekend, parks are there.
**Source**: Venues with `dog-friendly` vibe or `dog-park` type, sorted by haversine distance
**Requires**: User location (prompt once, cache)

### 4. New Spots (recently added places)

**What**: Vertical stack of 3-5 recently added dog-friendly places
**Example**: "Three Dog Bakery just added • BeltLine" / "Bark & Brew • Decatur"
**Why fourth**: Freshness signal. Shows the portal is alive and growing.
**Source**: Venues added in last 30 days with dog-relevant tags

### 5. Curated Lists (editorial navigation)

**What**: Grid of 4-6 curated list cards
**Example lists**:
- "Best Off-Leash Parks"
- "Pup Cup Spots" (restaurants that serve dogs)
- "Rainy Day Options" (indoor dog-friendly)
- "New Dog Parent Starter Pack"
- "Dog-Friendly Patios"
- "Weekend Road Trips (Dog Edition)"
**Why fifth**: Navigation into depth. Users who scroll this far want to browse.
**Source**: Manually curated lists (operator-editable)

### 6. Happening Today (if anything)

**What**: Compact list of events happening right now or starting soon
**Conditional**: Only shows if there are events today. If not, skipped entirely.
**Why sixth**: Utility for people who are out right now with their dog.
**Source**: Events with `start_date` = today, sorted by start time

### 7. Trails & Nature (places carousel)

**What**: Horizontal carousel of trails and nature spots
**Example cards**: "Sweetwater Creek • 8.2 mi" / "BeltLine Eastside • 2.1 mi"
**Why seventh**: Outdoor adventure content (AllTrails influence). Always available.
**Source**: Venues with trail/nature type or tags, from base Atlanta data

### 8. Community Tag (crowdsource CTA)

**What**: Compact banner encouraging users to tag places as dog-friendly
**Example**: "Know a dog-friendly spot we're missing? [Tag it →]"
**Why last**: Engaged users who've scrolled the full feed are most likely to contribute

---

## Journey Maps

### Journey 1: Urban Dog Owner (Primary)
**Trigger**: "What should we do this weekend?"

```
Open app → See hero + "This Weekend" carousel
  → Swipe through 4-5 weekend events
  → Tap "Adoption Event at Piedmont"
  → See event detail (time, location, description, map)
  → Save it / Share it
  → Back to feed, keep scrolling
  → See "Dog Parks Near You" → Tap one for directions
```

**Key metric**: Events viewed per session, saves per session

### Journey 2: New Dog Parent
**Trigger**: "I just got a dog, where do I even start?"

```
Open app → See hero
  → Scroll to "Curated Lists"
  → Tap "New Dog Parent Starter Pack"
  → Browse list: nearest vet, best training class, first dog park
  → Save several items
  → Return to feed
  → See "Dog Parks Near You" → Visit one
```

**Key metric**: List engagement, items saved from lists

### Journey 3: "I'm Out With My Dog Right Now"
**Trigger**: Standing in a park, wondering what else is nearby

```
Open app → Tap "Map" tab
  → See full-screen map with nearby pins
  → See dog park 0.3 mi away, bakery 0.5 mi away
  → Tap bakery pin → See bottom sheet with details
  → Tap "Directions" → Opens Maps app
```

**Key metric**: Map opens, direction taps

### Journey 4: Dog Community Organizer
**Trigger**: "When's the next event I can volunteer at?"

```
Open app → Tap search
  → Type "volunteer" or filter by category "events"
  → See filtered list of upcoming volunteer opportunities
  → Tap "LifeLine Vaccine Clinic"
  → Share to their breed group chat
```

**Key metric**: Shares per session, search usage

### Journey 5: Visiting Atlanta With Dog
**Trigger**: "We're in town for a week, what's dog-friendly?"

```
Open app → See hero
  → Tap "Explore the Map"
  → See everything near their hotel
  → Tap "Dog-Friendly Patios" list
  → Browse restaurants
  → Save a few, plan their evening
```

**Key metric**: Items saved, map interactions

---

## Scope Boundaries

### Intentionally INCLUDED
- Dog-friendly events (adoption, training, social, festivals, brewery nights)
- Dog parks and off-leash areas
- Dog-friendly restaurants, patios, breweries, cafes
- Dog services (vets, groomers, trainers, daycares, walkers)
- Dog bakeries and supply shops
- Trails and nature spots (from base Atlanta, filtered for dog-relevant)
- Curated editorial lists
- User-submitted "dog-friendly" tags on venues
- Saving and sharing events/places
- Map-based discovery

### Intentionally EXCLUDED
- Dog breeding or sales listings
- Veterinary medical advice or telemedicine
- Pet insurance or financial products
- E-commerce (buying products through the portal)
- Lost & found pets (liability, time-sensitivity — better served by dedicated platforms)
- Dog sitting/walking marketplace (Rover owns this)
- Breed-specific forums or social feeds
- User profiles or social features (v1 — may add later)
- Push notifications (v1 — may add later)
- User-submitted events (v1 — operator-curated only to maintain quality)

### Explicit Non-Goals
- Not a Yelp for dogs (no user reviews in v1)
- Not a Rover competitor (no service marketplace)
- Not a social network (no profiles, follows, posts in v1)
- Not a pet health app (no medical content)
- Not national (Atlanta only in v1)

---

## Detail Views

### Event Detail (existing component, styled to portal)
- Hero image (or color-block fallback)
- Event name (Baloo 2)
- Date/time with "starts in X hours" relative time
- Venue name + map
- Description
- Tags (dog-friendly, free, outdoor, etc.)
- [Save] [Share] [Directions] CTAs
- "More events this weekend" carousel at bottom

### Place Detail (existing component, styled to portal)
- Hero image (or color-block fallback)
- Place name (Baloo 2)
- Type badge (Dog Park / Restaurant / Vet / etc.)
- Distance from user
- Hours (if available)
- Description
- Dog-specific info: "Off-leash: Yes" / "Water bowls: Yes" / "Pup cup: Yes"
- Map
- [Save] [Share] [Directions] CTAs
- "Nearby dog-friendly spots" carousel at bottom

---

## Filter System

### Category Filters (pill-style, horizontal scroll)
- All (default)
- Parks & Trails
- Events
- Food & Drink
- Services
- Shops

### Temporal Filters (for events)
- Today
- This Weekend
- This Week
- Anytime

### Sort Options
- Nearest (default, requires location)
- Newest (recently added)
- Happening Soon (time-based, events only)

Filters are additive. Category + temporal work together.
All filters are URL-param based (shareable, bookmarkable).
