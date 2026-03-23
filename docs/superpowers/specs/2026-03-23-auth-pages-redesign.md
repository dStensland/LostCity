# Auth Pages Redesign — First Impressions

**Date**: 2026-03-23
**Status**: Review
**Goal**: Redesign auth pages (login, signup, forgot/reset password, post-signup preferences) from generic SaaS forms into branded Lost City experiences with vibrant Atlanta imagery and portal-aware theming.

## Context

Current auth pages are generic dark-mode SaaS — centered form card on a void background. No hero imagery, no brand personality. The Welcome/Onboarding pages have more life (atmospheric gradients, category cards) but the login/signup pages — the actual first impression — feel like any other product.

The feed now has a strong visual identity (cinematic hero, signal strip, editorial voice). The auth pages should match that energy.

## Design Principles

1. **First taste of the city.** The auth page should feel like you're about to unlock Atlanta, not fill out a form.
2. **Minimal onboarding.** Sign up → one optional screen (categories) → feed. No multi-step wizards. The feed works without personalization (intrinsic scoring).
3. **Portal-aware entry.** If referred from a portal, the auth page adapts to that portal's branding.
4. **Progressive disclosure for settings.** Privacy, friends, groups, neighborhoods, notifications — all surface contextually after the user experiences the product, never during onboarding.

## Pages

### Login (`/auth/login`)

**Layout:** Split screen on desktop. Photo backdrop on mobile.

**Desktop (1440px):**
- Left half: Vibrant Atlanta city photo (SmartImage, from the same photo pool as CityBriefing hero). Time-of-day matched if possible (morning photos in morning, evening in evening). Gradient overlay (bottom-heavy) for text readability.
  - "LOST CITY" logo + "do your own thing" tagline overlaid at bottom-left of the photo, same masthead treatment as CityBriefing.
- Right half: Form card centered vertically on `bg-[var(--void)]` background.
  - Form card: `bg-[var(--night)]`, `rounded-card` (12px), `border border-[var(--twilight)]`, `p-8`, `max-w-sm`. On mobile, the card treatment is dropped — form elements render directly on `bg-[var(--void)]` below the photo. The divider "or" pill should use `bg-[var(--dusk)]` to work on both backgrounds.
  - Google OAuth button: full-width, prominent, outlined style
  - Divider: "or continue with email" in `font-mono text-2xs uppercase text-[var(--muted)]`
  - Email input + Password input (existing design system input pattern)
  - "Forgot password?" link: `text-xs text-[var(--muted)] hover:text-[var(--soft)]`
  - "Sign in" button: full-width, `bg-[var(--coral)] text-[var(--void)]`, `font-mono text-sm font-medium`
  - Footer: "Don't have an account? [Sign up](/auth/signup)" in `text-sm text-[var(--soft)]`

**Mobile (375px):**
- Full-width Atlanta photo at top (~200px, with gradient overlay)
- Logo overlaid on photo
- Form below on void background (no card container — form elements directly on the page with standard padding)

**Portal-aware variant:**
When `?redirect=/helpatl` or similar portal path is in the URL:
- Swap Atlanta photo for portal-themed imagery (or use the portal's accent color as a gradient background if no portal photo exists)
- Show portal logo instead of Lost City logo (e.g., "LOST CITIZEN" with teal accent)
- Form styling stays the same (it's a global account, not a portal-specific one)

**Note:** The signup page already has `extractPortalFromRedirect` and `getRememberedPortalSlug` for portal detection. The login page does NOT — portal detection must be added to login, or better, the shared `AuthLayout` component handles it from the `redirect` query param so all auth pages get it for free.

### Signup (`/auth/signup`)

**Same split-screen layout as login.** Form differences:
- Google OAuth button (same)
- Email input
- Username input with availability check (existing pattern — keep the spinner/check)
- Password input with PasswordStrength component (existing — keep it)
- Date of birth picker (existing — keep it, COPPA required)
- "Create account" button (coral primary)
- Footer: "Already have an account? [Sign in](/auth/login)"

### Forgot Password (`/auth/forgot-password`)

**Same split-screen layout.** Simpler form:
- Email input
- "Send reset link" button (coral primary)
- Success state: replace form with confirmation message + check icon using `text-[var(--neon-green)]` (NOT green-500)
- Footer: "Back to [Sign in](/auth/login)"

### Reset Password (`/auth/reset-password`)

**Same split-screen layout.** Form:
- New password input with PasswordStrength
- Confirm password input
- "Reset password" button (coral primary)
- Success state: confirmation message + "Sign in" CTA, using `text-[var(--neon-green)]` (NOT green-500)

### Post-Signup: Quick Preferences (`/onboarding` or inline after signup)

**One screen, skippable. Shown immediately after account creation.**

**Layout:**
- Full-screen dark background (`bg-[var(--void)]`)
- Centered content, `max-w-2xl`
- Headline: "Make Lost City yours" — `text-2xl font-semibold text-[var(--cream)]`
- Subtitle: "Pick what interests you, or skip and explore everything" — `text-sm text-[var(--soft)]`

**Category grid:**
- 8-10 category cards in a 2-column grid (mobile) or 3-4 column (desktop)
- Each card: `bg-[var(--night)]`, `rounded-card`, `border border-[var(--twilight)]`, `p-4`
  - Phosphor icon (weight="duotone", 32px) in a colored circle (category accent color at 20% opacity)
  - Category name: `text-sm font-semibold text-[var(--cream)]`
  - Event count hint: `text-2xs text-[var(--muted)]` — e.g., "47 events this week"
- Selected state: border changes to category accent color, background tints with accent at 10%
- Multi-select: tap to toggle

**Categories to show:**
Music, Art, Comedy, Food & Drink, Nightlife, Outdoors, Sports, Community, Family, Wellness

**Action buttons:**
- "Continue" — coral primary, full-width. Saves selected categories to `user_preferences.favorite_categories` and navigates to the feed.
- "Skip for now →" — ghost/text link below. Navigates directly to feed with no preferences set.

**No second step.** This is the entire onboarding. No genres, no neighborhoods, no organizations.

**Email confirmation screen:** If email confirmation is enabled, signup shows a "Check your email" screen after form submission. This screen also renders inside `AuthLayout` (city photo stays visible). The existing `emailSent` state handling stays — just wraps in the new layout.

**Migration from existing onboarding:**
- `/onboarding` page gets replaced with the single-screen category picker above
- `GenrePicker.tsx` and the multi-step `OnboardingProgress` component become dead code — leave in place but don't render. Clean up in a future pass.
- `/welcome` page is **deprecated but not deleted** — it stays as a fallback route but is not linked from the new signup flow. The new flow goes: signup → (email confirm if needed) → category picker → feed.
- The `/api/onboarding/complete` endpoint stays (it accepts categories which is what the new screen sends). Genre/needs fields become optional no-ops.

## Implementation Changes

### Modified files
- `web/app/auth/login/page.tsx` — rework layout to split-screen with city photo
- `web/app/auth/signup/page.tsx` — same split-screen layout
- `web/app/auth/forgot-password/page.tsx` — split-screen + fix green-500 → neon-green
- `web/app/auth/reset-password/page.tsx` — split-screen + fix green-500 → neon-green

### New components
- `web/components/auth/AuthLayout.tsx` — shared split-screen layout (city photo left, form right). Accepts `portalSlug` for portal-aware theming. Reused by all 4 auth pages.
- `web/components/auth/AuthHeroPhoto.tsx` — city photo with gradient overlay + logo. Uses SmartImage, same photo pool as CityBriefing.

### Modified onboarding
- `web/app/onboarding/page.tsx` — simplify to the single-screen category picker described above. Remove the multi-step genre/neighborhood/org flow. The existing Welcome page (`/welcome`) with its more complex flow can remain as a fallback or be deprecated.

### Pencil design system
- Add all auth pages to the Pencil design system (desktop + mobile)
- Add AuthLayout and category picker to the component library

## Photo Pool

Reuse the existing `HEADER_PHOTOS` from `web/lib/city-pulse/header-defaults.ts` — the CityBriefing hero already has curated Atlanta photos per time slot. The auth pages can pick from the same pool, or use a dedicated subset of the most vibrant/iconic shots.

For portal-aware variants, each portal should have 1-2 representative photos or fall back to a gradient using the portal's accent color.

## What's NOT in This Spec

- **Privacy settings in onboarding** — surfaces contextually when user first interacts with social features
- **Add friends flow** — surfaces in Community tab and after RSVPs
- **Join groups** — surfaces in Community tab
- **Neighborhood preferences** — surfaces after browsing behavior reveals patterns
- **Notification preferences** — surfaces after first RSVP
- **Welcome page revamp** — the existing `/welcome` page stays as-is for now; it may be deprecated once the simplified onboarding proves sufficient

## Success Criteria

1. Login page feels like Atlanta, not like SaaS — the city photo is the first thing you see
2. Signup → feed in under 30 seconds (including optional category picks)
3. "Skip for now" gets you to the feed in under 10 seconds after signup
4. Portal-aware entry: signing up from HelpATL feels civic (teal), from Arts feels creative (copper)
5. No green-500 anywhere in auth pages — all success states use `--neon-green`
6. All auth pages in the Pencil design system with desktop + mobile compositions

## Risks

- **Photo loading on auth pages**: Auth pages are `"use client"` with no server-side CityPulse context. For the time slot: compute client-side from `new Date().getHours()` (simple hour-to-slot mapping, no API needed). For the photo: use a **local-first strategy** — default to a local photo (`/portals/atlanta/skyline.jpg` or similar) that loads instantly, with the time-matched external Unsplash photo as an enhancement that swaps in after loading. This is the literal first page users see — it must load fast.
- **Portal detection reliability**: Detecting which portal referred the user depends on the `redirect` query param. If someone navigates directly to `/auth/login`, they get the default Atlanta experience. This is fine.
- **Onboarding skip rate**: If most users skip the category screen, the personalization layer stays empty. This is acceptable — the intrinsic scoring and tier system make the feed useful without preferences. Monitor skip rate and adjust if needed.
