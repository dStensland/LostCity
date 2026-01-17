# Lost City Feature Backlog

Features from the Lovable redesign to implement in the Next.js codebase.

---

## UI/UX Improvements

### Event Cards Redesign
- [ ] Time column layout (large time on left)
- [ ] Live event indicator with pulsing dot
- [ ] Category-colored badges using new neon palette
- [ ] "Featured" and "Trending" badge indicators
- [ ] Friends going avatar stack
- [ ] Hover glow effect using `.card-interactive`
- [ ] Price display integration

### Filter System Overhaul
- [ ] Horizontal scroll filter chips (Today, Tomorrow, Weekend, categories)
- [ ] Active chip with neon glow effect
- [ ] Full-screen filter drawer (slide from right)
- [ ] Filter sections: When, Neighborhood, Price, Social
- [ ] "Show X Events" counter in filter footer

### Search Experience
- [ ] Full-screen search overlay with backdrop blur
- [ ] Popular searches as quick chips
- [ ] Results grouped by: Events, Venues, Neighborhoods
- [ ] Live search with instant results
- [ ] ESC to close keyboard hint

### Header Updates
- [ ] Glass effect on scroll
- [ ] Gradient underline on logo
- [ ] Pill-style navigation (Events | Collections)
- [ ] Icon buttons: Search, Map, Bookmarks, User

---

## New Features

### Social Proof
- [ ] Add `attendee_count` to events table
- [ ] "X interested" display on event cards
- [ ] Friends going feature (requires follow system integration)
- [ ] "Who's Going" section on event detail page

### Live Events
- [ ] Add `is_live` field to events
- [ ] Pulsing live indicator badge
- [ ] Filter for "Happening Now"
- [ ] Real-time status updates

### Featured & Trending
- [ ] Add `is_featured` and `is_trending` fields
- [ ] Admin UI to mark events as featured
- [ ] Trending algorithm based on saves/views
- [ ] Featured badge with star icon
- [ ] Trending badge with fire icon

### Collections Enhancement
- [ ] Collection cover images
- [ ] Collection descriptions
- [ ] Public/private toggle
- [ ] Browse collections page
- [ ] "Date Night Picks", "Free This Week" etc.

### Venue Pages
- [ ] Dedicated venue detail page (`/venues/[slug]`)
- [ ] Venue vibes/tags (Underground, Live Music, Rooftop, etc.)
- [ ] Upcoming events count
- [ ] Venue description
- [ ] Related events at venue

### View Toggle
- [ ] Events / Venues / Map view toggle
- [ ] Persist view preference
- [ ] Map view with event markers

---

## Data Model Changes

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

- [ ] Add Framer Motion for page transitions
- [ ] Staggered fade-up on event list load
- [ ] Smooth drawer open/close animations
- [ ] Search overlay transitions
- [ ] Card hover lift effect

---

## Priority Order (Suggested)

1. **High Impact, Low Effort**
   - Event card hover glow (CSS only)
   - Status badges (Live, Featured, Trending)
   - Filter chip redesign

2. **High Impact, Medium Effort**
   - Search overlay
   - Venue pages
   - Social proof (attendee counts)

3. **Medium Impact, Higher Effort**
   - Full filter drawer
   - Friends going feature
   - Map view

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
