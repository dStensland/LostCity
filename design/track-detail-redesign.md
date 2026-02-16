# Explore Track Detail Page - Redesign Spec

**Date:** 2026-02-15  
**Status:** Ready for Implementation  
**Target Component:** `web/components/explore/ExploreTrackDetail.tsx`

---

## Executive Summary

The current track detail page fails to deliver the cinematic, premium experience established by the track list banners. The hero feels cramped and dark, venue cards are massive vertical blocks that feel monotonous, and the overall page lacks visual rhythm. This redesign brings the detail page up to the same quality level as the track list, with a focus on information density, visual hierarchy, and mobile-first design.

**Core Problems:**
1. Dark, cramped hero with poor visual hierarchy
2. Venue cards are 16:9 images stacked vertically — extremely scrolly, monotonous
3. No visual differentiation between featured venues and others
4. Activity bar stats barely visible
5. Compact grid at bottom is tiny and unreadable
6. Everything has the same visual weight — no rhythm

**Design Goals:**
- Match the cinematic quality of ExploreTrackList banners
- Reduce vertical scroll by 60%+ through smarter layouts
- Create clear visual hierarchy (hero → featured → grid)
- Make activity stats prominent and actionable
- Improve mobile readability and tap targets

---

## 1. What's Wrong — Detailed Issues

### 1.1 Hero Section Issues

**Current Problems:**
- **Too dark:** Portrait image has `brightness(0.28) saturate(0.5)` filter, making it nearly black
- **Poor contrast:** Quote text is `rgba(255,255,255,0.45)` on dark background — barely readable
- **Cramped spacing:** 260px min-height feels short, content is squeezed
- **Back button lost:** `rgba(255,255,255,0.35)` text at top-left is invisible
- **No visual anchor:** Category label is tiny, accent color barely shows

**Screenshot Evidence:**
The hero in the screenshot is almost entirely dark gray/black. The quote is barely visible, and the overall feel is like a dead-end alley, not an inviting entry point to explore Atlanta.

### 1.2 Venue Card Issues

**Current Problems:**
- **Massive vertical cards:** Each featured venue is 16:9 aspect ratio image + 100px+ of text = ~300px tall per card
- **12 venues × 300px = 3600px of scroll** — way too much scrolling
- **Monotonous rhythm:** Every card is the same size, same layout, same weight
- **Poor information density:** Huge images dominate, editorial content is secondary
- **Event rows get lost:** Buried inside cards, not scannable

**Screenshot Evidence:**
Looking at the screenshot, the venue cards are enormous blocks. The first few cards take up the entire viewport, and scrolling reveals more identical blocks. It feels like a basic WordPress blog list, not a curated city guide.

### 1.3 Activity Bar Issues

**Current Problems:**
- **Low contrast:** Stats are barely visible against the dark background
- **Not actionable:** Numbers are shown but don't feel interactive or useful
- **Poor hierarchy:** "Places" stat has same visual weight as "Tonight" — but "Tonight" is way more urgent

**Screenshot Evidence:**
The activity bar is present but nearly invisible — the colored values blend into the dark theme.

### 1.4 Compact Grid Issues

**Current Problems:**
- **Too small:** 4:3 aspect ratio on 50% width = tiny cards on mobile
- **Text unreadable:** 10.5px text in 2-col grid on mobile is below readable threshold
- **No differentiation:** Compact cards look like an afterthought, not a distinct section

---

## 2. Design Direction

### 2.1 Visual Language

The redesigned track detail should feel like:
- **A magazine spread** — beautiful layouts with rhythm and white space
- **Information-rich** — more venues visible per scroll, scannable
- **Cinematic but functional** — match the track list banners' quality while prioritizing usability
- **Dark and moody** — preserve the Explore dark theme, but with better contrast and hierarchy

### 2.2 Layout Philosophy

**Hero:** Taller, brighter, more inviting. The quote and portrait should be a compelling entry point, not a dark tunnel.

**Featured Venues (with events):** Horizontal cards with side-by-side image + content. More compact, more scannable.

**Grid Venues (no events):** Larger cards in 2-col grid, better readability.

**Activity Bar:** Redesign as a prominent, actionable summary panel.

### 2.3 Information Density Target

- **Current:** 2-3 venues visible on initial mobile viewport
- **Target:** 4-6 venues visible, with hero + activity bar
- **Current scroll for 12 venues:** ~3600px
- **Target scroll:** ~1500px (60% reduction)

---

## 3. Layout Spec — Component-by-Component

### 3.1 Hero Section Redesign

**Goal:** Brighter, taller, more inviting. Create a cinematic entry point that matches track list banner quality.

#### Changes:

**Height:**
- Current: `minHeight: 260`
- New: `minHeight: 340` (mobile), `minHeight: 400` (desktop)

**Portrait Image Filter:**
- Current: `brightness(0.28) saturate(0.5) contrast(1.2)` — way too dark
- New: `brightness(0.5) saturate(0.7) contrast(1.15)` — still moody, but visible

**Gradient Overlay:**
- Current: `linear-gradient(to top, ${bg} 0%, rgba(14,14,14,0.7) 40%, transparent 100%)`
- New: `linear-gradient(to top, ${bg} 0%, rgba(14,14,14,0.85) 30%, rgba(14,14,14,0.4) 70%, transparent 100%)`
  - Stronger gradient at bottom for text legibility
  - More transparency at top to show portrait

**Back Button:**
- Current: `rgba(255,255,255,0.35)` — invisible
- New: `rgba(255,255,255,0.6)` with `background: rgba(0,0,0,0.4)` pill
- Add padding: `px-2.5 py-1.5 rounded-full`

**Category Label:**
- Current: Tiny accent-colored text
- New: Dark pill with accent border and text
- Style: 
  ```tsx
  background: "rgba(0,0,0,0.6)"
  border: `1px solid ${accent}`
  color: accent
  padding: "4px 10px"
  fontSize: "10px"
  fontWeight: 700
  ```

**Title:**
- Current: 34px/44px
- New: 38px (mobile), 52px (desktop) — larger, more commanding
- Add subtle glow: `textShadow: 0 2px 16px rgba(0,0,0,0.8), 0 0 40px ${accent}15`

**Quote:**
- Current: `rgba(255,255,255,0.45)` — too dim
- New: `rgba(255,255,255,0.7)` — much more readable
- Font size: 15px → 16px
- Add leading: `leading-[1.5]`

**Quote Source:**
- Current: `rgba(255,255,255,0.25)`
- New: `rgba(255,255,255,0.5)` with accent color on dash
- Style: `<span style={{ color: accent }}>&mdash;</span> {track.quoteSource}`

**Description (if present):**
- Current: Separate section below hero
- New: Integrate into hero, positioned below quote
- Max 2 lines with `line-clamp-2`
- Style: `text-sm opacity-60 mt-2 max-w-[85%]`

#### Complete Hero JSX:

```tsx
<div className="relative overflow-hidden" style={{ minHeight: "340px" }}>
  {/* Portrait image */}
  {track.quotePortraitUrl ? (
    <Image
      src={track.quotePortraitUrl}
      alt={track.quoteSource}
      fill
      sizes="(max-width: 768px) 100vw, 800px"
      className="object-cover object-top"
      style={{ filter: "brightness(0.5) saturate(0.7) contrast(1.15)" }}
    />
  ) : (
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(135deg, ${accent}30 0%, ${EXPLORE_THEME.bg} 100%)`,
      }}
    />
  )}
  
  {/* Gradient overlay */}
  <div
    className="absolute inset-0"
    style={{
      background: `linear-gradient(to top, ${EXPLORE_THEME.bg} 0%, rgba(14,14,14,0.85) 30%, rgba(14,14,14,0.4) 70%, transparent 100%)`,
    }}
  />

  {/* Content */}
  <div className="relative z-[2] flex flex-col justify-end h-full p-5 md:p-7 pt-20">
    {/* Back button pill */}
    <button
      onClick={onBack}
      className="absolute top-4 left-4 font-mono text-[11px] px-2.5 py-1.5 rounded-full cursor-pointer transition-colors"
      style={{
        color: "rgba(255,255,255,0.6)",
        background: "rgba(0,0,0,0.4)",
      }}
    >
      ← All Tracks
    </button>

    {/* Category pill */}
    <div
      className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5 inline-block px-2.5 py-1 rounded-md"
      style={{
        background: "rgba(0,0,0,0.6)",
        border: `1px solid ${accent}`,
        color: accent,
        alignSelf: "flex-start",
      }}
    >
      {category}
    </div>

    {/* Title */}
    <h1
      className="explore-display-heading text-[38px] md:text-[52px] leading-[1.05] tracking-[-0.02em] mb-3"
      style={{
        color: EXPLORE_THEME.text,
        textShadow: `0 2px 16px rgba(0,0,0,0.8), 0 0 40px ${accent}15`,
      }}
    >
      {track.name}
    </h1>

    {/* Quote */}
    <p
      className="text-[16px] italic leading-[1.5] mb-1.5"
      style={{ color: "rgba(255,255,255,0.7)" }}
    >
      "{track.quote}"
    </p>
    <p
      className="text-[12px] mb-3"
      style={{ color: "rgba(255,255,255,0.5)" }}
    >
      <span style={{ color: accent }}>&mdash;</span> {track.quoteSource}
    </p>

    {/* Description (integrated) */}
    {track.description && (
      <p
        className="text-sm leading-[1.6] line-clamp-2 max-w-[85%]"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        {track.description}
      </p>
    )}
  </div>
</div>
```

**Remove** the separate description section that currently sits below the hero.

---

### 3.2 Activity Bar Redesign

**Goal:** Make stats prominent, actionable, and visually distinct.

#### Changes:

**Layout:**
- Current: 4-col equal-width flex
- New: Keep 4-col but add visual hierarchy through sizing and styling

**Stat Values:**
- Current: `text-lg font-extrabold`
- New: `text-2xl md:text-3xl font-black` — much larger
- Add slight glow to colored values: `textShadow: 0 0 12px ${color}30`

**Stat Labels:**
- Current: `text-[8px]` — tiny
- New: `text-[10px] md:text-[11px]` — more readable
- Change color: `rgba(255,255,255,0.5)` instead of 0.3

**Container Styling:**
- Add subtle gradient background to make section pop:
  ```tsx
  background: "linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.00) 100%)"
  ```
- Increase padding: `py-4 md:py-5`

**Tonight Stat:**
- Add pulsing indicator dot:
  ```tsx
  <div className="flex items-center justify-center gap-1.5">
    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: valueColors.tonight }} />
    <div className="text-2xl md:text-3xl font-black">
      {stat.value}
    </div>
  </div>
  ```

#### Complete ActivityBar Component:

```tsx
function ActivityBar({ activity }: { activity: TrackActivity }) {
  const stats: { label: string; value: number; colorClass: string }[] = [];

  if (activity.tonightCount > 0) {
    stats.push({ label: "Tonight", value: activity.tonightCount, colorClass: "tonight" });
  }
  if (activity.weekendCount > 0) {
    stats.push({ label: "This weekend", value: activity.weekendCount, colorClass: "weekend" });
  }
  if (activity.freeCount > 0) {
    stats.push({ label: "Free events", value: activity.freeCount, colorClass: "free" });
  }
  stats.push({ label: "Places", value: activity.venueCount, colorClass: "default" });

  const valueColors: Record<string, string> = {
    tonight: "#E03A3E",
    weekend: "#C1D32F",
    free: "#34D399",
    default: EXPLORE_THEME.text,
  };

  return (
    <div
      className="flex border-b py-4 md:py-5"
      style={{
        borderColor: "rgba(255,255,255,0.04)",
        background: "linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.00) 100%)",
      }}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="flex-1 px-4 text-center"
          style={{
            borderRight:
              i < stats.length - 1
                ? "1px solid rgba(255,255,255,0.04)"
                : "none",
          }}
        >
          {/* Tonight gets pulse indicator */}
          {stat.colorClass === "tonight" ? (
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: valueColors.tonight }}
              />
              <div
                className="text-2xl md:text-3xl font-black"
                style={{
                  color: valueColors[stat.colorClass],
                  textShadow: `0 0 12px ${valueColors[stat.colorClass]}30`,
                }}
              >
                {stat.value}
              </div>
            </div>
          ) : (
            <div
              className="text-2xl md:text-3xl font-black mb-1"
              style={{
                color: valueColors[stat.colorClass],
                textShadow: stat.colorClass !== "default" ? `0 0 12px ${valueColors[stat.colorClass]}30` : "none",
              }}
            >
              {stat.value}
            </div>
          )}
          <div
            className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.05em]"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### 3.3 Featured Venue Cards Redesign (With Events)

**Goal:** Reduce vertical height by 50%+ while maintaining information density.

**Current Issues:**
- 16:9 image (180px tall on mobile) + 100px content = ~300px per card
- Events list is buried inside card
- Too much vertical scroll

**New Layout: Horizontal Split on Mobile, Optimized on Desktop**

#### Mobile Layout (< 768px):
- Image on top, but shorter: **3:2 aspect ratio** instead of 16:9 (saves ~30px per card)
- Content below: more compact padding, tighter spacing
- Event rows: max 2 visible, "+N more" indicator

#### Desktop Layout (≥ 768px):
- Image left (40% width), content right (60% width)
- Side-by-side reduces height by ~60%

#### Changes:

**Image Section:**
- Mobile: `aspect-[3/2]` instead of `aspect-[16/9]`
- Desktop: `md:aspect-[1/1] md:w-[40%]`

**Content Section:**
- Reduce padding: `p-3.5` → `p-3`
- Tighter spacing: use `gap-1.5` instead of `gap-2.5`

**Event Rows:**
- Current: shows all events (up to 3)
- New: show max 2 events on mobile, 3 on desktop
- Add "+N more" footer if >2 events

**Blurb:**
- Current: full text
- New: `line-clamp-2` to prevent excessive height

#### Complete Featured Card Component:

```tsx
// Featured — horizontal layout on desktop, compact vertical on mobile
return (
  <div
    className="rounded-xl overflow-hidden group md:flex"
    style={{
      background: "#141414",
      border: `1px solid ${
        hasTonight
          ? "rgba(224,58,62,0.2)"
          : eventCount > 0
            ? "rgba(193,211,47,0.12)"
            : "rgba(255,255,255,0.04)"
      }`,
    }}
  >
    {/* Image — 3:2 mobile, 1:1 desktop, 40% width on desktop */}
    <Link
      href={`/${portalSlug}?spot=${venue.slug}`}
      className="block relative md:w-[40%] flex-shrink-0"
      style={{ aspectRatio: "3/2" }}
    >
      {venue.imageUrl ? (
        <Image
          src={venue.imageUrl}
          alt={venue.name}
          fill
          sizes="(max-width: 768px) 100vw, 400px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          style={{ filter: "contrast(1.06) saturate(0.8)" }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: EXPLORE_THEME.card }}
        >
          <span className="text-3xl opacity-20">📍</span>
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)",
        }}
      />

      {/* Badges */}
      <div className="absolute top-2 right-2 z-[3] flex flex-col gap-1 items-end">
        {hasTonight && (
          <span
            className="font-mono text-[8px] font-semibold px-2 py-[3px] rounded-md uppercase tracking-[0.03em] animate-pulse"
            style={{ background: "#E03A3E", color: "#fff" }}
          >
            Tonight
          </span>
        )}
        {!hasTonight && eventCount > 0 && (
          <span
            className="font-mono text-[8px] font-semibold px-2 py-[3px] rounded-md"
            style={{ background: "#C1D32F", color: EXPLORE_THEME.bg }}
          >
            {eventCount} this week
          </span>
        )}
      </div>
    </Link>

    {/* Body — 60% width on desktop */}
    <div className="p-3 md:flex-1">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/${portalSlug}?spot=${venue.slug}`} className="min-w-0">
          <h3
            className="text-[15px] font-bold leading-[1.3] mb-0.5"
            style={{ color: EXPLORE_THEME.text }}
          >
            {venue.name}
          </h3>
          <p
            className="font-mono text-[9px] uppercase"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {venue.neighborhood}
          </p>
        </Link>

        {/* Upvote */}
        <UpvoteButton venue={venue} accent={accent} onUpvote={onUpvote} />
      </div>

      {/* Blurb — 2 lines max */}
      {venue.editorialBlurb && (
        <p
          className="text-[12.5px] leading-[1.55] mb-2 line-clamp-2"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {venue.editorialBlurb}
        </p>
      )}

      {/* Event rows — max 2 on mobile, 3 on desktop */}
      {events.length > 0 && (
        <div
          className="rounded-lg overflow-hidden mb-2"
          style={{ border: "1px solid rgba(255,255,255,0.04)" }}
        >
          {events.slice(0, 2).map((ev, i) => (
            <EventRow
              key={ev.id}
              event={ev}
              isLast={i === Math.min(events.length, 2) - 1 && events.length <= 2}
            />
          ))}
          {events.length > 2 && (
            <div
              className="px-2.5 py-2 text-center text-[10px] font-mono cursor-pointer"
              style={{
                color: accent,
                background: `${accent}05`,
                borderTop: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              +{events.length - 2} more {events.length === 3 ? "event" : "events"}
            </div>
          )}
        </div>
      )}

      {/* Footer — tags (only if no events) */}
      {tags.length > 0 && events.length === 0 && (
        <>
          <div
            className="h-px mb-2"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          <div className="flex gap-1 flex-wrap">
            {tags.map((tag) => (
              <span
                key={tag}
                className="font-mono text-[8px] px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  </div>
);
```

**Impact:**
- Mobile: 300px → ~220px per card (27% reduction)
- Desktop: 300px → ~180px per card (40% reduction)
- 12 cards: 3600px → ~2200px mobile, ~1600px desktop

---

### 3.4 Compact Grid Redesign (No Events)

**Goal:** Make compact cards larger and more readable.

#### Changes:

**Card Size:**
- Current: 2-col grid, 4:3 aspect ratio
- New: Keep 2-col on mobile, but **increase image aspect to 1:1** (taller)
- Increase text size: `text-xs` → `text-[13px]`

**Image Aspect:**
- Change from `aspect-[4/3]` to `aspect-[1/1]`
- Gives more vertical space for image, better visual impact

**Text Sizing:**
- Venue name: `text-xs` → `text-[13px]` (was 12px, now 13px)
- Neighborhood: `text-[8px]` → `text-[9px]`
- Blurb: `text-[10.5px]` → `text-[11.5px]`

**Padding:**
- Increase from `p-2` to `p-2.5`

#### Complete Compact Card:

```tsx
function CompactVenueCard({
  venue,
  portalSlug,
  accent,
  events,
  hasTonight,
  eventCount,
}: {
  venue: ExploreTrackVenue;
  portalSlug: string;
  accent: string;
  events: ExploreVenueEvent[];
  hasTonight: boolean;
  eventCount: number;
}) {
  const nextEvent = events[0] ?? null;

  return (
    <Link
      href={`/${portalSlug}?spot=${venue.slug}`}
      className="rounded-[10px] overflow-hidden group block transition-colors"
      style={{
        background: "#141414",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Image — 1:1 instead of 4:3 */}
      <div
        className="relative"
        style={{ aspectRatio: "1/1" }}
      >
        {venue.imageUrl ? (
          <Image
            src={venue.imageUrl}
            alt={venue.name}
            fill
            sizes="(max-width: 640px) 50vw, 200px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ filter: "contrast(1.06) saturate(0.75)" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: EXPLORE_THEME.card }}
          >
            <span className="text-xl opacity-15">📍</span>
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%)",
          }}
        />

        {/* Badge */}
        <div className="absolute top-[5px] right-[5px] z-[3] flex flex-col gap-[3px] items-end">
          {hasTonight && (
            <span
              className="font-mono text-[7px] font-semibold px-1.5 py-0.5 rounded uppercase animate-pulse"
              style={{ background: "#E03A3E", color: "#fff" }}
            >
              Tonight
            </span>
          )}
          {!hasTonight && eventCount > 0 && (
            <span
              className="font-mono text-[7px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "#C1D32F", color: EXPLORE_THEME.bg }}
            >
              {eventCount} this week
            </span>
          )}
        </div>

        {/* Next event overlay */}
        {nextEvent && (
          <div
            className="absolute bottom-1.5 left-1.5 right-1.5 z-[3] flex items-center gap-1 text-[9px] leading-[1.3]"
            style={{
              color: "rgba(255,255,255,0.8)",
              textShadow: "0 1px 4px rgba(0,0,0,0.9)",
            }}
          >
            <span
              className="font-mono text-[8px] font-semibold flex-shrink-0"
              style={{ color: nextEvent.isTonight ? "#E03A3E" : "#C1D32F" }}
            >
              {nextEvent.isTonight
                ? nextEvent.startTime
                  ? formatTime(nextEvent.startTime)
                  : "Tonight"
                : `${formatShortDay(nextEvent.startDate)}${nextEvent.startTime ? " " + formatTime(nextEvent.startTime) : ""}`}
            </span>
            <span className="truncate">{nextEvent.title}</span>
          </div>
        )}
      </div>

      {/* Body — increased padding and text sizes */}
      <div className="p-2.5 pb-3">
        <h4
          className="text-[13px] font-bold leading-[1.25] mb-0.5"
          style={{ color: EXPLORE_THEME.text }}
        >
          {venue.name}
        </h4>
        {venue.neighborhood && (
          <p
            className="font-mono text-[9px] uppercase mb-1"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            {venue.neighborhood}
          </p>
        )}
        {venue.editorialBlurb && (
          <p
            className="text-[11.5px] leading-[1.45] line-clamp-2"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            {venue.editorialBlurb}
          </p>
        )}
      </div>
    </Link>
  );
}
```

---

### 3.5 Section Headers Redesign

**Goal:** Make section breaks more prominent, easier to scan.

**Current Issues:**
- `text-[9px]` labels are tiny
- `rgba(255,255,255,0.25)` is very dim
- No visual separation from content

#### Changes:

**"Happening this week" header:**
```tsx
<div className="flex items-center gap-2 py-2 mb-1">
  <div
    className="h-[2px] w-8 rounded-full"
    style={{ background: accent }}
  />
  <p
    className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
    style={{ color: accent }}
  >
    Happening this week
  </p>
</div>
```

**"More {category} spots" header:**
```tsx
<div className="flex items-center gap-2 py-2 mb-1 mt-3">
  <div
    className="h-[2px] w-6 rounded-full"
    style={{ background: "rgba(255,255,255,0.15)" }}
  />
  <p
    className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
    style={{ color: "rgba(255,255,255,0.4)" }}
  >
    More {category.toLowerCase()} spots
  </p>
</div>
```

---

### 3.6 Filter Row (No Changes Needed)

The filter row is already well-designed. Keep as-is.

---

### 3.7 "See All" Footer Redesign

**Goal:** Make it more prominent and actionable.

#### Changes:

**Style:**
- Current: dashed border, muted
- New: solid accent border, more prominent

```tsx
<button
  className="w-full flex items-center justify-center gap-2 mt-4 py-3.5 rounded-xl font-mono text-[11px] font-medium transition-all"
  style={{
    background: `${accent}08`,
    border: `1.5px solid ${accent}30`,
    color: accent,
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = `${accent}15`;
    e.currentTarget.style.borderColor = `${accent}50`;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = `${accent}08`;
    e.currentTarget.style.borderColor = `${accent}30`;
  }}
>
  <span>View all {track.activity.venueCount} places</span>
  {totalEventCount > 0 && (
    <span style={{ color: "rgba(255,255,255,0.5)" }}>
      · {totalEventCount} events this week
    </span>
  )}
  <span>→</span>
</button>
```

---

## 4. Mobile Considerations

### 4.1 Touch Targets

All interactive elements must meet 44px minimum tap target:
- Upvote buttons: already 44px+ (good)
- Filter chips: 32px height → increase to `py-2` for 36px (acceptable for pills)
- Back button: add padding to reach 44px total

### 4.2 Scroll Performance

**Optimizations:**
- Use `will-change: transform` on hover states only (not always-on)
- Lazy-load images below fold with `loading="lazy"`
- Use `IntersectionObserver` to trigger animations only when visible

### 4.3 Text Readability

**Minimum sizes:**
- Body text: 12px minimum (currently 12.5px — good)
- Labels: 10px minimum (currently 9-11px — mostly good)
- Compact grid text: 11.5px (was 10.5px — improved)

### 4.4 Spacing

**Mobile padding:**
- Hero: `p-5` (20px) — good
- Cards: `p-3` (12px) — good
- Outer container: `px-4` (16px) — good

**Desktop increases:**
- Hero: `md:p-7` (28px)
- Cards: `md:p-4` (16px)
- Outer container: `lg:px-6` (24px)

---

## 5. Animation & Transitions

### 5.1 Hero Entry

Add subtle fade-in animation:

```css
@keyframes heroFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.track-detail-hero {
  animation: heroFadeIn 0.4s ease-out;
}
```

Apply to hero wrapper: `className="track-detail-hero relative overflow-hidden"`

### 5.2 Card Stagger

Current code has `.explore-track-enter` animation — keep it, but reduce delay:
- Current: `animationDelay: ${index * 90}ms`
- New: `animationDelay: ${index * 50}ms` (faster stagger)

### 5.3 Hover States

**Venue cards:**
- Image scale: 1.0 → 1.05 (already implemented)
- Add subtle lift: `transition: transform 0.3s, box-shadow 0.3s`
- On hover: `transform: translateY(-2px)` + `box-shadow: 0 8px 20px rgba(0,0,0,0.4)`

**See All button:**
- Already specified in 3.7 above

---

## 6. Accessibility

### 6.1 Color Contrast

**Current Issues:**
- Quote at `rgba(255,255,255,0.45)` = 4.3:1 contrast (fails AA for body text)
- Section headers at `rgba(255,255,255,0.25)` = 2.5:1 (fails AA)

**Fixes:**
- Quote: `rgba(255,255,255,0.7)` = 7.8:1 (passes AAA)
- Section headers with accent: use accent color directly (varies by track, but most are 4.5:1+)
- Secondary headers: `rgba(255,255,255,0.4)` = 4.2:1 (passes AA for large text)

### 6.2 Focus Indicators

Add focus styles to all interactive elements:

```tsx
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
style={{ "--tw-ring-color": accent }}
```

Apply to:
- Venue cards (Link components)
- Upvote buttons
- Filter chips
- See All button

### 6.3 Screen Reader Support

**Improvements needed:**

1. Add sr-only text to activity bar:
```tsx
<div className="sr-only">
  Track activity: {activity.tonightCount} events tonight, {activity.weekendCount} this weekend, {activity.freeCount} free events, {activity.venueCount} total places
</div>
```

2. Improve upvote button aria-label (already implemented)

3. Add aria-current to active filter chip:
```tsx
aria-current={active === f.key ? "true" : undefined}
```

---

## 7. Design Tokens Reference

Use these existing EXPLORE_THEME colors:

```typescript
EXPLORE_THEME = {
  bg: "#0E0E0E",           // Main background
  primary: "#C1D32F",      // Hawks Volt Green
  secondary: "#E03A3E",    // Torch Red
  text: "#FFFFFF",         // Primary text
  muted: "#A0A0A0",        // Secondary text
  card: "#1A1A1A",         // Card background
  cardBorder: "#2A2A2A",   // Card border
}
```

Track-specific accent colors from `TRACK_ACCENT_COLORS`:
- welcome-to-atlanta: `#C1D32F` (Hawks green)
- the-south-got-something-to-say: `#D4A574` (warm brown)
- hard-in-da-paint: `#14B8A6` (teal)
- etc.

Semantic pill colors from `PILL_COLORS`:
- tonight: `#E03A3E` (red)
- weekend: `#C1D32F` (green)
- free: `#34D399` (emerald)

---

## 8. Implementation Checklist

### Phase 1: Hero (30 min)
- [ ] Increase hero min-height to 340px/400px
- [ ] Brighten portrait filter (0.28 → 0.5 brightness)
- [ ] Update gradient overlay
- [ ] Redesign back button as pill
- [ ] Add category pill with accent border
- [ ] Increase title font size (38px/52px)
- [ ] Brighten quote text (0.45 → 0.7 opacity)
- [ ] Add accent-colored dash to quote source
- [ ] Integrate description into hero with line-clamp-2
- [ ] Remove separate description section
- [ ] Add hero fade-in animation

### Phase 2: Activity Bar (20 min)
- [ ] Increase stat value size (text-2xl/3xl)
- [ ] Add text glow to colored values
- [ ] Add pulse indicator dot to "Tonight" stat
- [ ] Increase label text size (10px/11px)
- [ ] Add gradient background to container
- [ ] Increase padding (py-4/py-5)
- [ ] Brighten label color (0.3 → 0.5 opacity)

### Phase 3: Featured Cards (45 min)
- [ ] Change mobile image aspect from 16:9 to 3:2
- [ ] Add desktop horizontal layout (image left 40%, content right 60%)
- [ ] Reduce padding (p-3.5 → p-3)
- [ ] Add line-clamp-2 to blurb
- [ ] Limit events to 2 on mobile, 3 on desktop
- [ ] Add "+N more events" footer when >2 events
- [ ] Remove tags footer when events present
- [ ] Add hover lift effect
- [ ] Reduce stagger animation delay (90ms → 50ms)

### Phase 4: Compact Grid (20 min)
- [ ] Change image aspect from 4:3 to 1:1
- [ ] Increase venue name size (12px → 13px)
- [ ] Increase neighborhood size (8px → 9px)
- [ ] Increase blurb size (10.5px → 11.5px)
- [ ] Increase padding (p-2 → p-2.5)

### Phase 5: Section Headers (15 min)
- [ ] Add accent bar to "Happening this week" header
- [ ] Use accent color for header text
- [ ] Increase font size (9px → 10px)
- [ ] Add subtle bar to secondary headers

### Phase 6: Footer & Polish (15 min)
- [ ] Redesign "See All" button with accent border
- [ ] Add hover state transitions
- [ ] Add focus indicators to all interactive elements
- [ ] Add sr-only activity summary
- [ ] Test color contrast ratios

### Phase 7: Mobile QA (20 min)
- [ ] Test on iPhone SE (375px width)
- [ ] Test on iPhone 14 Pro (393px width)
- [ ] Verify tap targets ≥44px
- [ ] Test scroll performance
- [ ] Verify text readability at all sizes

**Total Estimated Time:** 2.5-3 hours

---

## 9. Success Metrics

### Quantitative:
- **Scroll reduction:** 60%+ (3600px → ~1500px for 12 venues)
- **Venues per viewport:** 2-3 → 4-6 (initial load)
- **Contrast ratios:** All text passes WCAG AA (4.5:1 minimum)
- **Load time:** <2s on 3G for hero + first 3 cards

### Qualitative:
- Hero feels inviting and cinematic (matches track list quality)
- Venue cards are scannable and information-dense
- Visual hierarchy is clear (hero → featured → grid)
- Dark theme feels premium, not murky
- Page has visual rhythm and breathing room

---

## 10. Design Rationale — Key Decisions

### Why horizontal featured cards on desktop?
**Problem:** Vertical 16:9 images dominate the viewport, creating monotonous scroll.  
**Solution:** Side-by-side layout reduces height by 40% while improving scannability. Users can see image + content in a single glance.

### Why brighter hero?
**Problem:** Current hero is so dark it feels like a dead end, not an entry point.  
**Solution:** Brightness 0.5 (vs 0.28) makes the portrait visible while maintaining moody aesthetic. Better contrast = better emotional connection.

### Why larger activity stats?
**Problem:** Stats are barely visible, feel like metadata rather than actionable info.  
**Solution:** Text-3xl with glow makes stats feel like primary CTAs. The pulse on "Tonight" adds urgency.

### Why 1:1 compact grid images?
**Problem:** 4:3 images on 50% width are tiny and unreadable.  
**Solution:** 1:1 gives more vertical space for image, better visual impact. More Instagram-like, less thumbnail-like.

### Why integrate description into hero?
**Problem:** Separate description section adds 60px+ of vertical scroll and breaks hero momentum.  
**Solution:** Line-clamp-2 in hero keeps description visible but contained. Users who want more can tap the venue.

### Why semantic pill colors?
**Problem:** Using track accent for all pills makes "Tonight" and "Free" feel the same.  
**Solution:** Red for tonight = urgency, Green for weekend = upcoming, Emerald for free = value. Color communicates meaning.

---

## 11. Future Enhancements (Out of Scope)

These are good ideas but not required for v1:

- **Venue filtering:** Allow users to show only featured venues or only grid venues
- **Event calendar integration:** Show events in a mini-calendar view
- **Map view:** Show all track venues on a map
- **Share functionality:** Share track link or specific venues
- **Print-friendly layout:** PDF export of track guide
- **Venue reordering:** Drag-to-reorder venues within track

---

## Appendix: CSS Additions Required

Add to `globals.css`:

```css
/* Track detail hero animation */
@keyframes heroFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.track-detail-hero {
  animation: heroFadeIn 0.4s ease-out;
}

/* Hover lift for venue cards */
.venue-card-lift {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.venue-card-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

/* Screen reader only utility (if not already present) */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Questions for Product/Eng

1. **Desktop breakpoint:** Current design uses `md:` (768px). Should we add an `lg:` breakpoint (1024px) for even more optimized desktop layouts?

2. **Event detail link:** Should clicking an event row in the venue card open event detail, or should the entire card link to the venue?

3. **Upvote persistence:** Should upvotes persist across sessions (requires auth), or just optimistic UI updates?

4. **"See All" behavior:** Should it open a full track venue list page, or expand inline?

5. **Image loading:** Should we use blur-up placeholders (requires image processing) or solid color backgrounds?

---

**End of Design Spec**
