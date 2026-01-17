# Lost City Feature Backlog

Features from the Lovable redesign to implement in the Next.js codebase.

---

## UI/UX Improvements

### Event Cards Redesign
- [x] Time column layout (large time on left)
- [x] Live event indicator with pulsing dot
- [x] Category-colored badges using new neon palette
- [x] "Featured" and "Trending" badge indicators
- [x] Friends going avatar stack
- [x] Hover glow effect using `.card-interactive`
- [x] Price display integration

### Filter System Overhaul
- [x] Horizontal scroll filter chips (Today, Tomorrow, Weekend, categories)
- [x] Active chip with neon glow effect
- [x] Full-screen filter drawer (slide from right)
- [x] Filter sections: When, Neighborhood, Price, Social
- [x] "Show X Events" counter in filter footer

### Search Experience
- [x] Full-screen search overlay with backdrop blur
- [x] Popular searches as quick chips
- [x] Results grouped by: Events, Venues, Neighborhoods
- [x] Live search with instant results
- [x] ESC to close keyboard hint

### Header Updates
- [x] Glass effect on scroll
- [x] Gradient underline on logo
- [x] Pill-style navigation (Events | Collections)
- [x] Icon buttons: Search, Map, Bookmarks, User

---

## New Features

### Social Proof
- [x] Add `attendee_count` to events table
- [x] "X interested" display on event cards
- [x] Friends going feature (requires follow system integration)
- [x] "Who's Going" section on event detail page

### Live Events
- [x] Add `is_live` field to events
- [x] Pulsing live indicator badge
- [x] Filter for "Happening Now"
- [x] Real-time status updates

### Featured & Trending
- [x] Add `is_featured` and `is_trending` fields
- [x] Admin UI to mark events as featured
- [x] Trending algorithm based on saves/views
- [x] Featured badge with star icon
- [x] Trending badge with fire icon

### Collections Enhancement
- [x] Collection cover images
- [x] Collection descriptions
- [x] Public/private toggle
- [x] Browse collections page
- [x] "Date Night Picks", "Free This Week" etc.

### Venue Pages
- [x] Dedicated venue detail page (`/spots/[slug]`)
- [x] Venue vibes/tags (Underground, Live Music, Rooftop, etc.)
- [x] Upcoming events count
- [x] Venue description
- [x] Related events at venue

### View Toggle
- [x] Events / Venues / Map view toggle
- [x] Persist view preference
- [x] Map view with event markers

---

## Data Model Changes (Completed)

### Events Table
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendee_count INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false;
```

### Venues Table
```sql
ALTER TABLE venues ADD COLUMN IF NOT EXISTS vibes TEXT[];
ALTER TABLE venues ADD COLUMN IF NOT EXISTS description TEXT;
```

---

## Animation & Polish

- [x] Add Framer Motion for page transitions
- [x] Staggered fade-up on event list load
- [x] Smooth drawer open/close animations
- [x] Search overlay transitions
- [x] Card hover lift effect

---

## Priority Order (Suggested)

1. **High Impact, Low Effort** - DONE
   - ~~Event card hover glow (CSS only)~~
   - ~~Status badges (Live, Featured, Trending)~~
   - ~~Filter chip redesign~~

2. **High Impact, Medium Effort** - DONE
   - ~~Search overlay~~
   - ~~Venue pages~~
   - ~~Social proof (attendee counts)~~

3. **Medium Impact, Higher Effort** - DONE
   - ~~Full filter drawer~~
   - ~~Friends going feature~~
   - ~~Map view~~

---

## Design System (Completed)

- [x] Neon color palette (magenta, cyan, amber, green)
- [x] Glow effects (.glow, .glow-sm, .glow-lg)
- [x] Text glow (.text-glow)
- [x] Gradient text (.gradient-text-neon)
- [x] Interactive cards (.card-interactive)
- [x] Glass effect (.glass)
- [x] Status badges (.badge-live, .badge-trending, etc.)
- [x] New animations (fade-up, scale-in, pulse-glow, shimmer)
- [x] Space Grotesk display font

---

## Remaining Items

### Quick Wins
- [x] Glass effect on header scroll
- [x] Gradient underline on logo hover
- [x] Filter for "Happening Now" (live events)

### Medium Effort
- [x] Friends going avatar stack on event cards
- [x] "Who's Going" section on event detail
- [x] Admin UI to mark events as featured

### Larger Features
- [x] Framer Motion page transitions
- [x] View toggle (Events/Venues/Map)
- [x] Collections enhancements
