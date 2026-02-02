# Portal Polish - Quick Reference

## CSS Classes Added

### Animations
```css
.animate-slide-up        /* Smooth upward reveal (400ms) */
.animate-content-reveal  /* Bounce-in reveal (500ms) */
.animate-fade-in        /* Simple fade (300ms) - existing */
.stagger-1 to .stagger-10  /* Stagger delays (20ms increments) - existing */
```

### Layout
```css
.img-optimized          /* Content visibility + intrinsic size */
.aspect-container       /* Prevent layout shift for images */
```

### Usage Examples
```jsx
// Section reveal
<section className="animate-slide-up">

// Hero content with stagger
<div className="animate-content-reveal">
  <h1 className="animate-fade-in stagger-1">Title</h1>
  <p className="animate-fade-in stagger-2">Subtitle</p>
  <button className="animate-fade-in stagger-3">CTA</button>
</div>

// Optimized image
<img className="img-optimized" ... />

// Aspect ratio container
<div className="aspect-container aspect-[16/9]">
  <img ... />
</div>
```

## Component Patterns

### Section Header (Standard)
```jsx
<div className="flex items-center gap-3 mb-5">
  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--neon-magenta)] to-[var(--coral)] flex items-center justify-center shadow-lg">
    <span className="text-xl">🌙</span>
  </div>
  <div className="flex-1">
    <h2 className="font-display text-2xl font-semibold text-[var(--cream)] tracking-tight">
      Section Title
    </h2>
    <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
      Description text
    </p>
  </div>
</div>
```

### Section Header (Simple)
```jsx
<div className="mb-5">
  <h2 className="text-xl font-display font-semibold text-[var(--cream)] mb-1 tracking-tight">
    Section Title
  </h2>
  <p className="font-mono text-xs text-[var(--muted)]">
    Description text
  </p>
</div>
```

### Card with Hover Effect
```jsx
<Link
  href="..."
  className="block relative rounded-2xl overflow-hidden transition-transform duration-300 hover:scale-[1.01] group"
  style={{ willChange: 'transform' }}
>
  <div
    className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
    style={{
      backgroundImage: `url(...)`,
      willChange: 'transform'
    }}
  />
  {/* Content */}
</Link>
```

### Tab Navigation
```jsx
<div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30">
  <button
    className={`
      flex-1 px-3 py-2.5 rounded-lg font-mono text-xs font-medium
      transition-all duration-200
      ${isActive
        ? "bg-[var(--coral)] text-[var(--void)] shadow-[0_0_16px_var(--coral)/25]"
        : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
      }
    `}
  >
    Tab Label
  </button>
</div>
```

### Skeleton Loader
```jsx
// Match final UI exactly to prevent layout shift
<div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30">
  {[1, 2, 3].map((i) => (
    <div key={i} className="flex-1 h-10 skeleton-shimmer rounded-lg" />
  ))}
</div>
```

## Timing Standards

```js
// Use these values consistently
const TIMINGS = {
  micro: 100,      // Button press
  fast: 200,       // Tab switch, hover
  medium: 300,     // Card hover
  slow: 500,       // Section reveal
  dramatic: 700,   // Hero zoom
  shimmer: 3000,   // Loading skeleton
};
```

## Spacing Standards

```js
const SPACING = {
  tight: 'gap-2',     // 8px - related items
  normal: 'gap-3',    // 12px - default spacing
  relaxed: 'gap-4',   // 16px - section items
  section: 'gap-5',   // 20px - major sections
  hero: 'gap-6',      // 24px - hero elements
};

const MARGINS = {
  item: 'mb-3',       // 12px - list items
  group: 'mb-4',      // 16px - grouped content
  section: 'mb-5',    // 20px - sections
  major: 'mb-6',      // 24px - major dividers
};
```

## Typography Standards

```jsx
// Section Headers
<h2 className="text-xl md:text-2xl font-display font-semibold text-[var(--cream)] tracking-tight">

// Section Subheaders
<h3 className="text-lg font-display font-medium text-[var(--cream)]">

// Body Text
<p className="text-sm md:text-base text-[var(--muted)]">

// Labels
<span className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider">

// Hero Titles
<h1 className="text-4xl md:text-5xl lg:text-7xl font-display font-bold text-white tracking-tight">

// Hero Subtitles
<p className="text-lg md:text-xl lg:text-2xl text-white/90 font-medium">
```

## Performance Checklist

### Images
- [ ] Use `quality={90}` for hero images
- [ ] Add `priority` for above-fold images
- [ ] Add `loading="lazy"` for below-fold images
- [ ] Add `willChange: 'transform'` for animated images
- [ ] Use proper `sizes` attribute

### Animations
- [ ] Use `willChange` sparingly (only for animated properties)
- [ ] Keep durations under 700ms for interactive elements
- [ ] Use CSS containment for complex sections
- [ ] Respect `prefers-reduced-motion`

### Layout
- [ ] Match skeleton dimensions to actual content
- [ ] Use aspect ratio containers for images
- [ ] Add proper `Suspense` boundaries
- [ ] Avoid nested `Suspense` with same fallback

### Example: Optimized Image Component
```jsx
<div className="relative aspect-[16/9] overflow-hidden rounded-xl">
  <Image
    src={imageUrl}
    alt={title}
    fill
    quality={90}
    priority={aboveFold}
    className="object-cover transition-transform duration-700 group-hover:scale-105"
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    style={{ willChange: 'transform' }}
  />
</div>
```

## Common Mistakes to Avoid

### ❌ Don't
```jsx
// Too fast shimmer
animation: skeleton-shimmer 1s infinite;

// Missing willChange on transforms
<div className="hover:scale-105" />

// Inconsistent timing
transition: transform 150ms, opacity 300ms;

// Skeleton doesn't match UI
<div className="h-8 rounded-md" /> // actual is h-10 rounded-lg

// No GPU hints
transform: scale(1.05);
```

### ✅ Do
```jsx
// Smooth shimmer
animation: skeleton-shimmer 3s ease-in-out infinite;

// Proper GPU acceleration
<div className="hover:scale-105" style={{ willChange: 'transform' }} />

// Consistent timing
transition-all duration-200

// Skeleton matches UI
<div className="h-10 rounded-lg skeleton-shimmer" />

// GPU hints for performance
transform: scale(1.05);
will-change: transform;
```

## Debugging Tips

### Check Layout Shift
```js
// In browser console
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('CLS:', entry);
  }
}).observe({ entryTypes: ['layout-shift'] });
```

### Check Animation Performance
```js
// In DevTools > Performance
// Record while loading page
// Look for:
// - Long tasks (>50ms)
// - Layout/reflow warnings
// - Paint operations
```

### Visual Debugging
```css
/* Add to globals.css temporarily */
* { outline: 1px solid red !important; }
.skeleton-shimmer { outline: 2px solid blue !important; }
```

## Files Reference

### Modified Files
- `app/[portal]/page.tsx` - Main portal layout
- `app/globals.css` - Animations and utilities
- `components/HeroSection.tsx` - Hero enhancements
- `components/TonightsPicks.tsx` - Section polish
- `components/TrendingNow.tsx` - Section polish
- `components/BrowseByActivity.tsx` - Section polish
- `components/feed/FeedShell.tsx` - Tab polish
- `components/feed/CuratedContent.tsx` - Layout organization
- `components/family/FamilyFeed.tsx` - Family portal polish

### Documentation
- `PORTAL_LANDING_PAGE_POLISH.md` - Detailed changes
- `PORTAL_POLISH_VISUAL_GUIDE.md` - Visual comparisons
- `PORTAL_POLISH_QUICK_REF.md` - This file
