# Explore UX Patterns Research
**Date**: 2026-02-14  
**Context**: LostCity Explore screen - 14 thematic "tracks" for Atlanta discovery  
**References**: Atlas Obscura, Airbnb Experiences, Headout, Google Arts & Culture, Time Out

---

## Design Brief Recap

**Emotional Register**: Curious, adventurous, wonder  
**Reference App**: Atlas Obscura  
**Anti-Reference**: Facebook (generic, algorithmic, soulless)  
**Color Temperature**: Hip neon  
**Density**: Rich and packed  
**Photography**: Candid, gonzo  
**Typography**: Bold display  
**Motion**: Animated, humming with energy  
**Audience**: Both locals and visitors  
**One Word**: Adventure

**Content Structure**:
- 14 thematic tracks (e.g., "Good Trouble", "The South Got Something to Say", "Hard in Da Paint")
- Each track has: quote, portrait photo, 5-20 curated venues with editorial blurbs
- Evergreen but alive - venues have current exhibitions, upcoming events, seasonal context

---

## 1. Atlas Obscura - Master Pattern Analysis

### Information Architecture

**Three-Tier Discovery Model:**

1. **City Landing Page**
   - Hero image + city overview
   - "Must-see" featured places (3-5 hero cards)
   - Category filters (historical, natural wonders, museums, food & drink, etc.)
   - Map toggle (list ↔ map view)

2. **Place Collection Pages**
   - Thematic collections (e.g., "Hidden Gems", "Underground Spaces", "Street Art")
   - Masonry grid layout (Pinterest-style)
   - Rich imagery + intrigue-driven headlines
   - Each card shows: image, title, 1-2 sentence teaser, location pin

3. **Individual Place Page**
   - Large hero image
   - Editorial description (storytelling voice, not dry facts)
   - "Know Before You Go" practical info
   - Related places carousel
   - User-contributed photos
   - Comments/trip reports

### Key UX Patterns

**Progressive Disclosure:**
- Card teaser → Full description → Related exploration
- Never show everything at once; maintain intrigue
- "Read More" expansions for long editorial text

**Storytelling Cards:**
- Every card has a "hook" - weird fact, mysterious angle, provocative question
- Images are atmospheric, not stock photos
- Typography: bold display headlines (18-24px) over candid imagery

**Collection Browsing:**
- Horizontal pill navigation for categories (sticky on scroll)
- Masonry grid maintains visual interest (varying card heights)
- Infinite scroll for deep browsing sessions

**"Alive" Indicators:**
- "Recently added" badges
- "User photos" count
- "Been here? Add it to your list" CTA

---

## 2. Airbnb Experiences - Category Discovery

### Navigation Model

**Two-Phase Discovery:**

1. **Browse Phase** (Category overview)
   - Large category cards with lifestyle imagery
   - 3x2 grid on mobile, 4+ on desktop
   - Each card: category name, item count, hero image
   - Tap to drill into category

2. **Filter Phase** (Category detail)
   - Sticky filter bar (date, price, duration)
   - Sort options (popular, price, rating)
   - Card grid with experience details

### Card Anatomy

**Mobile Card (Experiences):**
```
┌─────────────────────────┐
│                         │
│   16:9 Hero Image       │ 
│   (with category badge) │
│                         │
├─────────────────────────┤
│ Title (2 lines max)     │
│ Price • Duration        │
│ ⭐ 4.9 (123)            │
└─────────────────────────┘
```

**Key Takeaways:**
- Images are HUGE (16:9 aspect ratio fills screen width)
- Category badges overlay images (top-left corner)
- Price/duration on same line (scannable)
- Ratings prominent but not dominant

### Dense Information Display

- Metadata: price, duration, group size, language ALL in one compact line
- Icons + text (not text alone) for scannability
- Collapsible "What's included" / "What to expect" sections (accordion pattern)

---

## 3. Headout / GetYourGuide - Activity Discovery

### Collection Pattern

**"Popular Experiences" Carousel:**
- Horizontal scroll (not paginated)
- Partial card peek (shows 1.3 cards on mobile)
- Momentum scroll (fling gesture)
- Card size: 75% of screen width (emphasis on imagery)

**Category Pills + Grid Hybrid:**
```
[Popular] [Museums] [Food Tours] [Nightlife] → horizontal scroll

┌──────┬──────┐
│ Card │ Card │
├──────┼──────┤
│ Card │ Card │
└──────┴──────┘
```

### "What's Happening Now" Pattern

**Live Activity Indicators:**
- "Starting in 2 hours" badges
- "Few spots left" scarcity markers
- "Trending" fire icon
- "Last booked 3 hours ago" social proof

**Implementation:**
- Small coral/amber badges at top-right of card image
- Pulsing animation on "live" events
- Font: uppercase mono, 10px, semibold

---

## 4. Google Arts & Culture - Collection-Based Browsing

### Collection Overview Pattern

**"Story" Cards (Magazine Layout):**

```
┌────────────────────────────┐
│                            │
│   Full-bleed image         │
│                            │
│  ┌──────────────────────┐  │
│  │ Overlaid Text Box    │  │
│  │ Title                │  │
│  │ Subtitle (1-2 lines) │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

**Key Features:**
- Text overlay uses semi-transparent dark box (glassmorphism)
- Vertical stacking on mobile (no side-by-side)
- Large tap target (entire card)
- Smooth page transitions (slide up from bottom)

### Track/Collection Detail Page

**Hero Section:**
- Full-width portrait/quote hero (3:2 aspect ratio)
- Quote overlaid on portrait with gradient mask
- Attribution below quote

**Content Sections:**
- Intro paragraph (editorial voice)
- "Featured" item carousel (horizontal scroll)
- "All Items" grid (2 columns on mobile)
- Sticky "Back to Collections" button (bottom-left FAB)

### Progressive Image Loading

- Low-quality placeholder (LQIP) with blur
- Fade-in transition when full image loads
- Skeleton shimmer for text (90% perceived performance improvement)

---

## 5. Time Out - City Guide Editorial UX

### Hero Pattern

**"Signature Experiences" Hero:**
```
┌─────────────────────────────────┐
│                                 │
│   21:9 Ultra-wide image         │
│   (Cinematic aspect ratio)      │
│                                 │
│   Gradient bottom 40%           │
│   Text overlay (left-aligned)   │
│   Title (32px bold)             │
│   Subtitle (14px)               │
│   CTA button                    │
└─────────────────────────────────┘
```

**Why 21:9?**
- More dramatic than 16:9
- Better accommodates text overlay
- Less vertical scroll on mobile

### Section Headers

**Editorial Section Pattern:**
- Large display font (28px) with icon
- Subheader (14px, muted color)
- Horizontal rule (1px, accent color)
- "View All" link (right-aligned)

```
┌────────────────────────────┐
│ 🎭 Best Shows This Week    │
│    Theater, comedy, music  │
│ ─────────────────────      │ View All →
└────────────────────────────┘
```

### Card Density (Mobile)

**Dense Card Anatomy:**
```
┌──────────┬─────────────────┐
│          │ Title           │
│  Square  │ Location • Type │
│  Image   │ Price | Hours   │
│  (1:1)   │ 📅 Today        │
└──────────┴─────────────────┘
```

- Image: 100px square (fixed, not responsive)
- Content: 60% of card width
- Compact vertical spacing (8px between lines)
- Icons inline with text (not separate rows)

---

## 6. Mobile-First Patterns for Density

### Masonry Grid (Pinterest-style)

**When to Use:**
- Varying content lengths (some venues need more description)
- Rich imagery with different aspect ratios
- Browsing behavior (not task-driven scanning)

**How It Works:**
- CSS Grid with `grid-auto-rows: 10px` + `grid-row: span X`
- Or React library: `react-masonry-css`
- Cards snap to grid rows (10px increments)
- Vertical scroll only (no horizontal)

**Implementation:**
```jsx
<div className="masonry-grid">
  {items.map(item => (
    <VenueCard 
      key={item.id}
      size={item.featured ? 'large' : 'normal'}
    />
  ))}
</div>
```

```css
.masonry-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 10px;
  gap: 12px;
}
```

### Overlapping Cards (Layered Stack)

**When to Use:**
- Feature highlights (top 3 picks)
- Visual drama on hero sections
- Shows "more content below" affordance

**Pattern:**
```
┌────────────┐
│  Card 1    │
│  (z-10)    │
├────────────┤
│  Card 2    │─┐
│  (z-9)     │ │
├────────────┤ │ ← Slight offset (8px)
│  Card 3    │ │   + shadow for depth
│  (z-8)     │─┘
└────────────┘
```

**CSS:**
```css
.card-stack .card:nth-child(1) { z-index: 10; }
.card-stack .card:nth-child(2) { 
  z-index: 9; 
  transform: translateY(-12px); 
}
.card-stack .card:nth-child(3) { 
  z-index: 8; 
  transform: translateY(-24px); 
}
```

### Content Peek Pattern

**Horizontal Scroll with Partial Reveal:**
- Show 1.2 cards on screen (20% of next card visible)
- Scroll snaps to card boundaries (`scroll-snap-type: x mandatory`)
- Momentum scrolling (native browser behavior)

**Benefits:**
- Signals "more content →"
- Encourages exploration
- Works with touch gestures

**CSS:**
```css
.scroll-container {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 16px;
  padding: 0 20px;
}

.card {
  flex: 0 0 calc(100vw - 80px); /* 20px padding × 2, 40px for peek */
  scroll-snap-align: start;
}
```

### Accordion Sections (Progressive Disclosure)

**When to Use:**
- Long editorial content (track descriptions)
- Venue details (hours, accessibility, parking)
- FAQ-style content

**Pattern:**
```
▼ Good Trouble: Atlanta's Civil Rights Legacy
  Martin Luther King Jr. National Historical Park
  Center for Civil and Human Rights
  Sweet Auburn Historic District
  [3 more venues...]

▶ The South Got Something to Say: Hip-Hop Heritage
```

**Interaction:**
- Tap header to expand/collapse
- Smooth height animation (200ms ease-in-out)
- Rotate chevron icon (90deg)
- Only one section open at a time (radio accordion) OR multiple open (checkbox accordion)

**Recommendation:** Use **checkbox accordion** (multiple sections open) for this use case - users may want to compare tracks.

---

## 7. Portrait/Quote Hero Patterns

### Option A: Full-Screen Takeover (Immersive)

**Layout:**
```
┌─────────────────────────────┐
│                             │
│   Portrait (full bleed)     │
│   Subtle vignette           │
│                             │
│   ┌───────────────────────┐ │
│   │ "Quote text"          │ │
│   │                       │ │
│   │ — Person Name         │ │
│   │   Title/Context       │ │
│   └───────────────────────┘ │
│                             │
│   [Swipe up to explore]     │
└─────────────────────────────┘
```

**Pros:**
- Maximum drama and impact
- Quote is highly readable
- Portrait gets hero treatment

**Cons:**
- Takes up full screen (requires scroll)
- May feel too heavy for secondary tabs

### Option B: Split Hero (Balanced)

**Layout:**
```
┌─────────────┬───────────────┐
│             │               │
│  Portrait   │  "Quote"      │
│  (left 40%) │               │
│             │  — Person     │
│             │    Context    │
└─────────────┴───────────────┘
```

**Pros:**
- More compact (50% of screen height)
- Quote + portrait immediately visible
- Faster scroll to content

**Cons:**
- Portrait less impactful (small)
- Text may wrap awkwardly on small screens

### Option C: Quote Card Over Portrait (Layered)

**Layout:**
```
┌───────────────────────────┐
│                           │
│   Portrait background     │
│   (subtle blur)           │
│                           │
│  ┌─────────────────────┐  │
│  │ Glass card          │  │
│  │                     │  │
│  │ "Quote"             │  │
│  │                     │  │
│  │ — Person            │  │
│  │   Context           │  │
│  └─────────────────────┘  │
│                           │
└───────────────────────────┘
```

**Pros:**
- Glassmorphism fits LostCity aesthetic
- Portrait provides context without dominating
- Quote is focal point
- Works with varying quote lengths

**Cons:**
- Requires careful contrast management
- Portrait must be non-busy (or heavily blurred)

**Recommendation:** **Option C (Glass Card)** - aligns with LostCity's glassmorphism design system, handles varying quote lengths gracefully, and maintains intrigue.

### Typography for Quotes

**Display Font:**
- Size: 20-24px on mobile, 28-32px on desktop
- Weight: 600-700 (semibold to bold)
- Line height: 1.3-1.4 (tight for drama)
- Italic: Optional (adds editorial voice)

**Attribution:**
- Size: 12-14px
- Weight: 500 (medium)
- Color: 70% opacity of main text
- Prefix: em dash (—) not hyphen (-)

**Example:**
```jsx
<div className="quote-card">
  <blockquote className="text-2xl font-bold leading-tight text-cream">
    "Good trouble is necessary trouble."
  </blockquote>
  <cite className="block mt-3 text-sm font-medium text-soft">
    — John Lewis
    <span className="block text-xs text-muted">
      Civil Rights Icon & Congressman
    </span>
  </cite>
</div>
```

---

## 8. "Alive" Indicators - Current Context

### Event Count Badges

**Pattern:**
```jsx
<div className="venue-card">
  <img ... />
  <div className="badge-container">
    {venue.next_event_title && (
      <span className="badge badge-live">
        Now: {venue.next_event_title}
      </span>
    )}
    {venue.upcoming_event_count > 0 && (
      <span className="badge badge-count">
        {venue.upcoming_event_count} upcoming
      </span>
    )}
  </div>
</div>
```

**Badge Styles:**
- Live: Coral background, pulsing animation
- Count: Muted background, static
- Position: Bottom-left of image (overlaid)
- Font: Mono, 10px, uppercase, semibold

### Time-Contextual Surfacing

**Show "Happening Today" Section:**
- If any venues in track have events today, show special section
- Sort venues by next event time
- Use different card style (with time indicator)

**Example:**
```
▼ Good Trouble: Atlanta's Civil Rights Legacy

  🔴 Happening Today
  ┌──────────────────────────┐
  │ MLK National Park        │
  │ Tour: 2:00 PM Today      │
  └──────────────────────────┘

  All Venues in This Track
  ┌──────────────────────────┐
  │ Center for Civil Rights  │
  │ 3 upcoming events        │
  └──────────────────────────┘
```

### Seasonal Context

**Conditional Blurbs:**
- Database field: `explore_blurb_seasonal` (optional)
- Show if current date in range (e.g., Dec-Jan for holiday events)
- Fallback to `explore_blurb` if out of season

**Example:**
```typescript
const getVenueBlurb = (venue: ExploreVenue) => {
  const month = new Date().getMonth();
  if (month >= 11 || month <= 0) { // Dec-Jan
    return venue.explore_blurb_seasonal || venue.explore_blurb;
  }
  return venue.explore_blurb;
};
```

### "New" Markers

**Show for Recently Added Venues:**
- If `created_at` within last 14 days
- Small "NEW" badge (top-right of card)
- Bright accent color (neon yellow/green)

---

## 9. Track Navigation Models

### Option A: Vertical Accordion (Simple)

**Layout:**
```
▼ Good Trouble (8 venues)
  [Venue cards in 2-column grid]

▶ The South Got Something to Say (12 venues)

▶ Hard in Da Paint (6 venues)

▶ ... (11 more tracks)
```

**Pros:**
- Simple mental model (expand/collapse)
- All tracks visible at glance
- Native scroll behavior

**Cons:**
- With 14 tracks, page is LONG
- Hard to jump between open tracks
- May feel overwhelming

### Option B: Tabbed Navigation (Segmented)

**Layout:**
```
[Track 1] [Track 2] [Track 3] → horizontal scroll
────────

[Content for active track]
```

**Pros:**
- One track at a time (focused)
- Clean, organized

**Cons:**
- Hides other tracks (low discoverability)
- Doesn't feel "packed" or "rich"
- More taps to explore multiple tracks

### Option C: Stacked Cards with Peek (Hybrid)

**Layout:**
```
┌─────────────────────────────┐
│ Good Trouble                │ ← Active (full height)
│ [Quote hero]                │
│ [8 venue cards]             │
└─────────────────────────────┘
┌─────────────────────────────┐
│ The South Got Something...  │ ← Collapsed (peek)
│ [Quote visible, venues hidden]
└─────────────────────────────┘
┌─────────────────────────────┐
│ Hard in Da Paint            │ ← Collapsed
└─────────────────────────────┘
```

**Interaction:**
- Tap collapsed card → scrolls to top of that track, expands it
- Scroll past track → auto-collapse it (keeps UI clean)
- Sticky track title bar at top (shows current track)

**Pros:**
- Shows all tracks (discoverability)
- One active at a time (focused)
- Feels "packed" with content
- Scroll-driven interactions (intuitive)

**Cons:**
- Complex to implement (scroll listeners)
- May feel jumpy on fast scrolling

### Option D: Horizontal Scroll Snapshots (Magazine-style)

**Layout:**
```
Page 1: Track overview grid (14 cards)
Page 2: Track 1 detail
Page 3: Track 2 detail
...
```

**Interaction:**
- Swipe left/right to change pages
- Overview grid shows all tracks (tap to jump to detail)
- Detail pages are full-screen immersive

**Pros:**
- Feels like magazine/editorial app
- Clear overview → detail hierarchy
- Swipe gestures feel natural

**Cons:**
- Breaks scroll paradigm (may confuse users)
- Hard to compare tracks side-by-side
- Back button behavior unclear

### Recommendation: **Option C (Stacked Cards with Peek)**

**Rationale:**
- Balances density (all tracks visible) with focus (one active)
- Scroll-driven (familiar interaction model)
- Supports "packed" aesthetic (layered cards)
- Can add subtle parallax on scroll for "energy"

**Implementation Strategy:**
1. Use Intersection Observer to detect when track enters/leaves viewport
2. Animate height: collapsed (120px quote hero) ↔ expanded (quote + venues)
3. Add CSS transition: `height 300ms ease-in-out`
4. Sticky header shows current track name (helps orientation)

---

## 10. Recommended UI Architecture

### Track List Page Structure

```jsx
<ExploreView>
  {/* Hero: Featured track (always expanded) */}
  <FeaturedTrackHero track={tracks[0]} />

  {/* Track navigation pills (optional, for quick jump) */}
  <TrackNavPills tracks={tracks} activeTrackId={activeId} />

  {/* All tracks (stacked cards with peek) */}
  {tracks.map(track => (
    <TrackCard
      key={track.id}
      track={track}
      isActive={activeTrackId === track.id}
      onActivate={() => setActiveTrack(track.id)}
    />
  ))}
</ExploreView>
```

### TrackCard Component Structure

```jsx
<div className={`track-card ${isActive ? 'expanded' : 'collapsed'}`}>
  {/* Quote Hero (always visible) */}
  <TrackHero 
    quote={track.quote}
    portrait={track.portrait_url}
    person={track.person_name}
    context={track.person_context}
  />

  {/* Venue Grid (visible when expanded) */}
  {isActive && (
    <div className="track-content">
      {/* Happening Today section (conditional) */}
      {todayVenues.length > 0 && (
        <section>
          <h3>🔴 Happening Today</h3>
          <div className="venue-grid">
            {todayVenues.map(venue => (
              <VenueCardCompact venue={venue} showTime />
            ))}
          </div>
        </section>
      )}

      {/* All venues */}
      <section>
        <h3>All Venues in This Track</h3>
        <div className="venue-grid">
          {track.venues.map(venue => (
            <VenueCardCompact venue={venue} />
          ))}
        </div>
      </section>
    </div>
  )}
</div>
```

### VenueCardCompact Component

```jsx
<Link href={`/${portalSlug}?spot=${venue.slug}`} className="venue-card">
  {/* Image with badges */}
  <div className="image-container">
    <img src={venue.hero_image_url} alt={venue.name} />
    <div className="badges">
      {venue.is_new && <span className="badge-new">NEW</span>}
      {venue.next_event_title && (
        <span className="badge-live pulse">
          Now: {venue.next_event_title}
        </span>
      )}
    </div>
  </div>

  {/* Content */}
  <div className="content">
    <h4>{venue.name}</h4>
    <p className="neighborhood">{venue.neighborhood}</p>
    <p className="blurb">{venue.explore_blurb}</p>
    
    {/* Event count */}
    {venue.upcoming_event_count > 0 && (
      <span className="event-count">
        {venue.upcoming_event_count} upcoming
      </span>
    )}
  </div>
</Link>
```

---

## 11. Animation & Motion

### Scroll-Triggered Animations

**Fade-In on Scroll:**
- Use Intersection Observer
- Fade in venue cards as they enter viewport
- Stagger delay (50ms per card) for cascading effect

```jsx
const [ref, inView] = useInView({ 
  triggerOnce: true, 
  threshold: 0.1 
});

<div 
  ref={ref}
  className={`venue-card ${inView ? 'fade-in' : 'opacity-0'}`}
  style={{ transitionDelay: `${index * 50}ms` }}
>
```

### Parallax Portrait

**Quote Hero with Parallax:**
- Portrait background moves slower than foreground text
- Creates depth effect
- Subtle (0.5x scroll speed, not dramatic)

```jsx
const [scrollY, setScrollY] = useState(0);

useEffect(() => {
  const handleScroll = () => setScrollY(window.scrollY);
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

<div 
  className="portrait-bg"
  style={{ transform: `translateY(${scrollY * 0.5}px)` }}
/>
```

### Pulsing "Live" Badge

**CSS Animation:**
```css
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

.badge-live {
  animation: pulse 2s ease-in-out infinite;
}
```

### Track Expand/Collapse

**Smooth Height Transition:**
```css
.track-card {
  transition: height 300ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.track-card.collapsed {
  height: 180px; /* Quote hero only */
}

.track-card.expanded {
  height: auto; /* Full content */
}
```

**Tip:** Use `max-height` instead of `height: auto` for smoother transitions:
```css
.track-card.collapsed { max-height: 180px; }
.track-card.expanded { max-height: 5000px; } /* Large enough */
```

---

## 12. Typography Scale

### Track Titles
- Mobile: 28px bold
- Desktop: 36px bold
- Font: Display font (if available) or default bold
- Color: var(--cream)

### Quote Text
- Mobile: 20px semibold, italic
- Desktop: 28px semibold, italic
- Line height: 1.3
- Color: var(--cream)

### Quote Attribution
- Size: 14px medium
- Color: var(--soft) (70% opacity)

### Venue Names
- Size: 16px semibold
- Color: var(--cream)
- Hover: var(--coral)

### Venue Blurbs
- Size: 13px regular
- Line height: 1.5
- Color: var(--soft)
- Line clamp: 2 (truncate after 2 lines)

### Section Headers
- Size: 18px bold
- Color: var(--cream)
- Icon: 20px (inline, accent color)

### Badges
- Size: 10px uppercase semibold
- Font: Mono
- Letter spacing: 0.05em

---

## 13. Color Application

### Track Themes (Optional Enhancement)

**Assign accent color per track:**
- Good Trouble → Coral (activism energy)
- The South Got Something to Say → Gold (hip-hop gold chains)
- Hard in Da Paint → Teal (street art spray paint)
- etc.

**Usage:**
- Quote card border: 2px accent color
- Section icons: accent color
- Badges: accent color background
- Hover states: accent color

**Implementation:**
```typescript
const TRACK_COLORS = {
  'good-trouble': 'var(--coral)',
  'the-south-got-something-to-say': 'var(--gold)',
  'hard-in-da-paint': '#14b8a6', // teal
  // ... 11 more
};

<TrackCard 
  track={track}
  accentColor={TRACK_COLORS[track.slug]}
/>
```

---

## 14. Accessibility Considerations

### Focus States
- All interactive elements (cards, pills, accordions) need visible focus ring
- Use `focus-visible` (only shows for keyboard, not mouse)

```css
.venue-card:focus-visible {
  outline: 2px solid var(--coral);
  outline-offset: 2px;
}
```

### ARIA Labels
- Track accordions: `aria-expanded` attribute
- Badge icons: `aria-label` for screen readers
- Image alt text: descriptive (not just venue name)

### Keyboard Navigation
- Track cards: Tab to focus, Enter to expand
- Venue grid: Arrow keys to navigate (optional enhancement)
- Skip link: "Skip to next track" for long sections

### Color Contrast
- All text on images must have gradient overlay or text shadow
- Badges: ensure 4.5:1 contrast ratio
- Test with Chrome DevTools Lighthouse accessibility audit

---

## 15. Performance Optimizations

### Image Loading
- Use Next.js `<Image>` component (automatic optimization)
- `loading="lazy"` for all non-hero images
- `priority` flag for featured track hero only
- `sizes` attribute for responsive images

```jsx
<Image
  src={venue.hero_image_url}
  alt={venue.name}
  width={400}
  height={300}
  sizes="(max-width: 640px) 100vw, 400px"
  loading="lazy"
  className="object-cover"
/>
```

### Intersection Observer
- Only render venue cards when track is expanded
- Lazy-load images as they enter viewport
- Unobserve after first load (`triggerOnce: true`)

### Virtualization (If Needed)
- If tracks have 100+ venues, use virtual scrolling
- Library: `react-window` or `@tanstack/react-virtual`
- Only render visible + 5 above/below (buffer)

---

## 16. Implementation Checklist

### Phase 1: Data Structure
- [ ] Create `explore_tracks` table (id, name, slug, quote, portrait_url, person_name, person_context, sort_order)
- [ ] Create `track_venues` junction table (track_id, venue_id, sort_order, custom_blurb)
- [ ] Seed 14 tracks with quotes and portraits
- [ ] Assign 5-20 venues per track

### Phase 2: API
- [ ] `/api/portals/[slug]/explore/tracks` - list all tracks
- [ ] `/api/portals/[slug]/explore/tracks/[id]` - track detail with venues
- [ ] Include `next_event_title`, `next_event_date`, `upcoming_event_count` in venue data

### Phase 3: UI Components
- [ ] `ExploreTracksView.tsx` - main container
- [ ] `TrackCard.tsx` - collapsible track with quote hero
- [ ] `TrackHero.tsx` - quote + portrait glassmorphism card
- [ ] `VenueCardCompact.tsx` - dense venue card with badges
- [ ] `TrackNavPills.tsx` - sticky horizontal scroll nav

### Phase 4: Interactions
- [ ] Expand/collapse track on tap
- [ ] Scroll-to-track on pill tap
- [ ] Intersection Observer for active track detection
- [ ] Fade-in animation on venue cards

### Phase 5: Polish
- [ ] Pulsing animation on "Now" badges
- [ ] Parallax effect on track hero portraits
- [ ] Smooth height transitions on expand/collapse
- [ ] Loading skeletons for async data
- [ ] Empty state if no tracks/venues

### Phase 6: Accessibility
- [ ] Focus states on all interactive elements
- [ ] ARIA labels and roles
- [ ] Keyboard navigation (Tab, Enter, Esc)
- [ ] Color contrast audit
- [ ] Screen reader testing

---

## 17. Example Track Data

```typescript
const exampleTracks = [
  {
    id: 1,
    name: "Good Trouble",
    slug: "good-trouble",
    quote: "Get in good trouble, necessary trouble, and help redeem the soul of America.",
    portrait_url: "/tracks/john-lewis.jpg",
    person_name: "John Lewis",
    person_context: "Civil Rights Icon & Congressman",
    description: "Explore the sites that shaped America's Civil Rights Movement, from MLK's birthplace to the streets where history was made.",
    accent_color: "#f97066", // coral
    venues: [
      {
        id: 101,
        name: "Martin Luther King Jr. National Historical Park",
        slug: "mlk-park",
        explore_blurb: "Walk through the birthplace of a movement. Dr. King's childhood home, Ebenezer Baptist Church, and the eternal flame.",
        hero_image_url: "/venues/mlk-park.jpg",
        next_event_title: "Guided Tour: MLK's Atlanta",
        next_event_date: "2026-02-14T14:00:00",
        upcoming_event_count: 5,
        is_new: false,
      },
      // ... 7 more venues
    ]
  },
  {
    id: 2,
    name: "The South Got Something to Say",
    slug: "hip-hop-heritage",
    quote: "The South got something to say!",
    portrait_url: "/tracks/andre-3000.jpg",
    person_name: "André 3000",
    person_context: "OutKast, 1995 Source Awards",
    description: "From trap music to Dungeon Family, trace the evolution of Atlanta hip-hop from underground to global phenomenon.",
    accent_color: "#d4a574", // gold
    venues: [
      // ... 12 venues
    ]
  },
  // ... 12 more tracks
];
```

---

## Final Recommendations

### For LostCity Explore Screen

**Navigation Model:** Stacked Cards with Peek (Option C)
- Shows all 14 tracks at glance (density)
- One active track at a time (focus)
- Scroll-driven interactions (familiar)

**Quote Hero:** Glass Card Over Portrait (Option C)
- Aligns with LostCity glassmorphism aesthetic
- Handles varying quote lengths
- Portrait provides mood without dominating

**Venue Card Style:** Dense Compact Card (Time Out pattern)
- Image: 16:9 aspect ratio (not square)
- Content below image (not side-by-side)
- Badges overlaid on image bottom-left
- 2-column grid on mobile

**"Alive" Indicators:**
- "Now: [event title]" badge (coral, pulsing)
- "X upcoming" count badge (muted)
- Conditional "Happening Today" section at top of each track

**Animation:**
- Parallax on track hero portraits (subtle)
- Fade-in on venue cards (staggered)
- Smooth expand/collapse on tracks (300ms ease)
- Pulse animation on "live" badges

**Typography:**
- Bold display fonts for track titles (28-36px)
- Italic semibold for quotes (20-28px)
- Small uppercase mono for badges (10px)

**Colors:**
- Track-specific accent colors (optional enhancement)
- Glassmorphism overlays (rgba(0,0,0,0.7))
- High contrast for text on images (gradient masks)

**Performance:**
- Lazy load all images except featured track
- Intersection Observer for scroll animations
- Only render venues for expanded tracks

This approach balances **density** (all tracks visible), **focus** (one active), **energy** (animations, pulsing badges), and **adventure** (editorial voice, storytelling cards). It's mobile-first but scales beautifully to desktop.

