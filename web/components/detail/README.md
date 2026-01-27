# Detail Components

Shared components for detail pages across events, spots, series, and community.

## Components

### DetailHero

Hero section with three display modes:

```tsx
import { DetailHero } from "@/components/detail";
import CategoryIcon from "@/components/CategoryIcon";

// Image mode (full 16:9)
<DetailHero
  mode="image"
  imageUrl="/event.jpg"
  title="Event Name"
  subtitle="Venue Name · Neighborhood"
  categoryColor="var(--cat-music)"
  categoryIcon={<CategoryIcon type="music" size={14} />}
  badge={<CategoryBadge />}
  isLive={true}
/>

// Poster mode (side-by-side)
<DetailHero
  mode="poster"
  imageUrl="/series.jpg"
  title="Series Name"
  subtitle="Organization Name"
  categoryColor="var(--cat-theater)"
>
  <div className="mt-4">
    {/* Additional content */}
  </div>
</DetailHero>

// Fallback mode (gradient + icon)
<DetailHero
  mode="fallback"
  title="Spot Name"
  subtitle="Bar · Eastside"
  categoryColor="var(--spot-bar)"
  categoryIcon={<CategoryIcon type="bar" size={64} />}
/>
```

### InfoCard

Main content container with accent border:

```tsx
import { InfoCard } from "@/components/detail";

<InfoCard accentColor="var(--cat-music)">
  <h2 className="text-lg font-bold mb-4">About</h2>
  <p>Content here...</p>
</InfoCard>
```

### MetadataGrid

3-column grid for key stats:

```tsx
import { MetadataGrid } from "@/components/detail";

<MetadataGrid
  items={[
    { label: "Date", value: "Fri, Jan 27" },
    { label: "Time", value: "8:00 PM", color: "var(--neon-cyan)" },
    { label: "Price", value: "Free", color: "var(--neon-green)" },
  ]}
/>
```

### SectionHeader

Typography-focused section divider:

```tsx
import { SectionHeader } from "@/components/detail";

<SectionHeader title="Upcoming Events" count={12} />
```

### RelatedSection

Container for related items with horizontal scroll on mobile:

```tsx
import { RelatedSection } from "@/components/detail";

<RelatedSection
  title="More Events"
  count={events.length}
  emptyMessage="No events found"
>
  {events.map((event) => (
    <RelatedCard key={event.id} {...event} />
  ))}
</RelatedSection>
```

### RelatedCard

Two variants for displaying related items:

```tsx
import { RelatedCard } from "@/components/detail";

// Compact (with icon)
<RelatedCard
  variant="compact"
  href={`/events/${event.id}`}
  title={event.title}
  subtitle={event.venue}
  icon={<CategoryIcon type={event.category} size={20} />}
  accentColor="var(--cat-music)"
/>

// Image (with thumbnail)
<RelatedCard
  variant="image"
  href={`/spots/${spot.id}`}
  title={spot.name}
  subtitle={spot.neighborhood}
  imageUrl={spot.image_url}
  accentColor="var(--spot-bar)"
/>
```

### DetailStickyBar

Fixed bottom bar with share + CTA:

```tsx
import { DetailStickyBar } from "@/components/detail";

<DetailStickyBar
  onShare={handleShare}
  secondaryActions={<RSVPButton eventId={eventId} />}
  primaryAction={{
    label: "Get Tickets",
    href: ticketUrl,
    icon: <TicketIcon />,
  }}
  scrollThreshold={400}
/>
```

## Design Principles

- **Typography-first**: Strong hierarchy, generous line-height (1.5-1.6)
- **Whitespace**: More breathing room between sections
- **Reduced effects**: Minimal glows/shadows, clean transitions
- **Color restraint**: Accent colors for key actions only
- **Mobile-first**: Horizontal scroll with snap on mobile, grid on desktop
- **Loading states**: Skeleton shimmer with category hint
- **Error handling**: Automatic fallback for missing images

## Color Variables

Use category colors for consistency:

```css
var(--cat-music)      /* #F9A8D4 */
var(--cat-film)       /* #A5B4FC */
var(--cat-comedy)     /* #FCD34D */
var(--cat-theater)    /* #F0ABFC */
var(--cat-art)        /* #C4B5FD */
var(--cat-community)  /* #6EE7B7 */
var(--cat-food)       /* #FDBA74 */
var(--cat-sports)     /* #7DD3FC */

var(--spot-bar)       /* #FDBA74 */
var(--spot-venue)     /* #F9A8D4 */
/* etc... */
```
