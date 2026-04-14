# CLAUDE.md - Web Frontend

This file provides guidance to Claude Code when working with the Next.js frontend.

## Project Structure

```
web/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/               # Server-side API routes
│   ├── [portal]/          # Portal pages (atlanta, etc.)
│   └── auth/              # Authentication pages
├── components/            # React components
├── lib/                   # Shared utilities & hooks
│   ├── supabase/         # Supabase client helpers
│   └── hooks/            # Custom React hooks
└── public/               # Static assets
```

## Portal Surface Architecture

The portal app is split into four surfaces with independent ownership:

- `feed` — root portal feed and feed-adjacent pages
- `explore` — canonical `/{portal}/explore`
- `detail` — canonical entity/detail pages plus detail-owned overlay entry
- `community` — civic/community routes such as groups, support, volunteer, and community hubs

### Hard rules

1. **Canonical Explore URLs only.** New UI must emit `/{portal}/explore...`, never `?view=find`.
2. **Legacy query URLs are compatibility only.** Normalize or redirect them; do not build new features on them.
3. **Use portal runtime for route resolution.** Portal/surface detection belongs in `lib/portal-runtime/*`, not inline in pages or layouts.
4. **Keep `[portal]/layout.tsx` thin.** It may own providers, theme, and truly global runtime only. No surface-specific chrome or loading behavior.
5. **Surface-owned chrome only.** Headers, footers, civic bars, Explore bars, and detail overlay behavior must live in the owning surface files.
6. **Entity URLs use `lib/entity-urls.ts` builders.** Overlay context (`'feed'`) is only valid inside feed/explore/calendar surface components. Standalone detail pages must use `'page'` context. Civic events use `getCivicEventHref()` from `lib/civic-routing.ts` as a pre-check (pattern: `getCivicEventHref(event, portal, vertical) ?? buildEventUrl(id, portal, context)`).
7. **Shared server-loader pattern is mandatory.** Pages and RSCs import server loaders directly; API routes wrap the same loaders; never fetch your own API from the server.
8. **Delete compatibility aggressively.** If you replace a route bridge or legacy emitter, remove the old emission path in the same workstream or the immediately following one.
9. **Every route family needs a runtime policy.** Surface ownership is not enough; each route family must have an explicit cache/runtime posture.
10. **Shared layout runtime stays minimal.** Trackers, widgets, and surface-specific client runtime belong in the owning surface wrapper, not in `[portal]/layout.tsx`.
11. **Legacy query-style community/explore entry is read-only compatibility.** Normalize or redirect it, but do not author new behavior on top of it.

## Commands

```bash
npm run dev      # Development server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

---

## Multi-Agent Coordination

When multiple Claude Code sessions work in parallel, check `ACTIVE_WORK.md` in the repo root before starting. It tracks which agent is working on what and which files/directories are claimed. Don't modify files claimed by another agent — tell the user if you need to.

See `DEV_PLAN.md` for the active execution status. `BACKLOG.md` at the repo root is being wound down — do not add new items there.

---

## Authentication & Database Access

### CRITICAL: Never Do Direct Supabase Mutations from Components

**The Problem:** Client-side Supabase calls are unreliable because:
- Browser cookies/sessions can get out of sync with Supabase auth
- RLS (Row Level Security) policies can fail silently or hang forever
- Missing user profiles cause foreign key constraint errors
- No centralized error handling

**The Solution:** All authenticated database mutations MUST go through API routes.

### Canonical Auth Pattern: `withAuth` / `withAuthAndParams`

New API routes MUST use the wrappers from `lib/api-middleware.ts`:

```typescript
import { withAuth } from "@/lib/api-middleware";

export const POST = withAuth(async (request, { user, serviceClient }) => {
  // user is already verified, serviceClient bypasses RLS
  const { data } = await serviceClient.from("table").insert({ user_id: user.id } as never);
  return NextResponse.json({ success: true });
});
```

~95 legacy routes still use manual `getUser()` — migrate them opportunistically when touching those files. Don't batch-migrate.

### Pattern: Use API Routes for All Mutations

```typescript
// ❌ BAD - Direct Supabase call from component (will hang or fail silently)
const { error } = await supabase.from("event_rsvps").insert({
  user_id: user.id,
  event_id: eventId,
  status: "going",
});

// ✅ GOOD - Use API route
const response = await fetch("/api/rsvp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ event_id: eventId, status: "going" }),
});
```

### Available API Routes for Authenticated Operations

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/profile` | GET, PATCH | Fetch/update user profile (auto-creates if missing) |
| `/api/rsvp` | GET, POST, DELETE | Event RSVP operations |
| `/api/saved` | GET, POST, DELETE | Save/unsave events and venues |

### Using the `useAuthenticatedFetch` Hook

For new authenticated features, use the provided hook:

```typescript
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";

function MyComponent() {
  const { authFetch, user, isLoading } = useAuthenticatedFetch();

  const handleAction = async () => {
    const { data, error } = await authFetch<{ success: boolean }>("/api/my-endpoint", {
      method: "POST",
      body: { foo: "bar" },
      timeout: 10000,        // Optional, default 10s
      showErrorToast: true,  // Optional, default true
    });

    if (error) {
      // Error already shown via toast
      return;
    }

    // Use data
  };
}
```

The hook provides:
- Automatic request timeouts (no more hanging forever)
- Redirects to login if unauthenticated
- Automatic error toasts
- Consistent error handling

### Creating New API Routes

When adding new authenticated features:

```typescript
// app/api/my-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  // 1. Verify auth using server client
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Use service client for database operations (bypasses RLS)
  const serviceClient = createServiceClient();

  // 3. Ensure profile exists before FK operations
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Create profile...
  }

  // 4. Perform database operation
  const { data, error } = await serviceClient
    .from("my_table")
    .insert({ user_id: user.id, ... } as never);

  // 5. Return response
  return NextResponse.json({ success: true, data });
}
```

### Why Service Client?

- `createClient()` - Server-side client with user's session, subject to RLS
- `createServiceClient()` - Admin client that bypasses RLS entirely

Use service client for mutations to avoid RLS policy issues. The auth is still verified via `createClient().auth.getUser()`.

---

## Profile Creation

User profiles are created automatically:
1. **Database trigger** (`076_profile_creation_trigger.sql`) creates profile on signup
2. **API fallback** (`/api/auth/profile`) creates profile if trigger failed
3. **Other API routes** create profile before FK operations as safety net

Never assume a profile exists - always check and create if needed.

---

## Deployment & Session Stability

### Why Auth Can Break on Deploys

During Vercel deployments, there can be brief network hiccups or race conditions when:
- Old code is still serving requests while new code spins up
- Edge functions restart and lose any in-memory state
- Requests to Supabase might timeout during the transition

**The Fix (already implemented):**

The middleware (`middleware.ts`) only clears auth cookies for **specific** auth errors that definitely indicate an invalid session:
- `session_not_found`
- `invalid_token`
- `user_not_found`
- `bad_jwt`

It does **NOT** clear cookies on:
- Network errors
- Timeouts
- Any other transient errors

This prevents users from being logged out due to deployment-related network blips.

### Cookie Management

Supabase stores auth tokens in cookies via `@supabase/ssr`. The cookie names follow the pattern:
`sb-{project-id}-auth-token`

These cookies:
- Are HttpOnly (can't be accessed by JavaScript)
- Are set by the server/middleware
- Persist across page refreshes and deploys
- Contain JWT tokens that are refreshed automatically by `getUser()`

---

## Security Best Practices

### Input Validation

Always validate query parameters before using them:

```typescript
import { parseIntParam, parseFloatParam, validationError } from "@/lib/api-utils";

// ❌ BAD - parseInt on untrusted input can return NaN
const eventId = parseInt(searchParams.get("event_id")); // NaN if "abc"

// ✅ GOOD - Use validation helpers
const eventId = parseIntParam(searchParams.get("event_id"));
if (eventId === null) {
  return validationError("Invalid event_id");
}
```

### Rate Limiting

Apply rate limiting to all API routes, especially auth-related ones:

```typescript
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;
  // ...
}
```

Available limits:
- `RATE_LIMITS.auth` - 10/min (login, signup, username check)
- `RATE_LIMITS.write` - 30/min (RSVP, save, follow)
- `RATE_LIMITS.read` - 200/min (events, search)
- `RATE_LIMITS.standard` - 100/min (general API)

### Service Key Usage

- **Never use service key for public routes** - it bypasses RLS
- Use `createClient()` (anon key) for public read-only endpoints
- Use `createServiceClient()` only for authenticated mutations after verifying auth

### Error Messages

Use generic error messages to prevent information leakage:

```typescript
// ❌ BAD - Reveals information
if (existingUser) return { error: "Email already registered" };

// ✅ GOOD - Generic message
if (existingUser) return { error: "Unable to create account" };
```

---

## Design System Contract

### How Typography Works (THIS PROJECT)

This project uses Tailwind v4 with `@theme inline` in globals.css to override default sizes. **Use standard Tailwind classes — they already produce the correct pixels:**

| Tailwind class | Actual size | Notes |
|---------------|-------------|-------|
| `text-2xs` | 10px | Custom `@utility` (not in default Tailwind) |
| `text-xs` | 11px | Overridden via `@theme inline` |
| `text-sm` | 13px | Overridden via `@theme inline` |
| `text-base` | 15px | Overridden via `@theme inline` |
| `text-lg` | 18px | Overridden via `@theme inline` |
| `text-xl` | 20px | Overridden via `@theme inline` |
| `text-2xl` | 24px | Overridden via `@theme inline` |
| `text-3xl` | 30px | Overridden via `@theme inline` |

**CRITICAL:** Never use `text-[var(--text-xs)]` or similar. In Tailwind v4, the `text-` prefix is ambiguous — with CSS variables it generates `color:` instead of `font-size:`, silently falling back to 16px. Just write `text-xs`.

### Typography Usage Guide

| Token | Size | MINIMUM use case | Typical use in production |
|-------|------|------------------|---------------------------|
| `text-2xs` | 10px | Count badges inside chips, "Added" chip labels | `NowShowingSection.tsx` "Added" badge, category labels inside cards |
| `text-xs` | 11px | Standalone readable text floor | Section header titles (`font-mono text-xs font-bold tracking-[0.12em] uppercase`), date/time metadata, venue name in cards, badge text |
| `text-sm` | 13px | Default for secondary content | Film titles in rows, description text, metadata details, subtitle text |
| `text-base` | 15px | Primary content in cards | Card titles (`text-base font-semibold text-[var(--cream)]`), theater names, body text |
| `text-lg` | 18px | Prominent card titles | Large card titles, detail page subheadings |
| `text-xl` | 20px | Section headers (secondary) | FeedSectionHeader with `priority="secondary"` |
| `text-2xl` | 24px | Section headers (primary) | FeedSectionHeader with `priority="primary"`, detail page hero titles |
| `text-3xl` | 30px | Page/hero titles | Detail page `<h1>` on desktop (`sm:text-3xl`) |

**Key principle:** `text-sm` (13px) is the workhorse for metadata and secondary content. `text-xs` (11px) is the *floor* for standalone readable text. `text-2xs` (10px) is ONLY for count badges inside chips — never for readable sentences.

### Color Tokens & Contrast Rules

**Surface tokens (backgrounds/borders only — NEVER for text):**

| Token | Value | Use for |
|-------|-------|---------|
| `--void` | #09090B | Page background |
| `--night` | #0F0F14 | Card backgrounds |
| `--dusk` | #18181F | Modal/elevated surfaces |
| `--twilight` | #252530 | Borders, dividers |

**Three-tier text hierarchy (the ONLY text colors on dark backgrounds):**

| Token | Value | Role | Contrast on --night |
|-------|-------|------|---------------------|
| `--cream` | #F5F5F3 | Primary — headings, titles | 14.5:1 |
| `--soft` | #A1A1AA | Secondary — labels, metadata | 6.8:1 |
| `--muted` | #8B8B94 | Tertiary — timestamps (minimum readable) | 4.8:1 |

`--void`, `--night`, `--dusk`, `--twilight` used as text color = invisible. Minimum text = `--muted`.
Exception: `text-[var(--void)]` is OK on bright backgrounds (e.g. `bg-[var(--coral)]` CTA buttons).
Exception: `text-white` is OK on photographic backgrounds (hero images, overlays).

**Accent tokens:**

| Token | Value | Use for |
|-------|-------|---------|
| `--coral` | #FF6B7A | Brand primary / CTA |
| `--gold` | #FFD93D | Featured / date filters |
| `--neon-cyan` | #00D4E8 | Secondary neon accent |
| `--neon-green` | #00D9A0 | Success / free indicator |
| `--neon-magenta` | #E855A0 | Nightlife neon |
| `--neon-red` | #FF5A5A | Live / error |
| `--vibe` | #A78BFA | Vibe/mood filter accent |

### Component Recipes

These are the **proven patterns** from production. Copy these — don't improvise from primitives.

#### Carousel Card (288–320px wide)

```
Container:  flex-shrink-0 w-72 snap-start rounded-card overflow-hidden
            bg-[var(--night)] shadow-card-sm hover-lift
            border border-[var(--twilight)]/40
Image:      h-32 (poster strip) or h-44 (hero image), relative overflow-hidden
Gradient:   absolute inset-x-0 bottom-0 h-16
            bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent
Title:      text-base font-semibold text-[var(--cream)]
Metadata:   text-sm text-[var(--soft)]     (film titles, descriptions)
Micro:      text-xs text-[var(--muted)]    (venue, neighborhood, showtimes)
Badges:     text-2xs font-mono font-bold uppercase tracking-wider
```
Reference: `FeaturedCarousel.tsx` (FeaturedCard), `NowShowingSection.tsx` (TheaterCard)

#### Feed List Section

```
Container:  rounded-xl overflow-hidden
            border border-[var(--twilight)]/40 bg-[var(--night)]
Row cards:  Rendered via <CompactEventRow> — grid cards with image + content
Overflow:   mt-2 text-xs font-mono text-[var(--accent)] hover:opacity-80
            "+N more this week →"
```
Reference: `ComingUpSection.tsx`, `TonightsRegularsSection.tsx`

#### List Row Card (.find-row-card)

```
Container:  find-row-card find-row-card-bg rounded-xl overflow-hidden
            border border-[var(--twilight)]/75 border-l-[2px] border-l-[var(--accent-color)]
            mb-2.5 sm:mb-3

Padding:    p-3 sm:p-3.5  (main content link)
Gap:        gap-2.5 sm:gap-3  (between rail and content)

Date rail:  hidden sm:flex w-[100px]
            -ml-3 sm:-ml-3.5 -my-3 sm:-my-3.5
            Image: sizes="100px", list-rail-media class
Time:       font-mono text-xl font-bold leading-none tabular-nums
Period:     font-mono text-2xs font-medium uppercase tracking-[0.12em]

Icon box:   w-8 h-8 rounded-lg bg-accent-20 border border-[var(--twilight)]/55
            CategoryIcon size={16}

Title:      text-base (mobile) / sm:text-lg (desktop)
            font-semibold text-[var(--cream)] leading-tight
            group-hover:text-[var(--accent-color)]

Venue:      font-medium text-sm text-[var(--text-secondary)]
Metadata:   text-sm text-[var(--text-secondary)]

Actions:    pt-2.5 pr-2.5 pb-2.5 sm:pt-3 sm:pr-3.5 sm:pb-3
```
Reference: `EventCard.tsx`, `SeriesCard.tsx`, `FestivalCard.tsx`, `VenueCard.tsx`

#### Feed Section Header

```
USE THE COMPONENT: <FeedSectionHeader> from components/feed/FeedSectionHeader.tsx
Props: title, priority, accentColor, icon, badge, seeAllHref

For standalone section headers (when not using the component):
  Title:    font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--accent)]
  Icon:     Phosphor icon, w-3.5 h-3.5, matching accent color, weight="duotone"
  See-all:  text-xs flex items-center gap-1 text-[var(--accent)] hover:opacity-80
  Layout:   flex items-center justify-between mb-3

Accent color per section type:
  Trending/featured → --coral or --gold
  Calendar/coming-up → --neon-green
  Cinema/film → --vibe
  Network/community → --neon-cyan
  Recurring/regulars → --vibe
```
Reference: `FeedSectionHeader.tsx`, `ComingUpSection.tsx`, `NowShowingSection.tsx`

#### Detail Screen

```
Shell:      <main className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-28 space-y-5 sm:space-y-8">
Hero:       <DetailHero> — modes: "image" (full-width), "poster" (side-by-side), "fallback"
Teaser:     <DescriptionTeaser> — pull-quote with Quotes icon + accent border-l
              Extracts first sentence (30–180 chars), returns null if not meaningful
Social:     <SocialProofStrip> — vertical card: friend avatars (children) + count pills
              Pills match EventCard: coral ✓ for going, gold ★ for interested
              font-mono text-xs, bg-[color]/10 border-[color]/20
Genres:     <GenreChip> from ActivityChip — clickable, links to filtered search
              Neutral: bg-[var(--twilight)] text-[var(--muted)], hover to cream
Content:    <InfoCard> wraps content sections, border border-[var(--twilight)] bg-[var(--card-bg)] p-6 sm:p-8
Metadata:   <MetadataGrid> — label (font-mono text-xs uppercase tracking-[0.13em] text-[var(--muted)])
                            + value (text-base font-medium text-[var(--cream)])
Sections:   <SectionHeader> — font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]
                              with border-t border-[var(--twilight)] separator
Related:    <RelatedSection> + <RelatedCard> — variants: "compact" (row) and "image" (poster)
Bottom bar: <DetailStickyBar> — fixed bottom CTA bar, appears on scroll
```
Reference: `components/detail/*.tsx`, `app/[portal]/events/[id]/page.tsx`

#### Modal / Dialog

```
Backdrop:   fixed inset-0 z-50 flex items-center justify-center p-4
            bg-black/60 backdrop-blur-sm
            onClick: close when e.target === e.currentTarget

Panel:      relative bg-[var(--night)] border border-[var(--twilight)] rounded-xl
            p-6 max-w-md w-full shadow-2xl

Title:      text-xl font-semibold text-[var(--cream)] mb-6
Close X:    absolute top-4 right-4 w-8 h-8 rounded-full
            hover:bg-[var(--twilight)] transition-colors
Label:      font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5

Footer:     flex gap-3 mt-6
  Cancel:   flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg
            font-mono text-sm hover:bg-[var(--dusk)] transition-colors
  Primary:  flex-1 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg
            font-mono text-sm font-medium disabled:opacity-50

Behavior:   Escape key closes, backdrop click closes, document.body overflow hidden
            Render via createPortal(content, document.body)
```
Reference: `ConfirmDialog.tsx`, `CreateCollectionModal.tsx`, `AddTagModal.tsx`

#### Bottom Sheet

```
Backdrop:   fixed inset-0 z-[140] bg-black/50 transition-colors duration-300

Sheet:      fixed bottom-0 left-0 right-0 bg-[var(--void)]
            border-t border-[var(--twilight)] rounded-t-2xl shadow-2xl
            max-h-[85vh] transition-transform duration-300
            md: top-0 left-auto right-0 w-[420px] rounded-none border-t-0 border-l

Drag handle: flex justify-center pt-3 pb-2
             → w-12 h-1 rounded-full bg-[var(--twilight)]

Header:     flex items-center justify-between px-4 pb-3
  Title:    font-mono text-lg font-semibold text-[var(--cream)]
  Close X:  w-8 h-8 rounded-full hover:bg-[var(--twilight)]

Content:    overflow-y-auto max-h-[calc(85vh-120px)] px-4 pb-6 space-y-6

Footer:     sticky bottom-0 border-t border-[var(--twilight)] bg-[var(--void)]
            px-4 py-3 flex gap-3
  Clear:    flex-1 min-h-[44px] bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm
  Apply:    flex-1 min-h-[44px] bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm
```
Reference: `MobileFilterSheet.tsx`, `VenueFilterSheet.tsx`, `PlanInviteSheet.tsx`

#### Form Input Field

```
Label:      font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5

Input:      w-full px-3 py-2.5 rounded-lg
            bg-[var(--dusk)] border border-[var(--twilight)]
            text-[var(--cream)] font-mono text-sm
            placeholder:text-[var(--muted)]
            focus:outline-none focus:border-[var(--coral)] transition-colors

Textarea:   same as Input + resize-none, rows={3..4}

Error:      p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]
            text-[var(--coral)] font-mono text-xs
            (NEVER use hardcoded red-400/red-500 — always --coral)

Submit:     py-2.5 px-6 rounded-lg bg-[var(--coral)] text-[var(--void)]
            font-mono text-sm font-medium hover:bg-[var(--rose)]
            disabled:opacity-50 transition-colors
```
Reference: `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`, `settings/ProfilePanel.tsx`

#### Filter Chip

```
USE THE COMPONENT: <FilterChip> from components/filters/FilterChip.tsx
Props: label, variant, isActive, onClick, icon, count, size

For hand-rolled chip strips (scrollable mobile):
  Container:  flex items-center gap-2 overflow-x-auto scrollbar-hide px-4
  Pill:       flex-shrink-0 min-h-[44px] px-3.5 rounded-full
              font-mono text-xs font-medium border active:scale-95
    Inactive: bg-white/5 backdrop-blur-sm text-[var(--soft)] border-white/10
    Active:   colored per variant (--gold for date, --coral for category, --neon-green for free)

Also available: <ToggleRow> from components/settings/ToggleRow.tsx for toggle switches
```
Reference: `FilterChip.tsx`, `SimpleFilterBar.tsx`, `MobileFilterSheet.tsx`

### Dynamic Colors (data-driven)

Use the **ScopedStyles pattern** for colors that come from data:

```typescript
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

const colorClass = createCssVarClass("--series-color", typeColor, "series-color");
return (
  <>
    <ScopedStyles css={colorClass?.css} />
    <span className={`${colorClass?.className}`}>...</span>
  </>
);

// Category colors via data-attribute (already in globals.css)
<div data-category={event.category}>
  <span className="text-category">Colored by category</span>
</div>
```

### Portal Customization

The project uses a **3-layer token system** for portal theming:

| Layer | Example tokens | Purpose |
|-------|---------------|---------|
| Primitives | `--primitive-primary-500`, `--primitive-secondary-rgb` | Raw colors per portal |
| Semantic | `--action-primary`, `--card-bg`, `--card-bg-hover` | Role-based tokens |
| Component | `--shadow-card`, `--radius-card`, `--glow-opacity` | Component-specific overrides |

`PortalTheme.tsx` (server) injects per-portal CSS variables at `:root`.
`PortalThemeClient.tsx` (client) sets data attributes on `<body>`:

| Data attribute | Values | Use for |
|---------------|--------|---------|
| `data-card-style` | `"glass"`, etc. | Card variant styling |
| `data-button-style` | style name | Button variant styling |
| `data-vertical` | `"film"`, `"hotel"`, etc. | Vertical-specific overrides |
| `data-theme` | `"light"` | Light mode |
| `data-glow` | `"disabled"` | Disable glow effects |
| `data-portal-slug` | portal slug | Portal-scoped art direction |

When writing recipes, prefer semantic tokens (Layer 2–3) over primitives. For portal-specific overrides, use data-attribute selectors in globals.css:

```css
[data-vertical="film"] .card-premium { /* film-specific card styles */ }
[data-card-style="glass"] .surface-raised { /* glass card overrides */ }
```

### Utility Classes

**Cards:** `card-premium hover-lift` — never rebuild card/shadow/hover from scratch
**Surfaces:** `.surface-base` (void), `.surface-raised` (night), `.surface-elevated` (dusk)
**Text:** `.text-primary` (cream), `.text-secondary` (soft), `.text-tertiary` (muted)
**Typography:** `.mono-label` — `font-mono text-xs font-bold uppercase tracking-wider` (section headers, metadata labels)
**Borders:** `.border-subtle` — never `border-gray-*`
**Backgrounds:** `.find-row-card-bg` — flat night/dusk surface for list row cards
**Shadows:** `.shadow-card-{sm|md|lg|xl}` — never raw `shadow-*`
**Radius:** `rounded-card` (12px) or `rounded-card-xl` (16px). List rows: `rounded-xl` (12px). Grid cards: `rounded-lg` (8px).
**Hover:** `.hover-lift` — never rebuild translateY hover
**Focus:** `.focus-ring` — accessible focus-visible ring with coral outline
**Glow:** `.shadow-glow-{sm|md|lg}` or `.chip-glow-*`

### Reusable UI Components (`components/ui/`)

| Component | Props | Use case |
|-----------|-------|----------|
| `<Badge>` | `variant` (neutral/success/alert/info/accent), `size`, `accentColor` | Color-coded pills for status, categories |
| `<CountBadge>` | `count`, `placement` (inline/overlay), `max` | Notification count indicators |
| `<Dot>` | `className` | Inline metadata separator (middot `·`) |
| `<DialogFooter>` | `onCancel`, `onConfirm`, `confirmLabel`, `loading`, `destructive` | Cancel + Primary button pair for modals |
| `<Button>` | Standard button | Primary CTAs |
| `<ScrollableRow>` | Horizontal scroll | Carousel containers |

**When to use these:**
- `<Dot />` instead of `<span className="opacity-40">·</span>` (74+ former inline usages)
- `<Badge variant="success">Open</Badge>` instead of rebuilding pill badges inline
- `<CountBadge count={3} placement="overlay" />` instead of inline coral count dots
- `<DialogFooter onCancel={close} onConfirm={save} />` instead of inline button pairs

### Reusable Detail Components (`components/detail/`)

| Component | Props | Use case |
|-----------|-------|----------|
| `<DescriptionTeaser>` | `description`, `accentColor` | Pull-quote teaser between hero and InfoCard (Quotes icon + accent border) |
| `<SocialProofStrip>` | `goingCount`, `interestedCount`, `children` | Attendance pills (coral going, gold interested) + friend avatar slot |
| `<GenreChip>` | `genre`, `category`, `portalSlug` | Clickable genre pill that links to filtered search (from `ActivityChip.tsx`) |

**When to use these on detail pages:**
- `<DescriptionTeaser>` instead of inline blockquotes — handles sentence extraction + null safety
- `<SocialProofStrip>` instead of inline social proof — matches EventCard's pill visual language
- `<GenreChip>` instead of static `<Badge>` for genres — interactive, links to search

### Quick Reference: What NOT To Do

```
❌ text-[var(--text-xs)]     → text-xs           (TW4 generates color, not font-size)
❌ --font-size-xs in @theme  → --text-xs          (TW4 font-size namespace is --text-*, not --font-size-*)
❌ text-[0.65rem]            → text-xs            (use the scale, not arbitrary rem)
❌ text-[#8a8a9a]            → text-[var(--muted)] (no hardcoded hex)
❌ text-white / bg-gray-900  → text-[var(--cream)] / bg-[var(--night)] (use tokens)
❌ text-[var(--twilight)]    → text-[var(--muted)] (surface tokens are never text)
❌ text-[var(--night)]       → text-[var(--void)]  (use deepest dark for text on bright bg)
❌ border-[var(--soft)]      → border-[var(--twilight)] (text tokens are never borders)
❌ shadow-lg                 → shadow-card-lg     (use utility classes)
❌ rounded-xl (for cards)    → rounded-card       (use the card radius token)
❌ style={{ color: hex }}    → ScopedStyles + createCssVarClass (for dynamic colors)
❌ <span className="opacity-40">·</span> → <Dot /> (use the component)
❌ min-w-[1.5rem]            → min-w-6            (use Tailwind spacing scale)
❌ rounded-2xl (list rows)   → rounded-xl          (list row cards are 12px)
❌ inline gradient bg        → find-row-card-bg    (use the utility class)
❌ <Image src={dynamicUrl}>  → <SmartImage src={dynamicUrl}> (crashes on unknown hosts)
```

### Accepted Exceptions

Some arbitrary values are intentional and should NOT be "fixed":
- **Masthead display type** (`text-[3.5rem]` etc.) — display sizes outside the body type scale
- **Component-specific dimensions** (`rounded-[1.35rem]`, `min-w-[9.5rem]`) — unique layout needs
- **`text-[var(--void)]` on bright backgrounds** — dark text on coral/gold/green buttons is correct
- **`hover:border-[var(--soft)]`** — intentionally lighter border on hover state

### Pre-Edit Checklist

Before modifying ANY component's visual styling:
1. **Read the recipes above** — find the closest match and follow it
2. **Search globals.css** for existing utility classes before creating inline styles
3. **Check `components/ui/`** — Badge, Dot, CountBadge, DialogFooter, Button, etc.
4. **Check component library** — `components/detail/`, `components/feed/` likely have what you need
5. **Never introduce a hex color** that isn't already a CSS variable
6. **Never use an arbitrary text size** — map to the 8-step scale
7. **Test portal theming** — does it work when `--coral`, `--night`, etc. are overridden?

---

## Shipping Standards (No Smoke and Mirrors)

**The #1 failure mode is code that compiles but doesn't actually work.** Components that reference non-existent APIs, sections that render with hardcoded data, CSS that looks right in code but renders wrong in the browser. This wastes more time than any other category of bug because it looks "done" until someone actually uses it.

### Before ANY UI Work Is "Done"

Every component, section, or page change must pass this checklist before being called complete:

1. **Data layer exists and returns real data.** Before building a UI section, verify:
   - The API route exists and is deployed (or exists locally)
   - The database table/columns it queries exist
   - The query returns actual rows, not an empty set
   - If the data layer doesn't exist yet, build it first or don't build the UI. A beautiful component with no data behind it is waste.

2. **No hardcoded or placeholder data in production components.** These are all red flags:
   - Arrays of sample events/venues defined inline in a component
   - `const MOCK_DATA = [...]` anywhere outside a test file
   - Hardcoded strings that should come from the database ("Atlanta's Best Restaurants")
   - Fallback data that masks an empty API response (showing 3 hardcoded items when the real query returns 0)

   If a section has no data, it should render nothing or a proper empty state — never fake content.

3. **Browser-verified.** Before calling UI work done:
   - Actually load the page in a browser (dev server or preview deploy)
   - Check that text renders at the expected size (not 16px fallback)
   - Check that colors match the design system tokens (not transparent/invisible)
   - Check that the section renders with real data from the API
   - Check empty states: what happens with 0 results?
   - Check on mobile viewport (375px) — not just desktop
   - If you can't browser-test, say so explicitly rather than marking it done

4. **TypeScript builds clean.** Run `npx tsc --noEmit` — not just "no red squiggles in my editor." The full project must compile.

5. **Portal-aware.** If the component reads portal context:
   - Does it work on Atlanta (base portal)?
   - Does it work on a non-Atlanta portal (FORTH, HelpATL)?
   - Does it respect portal attribution (not leaking cross-portal data)?

### Common Hallucination Patterns to Catch

| What it looks like | What's actually happening | How to prevent |
|---|---|---|
| Component imports a hook that fetches from `/api/foo` | `/api/foo` doesn't exist | Check `app/api/` directory before writing the import |
| Section renders 5 beautiful cards | Data is a hardcoded array, not a fetch | Search for `const ` arrays of objects in the component |
| Typography looks correct in code review | `text-[var(--text-sm)]` generates `color:` not `font-size:` | Use bare `text-sm`, never `text-[var(--text-*)]` |
| Empty state says "No events found" | The query works but returns 0 rows because the data doesn't exist yet | Check row counts before building UI |
| Section looks great on desktop | Mobile viewport is broken (overflow, tiny text, missing padding) | Always check 375px viewport |
| Component "works" in isolation | Parent page doesn't import it, or route doesn't exist | Verify the full user path from navigation to render |

### The Data-First Rule

**Never build a UI section before its data layer is confirmed working.** The correct order is:

1. Verify the database has the data (query it directly)
2. Verify the API route returns it correctly (curl it or check in browser)
3. Build the component that renders it
4. Browser-test the result

If you reverse this order — building the component first and "planning to wire up the data later" — you get smoke and mirrors. The component gets merged, looks done in the PR, and nobody notices it's hollow until a user hits it.

### Design Consistency Across Portals

Each portal has its own design language (typography, colors, layout), but shared infrastructure must be consistent:

- **Use the token system.** Never hardcode hex colors. Never use `text-white` or `bg-gray-*` when tokens exist.
- **Use existing components.** Check `components/ui/`, `components/detail/`, `components/feed/` before building from scratch. If a Badge, Card, or Section pattern exists, use it.
- **Portal-specific design goes in portal-specific files.** Don't add portal-specific CSS to `globals.css`. Don't add portal-specific logic to shared components with `if (portal === 'forth')` checks.
- **Reference the component recipes above.** They exist because we've rebuilt the same patterns multiple times. Copy them — don't improvise from primitives.

When building a new portal's unique pages (Adventure's trail detail, Arts' exhibition page), start from the Pencil designs if they exist, but use the shared token system for colors, typography, and spacing. The portal's personality comes from layout, content hierarchy, and accent colors — not from reinventing the button.

---

## Images: SmartImage vs next/image

**CRITICAL: Never use `import Image from "next/image"` for dynamic or external image URLs.** An unconfigured hostname in `next.config.ts` `remotePatterns` causes `next/image` to throw a render error that crashes the entire page — not just the image.

### Use `SmartImage` (default choice)

```typescript
import SmartImage from "@/components/SmartImage";

// Dynamic URLs from API/database — SmartImage handles everything
<SmartImage src={event.image_url} alt={event.title} fill />

// With blurhash placeholder
<SmartImage src={venue.image_url} alt="" fill blurhash={venue.blurhash} />

// With custom fallback on error
<SmartImage src={org.logo_url} alt="" width={40} height={40}
  fallback={<div className="w-10 h-10 bg-[var(--twilight)] rounded-full" />}
/>
```

SmartImage provides three layers of crash protection:
1. **Proxy**: Unknown hosts route through `/api/image-proxy` (local URL, always allowed)
2. **Passthrough loader**: External URLs from unknown hosts skip hostname validation
3. **Error boundary**: If `next/image` still throws, re-renders with passthrough loader + fallback UI

You do NOT need to call `getProxiedImageSrc()` — SmartImage handles proxying internally.

### Use `Image` from next/image (rare — static local assets only)

```typescript
import Image from "next/image";

// ONLY for static imports or guaranteed-local paths
import heroImg from "@/public/hero.jpg";
<Image src={heroImg} alt="Hero" />
<Image src="/portals/atlanta/skyline.jpg" alt="Skyline" fill />
```

### Quick Reference

```
❌ <Image src={event.image_url} />           → crashes on unknown hostname
❌ <Image src={getProxiedImageSrc(url)} />   → still crashes if proxy misses
✅ <SmartImage src={event.image_url} />       → always safe, degrades gracefully
✅ <Image src="/local/static.jpg" />          → fine for local assets
✅ <Image src={importedStaticImage} />        → fine for static imports
```

---

## Common Gotchas

1. **TypeScript and Supabase**: Use `as never` for insert/update operations to bypass strict typing:
   ```typescript
   await serviceClient.from("table").insert({ ... } as never);
   ```

2. **Timeouts**: Always add timeouts to fetch calls to prevent infinite hangs:
   ```typescript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 8000);
   const response = await fetch(url, { signal: controller.signal });
   clearTimeout(timeoutId);
   ```

3. **Optimistic Updates**: Update UI immediately, rollback on error:
   ```typescript
   const previousState = currentState;
   setCurrentState(newState); // Optimistic
   try {
     await apiCall();
   } catch {
     setCurrentState(previousState); // Rollback
   }
   ```

---

## Known Gotchas (Agent-Critical)

These are bugs that have bitten agents multiple times. They live here (not in MEMORY.md) so agents editing web/ files see them automatically.

### CSP + Next.js 16 Streaming

Next.js 16 streaming scripts (`$RC`, `$RS`, `__next_f.push`) have NO nonce attribute. If CSP `script-src` uses a nonce, these inline scripts are blocked, causing the **entire site to render blank** — only `<template>` elements visible, all Suspense boundaries stuck.

- **Fix:** Use `'unsafe-inline'` instead of nonce for `script-src`. Keep nonces for `style-src` (Next.js does add nonces to `<style>` tags).
- **Symptom:** Page loads 200 with full HTML, but `animate-page-enter` div has height 0. All `<template id="B:N">` elements have hidden `<div id="S:N">` content never swapped in.
- **File:** `web/lib/csp.ts` — `script-src` line must NOT include `'nonce-...'`.

### TypeScript / Next.js 16 Build Gotchas

In addition to the `as never` pattern in Common Gotchas above:

- **Supabase `.maybeSingle()` returns `never`:** After null checks on `.maybeSingle()` or `.select()` results, TypeScript infers the type as `never`. Fix: cast with `as { field: type }` after the guard.
- **SupabaseClient double-cast:** `supabase as SupabaseClient<Schema>` fails. Need: `as unknown as SupabaseClient<Schema>`.
- **PostgrestError is not LogContext:** `logger.warn()` accepts `LogContext`, not `PostgrestError`. Wrap: `{ error: pgError.message }`.
- **`headers()` is async:** Next.js 16 `headers()` returns `Promise<ReadonlyHeaders>` — must be awaited.
- **`RemotePattern.protocol`:** Needs `as const` literal type assertion.
- **`AnimationEffect.setKeyframes`:** Must cast to `KeyframeEffect` first.
- **Re-exports aren't local:** `export { X } from "./mod"` does NOT make `X` available in the current file. Must also `import { X }` separately.
- **Always run `npx tsc --noEmit`** before pushing to catch ALL errors at once, not just the first one Vercel reports.

### Client-Side Filter Patterns

- **Never use `router.push()` for filter state.** It triggers a full Next.js navigation cycle through Suspense. Use `useState` + `window.history.replaceState()` for instant filter toggling.
- **`days_of_week` ISO convention:** DB stores ISO 8601 (1=Mon, 7=Sun). JavaScript `getDay()` returns 0=Sun, 6=Sat. Always convert with `jsToIsoDay()`.
- Day badge counts must reflect the active activity filter.
- Active filter chips must remain visible even at 0 count (so users can clear them).

### Pencil MCP Property Names

When using Pencil MCP tools (`batch_design`), these property names are NOT what you'd guess:

| What you want | Correct property | Wrong (will silently fail) |
|---|---|---|
| Text color | `fill` (string) | `fills` (array) |
| Frame background | `fill` (string) | `fills` (array) |
| Stroke | `{fill, thickness}` | `{color, width}` |
| Layout direction | `layout: "vertical"` | `layoutMode` |
| Padding | `[top, right, bottom, left]` or `[v, h]` or number | Object `{top, right, ...}` |
| Clip content | `clip: true` | `clipsContent` |

---

## Recent Architectural Shifts (as of 2026-04-14)

When working in `web/`, be aware these landed recently and older patterns are stale:

- **`web/lib/entity-urls.ts` is the canonical URL builder.** Never hand-build entity URLs. Public API: `buildEventUrl(id, portal, context)`, `buildSpotUrl(slug, portal, context)`, `buildSeriesUrl(slug, portal, seriesType?)`, `buildFestivalUrl(slug, portal)`, `buildExhibitionUrl(slug, portal)`, `buildArtistUrl(slug, portal)`, `buildOrgUrl(slug, portal)`. Only `buildEventUrl` and `buildSpotUrl` take a `LinkContext` arg (`'feed' | 'page'`) — `'feed'` returns an overlay URL (e.g., `?event=123`, `?spot=high-museum`), `'page'` returns the canonical detail page URL. **Standalone detail pages must always pass `'page'`.** Other entity URLs (series, festival, exhibition, artist) are always canonical — no overlay mode. `buildOrgUrl` is an exception: it always returns an overlay URL (`?org=slug`). Civic events use `getCivicEventHref()` from `lib/civic-routing.ts` as a pre-check before `buildEventUrl` (pattern: `getCivicEventHref(event, portal, vertical) ?? buildEventUrl(id, portal, context)`).
- **`places`, not `venues`.** The DB table is `places`. The frontend type is `Place`. Joins use `place_id`, not `venue_id`. The user-facing route is `/{portal}/spots/[id]`, not `/{portal}/venues/[id]`. If you find a stale `venues` table reference in code, fix it; if it's in a comment, update it.
- **`search_unified()` RPC for all search.** The legacy unified-search stack was deleted (commit `b5a3344e` era cleanup). New search code calls `search_unified()` via the server loader pattern — never write a client-side query that bypasses it. Portal isolation is enforced inside the RPC; you must pass `p_portal_id`.
- **Exhibitions are a first-class, cross-vertical entity.** They model persistent experiences at a place — gallery shows, museum exhibitions, aquarium habitats, zoo exhibits, historic site displays, park attractions — with optional run dates. Has its own `ExhibitionResultCard`, `buildExhibitionUrl()`, `exhibitions.search_vector`, and exhibition CTEs in `search_unified()` (commit `bd9cd223`). The Arts portal currently produces most exhibitions, but any vertical with museums/aquariums/historic sites/parks should use the exhibitions table, not events. Treat exhibitions as a noun on the same level as events and places. The `events.exhibition_id` FK is live (commit `838b9052`) — use it to link associated events (opening nights, artist talks, tours, walkthroughs) to their parent exhibition.
- **Overlay vs canonical link rule.** Inside feed/explore/calendar surfaces (the `'feed'` context), entity links open as overlay (modal) for in-place browsing. On standalone detail pages and in shared/permalink contexts, links must be canonical (`'page'` context). The wrong context here causes infinite overlay nesting on detail pages.
- **`content_kind='exhibit'` is deprecated.** Do not create new events with this flag. The filter on feed and event queries (commits `b5a3344e`, `0bb667ab`) remains as protection for legacy rows; new code should never need to set or unset this flag. If you're linking an event to an exhibition, set `events.exhibition_id` instead.
