# Auth Pages Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign auth pages from generic SaaS forms into branded Lost City experiences with split-screen city photos, portal-aware theming, and a simplified single-screen onboarding.

**Architecture:** Shared `AuthLayout` component handles the split-screen layout + portal detection for all auth pages. Each page provides its own form content. Post-signup onboarding simplified to one category picker screen.

**Tech Stack:** Next.js 16, Tailwind v4, Supabase Auth, SmartImage, existing design system tokens

**Spec:** `docs/superpowers/specs/2026-03-23-auth-pages-redesign.md`

---

## Task 1: AuthLayout + AuthHeroPhoto Components

**Purpose:** Shared split-screen layout used by all auth pages. City photo left, form right on desktop. Photo header + form below on mobile.

**Files:**
- Create: `web/components/auth/AuthLayout.tsx`
- Create: `web/components/auth/AuthHeroPhoto.tsx`

- [ ] **Step 1: Create AuthHeroPhoto**

`web/components/auth/AuthHeroPhoto.tsx` — the city photo side of the split screen.

```typescript
"use client";
import SmartImage from "@/components/SmartImage";

interface AuthHeroPhotoProps {
  portalSlug?: string | null;
  portalAccentColor?: string;
  portalLabel?: string; // "LOST CITIZEN", "LOST ARTS", etc.
}
```

- Determines time slot from `new Date().getHours()` (morning < 11, midday < 16, happy_hour < 18, evening < 22, late_night)
- Picks a local photo as default: `/portals/atlanta/jackson-st-bridge.jpg` (or another known local file)
- Gradient overlay: bottom-heavy, same treatment as CityBriefing but lighter (the auth photo should be vibrant)
- Logo overlay: "LOST CITY" + "do your own thing" tagline at bottom-left. If `portalLabel` provided, show that instead.
- Uses `SmartImage` with `priority` for fast loading

- [ ] **Step 2: Create AuthLayout**

`web/components/auth/AuthLayout.tsx` — the split-screen wrapper.

```typescript
interface AuthLayoutProps {
  children: React.ReactNode; // The form content
  portalSlug?: string | null;
}
```

- Parses `redirect` query param from URL to detect portal (reuse `extractPortalFromRedirect` from signup page or implement inline)
- Look up portal accent color and label from slug
- Desktop: `flex` row — `AuthHeroPhoto` takes left half (`w-1/2`), form content takes right half (`w-1/2`) centered vertically
- Mobile: `AuthHeroPhoto` as a header (~200px), form content below on `bg-[var(--void)]`
- Desktop form area: form wrapped in a card (`bg-[var(--night)] rounded-card border border-[var(--twilight)] p-8 max-w-sm mx-auto`)
- Mobile form area: no card, just `px-6 py-8` directly on void

- [ ] **Step 3: Commit**

```bash
git add web/components/auth/AuthLayout.tsx web/components/auth/AuthHeroPhoto.tsx
git commit -m "feat: add AuthLayout split-screen and AuthHeroPhoto components"
```

---

## Task 2: Redesign Login Page

**Purpose:** Wrap existing login form in AuthLayout. Keep all logic, just change the visual wrapper.

**Files:**
- Modify: `web/app/auth/login/page.tsx`

- [ ] **Step 1: Read the current login page**

Read `web/app/auth/login/page.tsx` (259 lines). Understand the form structure, Google OAuth, error handling, redirect logic.

- [ ] **Step 2: Wrap in AuthLayout**

Replace the current centered-card layout with `AuthLayout`:

```tsx
import AuthLayout from "@/components/auth/AuthLayout";

export default function LoginPage() {
  // ... existing state/logic stays

  return (
    <AuthLayout>
      {/* Form content — same inputs, buttons, links as before */}
      <h1 className="text-2xl font-semibold text-[var(--cream)] mb-6">Sign in</h1>
      {/* Google OAuth button */}
      {/* Divider */}
      {/* Email + password inputs */}
      {/* Forgot password link */}
      {/* Submit button */}
      {/* Sign up link */}
    </AuthLayout>
  );
}
```

- Remove the old wrapper `<div>` that centers the card
- Remove the old logo rendering (AuthLayout handles the logo in the photo area)
- Keep all form logic, validation, error states, redirect handling unchanged
- Update the divider "or" pill to use `bg-[var(--dusk)]` (works on both night card and void bg)

- [ ] **Step 3: Browser test**

- Desktop: city photo left, form right
- Mobile: photo header, form below
- Google OAuth works
- Email/password login works
- Redirect after login works
- Error states display correctly

- [ ] **Step 4: Commit**

```bash
git add web/app/auth/login/page.tsx
git commit -m "feat: redesign login page with split-screen city photo layout"
```

---

## Task 3: Redesign Signup Page

**Purpose:** Same AuthLayout wrapper. Keep all signup logic (OAuth, username check, COPPA DOB, password strength).

**Files:**
- Modify: `web/app/auth/signup/page.tsx`

- [ ] **Step 1: Read the current signup page**

Read `web/app/auth/signup/page.tsx` (509 lines). Understand form steps, email confirmation state, portal detection (already exists here).

- [ ] **Step 2: Wrap in AuthLayout**

Same pattern as login — wrap form content in `AuthLayout`. The signup page already has `extractPortalFromRedirect` — let AuthLayout handle this instead (or share the detection).

Keep:
- Google OAuth
- Email, username (with availability spinner), password (with PasswordStrength), DOB
- Email confirmation screen (`emailSent` state) — this also renders inside AuthLayout
- All validation, error handling, COPPA logic

Remove:
- Old centered-card wrapper
- Old logo rendering (AuthLayout handles it)

- [ ] **Step 3: Handle email confirmation state**

When `emailSent` is true, the page shows a "Check your email" screen. This should still render inside AuthLayout — the city photo stays visible, the confirmation message replaces the form in the right/bottom area.

- [ ] **Step 4: Browser test**

- Desktop + mobile split-screen layout
- Full signup flow works (email + Google)
- Username availability check works
- Password strength indicator works
- DOB picker works
- Email confirmation screen shows inside the layout
- Portal-aware theming (test with `?redirect=/helpatl`)

- [ ] **Step 5: Commit**

```bash
git add web/app/auth/signup/page.tsx
git commit -m "feat: redesign signup page with split-screen city photo layout"
```

---

## Task 4: Fix Forgot/Reset Password Pages

**Purpose:** Same AuthLayout + fix green-500 → neon-green.

**Files:**
- Modify: `web/app/auth/forgot-password/page.tsx`
- Modify: `web/app/auth/reset-password/page.tsx`

- [ ] **Step 1: Wrap forgot-password in AuthLayout**

Read and modify `web/app/auth/forgot-password/page.tsx` (150 lines). Wrap in AuthLayout. Fix all `green-500` references to `var(--neon-green)`:
- `bg-green-500/10` → `bg-[var(--neon-green)]/10`
- `border-green-500` → `border-[var(--neon-green)]`
- `text-green-500` → `text-[var(--neon-green)]`
- `text-green-400` → `text-[var(--neon-green)]`

- [ ] **Step 2: Wrap reset-password in AuthLayout**

Read and modify `web/app/auth/reset-password/page.tsx` (278 lines). Same AuthLayout wrap + green-500 fixes.

- [ ] **Step 3: Browser test**

- Forgot password: enter email, see success state with neon-green (not green-500)
- Reset password: enter new password, see success state with neon-green

- [ ] **Step 4: Commit**

```bash
git add web/app/auth/forgot-password/page.tsx web/app/auth/reset-password/page.tsx
git commit -m "feat: redesign forgot/reset password pages + fix green-500 to neon-green"
```

---

## Task 5: Simplified Onboarding — Category Picker

**Purpose:** Replace the multi-step onboarding with a single skippable category picker.

**Files:**
- Modify: `web/app/onboarding/page.tsx` (rewrite)

- [ ] **Step 1: Read current onboarding**

Read `web/app/onboarding/page.tsx` (329 lines). Understand the current flow (category → genre steps), the API call to save preferences, and the celebration overlay.

- [ ] **Step 2: Rewrite as single-screen picker**

Replace with a simple one-screen component:

```tsx
"use client";

const CATEGORIES = [
  { id: "music", label: "Music", icon: "MusicNote" },
  { id: "art", label: "Art", icon: "Palette" },
  { id: "comedy", label: "Comedy", icon: "SmileyWink" },
  { id: "food_drink", label: "Food & Drink", icon: "ForkKnife" },
  { id: "nightlife", label: "Nightlife", icon: "Martini" },
  { id: "outdoors", label: "Outdoors", icon: "Tree" },
  { id: "sports", label: "Sports", icon: "Trophy" },
  { id: "community", label: "Community", icon: "UsersThree" },
  { id: "family", label: "Family", icon: "Baby" },
  { id: "learning", label: "Learning", icon: "BookOpen" },
];
```

Layout:
- Full-screen `bg-[var(--void)]`
- Centered content `max-w-2xl mx-auto px-6 py-12`
- "Make Lost City yours" — `text-2xl font-semibold text-[var(--cream)]`
- "Pick what interests you, or skip and explore everything" — `text-sm text-[var(--soft)]`
- Grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-8`
- Each card: tappable, toggleable, shows Phosphor icon + label
  - Unselected: `bg-[var(--night)] border border-[var(--twilight)] rounded-card p-4`
  - Selected: border changes to category accent color, bg tints with accent at 10%
- Bottom: "Continue" button (coral, full-width) + "Skip for now →" link (ghost)

- [ ] **Step 3: Handle save + navigation**

"Continue" saves selected categories via the existing onboarding API (or directly to `user_preferences`), then redirects to the feed (`/${portalSlug || "atlanta"}`).

"Skip for now" navigates directly to the feed with no API call.

- [ ] **Step 4: Browser test**

- Category cards toggle on tap
- "Continue" saves preferences and goes to feed
- "Skip for now" goes straight to feed
- Mobile layout: 2 columns, scrollable

- [ ] **Step 5: Commit**

```bash
git add web/app/onboarding/page.tsx
git commit -m "feat: simplify onboarding to single-screen category picker"
```

---

## Task 6: Pencil Design System + Cleanup

**Purpose:** Add all auth pages to the Pencil design system and clean up.

**Files:**
- Modify: `docs/design-system.pen` (via Pencil MCP)
- Modify: `web/.claude/rules/figma-design-system.md`

- [ ] **Step 1: Build auth pages in Pencil**

Using Pencil MCP, build in `docs/design-system.pen`:
- Login — desktop (split-screen) + mobile
- Signup — desktop + mobile
- Category picker — desktop + mobile
- All using Atlanta theme (default)

- [ ] **Step 2: Update design system rules**

Add auth page patterns to `web/.claude/rules/figma-design-system.md`:
- AuthLayout component and usage
- Split-screen pattern (photo left, form right)
- Portal-aware theming in auth
- Category picker card pattern

- [ ] **Step 3: Commit**

```bash
git add web/.claude/rules/figma-design-system.md
git commit -m "docs: add auth pages to design system"
```
