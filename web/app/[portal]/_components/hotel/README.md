# Hotel Concierge Components

Luxury hotel vertical components for the LostCity portal system.

## Components

### `TimeGreeting.tsx`
Time-aware greeting component that displays "Good Morning", "Good Afternoon", or "Good Evening" based on the current time, along with an elegantly formatted date.

**Usage:**
```tsx
<TimeGreeting />
```

### `HotelSection.tsx`
Section wrapper component providing consistent spacing and typography for hotel feed sections.

**Props:**
- `title: string` - Section heading (serif)
- `subtitle?: string` - Optional section description
- `children: ReactNode` - Section content
- `className?: string` - Additional classes

**Usage:**
```tsx
<HotelSection title="This Evening" subtitle="Events happening tonight">
  {/* Event cards */}
</HotelSection>
```

### `HotelEventCard.tsx`
Event card with two variants: featured (large) and compact (list).

**Props:**
- `event: Event` - Event object with title, date, venue, etc.
- `portalSlug: string` - Portal slug for URL building
- `variant?: "featured" | "compact"` - Card style (default: "featured")

**Features:**
- Featured: 16:9 image, serif title, full description, generous padding
- Compact: 80x80 thumbnail, inline layout, condensed info
- Shows distance from hotel if available
- "Complimentary for Guests" for free events

**Usage:**
```tsx
<HotelEventCard event={event} portalSlug="forth" variant="featured" />
```

### `HotelVenueCard.tsx`
Venue/destination card showing venue photos, type, neighborhood, and next event.

**Props:**
- `venue: Venue` - Venue object with name, type, image, etc.
- `portalSlug: string` - Portal slug for URL building

**Features:**
- 4:3 aspect ratio images
- Shows venue type, neighborhood, distance, vibe tags
- "Next event" preview if available
- Serif venue names

**Usage:**
```tsx
<HotelVenueCard venue={venue} portalSlug="forth" />
```

### `HotelHeader.tsx`
Minimal, refined header for hotel portals.

**Props:**
- `portalSlug: string` - Portal slug for navigation
- `portalName: string` - Hotel name
- `logoUrl?: string | null` - Hotel logo URL (optional)

**Features:**
- Light background with thin border
- Hotel logo + "Concierge" label
- Simple navigation: Today / Events / Explore
- Sticky positioning

**Usage:**
```tsx
<HotelHeader
  portalSlug="forth"
  portalName="FORTH Hotel"
  logoUrl="/logos/forth.png"
/>
```

### `HotelFeed.tsx`
Main feed layout component organizing hotel content into sections.

**Props:**
- `portal: Portal` - Full portal object
- `todayEvents: Event[]` - Events happening today
- `upcomingEvents: Event[]` - Events this week
- `curatedEvents?: Event[]` - Curated picks (optional)
- `nearbyVenues?: Venue[]` - Nearby destinations (optional)

**Sections:**
1. Time Greeting
2. Today's Events (grouped by time of day)
3. Our Picks (curated events with staff attribution)
4. Explore Nearby (venues within walking distance)
5. Coming Up (events this week)

**Usage:**
```tsx
<HotelFeed
  portal={portal}
  todayEvents={todaysEvents}
  upcomingEvents={upcomingEvents}
  curatedEvents={picks}
  nearbyVenues={venues}
/>
```

### `HotelFeedClient.tsx`
Client-side wrapper that fetches data and renders HotelFeed.

**Props:**
- `portal: Portal` - Full portal object

**Features:**
- Fetches from `/api/portals/[slug]/feed`
- Splits events into today vs upcoming
- Shows elegant loading skeleton
- Handles errors gracefully

**Usage:**
```tsx
<HotelFeedClient portal={portal} />
```

## Design Principles

### Typography
- **Headings**: Cormorant Garamond (serif) - elegant, high contrast
- **Body**: Inter (sans-serif) - clean, readable
- **Spacing**: 0.15em tracking for labels, tight tracking for titles

### Colors
All colors use CSS variables from `globals.css`:

- `--hotel-ivory` (#FDFBF7) - Background
- `--hotel-cream` (#F5F3EE) - Card backgrounds
- `--hotel-charcoal` (#2F2D2A) - Primary text
- `--hotel-stone` (#9B968C) - Secondary text
- `--hotel-champagne` (#D4AF7A) - Accent (links, time, prices)
- `--hotel-sand` (#E8E4DD) - Borders, placeholders

### Spacing
- Section gaps: 64px (`mb-16`)
- Card padding: 24px (`p-6`)
- Card grids: 40px gap (`gap-10`)
- Content max-width: 1280px (`max-w-5xl`)

### Shadows
- Soft: `shadow-[var(--hotel-shadow-soft)]` - Default card state
- Medium: `shadow-[var(--hotel-shadow-medium)]` - Hover state
- No glow effects, no neon, no borders on cards

### Animations
- Timing: 400-600ms (slow, refined)
- Easing: `var(--hotel-ease-elegant)` - cubic-bezier(0.16, 1, 0.3, 1)
- Effects: Subtle fade-in, gentle lift on hover, scale 1.05 on image hover
- No shimmer, no pulse, no particle effects

### Language
- "Complimentary for Guests" instead of "Free"
- "This Evening" instead of "Happening Now"
- "Explore" instead of "Check it out"
- Refined, sophisticated tone

## Styling

All components use Tailwind classes with hotel CSS variables. The hotel theme is activated by the `[data-vertical="hotel"]` attribute on the portal layout.

**Example:**
```tsx
<div className="bg-[var(--hotel-cream)] text-[var(--hotel-charcoal)]">
  <h2 className="font-display text-2xl">Event Title</h2>
  <p className="font-body text-sm text-[var(--hotel-stone)]">Venue Name</p>
</div>
```

## Data Requirements

### Events
- `id`, `title`, `start_date`, `start_time`
- `image_url`, `blurhash` (for progressive loading)
- `description`, `venue_name`, `category`
- `price_min` (null for free events)
- `distance_km` (calculated from hotel geo_center)

### Venues
- `id`, `slug`, `name`, `image_url`
- `venue_type`, `neighborhood`, `vibes`
- `distance_km` (calculated from hotel geo_center)
- `next_event` (optional: next upcoming event)

## Future Enhancements

1. **Server-side data fetching** - Move data fetching to template for better performance
2. **Proximity calculations** - Haversine distance from hotel coordinates
3. **Curated sections** - Integration with portal_sections table
4. **Venue filters** - Browse by type: Restaurants, Bars, Coffee, Attractions
5. **Day planner** - Horizontal day selector with grouped events
6. **Weather awareness** - Surface indoor/outdoor events based on forecast
7. **Guest preferences** - Taste selector for personalized recommendations
