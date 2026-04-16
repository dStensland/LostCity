# Detail Page Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CMS-grade 340px sidebar detail layout with a cinematic full-bleed hero + sticky action rail for event detail pages.

**Architecture:** Shell Replacement — swap DetailShell with a new ElevatedShell (full-width hero → content column + 300px sticky rail). Section modules, manifests, and data hooks are untouched. Hero tier (expanded/compact/typographic) is determined server-side based on image dimensions.

**Tech Stack:** Next.js 16 (React 19), Tailwind CSS, Supabase, Phosphor Icons, existing motion design system (globals.css utilities)

**Spec:** `docs/superpowers/specs/2026-04-16-detail-page-elevation-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `web/components/detail/ElevatedShell.tsx` | Named-slot layout: hero (full-width) → content + rail two-column |
| `web/components/detail/core/QuickFactsCard.tsx` | Rail sub-component: date, venue link, price, age policy |
| `web/components/detail/core/HeroOverlayNav.tsx` | Floating back button overlay on hero |
| `web/components/detail/core/__tests__/heroTier.test.ts` | Unit tests for tier detection logic |
| `database/migrations/YYYYMMDD_add_image_dimensions.sql` | Add image_width/image_height columns |

### Modified Files
| File | Change |
|------|--------|
| `web/lib/detail/types.ts` | Add `image_width`, `image_height` to `EventData`; add `heroTier` to `EventApiResponse`; add `HeroTier` type |
| `web/lib/mappers/event-detail-mapper.ts` | Compute `heroTier` from image dimensions |
| `web/components/detail/core/DetailHero.tsx` | Add `tier` prop, three render paths (expanded/compact/typographic) |
| `web/components/detail/core/DetailActions.tsx` | Add `variant: 'sidebar' | 'rail'` prop; rail layout: vertical stack, full-width CTA, tier-adaptive poster |
| `web/components/detail/core/DetailIdentity.tsx` | Add `variant: 'sidebar' | 'elevated'` for typography upgrade |
| `web/components/detail/identity/EventIdentity.tsx` | Elevated variant: larger title, mono metadata, no icons |
| `web/components/detail/core/DetailLayout.tsx` | Add `shellVariant` prop; route configs to ElevatedShell when `'elevated'` |
| `web/components/views/EventDetailView.tsx` | Pass `shellVariant: 'elevated'`, `heroTier` from server data |
| `web/app/globals.css` | Add `@keyframes cta-pulse-glow` keyframe |

### Deleted Files
| File | Reason |
|------|--------|
| `web/components/detail/DetailHero.tsx` (outer, 242 lines) | Legacy pre-rearchitecture hero. Consolidate into core version. |

---

## Task 1: Database Migration — Image Dimensions

**Files:**
- Create: `database/migrations/YYYYMMDD_add_image_dimensions.sql`

This adds the columns that enable server-side hero tier detection. Without this, the tier is unknown and we'd have to use client-side detection (which causes layout shift).

- [ ] **Step 1: Check current events table schema**

Run: `supabase db dump --schema public --table events | head -80`

Confirm `image_width` and `image_height` do not already exist.

- [ ] **Step 2: Create migration**

Create `database/migrations/20260416_add_image_dimensions.sql`:

```sql
-- Add image dimension columns for server-side hero tier detection
-- These are populated at crawl time via image intrinsics
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS image_width integer,
  ADD COLUMN IF NOT EXISTS image_height integer;

-- Index for efficient tier computation (only care about images that exist)
CREATE INDEX IF NOT EXISTS idx_events_image_dimensions
  ON events (image_width, image_height)
  WHERE image_url IS NOT NULL;

COMMENT ON COLUMN events.image_width IS 'Width in pixels of image_url, populated at crawl time';
COMMENT ON COLUMN events.image_height IS 'Height in pixels of image_url, populated at crawl time';
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push` (or local: `supabase migration up`)

- [ ] **Step 4: Verify columns exist**

Run: `supabase db dump --schema public --table events | grep image_`

Expected: see `image_width integer` and `image_height integer` in output.

- [ ] **Step 5: Regenerate Supabase types**

Run: `npx supabase gen types typescript --project-id $PROJECT_ID > web/lib/database.types.ts`

Verify `image_width` and `image_height` appear in the generated types.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/20260416_add_image_dimensions.sql web/lib/database.types.ts
git commit -m "feat(db): add image_width/image_height columns for hero tier detection"
```

---

## Task 2: Types & Server-Side Tier Detection

**Files:**
- Modify: `web/lib/detail/types.ts`
- Modify: `web/lib/mappers/event-detail-mapper.ts`
- Create: `web/components/detail/core/__tests__/heroTier.test.ts`

- [ ] **Step 1: Add HeroTier type and update EventData**

In `web/lib/detail/types.ts`, add the `HeroTier` type near the top (after existing imports/types):

```typescript
export type HeroTier = 'expanded' | 'compact' | 'typographic';
```

Add `image_width` and `image_height` to `EventData` interface (after `image_url`):

```typescript
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
```

Add `heroTier` to `EventApiResponse`:

```typescript
export interface EventApiResponse {
  event: EventData;
  heroTier: HeroTier;
  eventArtists: EventArtist[];
  venueEvents: unknown[];
  nearbyEvents: unknown[];
  nearbyDestinations: Record<string, unknown[]>;
}
```

- [ ] **Step 2: Write the tier detection function and test**

Create `web/components/detail/core/__tests__/heroTier.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeHeroTier } from '@/lib/mappers/event-detail-mapper';

describe('computeHeroTier', () => {
  it('returns "expanded" for landscape image >= 1200px wide with aspect >= 1.3', () => {
    expect(computeHeroTier('https://img.jpg', 1600, 900, [])).toBe('expanded');
  });

  it('returns "expanded" for image at exact threshold (1200x923)', () => {
    expect(computeHeroTier('https://img.jpg', 1200, 923, [])).toBe('expanded');
  });

  it('returns "compact" for portrait image', () => {
    expect(computeHeroTier('https://img.jpg', 800, 1200, [])).toBe('compact');
  });

  it('returns "compact" for small landscape image (< 1200px)', () => {
    expect(computeHeroTier('https://img.jpg', 900, 600, [])).toBe('compact');
  });

  it('returns "compact" for square image', () => {
    expect(computeHeroTier('https://img.jpg', 1000, 1000, [])).toBe('compact');
  });

  it('returns "compact" for image with null dimensions', () => {
    expect(computeHeroTier('https://img.jpg', null, null, [])).toBe('compact');
  });

  it('returns "typographic" when no image URL', () => {
    expect(computeHeroTier(null, null, null, [])).toBe('typographic');
  });

  it('returns "expanded" when gallery has 2+ images regardless of primary dimensions', () => {
    expect(computeHeroTier('https://small.jpg', 400, 400, [
      'https://a.jpg', 'https://b.jpg',
    ])).toBe('expanded');
  });

  it('returns "typographic" when no image even with empty gallery', () => {
    expect(computeHeroTier(null, null, null, [])).toBe('typographic');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run components/detail/core/__tests__/heroTier.test.ts`

Expected: FAIL — `computeHeroTier` not found.

- [ ] **Step 4: Implement computeHeroTier in mapper**

In `web/lib/mappers/event-detail-mapper.ts`, add the exported function (before `mapEventServerDataToViewData`):

```typescript
import type { HeroTier } from '@/lib/detail/types';

export function computeHeroTier(
  imageUrl: string | null,
  imageWidth: number | null,
  imageHeight: number | null,
  galleryUrls: string[],
): HeroTier {
  if (!imageUrl) return 'typographic';
  if (galleryUrls.length >= 2) return 'expanded';
  if (
    imageWidth != null &&
    imageHeight != null &&
    imageWidth >= 1200 &&
    imageWidth / imageHeight >= 1.3
  ) {
    return 'expanded';
  }
  return 'compact';
}
```

- [ ] **Step 5: Wire heroTier into mapEventServerDataToViewData**

In the return object of `mapEventServerDataToViewData`, add `heroTier`:

```typescript
  heroTier: computeHeroTier(
    imageUrl,
    event.image_width ?? null,
    event.image_height ?? null,
    [], // gallery URLs not available at server level yet — will be added when gallery data exists
  ),
```

- [ ] **Step 6: Run tests**

Run: `cd web && npx vitest run components/detail/core/__tests__/heroTier.test.ts`

Expected: all 9 tests PASS.

- [ ] **Step 7: Run tsc**

Run: `cd web && npx tsc --noEmit`

Expected: no errors. If there are errors from the `EventApiResponse` shape change, update any consuming code to handle the new `heroTier` field.

- [ ] **Step 8: Commit**

```bash
git add web/lib/detail/types.ts web/lib/mappers/event-detail-mapper.ts web/components/detail/core/__tests__/heroTier.test.ts
git commit -m "feat: server-side hero tier detection — expanded/compact/typographic"
```

---

## Task 3: Consolidate DetailHero Files

**Files:**
- Delete: `web/components/detail/DetailHero.tsx` (outer, 242 lines)
- Modify: `web/components/detail/core/DetailHero.tsx` (138 lines — will be extended in Task 6)

The outer `DetailHero.tsx` is a legacy pre-rearchitecture component. The core version is used by `DetailLayout`. We need to check if the outer one is still imported anywhere and migrate those usages before deleting.

- [ ] **Step 1: Find all imports of the outer DetailHero**

Search for imports of the outer (non-core) DetailHero:

Run: `grep -rn "from.*detail/DetailHero" web/components/ web/app/ --include="*.tsx" --include="*.ts" | grep -v "/core/DetailHero" | grep -v "__tests__" | grep -v "node_modules"`

If any files import from `@/components/detail/DetailHero` or `../DetailHero` (not `../core/DetailHero`), those need to be migrated to use the core version.

- [ ] **Step 2: Migrate any remaining imports**

For each file found in Step 1, update the import to use the core version. The core `DetailHero` accepts `HeroConfig` props — check that the calling code provides the right shape. If the outer version has features the core version lacks (e.g., view transitions, floating back button), note them — those will be handled by `HeroOverlayNav` (Task 7) and the adaptive hero (Task 6).

- [ ] **Step 3: Delete the outer DetailHero**

Remove `web/components/detail/DetailHero.tsx`.

- [ ] **Step 4: Run tsc to verify no broken imports**

Run: `cd web && npx tsc --noEmit`

Expected: no errors. If the outer DetailHero had unique exports used elsewhere, the tsc will catch them.

- [ ] **Step 5: Commit**

```bash
git add -A web/components/detail/DetailHero.tsx web/components/detail/core/DetailHero.tsx
git commit -m "refactor: consolidate DetailHero — remove legacy outer, keep core"
```

---

## Task 4: ElevatedShell Component

**Files:**
- Create: `web/components/detail/ElevatedShell.tsx`

This is the structural backbone of the elevation. Full-width hero slot at top, two-column below (fluid content + 300px sticky rail), mobile collapses to single column with bottom bar.

- [ ] **Step 1: Create ElevatedShell**

Create `web/components/detail/ElevatedShell.tsx`:

```tsx
import { type ReactNode } from 'react';

interface ElevatedShellProps {
  hero: ReactNode;
  identity: ReactNode;      // null for typographic tier (identity embedded in hero)
  rail: ReactNode;           // null on mobile (rendered conditionally by caller)
  content: ReactNode;
  bottomBar?: ReactNode;
}

export function ElevatedShell({
  hero,
  identity,
  rail,
  content,
  bottomBar,
}: ElevatedShellProps) {
  return (
    <div className="relative min-h-[100dvh] bg-[var(--void)]">
      {/* Hero — full viewport width */}
      <div className="w-full">{hero}</div>

      {/* Two-column layout below hero */}
      <div className="mx-auto max-w-7xl px-0 lg:px-6">
        <div className="flex flex-col lg:flex-row lg:gap-8">
          {/* Content column */}
          <main className="flex-1 min-w-0">
            {identity && (
              <div className="px-4 lg:px-8 pt-6 pb-4">{identity}</div>
            )}
            <div>{content}</div>
          </main>

          {/* Sticky action rail — desktop only */}
          {rail && (
            <aside className="hidden lg:block lg:w-[300px] lg:flex-shrink-0">
              <div className="sticky top-6 max-h-[calc(100dvh-48px)] overflow-y-auto scrollbar-hide">
                {rail}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      {bottomBar && (
        <div className="lg:hidden">{bottomBar}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run tsc**

Run: `cd web && npx tsc --noEmit`

Expected: no errors (component is standalone, not yet wired in).

- [ ] **Step 3: Commit**

```bash
git add web/components/detail/ElevatedShell.tsx
git commit -m "feat: ElevatedShell — full-width hero + sticky rail layout"
```

---

## Task 5: HeroOverlayNav — Floating Back Button

**Files:**
- Create: `web/components/detail/core/HeroOverlayNav.tsx`

Replaces the top bar chrome on desktop canonical pages. Back button floats over the hero as an overlay.

- [ ] **Step 1: Create HeroOverlayNav**

Create `web/components/detail/core/HeroOverlayNav.tsx`:

```tsx
'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

interface HeroOverlayNavProps {
  onClose?: () => void;
  portalSlug?: string;
}

export function HeroOverlayNav({ onClose, portalSlug }: HeroOverlayNavProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else if (portalSlug) {
      router.push(`/${portalSlug}`);
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleBack}
      aria-label="Go back"
      className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white/70 transition-colors hover:bg-black/60 hover:text-white"
    >
      <ArrowLeft size={20} weight="bold" />
    </button>
  );
}
```

- [ ] **Step 2: Run tsc**

Run: `cd web && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/detail/core/HeroOverlayNav.tsx
git commit -m "feat: HeroOverlayNav — floating back button overlay for hero"
```

---

## Task 6: Adaptive DetailHero — Three Tiers

**Files:**
- Modify: `web/components/detail/core/DetailHero.tsx`

Extend the core hero to support three render paths based on the `tier` prop. The current hero handles image/gallery/fallback — we're restructuring these into expanded/compact/typographic.

- [ ] **Step 1: Read current DetailHero and understand the interface**

Read `web/components/detail/core/DetailHero.tsx` to confirm the current props and rendering logic.

The current `HeroConfig` interface (from `types.ts`) has: `imageUrl`, `aspectClass`, `fallbackMode`, `galleryEnabled`, `galleryUrls`, `category`, `isLive`, `overlaySlot`, `mobileMaxHeight`.

- [ ] **Step 2: Update HeroConfig type**

In `web/lib/detail/types.ts`, update `HeroConfig`:

```typescript
export interface HeroConfig {
  imageUrl: string | null;
  tier: HeroTier;                    // NEW — replaces aspectClass + fallbackMode for elevated shell
  aspectClass?: string;              // kept for sidebar shell backward compat
  fallbackMode?: 'category-icon' | 'type-icon' | 'logo' | 'banner';  // kept for sidebar shell
  galleryEnabled: boolean;
  galleryUrls?: string[];
  category?: string | null;
  isLive?: boolean;
  overlaySlot?: React.ReactNode;
  mobileMaxHeight?: string;
  title?: string;                    // NEW — for typographic tier (title rendered in hero)
  metadataLine?: string;             // NEW — for typographic tier (e.g., "APR 18 · TERMINAL WEST")
  tags?: string[];                   // NEW — for typographic tier
  accentColor?: string;              // NEW — for tier gradient coloring
}
```

- [ ] **Step 3: Rewrite DetailHero with tier support**

Rewrite `web/components/detail/core/DetailHero.tsx`. The component should branch on `tier` when present, falling back to the current `aspectClass`-based rendering for backward compatibility with the sidebar shell.

```tsx
'use client';

import { useState } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { HeroOverlayNav } from './HeroOverlayNav';
import type { HeroConfig } from '@/lib/detail/types';

// Category icon mapping — reuse existing logic from the current fallback
function getCategoryIcon(category: string | null): string {
  const icons: Record<string, string> = {
    'music': '🎵',
    'film': '🎬',
    'comedy': '😂',
    'sports': '⚽',
    'food-drink': '🍽️',
    'arts-culture': '🎨',
    'community': '🤝',
    'nightlife': '🌙',
    'outdoor': '🌲',
    'family': '👨‍👩‍👧‍👦',
  };
  return icons[category ?? ''] ?? '✦';
}

interface DetailHeroProps extends HeroConfig {
  onClose?: () => void;
  portalSlug?: string;
}

export default function DetailHero(props: DetailHeroProps) {
  const {
    tier,
    imageUrl,
    galleryEnabled,
    galleryUrls,
    category,
    isLive,
    overlaySlot,
    title,
    metadataLine,
    tags,
    accentColor,
    onClose,
    portalSlug,
  } = props;

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Determine images to display
  const images: string[] = [];
  if (galleryEnabled && galleryUrls?.length) {
    images.push(...galleryUrls);
  } else if (imageUrl && !imgError) {
    images.push(imageUrl);
  }

  const currentImage = images[galleryIndex] ?? null;
  const hasGallery = images.length > 1;

  // If tier is not set, fall back to legacy rendering (sidebar shell compat)
  if (!tier) {
    return <LegacyHero {...props} />;
  }

  // ── Tier: Expanded ────────────────────────────────
  if (tier === 'expanded') {
    return (
      <div className="relative w-full motion-fade-in">
        {/* Image container — 50-60vh */}
        <div className="relative w-full h-[55vh] min-h-[400px] max-h-[700px] overflow-hidden">
          {currentImage ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 bg-[var(--dusk)] animate-pulse" />
              )}
              <SmartImage
                src={currentImage}
                alt={title ?? ''}
                fill
                className="object-cover"
                sizes="100vw"
                priority
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)]" />
          )}

          {/* Bottom gradient fade */}
          <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-[var(--void)] to-transparent" />

          {/* LIVE badge */}
          {isLive && (
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-[var(--coral)] px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <span className="font-mono text-2xs font-medium uppercase text-white">Live</span>
            </div>
          )}

          {/* Overlay slot (badges etc) */}
          {overlaySlot}

          {/* Back button overlay */}
          <HeroOverlayNav onClose={onClose} portalSlug={portalSlug} />

          {/* Gallery controls */}
          {hasGallery && (
            <>
              <button
                onClick={() => setGalleryIndex((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60"
                aria-label="Previous image"
              >
                <ArrowLeft size={16} weight="bold" />
              </button>
              <button
                onClick={() => setGalleryIndex((i) => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60"
                aria-label="Next image"
              >
                <ArrowRight size={16} weight="bold" />
              </button>
              {/* Dot indicators */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-[3px] rounded-full bg-black/30 backdrop-blur-sm px-2.5 py-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIndex(i)}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i === galleryIndex ? 'bg-white' : 'bg-white/40'
                    }`}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Tier: Compact ─────────────────────────────────
  if (tier === 'compact') {
    const gradientColor = accentColor ?? 'var(--dusk)';
    return (
      <div className="relative w-full motion-fade-in">
        <div
          className="relative w-full"
          style={{ height: '200px' }}
        >
          {/* Gradient band */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${gradientColor}33 0%, var(--night) 100%)`,
            }}
          />
          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[var(--void)] to-transparent" />

          {/* LIVE badge */}
          {isLive && (
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-[var(--coral)] px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <span className="font-mono text-2xs font-medium uppercase text-white">Live</span>
            </div>
          )}

          {overlaySlot}
          <HeroOverlayNav onClose={onClose} portalSlug={portalSlug} />
        </div>
      </div>
    );
  }

  // ── Tier: Typographic ─────────────────────────────
  if (tier === 'typographic') {
    const gradientColor = accentColor ?? 'var(--dusk)';
    const icon = getCategoryIcon(category ?? null);
    return (
      <div className="relative w-full motion-fade-in">
        <div
          className="relative w-full flex flex-col justify-end"
          style={{ minHeight: '220px', padding: '0 0 24px' }}
        >
          {/* Atmospheric gradient band */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(160deg, ${gradientColor}40 0%, var(--night) 70%, var(--void) 100%)`,
            }}
          />
          {/* Bottom fade to void */}
          <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-[var(--void)] to-transparent" />

          <HeroOverlayNav onClose={onClose} portalSlug={portalSlug} />

          {/* Typography-led identity — lives inside the hero */}
          <div className="relative z-10 px-4 lg:px-8 max-w-7xl mx-auto w-full">
            {/* Category icon with glow */}
            <div
              className="mb-3 flex h-10 w-10 items-center justify-content rounded-[10px] text-lg"
              style={{
                background: `${gradientColor}1F`,
                boxShadow: `0 0 24px ${gradientColor}24`,
              }}
            >
              <span className="mx-auto">{icon}</span>
            </div>

            {/* Metadata line */}
            {metadataLine && (
              <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)] mb-1 motion-fade-up" style={{ animationDelay: '60ms' }}>
                {metadataLine}
              </p>
            )}

            {/* Title */}
            <h1 className="text-3xl font-bold text-[var(--cream)] mb-2 motion-fade-up" style={{ animationDelay: '100ms' }}>
              {title}
            </h1>

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 motion-fade-up" style={{ animationDelay: '140ms' }}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--twilight)]/60 px-2.5 py-0.5 font-mono text-2xs text-[var(--muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── Legacy hero for sidebar shell backward compat ───
// This preserves current behavior for non-event entity types
function LegacyHero(props: DetailHeroProps) {
  const {
    imageUrl,
    aspectClass = 'aspect-video',
    galleryEnabled,
    galleryUrls,
    category,
    isLive,
    overlaySlot,
    mobileMaxHeight,
  } = props;

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const images: string[] = [];
  if (galleryEnabled && galleryUrls?.length) {
    images.push(...galleryUrls);
  } else if (imageUrl && !imgError) {
    images.push(imageUrl);
  }

  const currentImage = images[galleryIndex] ?? null;
  const hasGallery = images.length > 1;

  if (images.length === 0) {
    // Fallback
    return (
      <div className={`relative w-full ${aspectClass} bg-gradient-to-br from-[var(--dusk)] to-[var(--night)] motion-fade-in`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl opacity-35">{getCategoryIcon(category ?? null)}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#09090BEE] to-transparent" />
        {overlaySlot}
      </div>
    );
  }

  return (
    <div className={`relative w-full ${aspectClass} ${mobileMaxHeight ?? ''} overflow-hidden motion-fade-in`}>
      {!imgLoaded && <div className="absolute inset-0 bg-[var(--dusk)] animate-pulse" />}
      <SmartImage
        src={currentImage!}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 340px"
        priority
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#09090BEE] to-transparent" />
      {isLive && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-[var(--coral)] px-2.5 py-0.5">
          <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          <span className="font-mono text-2xs font-medium uppercase text-white">Live</span>
        </div>
      )}
      {overlaySlot}
      {hasGallery && (
        <>
          <button
            onClick={() => setGalleryIndex((i) => (i - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60"
            aria-label="Previous"
          >
            <ArrowLeft size={16} weight="bold" />
          </button>
          <button
            onClick={() => setGalleryIndex((i) => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60"
            aria-label="Next"
          >
            <ArrowRight size={16} weight="bold" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1 rounded-full bg-black/30 backdrop-blur-sm px-2 py-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setGalleryIndex(i)}
                className={`h-1.5 w-1.5 rounded-full ${i === galleryIndex ? 'bg-white' : 'bg-white/40'}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

**Note to implementer:** The `LegacyHero` function preserves current sidebar-shell behavior for non-event entity types. Read the current `DetailHero.tsx` carefully and ensure all existing behavior is preserved in `LegacyHero`. The code above is the target structure — adapt the exact rendering logic from the current file. Do NOT lose existing gallery, skeleton, error, or LIVE badge behavior.

- [ ] **Step 4: Run tsc**

Run: `cd web && npx tsc --noEmit`

Fix any type errors from the `HeroConfig` changes. Other entity views (`PlaceDetailView`, `SeriesDetailView`, etc.) pass `HeroConfig` — they don't set `tier`, so they'll get `LegacyHero` via the fallback path.

- [ ] **Step 5: Run existing tests**

Run: `cd web && npx vitest run`

Expected: all existing tests pass. The hero changes are backward-compatible.

- [ ] **Step 6: Commit**

```bash
git add web/components/detail/core/DetailHero.tsx web/lib/detail/types.ts
git commit -m "feat: adaptive DetailHero — expanded/compact/typographic tiers with legacy compat"
```

---

## Task 7: DetailActions Rail Variant

**Files:**
- Modify: `web/components/detail/core/DetailActions.tsx`

Add a `variant` prop. When `'rail'`, render as a vertical stack with full-width CTA and tier-adaptive poster thumbnail.

- [ ] **Step 1: Read current DetailActions**

Read `web/components/detail/core/DetailActions.tsx` to confirm the current interface.

Current props: `config: ActionConfig`, `accentColor: string`.

- [ ] **Step 2: Update ActionConfig type**

In `web/lib/detail/types.ts`, update `ActionConfig` to include rail-specific fields:

```typescript
export interface ActionConfig {
  primaryCTA: {
    label: string;
    href?: string;
    onClick?: () => void;
    variant: 'filled' | 'outlined';
    color?: string;
    icon?: React.ReactNode;
  } | null;
  secondaryActions: ActionButton[];
  stickyBar: {
    enabled: boolean;
    scrollThreshold?: number;
  };
  // Rail-specific
  posterUrl?: string | null;       // NEW — poster thumbnail in rail (Tier 2 only)
  heroTier?: HeroTier;             // NEW — controls whether poster shows
}
```

- [ ] **Step 3: Add rail variant to DetailActions**

Rewrite `web/components/detail/core/DetailActions.tsx` to support both variants:

```tsx
'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import type { ActionConfig } from '@/lib/detail/types';

interface DetailActionsProps {
  config: ActionConfig;
  accentColor: string;
  variant?: 'sidebar' | 'rail';
}

export default function DetailActions({
  config,
  accentColor,
  variant = 'sidebar',
}: DetailActionsProps) {
  const { primaryCTA, secondaryActions, posterUrl, heroTier } = config;

  if (variant === 'rail') {
    return <RailActions config={config} accentColor={accentColor} />;
  }

  // ── Sidebar variant (unchanged from current) ─────
  const ctaRowSecondary = secondaryActions[0];
  const remainingSecondaries = secondaryActions.slice(1);

  return (
    <div className="motion-fade-up" style={{ animationDelay: '200ms' }}>
      {/* CTA row */}
      {primaryCTA && (
        <div className="flex items-center gap-2.5 px-4 pb-3">
          <ActionButton action={primaryCTA} className="flex-1 h-[44px] rounded-[22px] text-sm font-semibold" />
          {ctaRowSecondary && (
            <button
              onClick={ctaRowSecondary.onClick}
              aria-label={ctaRowSecondary.label}
              className="flex w-[44px] h-[44px] items-center justify-center rounded-[22px] border border-[var(--twilight)] text-[var(--soft)] motion-hover-lift"
            >
              {ctaRowSecondary.icon}
            </button>
          )}
        </div>
      )}
      {/* Actions row */}
      {remainingSecondaries.length > 0 && (
        <div className="flex gap-2 justify-center px-4 pb-4">
          {remainingSecondaries.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              aria-label={action.label}
              className="flex w-10 h-10 items-center justify-center rounded-xl border border-[var(--twilight)] text-[var(--soft)] transition-all motion-hover-lift"
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rail variant ────────────────────────────────────
function RailActions({
  config,
  accentColor,
}: {
  config: ActionConfig;
  accentColor: string;
}) {
  const { primaryCTA, secondaryActions, posterUrl, heroTier } = config;
  const showPoster = heroTier === 'compact' && posterUrl;

  return (
    <div className="flex flex-col gap-4 pt-2 motion-fade-in" style={{ animationDelay: '200ms' }}>
      {/* Poster thumbnail — Tier 2 only */}
      {showPoster && (
        <div className="relative mx-auto w-[120px] aspect-[3/4] rounded-xl overflow-hidden"
          style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))' }}
        >
          <SmartImage
            src={posterUrl}
            alt=""
            fill
            className="object-cover"
            sizes="120px"
          />
          <div className="absolute inset-0 rounded-xl border border-[var(--twilight)]/30" />
        </div>
      )}

      {/* Primary CTA */}
      {primaryCTA && (
        <ActionButton
          action={primaryCTA}
          className="w-full h-[48px] rounded-full text-sm font-semibold cta-pulse-glow motion-hover-glow motion-press"
        />
      )}

      {/* Secondary actions */}
      {secondaryActions.length > 0 && (
        <div className="flex gap-2 justify-center">
          {secondaryActions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              aria-label={action.label}
              className="flex w-10 h-10 items-center justify-center rounded-xl border border-[var(--twilight)] text-[var(--soft)] transition-all motion-hover-lift"
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared button renderer ──────────────────────────
function ActionButton({
  action,
  className = '',
}: {
  action: NonNullable<ActionConfig['primaryCTA']>;
  className?: string;
}) {
  const filledBg = action.color ?? 'var(--coral)';
  const base = action.variant === 'filled'
    ? `text-white`
    : 'border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50';
  const style = action.variant === 'filled' ? { backgroundColor: filledBg } : undefined;

  if (action.href) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center gap-2 ${base} ${className}`}
        style={style}
      >
        {action.icon}
        {action.label}
      </a>
    );
  }

  return (
    <button
      onClick={action.onClick}
      className={`flex items-center justify-center gap-2 ${base} ${className}`}
      style={style}
    >
      {action.icon}
      {action.label}
    </button>
  );
}
```

**Note to implementer:** Read the current `DetailActions.tsx` carefully. The sidebar variant code above must match the current behavior exactly. Adapt from the actual file — the code above is the target structure.

- [ ] **Step 4: Run tsc**

Run: `cd web && npx tsc --noEmit`

Fix any type errors.

- [ ] **Step 5: Commit**

```bash
git add web/components/detail/core/DetailActions.tsx web/lib/detail/types.ts
git commit -m "feat: DetailActions rail variant — vertical stack with tier-adaptive poster"
```

---

## Task 8: QuickFactsCard

**Files:**
- Create: `web/components/detail/core/QuickFactsCard.tsx`

Rail sub-component showing date, venue link, price, age policy.

- [ ] **Step 1: Create QuickFactsCard**

Create `web/components/detail/core/QuickFactsCard.tsx`:

```tsx
import Link from 'next/link';
import {
  CalendarBlank,
  MapPin,
  Ticket,
  IdentificationBadge,
} from '@phosphor-icons/react';

interface QuickFactsCardProps {
  date: string;            // Pre-formatted date string (e.g., "Fri, Apr 18 · 7:00 PM")
  venueName: string | null;
  venueSlug: string | null;
  portalSlug: string;
  priceText: string | null;   // Pre-formatted (e.g., "$25 – $45" or "Free")
  agePolicy: string | null;   // e.g., "21+", "All Ages"
}

export function QuickFactsCard({
  date,
  venueName,
  venueSlug,
  portalSlug,
  priceText,
  agePolicy,
}: QuickFactsCardProps) {
  const facts: { icon: React.ReactNode; text: React.ReactNode }[] = [];

  facts.push({
    icon: <CalendarBlank size={14} weight="regular" />,
    text: date,
  });

  if (venueName) {
    facts.push({
      icon: <MapPin size={14} weight="regular" />,
      text: venueSlug ? (
        <Link
          href={`/${portalSlug}/spots/${venueSlug}`}
          className="hover:underline"
        >
          {venueName}
        </Link>
      ) : (
        venueName
      ),
    });
  }

  if (priceText) {
    facts.push({
      icon: <Ticket size={14} weight="regular" />,
      text: priceText,
    });
  }

  if (agePolicy) {
    facts.push({
      icon: <IdentificationBadge size={14} weight="regular" />,
      text: agePolicy,
    });
  }

  if (facts.length === 0) return null;

  return (
    <div className="rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 p-3.5 flex flex-col gap-2.5">
      {facts.map((fact, i) => (
        <div key={i} className="flex items-start gap-2.5 text-xs text-[var(--muted)]">
          <span className="mt-0.5 flex-shrink-0 text-[var(--soft)]">{fact.icon}</span>
          <span>{fact.text}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run tsc**

Run: `cd web && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/detail/core/QuickFactsCard.tsx
git commit -m "feat: QuickFactsCard — rail sub-component for date, venue, price, age"
```

---

## Task 9: Elevated EventIdentity

**Files:**
- Modify: `web/components/detail/identity/EventIdentity.tsx`
- Modify: `web/components/detail/core/DetailIdentity.tsx`

Upgrade the identity zone for the elevated shell: larger typography, mono metadata line, no icons.

- [ ] **Step 1: Read current EventIdentity**

Read `web/components/detail/identity/EventIdentity.tsx` to understand current rendering.

Current: title at `text-[1.625rem]`, venue row with MapPin icon, date row with CalendarBlank icon, price row with Ticket icon.

- [ ] **Step 2: Add variant prop to EventIdentity**

Update `web/components/detail/identity/EventIdentity.tsx` to accept a `variant` prop:

```tsx
interface EventIdentityProps {
  event: EventData;
  portalSlug: string;
  variant?: 'sidebar' | 'elevated';
}
```

When `variant === 'elevated'`:
- Title: `text-2xl lg:text-3xl font-bold text-[var(--cream)]`
- Single metadata line: `font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]` — formatted as "APR 18 · TERMINAL WEST" (no icons)
- Tags/genres as pills below metadata
- No icon-prefixed detail rows (those live in the rail's QuickFactsCard)

When `variant === 'sidebar'` (default): render exactly as current.

**Note to implementer:** Read the full current `EventIdentity.tsx`. Preserve all existing sidebar behavior. The elevated variant is additive — a new render path alongside the existing one. Use the existing `formatDateDisplay()`, `formatEventTime()` utilities for the metadata line.

- [ ] **Step 3: Update DetailIdentity wrapper**

In `web/components/detail/core/DetailIdentity.tsx`, add variant support:

```tsx
interface DetailIdentityProps {
  children: React.ReactNode;
  variant?: 'sidebar' | 'elevated';
}

export default function DetailIdentity({ children, variant = 'sidebar' }: DetailIdentityProps) {
  if (variant === 'elevated') {
    return (
      <div className="motion-fade-up" style={{ animationDelay: '100ms' }}>
        {children}
      </div>
    );
  }

  // Sidebar (current behavior)
  return (
    <div className="px-5 py-4 border-b border-[var(--twilight)]/40 motion-fade-up" style={{ animationDelay: '100ms' }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run tsc**

Run: `cd web && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/components/detail/identity/EventIdentity.tsx web/components/detail/core/DetailIdentity.tsx
git commit -m "feat: elevated EventIdentity — larger type, mono metadata, no icons"
```

---

## Task 10: DetailLayout Elevated Orchestration

**Files:**
- Modify: `web/components/detail/core/DetailLayout.tsx`

This is the wiring task. Add `shellVariant` prop. When `'elevated'`, route hero/identity/actions/sections to `ElevatedShell` instead of `DetailShell`.

- [ ] **Step 1: Read current DetailLayout**

Read `web/components/detail/core/DetailLayout.tsx` (173 lines). Understand:
- How it builds the sidebar (hero + identity + actions)
- How it maps sections through the manifest
- How it renders the bottom bar
- The `ScopedStyles` accent color injection

- [ ] **Step 2: Add shellVariant prop and elevated path**

Update `DetailLayout` to accept:

```typescript
interface DetailLayoutProps {
  heroConfig: HeroConfig;
  identity: React.ReactNode;
  actionConfig: ActionConfig;
  manifest: SectionId[];
  data: EntityData;
  portalSlug: string;
  accentColor: string;
  entityType: EntityType;
  onClose?: () => void;
  accentColorSecondary?: string;
  shellVariant?: 'sidebar' | 'elevated';   // NEW
}
```

When `shellVariant === 'elevated'`:

1. Build hero with `tier` prop and `onClose`/`portalSlug` passed through
2. Build identity (null for typographic tier — identity embedded in hero)
3. Build rail: `<DetailActions variant="rail" config={actionConfig} accentColor={accentColor} />` + `<QuickFactsCard>` + social proof (if exists, remove from content manifest)
4. Build content: filtered sections as current
5. Build bottom bar: existing `DetailStickyBar` (mobile only)
6. Render via `<ElevatedShell hero={...} identity={...} rail={...} content={...} bottomBar={...} />`

When `shellVariant !== 'elevated'` (default): render via `<DetailShell>` exactly as current.

**Key detail — social proof promotion:** When `shellVariant === 'elevated'` and the event has social proof data, the orchestrator should:
- Render `SocialProofStrip` (compact version) inside the rail slot, after `QuickFactsCard`
- Remove `'socialProof'` from the resolved sections array so it doesn't render in the content column

**Note to implementer:** Read the full current `DetailLayout.tsx`. The elevated path is a new branch in the render logic — the existing sidebar path must be completely preserved. Do not refactor the sidebar path. Add the elevated path as a clean conditional branch.

- [ ] **Step 3: Run tsc**

Run: `cd web && npx tsc --noEmit`

Fix any import or type issues.

- [ ] **Step 4: Run existing tests**

Run: `cd web && npx vitest run`

Expected: all existing tests pass. The layout change is behind the `shellVariant` prop — existing views don't pass it, so they get the sidebar path.

- [ ] **Step 5: Commit**

```bash
git add web/components/detail/core/DetailLayout.tsx
git commit -m "feat: DetailLayout elevated orchestration — routes to ElevatedShell when shellVariant='elevated'"
```

---

## Task 11: EventDetailView Integration

**Files:**
- Modify: `web/components/views/EventDetailView.tsx`

Wire the event detail view to use the elevated shell and pass the hero tier from server data.

- [ ] **Step 1: Read current EventDetailView**

Read `web/components/views/EventDetailView.tsx` (102 lines). Understand how it builds `heroConfig` and `actionConfig`.

- [ ] **Step 2: Update EventDetailView**

Changes needed:
1. Read `heroTier` from the API response (or `initialData`)
2. Pass `shellVariant: 'elevated'` to `DetailLayout`
3. Set `tier` on `heroConfig` from server `heroTier`
4. Set `posterUrl` and `heroTier` on `actionConfig` for rail variant
5. Pass `variant: 'elevated'` to the identity component
6. Build the `metadataLine` and `title` for typographic hero (Tier 3)

```typescript
// In the heroConfig builder:
const heroConfig: HeroConfig = {
  imageUrl: event.image_url,
  tier: data.heroTier,                    // from server
  galleryEnabled: false,                  // or true if gallery data exists
  galleryUrls: [],
  category: event.category,
  isLive: event.is_live,
  // Typographic tier needs these:
  title: event.title,
  metadataLine: buildMetadataLine(event), // "APR 18 · TERMINAL WEST"
  tags: event.tags ?? [],
  accentColor,
};

// In the actionConfig builder, add:
actionConfig.posterUrl = event.image_url;
actionConfig.heroTier = data.heroTier;
```

Helper for metadata line (add to the same file or a local utility):

```typescript
function buildMetadataLine(event: EventData): string {
  const parts: string[] = [];
  if (event.start_date) {
    parts.push(formatDateDisplay(event.start_date, { short: true }).toUpperCase());
  }
  if (event.venue?.name) {
    parts.push(event.venue.name.toUpperCase());
  }
  return parts.join(' · ');
}
```

Pass to DetailLayout:

```typescript
<DetailLayout
  shellVariant="elevated"
  heroConfig={heroConfig}
  identity={
    data.heroTier !== 'typographic' ? (
      <EventIdentity event={event} portalSlug={portalSlug} variant="elevated" />
    ) : null
  }
  actionConfig={actionConfig}
  manifest={eventManifest}
  data={{ entityType: 'event', payload: data }}
  portalSlug={portalSlug}
  accentColor={accentColor}
  entityType="event"
  onClose={onClose}
/>
```

- [ ] **Step 3: Run tsc**

Run: `cd web && npx tsc --noEmit`

Fix any type errors.

- [ ] **Step 4: Run tests**

Run: `cd web && npx vitest run`

Expected: all tests pass.

- [ ] **Step 5: Browser smoke test**

Open the app and navigate to an event detail page. Verify:
- Hero renders (appropriate tier based on image)
- Identity shows below hero (or embedded for typographic)
- Rail appears on desktop with CTA and secondary actions
- Mobile shows sticky bottom bar, no rail
- All sections render in the content column

- [ ] **Step 6: Commit**

```bash
git add web/components/views/EventDetailView.tsx
git commit -m "feat: EventDetailView → elevated shell with hero tier from server data"
```

---

## Task 12: CTA Pulse Glow Keyframe

**Files:**
- Modify: `web/app/globals.css`

Add the single-pulse glow animation for the CTA in the rail.

- [ ] **Step 1: Add keyframe to globals.css**

In the motion keyframes section of `web/app/globals.css` (around line 2965), add:

```css
@keyframes cta-pulse-glow {
  0% { box-shadow: 0 0 0 0 rgba(232, 93, 74, 0); }
  50% { box-shadow: 0 0 20px 4px rgba(232, 93, 74, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(232, 93, 74, 0); }
}

.cta-pulse-glow {
  animation: cta-pulse-glow 1.2s ease-out 0.4s 1 both;
}

@media (prefers-reduced-motion: reduce) {
  .cta-pulse-glow {
    animation: none;
  }
}
```

- [ ] **Step 2: Verify the class is used**

The `cta-pulse-glow` class is already applied in the `RailActions` component (Task 7) on the primary CTA button.

- [ ] **Step 3: Run tsc and verify no CSS issues**

Run: `cd web && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css
git commit -m "feat: CTA pulse glow keyframe — single-fire attention draw on page load"
```

---

## Task 13: GATE — Design Review

**Skill:** `/design`

This is a review checkpoint. The elevated shell, hero tiers, rail, and identity are all wired up. Before refining motion, run a design review against the spec.

- [ ] **Step 1: Run design review**

Invoke the `/design` skill to audit the event detail page against the spec at `docs/superpowers/specs/2026-04-16-detail-page-elevation-design.md`.

Focus areas:
- Hero tier rendering (all 3 tiers — find events that trigger each)
- Rail layout, spacing, and typography
- Identity zone typography hierarchy
- Back button overlay placement
- Responsive behavior (desktop vs mobile)
- CTA variant rendering (ticketed, free, RSVP, no URL)
- Cinematic minimalism adherence (solid surfaces, atmospheric glow, no glass)

- [ ] **Step 2: Fix issues found**

Address any design issues found in the review. Common problems to watch for:
- Spacing inconsistencies between rail elements
- Typography weight/size not matching spec
- Gradient colors too strong or too weak
- Rail content overflowing on long venue names
- Mobile layout not collapsing rail properly

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: design review pass — [describe fixes]"
```

---

## Task 14: GATE — Motion Audit

**Skill:** `/motion audit`

Run a motion audit on the elevated detail page to verify the animation orchestration.

- [ ] **Step 1: Run motion audit**

Invoke `/motion audit` on the event detail page. The audit should verify:

1. **Page load sequence:** Hero fade-in → identity fade-up (100ms) → rail fade-in (200ms) → CTA pulse (400ms) → first section (200ms stagger)
2. **Below-fold sections:** scroll reveal via IntersectionObserver
3. **Hover states:** CTA glow + press, secondary button lift, venue link underline
4. **Gallery arrows:** fade on hero hover (Tier 1 only)
5. **prefers-reduced-motion:** all animations disabled
6. **No jank:** 60fps on scroll, no layout shift during animations

- [ ] **Step 2: Fix motion issues**

Address any timing, easing, or jank issues found in the audit.

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: motion audit pass — [describe fixes]"
```

---

## Task 15: Mobile Behavior Verification

**Files:** No new changes expected — this is a verification task.

Verify mobile-specific behavior matches the spec.

- [ ] **Step 1: Test mobile layout**

Using browser dev tools or a real device, verify at <1024px:
- Hero renders full-width (all 3 tiers)
- Identity renders below hero (Tier 1/2) or embedded in hero (Tier 3)
- NO rail visible
- Sections render in single column
- Sticky bottom bar appears with CTA + share
- Back button overlays the hero

- [ ] **Step 2: Test tablet breakpoint (768-1024px)**

Verify at 768-1024px:
- Rail collapsed (same as mobile behavior)
- No dual action surfaces (rail + bottom bar should never both be visible)

- [ ] **Step 3: Test existing entity types unaffected**

Navigate to a place detail, series detail, and festival detail page. Verify:
- Still using the 340px sidebar layout (DetailShell)
- No visual regressions
- All section modules render correctly

- [ ] **Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: mobile/tablet responsive adjustments"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd web && npx vitest run`

Expected: all tests pass.

- [ ] **Step 2: Run tsc**

Run: `cd web && npx tsc --noEmit`

Expected: no type errors.

- [ ] **Step 3: Run pre-commit hooks**

Run: `git add -A && git commit --dry-run -m "test"`

This triggers vitest + any lint hooks. All must pass.

- [ ] **Step 4: Browser test all hero tiers**

Navigate to:
- An event with a high-res landscape image → should render Tier 1 (expanded hero)
- An event with a poster/small image → should render Tier 2 (compact band + poster in rail)
- An event with no image → should render Tier 3 (typographic hero with identity embedded)

For each, verify: hero, identity, rail, sections, mobile layout, back button, CTA behavior.

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat: detail page elevation complete — adaptive hero + sticky action rail for events"
```
