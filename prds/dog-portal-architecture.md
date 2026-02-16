# ROMP Dog Portal Feature Expansion - Architecture & Implementation Plan

**Date:** 2026-02-14
**Status:** Ready for implementation
**Input Docs:** `dog-portal-features-prd.md`, `dog-portal-ux-design.md`, `dog-portal-content-strategy.md`

---

## 1. File Manifest

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `web/lib/dog-tags.ts` | Tag vocabulary constants, display info, validation, category grouping |
| `web/app/api/tag-venue/route.ts` | POST endpoint for crowdsourced venue tagging |
| `web/app/[portal]/parks/page.tsx` | Parks & Trails deep page (off-leash tab, trails tab) |
| `web/app/[portal]/pup-cups/page.tsx` | Pup Cup directory deep page |
| `web/app/[portal]/adopt/page.tsx` | Adoption hub: org profiles + adoption events |
| `web/app/[portal]/training/page.tsx` | Training classes deep page |
| `web/app/[portal]/services/page.tsx` | Vet & Services directory deep page |
| `web/app/[portal]/_components/dog/DogDeepPageShell.tsx` | Shared layout for all dog deep pages (header, back button, theme wrapper) |
| `web/app/[portal]/_components/dog/DogSectionHeader.tsx` | Reusable section header with "See all (N)" link |
| `web/app/[portal]/_components/dog/DogTagModal.tsx` | Client component: tag submission modal with auth check |
| `web/app/[portal]/_components/dog/DogFilterChips.tsx` | Client component: horizontal scrolling filter chips |
| `web/app/[portal]/_components/dog/DogOrgCard.tsx` | Adoption org profile card |
| `web/app/[portal]/_components/dog/DogEmptyState.tsx` | Reusable empty state with CTA variants |
| `web/app/[portal]/_components/dog/DogTagChips.tsx` | Display tag chips on venue cards (water bowls, fenced, etc.) |
| `web/app/[portal]/_components/dog/DogCommunityCTA.tsx` | Feed bottom CTA for tagging |
| `web/app/[portal]/_components/dog/DogServiceRow.tsx` | Compact service row with open/closed indicator |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `web/lib/dog-data.ts` | Add 7 new query functions for deep pages (pup cups, off-leash, services, adoption events, adoption orgs, training events, recently tagged) |
| `web/lib/dog-art.ts` | Add `adoption` content type color/emoji; extend `classifyDogContentType` for new venue types |
| `web/lib/dog-source-policy.ts` | Add new dog-relevant tags and vibes to the allow lists |
| `web/app/[portal]/_components/dog/DogFeed.tsx` | Add new sections (Pup Cup Spots, Off-Leash Parks, Adopt, Training, Services), "See all" links, conditional display |
| `web/app/[portal]/_components/dog/DogCard.tsx` | Add `showTags` prop to `DogVenueCard` and `DogVenueRow` for tag chip display; add `showDistance` prop |
| `web/app/[portal]/_components/dog/DogPortalExperience.tsx` | Wire community CTA to actual tag flow |
| `web/components/headers/DogHeader.tsx` | Add `showBackButton` and `pageTitle` props for deep page headers; update `isActive` to mark Explore active on deep pages |

---

## 2. Route Architecture

### Route File Pattern

Every dog deep page follows the hospital sub-route guard pattern from `web/app/[portal]/hospitals/page.tsx`:

```typescript
// Example: web/app/[portal]/parks/page.tsx
import { notFound } from "next/navigation";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { isDogPortal } from "@/lib/dog-art";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ filter?: string; tab?: string }>;
};

export const revalidate = 60;

export default async function DogParksPage({ params, searchParams }: Props) {
  const { portal: portalSlug } = await params;
  const searchParamsData = await searchParams;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  // Guard: only render for dog portals
  const vertical = getPortalVertical(portal);
  if (vertical !== "dog" && !isDogPortal(portal.slug)) notFound();

  // ... page content
}
```

### Route Guard Function

Every deep page MUST call this guard at the top. If a user navigates to `/atlanta/parks`, they get a 404. Only `/atl-dogs/parks` renders.

### Route-to-Component Mapping

```
/atl-dogs/parks       -> DogDeepPageShell + DogParksContent
/atl-dogs/pup-cups    -> DogDeepPageShell + DogPupCupsContent
/atl-dogs/adopt       -> DogDeepPageShell + DogAdoptContent
/atl-dogs/training    -> DogDeepPageShell + DogTrainingContent
/atl-dogs/services    -> DogDeepPageShell + DogServicesContent
```

### DogDeepPageShell Component

Shared wrapper providing theme CSS, font, header with back button, and bottom nav spacer:

```typescript
// web/app/[portal]/_components/dog/DogDeepPageShell.tsx
import { Plus_Jakarta_Sans } from "next/font/google";
import { DOG_THEME_SCOPE_CLASS, DOG_THEME_CSS } from "@/lib/dog-art";
import { DogHeader } from "@/components/headers";
import { Suspense } from "react";

const dogFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dog",
  display: "swap",
});

interface Props {
  portalSlug: string;
  pageTitle: string;
  children: React.ReactNode;
}

export default function DogDeepPageShell({ portalSlug, pageTitle, children }: Props) {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#FFFBEB" }}>
      <style>{`
        body::before { opacity: 0 !important; }
        body::after { opacity: 0 !important; }
        .ambient-glow { opacity: 0 !important; }
        .rain-overlay { display: none !important; }
        .cursor-glow { display: none !important; }
      `}</style>
      <Suspense fallback={null}>
        <DogHeader portalSlug={portalSlug} showBackButton pageTitle={pageTitle} />
      </Suspense>
      <div className={dogFont.variable}>
        <div className={DOG_THEME_SCOPE_CLASS}>
          <style dangerouslySetInnerHTML={{ __html: DOG_THEME_CSS }} />
          <main className="max-w-5xl mx-auto px-4 pb-20 pt-6">
            {children}
          </main>
        </div>
      </div>
      <div className="sm:hidden h-16" />
    </div>
  );
}
```

### Header Updates for Deep Pages

Modify `web/components/headers/DogHeader.tsx` to accept:

```typescript
interface DogHeaderProps {
  portalSlug: string;
  showBackButton?: boolean;  // NEW
  pageTitle?: string;        // NEW - shows breadcrumb text, e.g. "Parks"
}
```

When `showBackButton` is true:
- Desktop: Replace logo + pills with `<- Parks & Trails` breadcrumb link back to `/${portalSlug}`
- Mobile: Keep bottom nav, mark "Explore" as active. Top header shows back arrow + page title.

Update `isActive` logic to treat deep page paths as "Explore" active:

```typescript
const isActive = (tab: NavTab) => {
  const isPortalRoot = pathname === `/${portalSlug}`;
  const isDeepPage = pathname.startsWith(`/${portalSlug}/`) &&
    ["/parks", "/pup-cups", "/adopt", "/training", "/services"].some(p =>
      pathname.startsWith(`/${portalSlug}${p}`)
    );

  if (tab.key === "feed") {
    return (isPortalRoot && (!currentView || currentView === "feed")) || isDeepPage;
  }
  // ... rest unchanged
};
```

---

## 3. Data Layer Changes

### New Queries in `web/lib/dog-data.ts`

All additions go to the existing `dog-data.ts` file.

#### 3a. Extended DogVenue Type

Add optional fields to the existing type:

```typescript
export type DogVenue = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  venue_type: string | null;
  vibes: string[] | null;
  image_url: string | null;
  short_description: string | null;
  website: string | null;
  // NEW fields for deep pages
  hours_display?: string | null;
  hours?: Record<string, unknown> | null;
  is_24_hours?: boolean | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};
```

Update `VENUE_SELECT` to include new fields for deep page queries:

```typescript
const VENUE_SELECT = `
  id, name, slug, address, neighborhood, venue_type, vibes,
  image_url, short_description, website
`;

// Extended select for deep pages that need hours/location
const VENUE_SELECT_EXTENDED = `
  id, name, slug, address, neighborhood, venue_type, vibes,
  image_url, short_description, website,
  hours_display, hours, is_24_hours, phone, latitude, longitude
`;
```

#### 3b. New Query Functions

```typescript
/** Get off-leash parks (venues with off-leash vibe or dog_park type) */
export async function getDogOffLeashParks(limit = 30): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT_EXTENDED)
    .eq("active", true)
    .or("venue_type.eq.dog_park,vibes.cs.{off-leash}")
    .order("name")
    .limit(limit);

  return (data || []) as DogVenue[];
}

/** Get pup cup / dog menu venues */
export async function getDogPupCupSpots(limit = 40): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT_EXTENDED)
    .eq("active", true)
    .overlaps("vibes", ["pup-cup", "dog-menu", "treats-available"])
    .order("name")
    .limit(limit);

  return (data || []) as DogVenue[];
}

/** Get adoption events */
export async function getDogAdoptionEvents(limit = 20): Promise<DogEvent[]> {
  const today = getLocalDateString();

  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .overlaps("tags", ["adoption", "adoption-event"])
    .order("start_date", { ascending: true })
    .limit(limit);

  return (data || []) as DogEvent[];
}

/** Get adoption/shelter org venues */
export async function getDogAdoptionOrgs(): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT_EXTENDED)
    .eq("active", true)
    .eq("venue_type", "animal_shelter")
    .order("name");

  return (data || []) as DogVenue[];
}

/** Get training events */
export async function getDogTrainingEvents(limit = 20): Promise<DogEvent[]> {
  const today = getLocalDateString();

  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .overlaps("tags", ["dog-training", "puppy-class", "obedience", "agility"])
    .order("start_date", { ascending: true })
    .limit(limit);

  return (data || []) as DogEvent[];
}

/** Get training facility venues */
export async function getDogTrainingFacilities(): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT_EXTENDED)
    .eq("active", true)
    .overlaps("vibes", ["training", "dog-training"])
    .order("name");

  return (data || []) as DogVenue[];
}

/** Get service venues (vets, groomers, pet stores, daycare) */
export async function getDogServices(
  typeFilter?: string,
  limit = 50
): Promise<DogVenue[]> {
  let query = supabase
    .from("venues")
    .select(VENUE_SELECT_EXTENDED)
    .eq("active", true);

  if (typeFilter && typeFilter !== "all") {
    query = query.eq("venue_type", typeFilter);
  } else {
    query = query.in("venue_type", SERVICE_TYPES);
  }

  const { data } = await query.order("name").limit(limit);

  return (data || []) as DogVenue[];
}

/** Get recently tagged venues (venues with dog tags, sorted by updated_at) */
export async function getRecentlyTaggedVenues(limit = 6): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT)
    .eq("active", true)
    .contains("vibes", ["dog-friendly"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data || []) as DogVenue[];
}
```

#### 3c. Updated Feed Builder

Update `getDogFeed()` to include the new sections with ordering matching the UX doc:

```typescript
export async function getDogFeed(): Promise<DogFeedSection[]> {
  const [
    weekendEvents,
    allEvents,
    offLeashParks,
    pupCupSpots,
    adoptionEvents,
    trainingEvents,
    patios,
    trails,
    services,
  ] = await Promise.all([
    getDogWeekendEvents(10),
    getDogEvents(20),
    getDogOffLeashParks(12),
    getDogPupCupSpots(12),
    getDogAdoptionEvents(6),
    getDogTrainingEvents(6),
    getDogPatios(15),
    getDogTrails(10),
    getDogServices(undefined, 8),
  ]);

  const sections: DogFeedSection[] = [];

  // 1. This Weekend
  if (weekendEvents.length > 0) {
    sections.push({
      key: "this_weekend",
      title: "This Weekend",
      subtitle: "Things happening Friday through Sunday",
      type: "events",
      items: weekendEvents,
      deepPageHref: null,  // filters feed inline
    });
  }

  // 2. Off-Leash Parks
  if (offLeashParks.length >= 3) {
    sections.push({
      key: "off_leash",
      title: "Off-Leash Parks",
      subtitle: "Let them run free",
      type: "venues",
      items: offLeashParks,
      deepPageHref: "/parks",
    });
  }

  // 3. Pup Cup Spots
  if (pupCupSpots.length >= 3) {
    sections.push({
      key: "pup_cups",
      title: "Pup Cup Spots",
      subtitle: "Treats, menus, and puppuccinos",
      type: "venues",
      items: pupCupSpots,
      deepPageHref: "/pup-cups",
    });
  }

  // 4. Adopt
  if (adoptionEvents.length > 0) {
    sections.push({
      key: "adopt",
      title: "Adopt",
      subtitle: "Meet your new best friend",
      type: "events",
      items: adoptionEvents,
      deepPageHref: "/adopt",
    });
  }

  // 5. Training & Classes
  if (trainingEvents.length >= 3) {
    sections.push({
      key: "training",
      title: "Training & Classes",
      subtitle: "Puppy school, obedience, agility, and more",
      type: "events",
      items: trainingEvents,
      deepPageHref: "/training",
    });
  }

  // 6. Dog-Friendly Spots (patios)
  if (patios.length > 0) {
    sections.push({
      key: "patios",
      title: "Dog-Friendly Spots",
      subtitle: "Patios, breweries, and places that welcome your pup",
      type: "venues",
      items: patios,
      deepPageHref: null,  // filters feed inline
    });
  }

  // 7. Services
  if (services.length >= 3) {
    sections.push({
      key: "services",
      title: "Services",
      subtitle: "Vets, groomers, pet stores, and daycare",
      type: "venues",
      items: services,
      deepPageHref: "/services",
    });
  }

  // 8. Trails & Nature
  if (trails.length > 0) {
    sections.push({
      key: "trails",
      title: "Trails & Nature",
      subtitle: "Hiking, walking, and exploring",
      type: "venues",
      items: trails,
      deepPageHref: "/parks#trails",
    });
  }

  // 9. Coming Up
  if (allEvents.length > 0) {
    const weekendIds = new Set(weekendEvents.map((e) => e.id));
    const adoptionIds = new Set(adoptionEvents.map((e) => e.id));
    const trainingIds = new Set(trainingEvents.map((e) => e.id));
    const upcoming = allEvents.filter(
      (e) => !weekendIds.has(e.id) && !adoptionIds.has(e.id) && !trainingIds.has(e.id)
    );
    if (upcoming.length > 0) {
      sections.push({
        key: "upcoming",
        title: "Coming Up",
        subtitle: "Events, classes, and adoption days",
        type: "events",
        items: upcoming.slice(0, 12),
        deepPageHref: null,
      });
    }
  }

  return sections;
}
```

Update the `DogFeedSection` type:

```typescript
export type DogFeedSection = {
  key: string;
  title: string;
  subtitle?: string;        // NEW
  type: "events" | "venues";
  items: DogEvent[] | DogVenue[];
  deepPageHref?: string | null;  // NEW - relative path for "See all" link
};
```

---

## 4. API Route: POST /api/tag-venue

### File: `web/app/api/tag-venue/route.ts`

```typescript
import { NextResponse } from "next/server";
import { checkBodySize, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/user-utils";
import { withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ALLOWED_DOG_VIBES } from "@/lib/dog-tags";

/**
 * POST /api/tag-venue
 * Add dog-friendly vibes to a venue. Auth required.
 *
 * Body: { venue_id: number, vibes: string[] }
 * Response: { success: true, vibes: string[] } (merged vibes array)
 */
export const POST = withAuth(async (request, { user, serviceClient }) => {
  // Body size check
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  // Rate limit (write tier: 30/min)
  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { venue_id, vibes } = body;

    // --- Validation ---

    // venue_id must be a positive integer
    if (typeof venue_id !== "number" || !Number.isInteger(venue_id) || venue_id <= 0) {
      return validationError("Invalid venue_id");
    }

    // vibes must be a non-empty string array
    if (!Array.isArray(vibes) || vibes.length === 0 || vibes.length > 20) {
      return validationError("vibes must be a non-empty array (max 20)");
    }

    // Every vibe must be in the allowed set
    const invalidVibes = vibes.filter((v: unknown) =>
      typeof v !== "string" || !ALLOWED_DOG_VIBES.has(v)
    );
    if (invalidVibes.length > 0) {
      return validationError(`Invalid vibes: ${invalidVibes.join(", ")}`);
    }

    // --- Ensure profile exists ---
    await ensureUserProfile(user, serviceClient);

    // --- Fetch existing venue ---
    const { data: venue, error: fetchError } = await serviceClient
      .from("venues")
      .select("id, vibes")
      .eq("id", venue_id)
      .eq("active", true)
      .maybeSingle();

    if (fetchError) {
      logger.error("tag-venue fetch error", fetchError, { userId: user.id, venueId: venue_id, component: "tag-venue" });
      return NextResponse.json({ error: "Failed to fetch venue" }, { status: 500 });
    }

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Cast after null check to avoid Supabase `never` type issue
    const existingVenue = venue as { id: number; vibes: string[] | null };

    // --- Merge vibes (no duplicates) ---
    const existingVibes = existingVenue.vibes || [];
    const mergedVibes = [...new Set([...existingVibes, ...vibes])];

    // --- Update venue ---
    const { error: updateError } = await serviceClient
      .from("venues")
      .update({ vibes: mergedVibes, updated_at: new Date().toISOString() } as never)
      .eq("id", venue_id);

    if (updateError) {
      logger.error("tag-venue update error", updateError, { userId: user.id, venueId: venue_id, component: "tag-venue" });
      return NextResponse.json({ error: "Failed to update venue" }, { status: 500 });
    }

    return NextResponse.json({ success: true, vibes: mergedVibes });
  } catch (error) {
    logger.error("tag-venue API error", error, { userId: user.id, component: "tag-venue" });
    return NextResponse.json({ error: "Failed to tag venue" }, { status: 500 });
  }
});
```

### Key Design Decisions

1. **Uses `withAuth` wrapper** -- consistent with `/api/rsvp` pattern.
2. **Uses `serviceClient` for mutations** -- bypasses RLS, auth verified via `createClient().auth.getUser()`.
3. **`as never` on `.update()`** -- required by Supabase strict typing (see CLAUDE.md).
4. **Cast after `.maybeSingle()` null check** -- avoids the Supabase `never` type pitfall on `.select()` results.
5. **Vibes are additive only** -- no removal in V1. The `Set` merge prevents duplicates.
6. **Validation is strict** -- every submitted vibe must exist in `ALLOWED_DOG_VIBES`. No freeform input.
7. **Rate limited at write tier** -- 30/min, keyed per user+IP.

---

## 5. Component Plan

### 5a. DogSectionHeader

Replaces the bare `<h2>` in `DogFeed.tsx`. Shows title, subtitle, and optional "See all (N)" link.

```typescript
// web/app/[portal]/_components/dog/DogSectionHeader.tsx
import Link from "next/link";

interface Props {
  title: string;
  subtitle?: string;
  seeAllHref?: string | null;
  seeAllCount?: number;
  portalSlug: string;
}

export default function DogSectionHeader({ title, subtitle, seeAllHref, seeAllCount, portalSlug }: Props) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h2 className="dog-section-title">{title}</h2>
        {subtitle && (
          <p className="text-xs -mt-1 mb-2" style={{ color: "var(--dog-stone)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {seeAllHref && (
        <Link
          href={`/${portalSlug}${seeAllHref}`}
          className="text-sm font-semibold whitespace-nowrap flex-shrink-0 mt-1"
          style={{ color: "var(--dog-orange)" }}
        >
          See all{seeAllCount != null ? ` (${seeAllCount})` : ""} &rarr;
        </Link>
      )}
    </div>
  );
}
```

### 5b. DogTagChips

Displays venue tag chips below the venue name on cards.

```typescript
// web/app/[portal]/_components/dog/DogTagChips.tsx
import { getTagDisplayInfo } from "@/lib/dog-tags";

interface Props {
  vibes: string[] | null;
  maxTags?: number;
}

export default function DogTagChips({ vibes, maxTags = 3 }: Props) {
  if (!vibes || vibes.length === 0) return null;

  // Filter to only dog-specific tags and take first N
  const dogTags = vibes
    .map(v => getTagDisplayInfo(v))
    .filter(Boolean)
    .slice(0, maxTags);

  if (dogTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {dogTags.map(tag => (
        <span
          key={tag!.machineKey}
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
          style={{
            background: "rgba(253, 232, 138, 0.3)",
            color: "var(--dog-charcoal)",
          }}
        >
          {tag!.icon} {tag!.label}
        </span>
      ))}
    </div>
  );
}
```

### 5c. DogTagModal (Client Component)

```typescript
// web/app/[portal]/_components/dog/DogTagModal.tsx
"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import { DOG_TAG_GROUPS, type DogTagGroup } from "@/lib/dog-tags";

interface Props {
  venueId: number;
  venueName: string;
  venueType: string | null;
  existingVibes: string[] | null;
  onClose: () => void;
  onSuccess: (updatedVibes: string[]) => void;
}

export default function DogTagModal({ venueId, venueName, venueType, existingVibes, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const { authFetch } = useAuthenticatedFetch();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(["dog-friendly"])  // Always pre-selected
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter tag groups based on venue type
  const visibleGroups = getVisibleGroups(venueType);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (tag === "dog-friendly") return next;  // Cannot uncheck base tag
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (selectedTags.size === 0) {
      setError("You must select at least one tag.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const vibes = Array.from(selectedTags);
    const { data, error: fetchError } = await authFetch<{ success: boolean; vibes: string[] }>(
      "/api/tag-venue",
      { method: "POST", body: { venue_id: venueId, vibes } }
    );

    setSubmitting(false);

    if (fetchError || !data?.success) {
      setError("Something went wrong. Try again.");
      return;
    }

    onSuccess(data.vibes);
  };

  // ... render modal UI (see UX doc Section 4 for layout)
}

function getVisibleGroups(venueType: string | null): DogTagGroup[] {
  const type = (venueType || "").toLowerCase();
  const isPark = ["park", "dog_park", "trail", "nature_preserve"].includes(type);
  const isTrail = ["trail", "nature_preserve"].includes(type);
  const isFood = ["restaurant", "bar", "cafe", "brewery", "coffee_shop"].includes(type);

  return DOG_TAG_GROUPS.filter(group => {
    if (group.key === "base" || group.key === "amenities") return true;
    if (group.key === "food") return isFood || (!isPark && !isTrail);
    if (group.key === "access") return isPark;
    if (group.key === "surface") return isPark || isTrail;
    return true;
  });
}
```

### 5d. DogFilterChips (Client Component)

Used on deep pages for filtering. Stores state in URL params for shareability.

```typescript
// web/app/[portal]/_components/dog/DogFilterChips.tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface FilterOption {
  key: string;
  label: string;
}

interface Props {
  paramName: string;    // e.g. "filter" or "type"
  options: FilterOption[];
  defaultValue?: string;
}

export default function DogFilterChips({ paramName, options, defaultValue = "all" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams?.get(paramName) || defaultValue;

  const setFilter = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value === defaultValue) {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router, pathname, searchParams, paramName, defaultValue]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {options.map(opt => {
        const active = current === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
            style={{
              background: active ? "var(--dog-orange)" : "rgba(253, 232, 138, 0.25)",
              color: active ? "#fff" : "var(--dog-charcoal)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

### 5e. DogEmptyState

```typescript
// web/app/[portal]/_components/dog/DogEmptyState.tsx

interface Props {
  emoji?: string;
  headline: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function DogEmptyState({ emoji, headline, body, ctaLabel, ctaHref }: Props) {
  return (
    <div className="text-center py-12 px-4">
      {emoji && <p className="text-3xl mb-3">{emoji}</p>}
      <p className="dog-display text-base font-bold" style={{ color: "var(--dog-charcoal)" }}>
        {headline}
      </p>
      {body && (
        <p className="mt-1 text-sm" style={{ color: "var(--dog-stone)" }}>{body}</p>
      )}
      {ctaLabel && ctaHref && (
        <a href={ctaHref} className="dog-btn-secondary inline-block mt-4 text-sm">
          {ctaLabel}
        </a>
      )}
    </div>
  );
}
```

### 5f. DogOrgCard

```typescript
// web/app/[portal]/_components/dog/DogOrgCard.tsx
import Link from "next/link";
import Image from "next/image";
import type { DogVenue } from "@/lib/dog-data";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface Props {
  org: DogVenue;
  portalSlug: string;
}

export default function DogOrgCard({ org, portalSlug }: Props) {
  return (
    <Link
      href={`/${portalSlug}/spots/${org.slug}`}
      className="dog-card p-4 flex items-start gap-3 group"
    >
      {org.image_url ? (
        <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={getProxiedImageSrc(org.image_url)}
            alt={org.name}
            fill
            className="object-cover"
            sizes="40px"
          />
        </div>
      ) : (
        <div
          className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: "rgba(255, 107, 53, 0.15)" }}
        >
          <span className="text-base">&#10084;&#65039;</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-sm" style={{ color: "var(--dog-charcoal)" }}>
          {org.name}
        </h3>
        {org.short_description && (
          <p className="text-xs line-clamp-1 mt-0.5" style={{ color: "var(--dog-stone)" }}>
            {org.short_description}
          </p>
        )}
        {org.address && (
          <p className="text-xs mt-0.5" style={{ color: "var(--dog-stone)" }}>
            {org.address}
          </p>
        )}
      </div>
      {org.website && (
        <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--dog-orange)" }}>
          Visit &rarr;
        </span>
      )}
    </Link>
  );
}
```

### 5g. Updates to Existing DogVenueCard

Add optional props to the existing `DogVenueCard` in `web/app/[portal]/_components/dog/DogCard.tsx`:

```typescript
export function DogVenueCard({
  venue,
  portalSlug,
  showTags = false,      // NEW - show DogTagChips below name
  showDistance = false,   // NEW - placeholder for future geolocation
}: {
  venue: DogVenue;
  portalSlug: string;
  showTags?: boolean;
  showDistance?: boolean;
}) {
  // ... existing render, add after venue name:
  // {showTags && <DogTagChips vibes={venue.vibes} maxTags={3} />}
}
```

---

## 6. Feed Section Updates

### Updated DogFeed.tsx

The existing `DogFeed.tsx` needs these changes:

1. **Import `DogSectionHeader`** and use it instead of bare `<h2>`.
2. **Import `DogTagChips`** and pass `showTags={true}` to venue cards in relevant sections.
3. **Handle the new `subtitle` and `deepPageHref`** fields on each section.
4. **Use section key to select card variant** (cards vs rows).
5. **Import `DogCommunityCTA`** and render it at the bottom.

```typescript
// Updated section rendering in DogFeed.tsx
{sections.map((section) => (
  <section key={section.key}>
    <DogSectionHeader
      title={section.title}
      subtitle={section.subtitle}
      seeAllHref={section.deepPageHref}
      seeAllCount={section.items.length > 8 ? section.items.length : undefined}
      portalSlug={portalSlug}
    />

    {section.type === "events" ? (
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {(section.items as DogEvent[]).map((event) => (
          <DogEventCard key={event.id} event={event} portalSlug={portalSlug} />
        ))}
      </div>
    ) : section.key === "patios" || section.key === "services" ? (
      <div className="space-y-3">
        {(section.items as DogVenue[]).slice(0, 6).map((venue) => (
          <DogVenueRow key={venue.id} venue={venue} portalSlug={portalSlug} />
        ))}
      </div>
    ) : (
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {(section.items as DogVenue[]).map((venue) => (
          <DogVenueCard
            key={venue.id}
            venue={venue}
            portalSlug={portalSlug}
            showTags={["off_leash", "pup_cups", "trails"].includes(section.key)}
          />
        ))}
      </div>
    )}
  </section>
))}
```

---

## 7. Tag Vocabulary Constants

### File: `web/lib/dog-tags.ts`

This is the single source of truth for all dog-related tag metadata.

```typescript
/**
 * Dog portal tag vocabulary.
 *
 * All allowed vibes for dog venue tagging, their display info,
 * category grouping, and validation.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type DogTagCategory =
  | "base"
  | "amenities"
  | "access"
  | "food"
  | "surface"
  | "services"
  | "events";

export type DogTagInfo = {
  machineKey: string;
  label: string;
  icon: string;
  category: DogTagCategory;
};

export type DogTagGroup = {
  key: DogTagCategory;
  label: string;
  tags: DogTagInfo[];
};

/* ------------------------------------------------------------------ */
/*  Tag Registry                                                       */
/* ------------------------------------------------------------------ */

export const DOG_TAGS: DogTagInfo[] = [
  // Base
  { machineKey: "dog-friendly", label: "Dog-Friendly", icon: "\uD83D\uDC15", category: "base" },

  // Amenities
  { machineKey: "water-bowls", label: "Water Bowls", icon: "\uD83D\uDCA7", category: "amenities" },
  { machineKey: "dog-wash", label: "Dog Wash Station", icon: "\uD83D\uDEBF", category: "amenities" },
  { machineKey: "shade", label: "Shaded Area", icon: "\uD83C\uDF33", category: "amenities" },
  { machineKey: "benches", label: "Seating", icon: "\uD83E\uDE91", category: "amenities" },
  { machineKey: "parking", label: "Parking Available", icon: "\uD83C\uDD7F\uFE0F", category: "amenities" },
  { machineKey: "water-access", label: "Water Access", icon: "\uD83C\uDFCA", category: "amenities" },
  { machineKey: "agility-equipment", label: "Agility Equipment", icon: "\uD83C\uDFC3", category: "amenities" },

  // Access
  { machineKey: "off-leash", label: "Off-Leash Area", icon: "\uD83E\uDDAE", category: "access" },
  { machineKey: "leash-required", label: "Leash Required", icon: "\uD83D\uDD17", category: "access" },
  { machineKey: "fenced", label: "Fully Fenced", icon: "\uD83D\uDEA7", category: "access" },
  { machineKey: "unfenced", label: "Unfenced/Open", icon: "\uD83C\uDF3E", category: "access" },
  { machineKey: "small-dog-area", label: "Small Dog Section", icon: "\uD83D\uDC15\u200D\uD83E\uDDBA", category: "access" },
  { machineKey: "large-dog-area", label: "Large Dog Section", icon: "\uD83D\uDC15", category: "access" },
  { machineKey: "indoor", label: "Indoor Space", icon: "\uD83C\uDFE0", category: "access" },
  { machineKey: "outdoor-only", label: "Outdoor Only", icon: "\u2600\uFE0F", category: "access" },

  // Food & Dining
  { machineKey: "pup-cup", label: "Pup Cup", icon: "\uD83E\uDDC1", category: "food" },
  { machineKey: "dog-menu", label: "Dog Menu", icon: "\uD83C\uDF56", category: "food" },
  { machineKey: "treats-available", label: "Treats Available", icon: "\uD83E\uDDB4", category: "food" },

  // Surface & Terrain
  { machineKey: "paved", label: "Paved Path", icon: "\uD83D\uDEE4\uFE0F", category: "surface" },
  { machineKey: "gravel", label: "Gravel", icon: "\uD83E\uDEA8", category: "surface" },
  { machineKey: "grass", label: "Grass", icon: "\uD83C\uDF31", category: "surface" },
  { machineKey: "mulch", label: "Mulch", icon: "\uD83C\uDF42", category: "surface" },
  { machineKey: "dirt-trail", label: "Dirt Trail", icon: "\uD83E\uDD7E", category: "surface" },

  // Services
  { machineKey: "emergency-vet", label: "Emergency Vet", icon: "\uD83D\uDE91", category: "services" },
  { machineKey: "boarding", label: "Boarding", icon: "\uD83D\uDECF\uFE0F", category: "services" },
  { machineKey: "grooming", label: "Grooming", icon: "\u2702\uFE0F", category: "services" },
  { machineKey: "training", label: "Training Classes", icon: "\uD83C\uDF93", category: "services" },
  { machineKey: "daycare", label: "Daycare", icon: "\uD83C\uDFEB", category: "services" },
  { machineKey: "adoption", label: "Adoption Services", icon: "\u2764\uFE0F", category: "services" },
  { machineKey: "low-cost-vet", label: "Low-Cost Vet", icon: "\uD83D\uDCB0", category: "services" },

  // Events (applied to events, not venues via tagging)
  { machineKey: "adoption-event", label: "Adoption Event", icon: "\uD83C\uDFE0", category: "events" },
  { machineKey: "yappy-hour", label: "Yappy Hour", icon: "\uD83C\uDF7A", category: "events" },
  { machineKey: "dog-training", label: "Training Class", icon: "\uD83D\uDCDA", category: "events" },
  { machineKey: "dog-social", label: "Dog Social", icon: "\uD83C\uDF89", category: "events" },
  { machineKey: "vaccination", label: "Vaccination Clinic", icon: "\uD83D\uDC89", category: "events" },
  { machineKey: "fundraiser", label: "Fundraiser", icon: "\uD83D\uDCB5", category: "events" },
];

/* ------------------------------------------------------------------ */
/*  Derived lookups                                                    */
/* ------------------------------------------------------------------ */

/** Set of all machine keys -- used for API validation */
export const ALLOWED_DOG_VIBES = new Set(
  DOG_TAGS.filter(t => t.category !== "events").map(t => t.machineKey)
);

/** Map from machine key to display info */
const TAG_MAP = new Map(DOG_TAGS.map(t => [t.machineKey, t]));

/** Get display info for a vibe key. Returns null if not a dog tag. */
export function getTagDisplayInfo(key: string): DogTagInfo | null {
  return TAG_MAP.get(key) || null;
}

/* ------------------------------------------------------------------ */
/*  Grouped tags for the tag submission modal                          */
/* ------------------------------------------------------------------ */

export const DOG_TAG_GROUPS: DogTagGroup[] = [
  {
    key: "base",
    label: "Dog-Friendly Basics",
    tags: DOG_TAGS.filter(t => t.category === "base"),
  },
  {
    key: "amenities",
    label: "Amenities",
    tags: DOG_TAGS.filter(t => t.category === "amenities"),
  },
  {
    key: "food",
    label: "Food & Treats",
    tags: DOG_TAGS.filter(t => t.category === "food"),
  },
  {
    key: "access",
    label: "Access",
    tags: DOG_TAGS.filter(t => t.category === "access"),
  },
  {
    key: "surface",
    label: "Surface & Terrain",
    tags: DOG_TAGS.filter(t => t.category === "surface"),
  },
];

/* ------------------------------------------------------------------ */
/*  Filter option sets for deep pages                                  */
/* ------------------------------------------------------------------ */

export const PARK_FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "fenced", label: "Fenced" },
  { key: "unfenced", label: "Unfenced" },
  { key: "small-dog-area", label: "Small Dog Area" },
  { key: "water-access", label: "Water Access" },
] as const;

export const SERVICE_TYPE_OPTIONS = [
  { key: "all", label: "All" },
  { key: "vet", label: "Vets" },
  { key: "groomer", label: "Groomers" },
  { key: "pet_store", label: "Pet Stores" },
  { key: "pet_daycare", label: "Daycare" },
] as const;

export const TRAINING_FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "puppy-class", label: "Puppy" },
  { key: "obedience", label: "Obedience" },
  { key: "agility", label: "Agility" },
] as const;
```

### Why a Separate File?

`dog-tags.ts` is imported by:
- **Server components** (tag display on cards and deep pages)
- **Client components** (tag modal, filter chips)
- **API route** (validation of submitted vibes)

It contains NO server-only imports (no supabase, no `server` module), so it is safe for client components.

---

## 8. Data Seeding Approach

### Strategy: SQL Migrations via Supabase

Create seeding SQL files that can be run via `supabase db push` or directly in the Supabase dashboard.

### Phase 1: Tag Existing Venues

```sql
-- seed_dog_tags_batch1.sql
-- Tag existing dog-friendly venues with structured vibes

-- Helper: merge vibes without duplicates
CREATE OR REPLACE FUNCTION merge_vibes(existing_vibes text[], new_vibes text[])
RETURNS text[] AS $$
  SELECT ARRAY(
    SELECT DISTINCT unnest(COALESCE(existing_vibes, '{}') || new_vibes)
    ORDER BY 1
  );
$$ LANGUAGE sql IMMUTABLE;

-- Tag known dog parks
UPDATE venues SET vibes = merge_vibes(vibes, ARRAY['dog-friendly', 'off-leash', 'fenced', 'small-dog-area', 'large-dog-area', 'water-bowls', 'shade', 'grass'])
WHERE name ILIKE '%piedmont%dog%park%' OR (name ILIKE '%piedmont%park%' AND venue_type = 'dog_park');

UPDATE venues SET vibes = merge_vibes(vibes, ARRAY['dog-friendly', 'off-leash', 'fenced', 'grass', 'shade'])
WHERE name ILIKE '%freedom park%off%leash%' OR name ILIKE '%freedom barkway%';

-- Tag known breweries
UPDATE venues SET vibes = merge_vibes(vibes, ARRAY['dog-friendly', 'outdoor-only', 'water-bowls'])
WHERE name ILIKE '%monday night brewing%';

UPDATE venues SET vibes = merge_vibes(vibes, ARRAY['dog-friendly', 'outdoor-only', 'water-bowls'])
WHERE name ILIKE '%orpheus brewing%';

-- ... (continue for each venue in content strategy doc)
```

### Phase 2: Insert New Venues

```sql
-- seed_dog_venues_batch1.sql
-- Add dog parks not already in the database

INSERT INTO venues (name, slug, address, neighborhood, city, state, venue_type, vibes, active, created_at, updated_at)
VALUES
  ('Newtown Dream Dog Park', 'newtown-dream-dog-park', '300 E College Ave, Decatur, GA 30030', 'Decatur', 'Decatur', 'GA', 'dog_park',
   ARRAY['dog-friendly', 'off-leash', 'fenced', 'small-dog-area', 'large-dog-area', 'agility-equipment', 'water-bowls', 'parking'],
   true, now(), now()),
  ('Brook Run Dog Park', 'brook-run-dog-park', '4770 N Peachtree Rd, Dunwoody, GA 30338', 'Dunwoody', 'Dunwoody', 'GA', 'dog_park',
   ARRAY['dog-friendly', 'off-leash', 'fenced', 'small-dog-area', 'large-dog-area', 'water-access', 'parking'],
   true, now(), now())
-- ... more inserts
ON CONFLICT (slug) DO UPDATE SET
  vibes = merge_vibes(venues.vibes, EXCLUDED.vibes),
  updated_at = now();
```

### Phase 3: Insert Shelter/Rescue Orgs

```sql
-- seed_dog_orgs.sql
INSERT INTO venues (name, slug, address, neighborhood, city, state, venue_type, short_description, website, vibes, active, created_at, updated_at)
VALUES
  ('LifeLine Animal Project', 'lifeline-animal-project', '3180 Presidential Dr, Atlanta, GA 30340', 'DeKalb County', 'Atlanta', 'GA', 'animal_shelter',
   'County partner shelter, high volume adoptions', 'https://lifelineanimal.org',
   ARRAY['adoption', 'low-cost-vet', 'vaccination'],
   true, now(), now()),
  ('Atlanta Humane Society', 'atlanta-humane-society', '981 Howell Mill Rd NW, Atlanta, GA 30318', 'West Midtown', 'Atlanta', 'GA', 'animal_shelter',
   'Atlantas oldest animal welfare organization', 'https://atlantahumane.org',
   ARRAY['adoption', 'vaccination'],
   true, now(), now())
-- ... more shelters
ON CONFLICT (slug) DO UPDATE SET
  vibes = merge_vibes(venues.vibes, EXCLUDED.vibes),
  short_description = COALESCE(EXCLUDED.short_description, venues.short_description),
  updated_at = now();
```

### Execution Order

1. Run `merge_vibes` function creation first.
2. Run `seed_dog_tags_batch1.sql` (tag existing venues).
3. Run `seed_dog_venues_batch1.sql` (add dog parks).
4. Run `seed_dog_trails.sql` (add trails).
5. Run `seed_dog_orgs.sql` (add shelters).
6. Run `seed_dog_services.sql` (add vets, groomers).
7. Run `seed_dog_pupcups.sql` (add pup cup spots + tag existing breweries).
8. Drop the `merge_vibes` function or keep for ongoing use.

### Validation

After seeding, run verification queries:

```sql
-- Count venues by type in ROMP scope
SELECT venue_type, count(*) FROM venues
WHERE 'dog-friendly' = ANY(vibes) OR venue_type IN ('dog_park', 'animal_shelter', 'vet', 'groomer', 'pet_store', 'pet_daycare')
GROUP BY venue_type ORDER BY count(*) DESC;

-- Count venues with off-leash tag
SELECT count(*) FROM venues WHERE 'off-leash' = ANY(vibes);

-- Count pup cup spots
SELECT count(*) FROM venues WHERE vibes && ARRAY['pup-cup', 'dog-menu', 'treats-available'];
```

---

## 9. Risks and Gotchas

### TypeScript / Supabase Pitfalls

1. **Supabase `never` type after `.maybeSingle()` + null check.**
   - The API route fetches a venue, checks if null, then reads `.vibes`. After the null guard, TypeScript may still infer the row type as `never`.
   - **Fix:** Cast immediately after the guard: `const existingVenue = venue as { id: number; vibes: string[] | null };`

2. **Supabase `.update()` requires `as never`.**
   - All `.update()` and `.insert()` calls with the service client need the `as never` cast on the data object.
   - **Example:** `.update({ vibes: mergedVibes } as never)`

3. **Next.js 16 `headers()` returns `Promise`.**
   - `createClient()` internally awaits `cookies()` which is fine. But if any deep page server component calls `headers()` directly, it must be awaited.

4. **`searchParams` and `params` are Promises in Next.js 16.**
   - Every `page.tsx` must `await params` and `await searchParams` before using them. Already handled in existing patterns.

### Performance Concerns

5. **`getDogFeed()` now runs 9 parallel queries instead of 5.**
   - All queries hit Supabase with `Promise.all`, so wall-clock time = slowest query.
   - Each query is small (30-50 rows max, indexed on `venue_type` and `vibes` GIN index).
   - If latency becomes an issue, consider caching the entire feed response with `unstable_cache` or Redis.

6. **Deep pages should NOT reuse `getDogFeed()`.**
   - Each deep page runs its own focused query (e.g., `getDogOffLeashParks()`). Do not fetch the entire feed just to render one section.

7. **Horizontal scroll sections render all cards (8-12) in the DOM.**
   - For V1 this is fine. If card counts grow past 20, add viewport-based lazy rendering.

### Data Quality

8. **`overlaps` vs `contains` for vibes filtering.**
   - `contains` = venue has ALL specified vibes (AND logic). Used for `getDogVenues()` (must have `dog-friendly`).
   - `overlaps` = venue has ANY of the specified vibes (OR logic). Used for `getDogPupCupSpots()` (has `pup-cup` OR `dog-menu` OR `treats-available`).
   - Mixing these up will silently return wrong results.

9. **Tag pollution risk.**
   - Users can tag any venue with any allowed vibe. A brewery could get tagged `off-leash` incorrectly.
   - V1 mitigation: Auto-approve all, plan moderation for V2.
   - Monitor: Query for implausible tag combinations monthly (e.g., `off-leash` on a `restaurant`).

10. **Venue deduplication.**
    - Seeding scripts use `ON CONFLICT (slug) DO UPDATE` to avoid duplicates.
    - Slug generation must be consistent (lowercase, hyphenated). Use the existing `slugify()` function.

### Client/Server Module Split

11. **`dog-tags.ts` must be client-importable.**
    - It cannot import from `@/lib/supabase/server` or any server-only module.
    - It only exports constants and pure functions. This is safe.

12. **`DogTagModal` and `DogFilterChips` are `"use client"` components.**
    - They must import from `dog-tags.ts` (client-safe), NOT from `dog-data.ts` (server-only).
    - If a server component needs both tag info and data, import each from its respective module.

### Edge Cases

13. **Empty sections in feed.**
    - If a section has fewer than 3 items (threshold from UX doc), it should not render.
    - Exception: "Adopt" renders even with 0 events if there are org profiles. Handle this in `getDogFeed()` by adding an `adopt` section regardless, and let the component check both events and orgs.

14. **Hash fragment routing for tabs.**
    - `/atl-dogs/parks#trails` needs client-side handling. The Parks page should read `window.location.hash` on mount and set the active tab.
    - Alternatively, use a search param: `/atl-dogs/parks?tab=trails` (more robust, works with SSR).
    - **Recommendation:** Use `?tab=trails` for the Parks page tab selection. Update all "See all" links for Trails section accordingly.

15. **URL param `filter` collisions.**
    - Multiple deep pages use `?filter=` or `?type=`. Since each is a different route, there is no collision. But be explicit: Parks uses `?filter=fenced`, Services uses `?type=vet`.

---

## 10. Build Order

### Phase 1: Foundation (No UI changes visible yet)

**Step 1: `web/lib/dog-tags.ts`** (0 dependencies)
- Create the tag vocabulary constants file.
- All other steps depend on this.
- Verify: `npx tsc --noEmit` passes.

**Step 2: `web/lib/dog-data.ts` updates** (depends on Step 1)
- Add `VENUE_SELECT_EXTENDED`.
- Add all 7 new query functions.
- Update `DogFeedSection` type with `subtitle` and `deepPageHref`.
- Update `getDogFeed()` with new sections.
- Verify: `npx tsc --noEmit` passes.

**Step 3: `web/lib/dog-art.ts` updates** (depends on nothing)
- Add `adoption` to `DOG_CONTENT_COLORS` and `DOG_CONTENT_EMOJI`.
- Update `classifyDogContentType` to handle new venue types (`animal_shelter`, `pet_daycare`).
- Verify: `npx tsc --noEmit` passes.

### Phase 2: API Route

**Step 4: `web/app/api/tag-venue/route.ts`** (depends on Step 1)
- Create the tagging endpoint.
- Test with `curl` or Postman:
  ```bash
  curl -X POST http://localhost:3000/api/tag-venue \
    -H "Content-Type: application/json" \
    -H "Cookie: <auth-cookie>" \
    -d '{"venue_id": 123, "vibes": ["dog-friendly", "water-bowls"]}'
  ```
- Verify: 401 without auth, 400 with invalid vibes, 200 with valid payload.

### Phase 3: Shared Components

**Step 5: Shared dog components** (depends on Steps 1, 3)
- Create in this order (each is standalone):
  1. `DogEmptyState.tsx`
  2. `DogTagChips.tsx`
  3. `DogSectionHeader.tsx`
  4. `DogOrgCard.tsx`
  5. `DogFilterChips.tsx`
  6. `DogCommunityCTA.tsx`
- Verify: `npx tsc --noEmit` passes after each.

### Phase 4: Feed Updates

**Step 6: Update `DogFeed.tsx`** (depends on Steps 2, 5)
- Replace `<h2>` with `DogSectionHeader`.
- Add `showTags` prop usage on venue cards.
- Handle new section keys.
- Verify: Dev server renders `/atl-dogs` with new section headers.

**Step 7: Update `DogPortalExperience.tsx`** (depends on Step 6)
- Wire community CTA button to a search/tag flow (or just link to Find view for V1).

### Phase 5: Deep Page Shell + Header

**Step 8: Update `DogHeader.tsx`** (depends on nothing beyond existing code)
- Add `showBackButton` and `pageTitle` props.
- Update `isActive` logic for deep page paths.
- Verify: No regression on existing `/atl-dogs` header behavior.

**Step 9: Create `DogDeepPageShell.tsx`** (depends on Step 8)
- Shared wrapper for all deep pages.

### Phase 6: Deep Pages (can be done in parallel)

**Step 10a: Parks & Trails page** (`web/app/[portal]/parks/page.tsx`)
- Depends on Steps 2, 5, 9.
- Two-tab layout (Off-Leash / Trails) using `?tab=` param.
- Filter chips for fenced/unfenced/etc.
- Uses `getDogOffLeashParks()` and `getDogTrails()`.

**Step 10b: Pup Cups page** (`web/app/[portal]/pup-cups/page.tsx`)
- Depends on Steps 2, 5, 9.
- Grid of venue cards, optional neighborhood filter.
- Uses `getDogPupCupSpots()`.

**Step 10c: Adoption page** (`web/app/[portal]/adopt/page.tsx`)
- Depends on Steps 2, 5, 9.
- Two sections: org profiles (DogOrgCard) + adoption events.
- Uses `getDogAdoptionOrgs()` and `getDogAdoptionEvents()`.

**Step 10d: Training page** (`web/app/[portal]/training/page.tsx`)
- Depends on Steps 2, 5, 9.
- Filter chips for class type.
- Uses `getDogTrainingEvents()` and `getDogTrainingFacilities()`.

**Step 10e: Services page** (`web/app/[portal]/services/page.tsx`)
- Depends on Steps 2, 5, 9.
- Tab filters for vet/groomer/pet store/daycare.
- Open Now toggle (uses `isSpotOpen` from `spots-constants.ts`).
- Uses `getDogServices()`.

### Phase 7: Tag Submission UI

**Step 11: `DogTagModal.tsx`** (depends on Steps 1, 4)
- Client component with auth check, conditional tag groups, form submission.
- Integrate into venue detail pages (or as a standalone entry point from community CTA).
- This is the most complex client component -- build and test in isolation first.

### Phase 8: Data Seeding

**Step 12: SQL seed scripts** (can run anytime after Step 1)
- Write and execute seed SQL in order specified in Section 8.
- Verify feed populates correctly.
- This can run in parallel with any UI work.

### Phase 9: Polish

**Step 13: Feed-level filter chips** (optional V1)
- Sticky filter bar at top of feed.
- Lower priority -- can ship without this.

**Step 14: End-to-end testing**
- `npx tsc --noEmit` to catch all type errors.
- Manual test all 5 deep pages at `/atl-dogs/parks`, etc.
- Test 404 behavior at `/atlanta/parks` (should 404).
- Test tag submission flow end-to-end (login -> tag -> verify update).
- Test mobile bottom nav persistence across deep pages.
- Verify `revalidate = 60` works (page caches, refreshes after 60s).

---

## Dependency Graph Summary

```
dog-tags.ts (Step 1)
  ├── dog-data.ts updates (Step 2)
  │     └── DogFeed.tsx update (Step 6)
  │           └── DogPortalExperience.tsx (Step 7)
  ├── tag-venue API (Step 4)
  │     └── DogTagModal.tsx (Step 11)
  ├── Shared components (Step 5)
  │     ├── DogFeed.tsx update (Step 6)
  │     └── All deep pages (Steps 10a-10e)
  └── dog-art.ts updates (Step 3)

DogHeader.tsx update (Step 8)
  └── DogDeepPageShell.tsx (Step 9)
        └── All deep pages (Steps 10a-10e)

SQL seed scripts (Step 12) -- parallel with everything
```

---

## Appendix A: Deep Page Skeleton Example

Each deep page follows this exact structure. Here is the Parks page as reference:

```typescript
// web/app/[portal]/parks/page.tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { isDogPortal } from "@/lib/dog-art";
import { getDogOffLeashParks, getDogTrails } from "@/lib/dog-data";
import DogDeepPageShell from "../_components/dog/DogDeepPageShell";
import DogFilterChips from "../_components/dog/DogFilterChips";
import { DogVenueCard } from "../_components/dog/DogCard";
import DogEmptyState from "../_components/dog/DogEmptyState";
import DogTagChips from "../_components/dog/DogTagChips";
import { PARK_FILTER_OPTIONS } from "@/lib/dog-tags";
import type { DogVenue } from "@/lib/dog-data";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ tab?: string; filter?: string }>;
};

export default async function DogParksPage({ params, searchParams }: Props) {
  const { portal: portalSlug } = await params;
  const searchParamsData = await searchParams;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const vertical = getPortalVertical(portal);
  if (vertical !== "dog" && !isDogPortal(portal.slug)) notFound();

  const activeTab = searchParamsData.tab === "trails" ? "trails" : "off-leash";
  const activeFilter = searchParamsData.filter || "all";

  const [offLeashParks, trails] = await Promise.all([
    getDogOffLeashParks(50),
    getDogTrails(50),
  ]);

  const venues = activeTab === "trails" ? trails : offLeashParks;

  // Apply client-side filter (vibes-based)
  const filtered = activeFilter === "all"
    ? venues
    : venues.filter((v: DogVenue) => v.vibes?.includes(activeFilter));

  return (
    <DogDeepPageShell portalSlug={portalSlug} pageTitle="Parks & Trails">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <TabLink href={`/${portalSlug}/parks`} active={activeTab === "off-leash"}>Off-Leash</TabLink>
        <TabLink href={`/${portalSlug}/parks?tab=trails`} active={activeTab === "trails"}>Trails</TabLink>
      </div>

      {/* Filters */}
      {activeTab === "off-leash" && (
        <Suspense fallback={null}>
          <DogFilterChips
            paramName="filter"
            options={[...PARK_FILTER_OPTIONS]}
          />
        </Suspense>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <DogEmptyState
          emoji="\uD83D\uDC15"
          headline={activeFilter !== "all" ? "No spots match your filters" : "No off-leash parks found nearby"}
          body={activeFilter !== "all" ? undefined : "We're building our map. Know one?"}
          ctaLabel={activeFilter !== "all" ? "Clear filters" : "Tag a park"}
          ctaHref={activeFilter !== "all" ? `/${portalSlug}/parks` : `/${portalSlug}?view=find`}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {filtered.map((venue: DogVenue) => (
            <DogVenueCard
              key={venue.id}
              venue={venue}
              portalSlug={portalSlug}
              showTags
            />
          ))}
        </div>
      )}
    </DogDeepPageShell>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
      style={{
        background: active ? "var(--dog-orange)" : "rgba(253, 232, 138, 0.25)",
        color: active ? "#fff" : "var(--dog-charcoal)",
      }}
    >
      {children}
    </a>
  );
}
```

---

## Appendix B: Pre-Implementation Checklist

Before starting implementation, verify:

- [ ] `web/lib/supabase/server.ts` exports `createClient` (used by `withAuth`)
- [ ] `web/lib/supabase/service.ts` exports `createServiceClient` (used by API route)
- [ ] `web/lib/user-utils.ts` exports `ensureUserProfile` (used by API route)
- [ ] `web/lib/api-middleware.ts` exports `withAuth` (confirmed in current code)
- [ ] `web/lib/rate-limit.ts` exports `applyRateLimit`, `RATE_LIMITS`, `getClientIdentifier`
- [ ] `web/lib/api-utils.ts` exports `checkBodySize`, `validationError`
- [ ] `web/lib/logger.ts` exports `logger` with `.error()` method
- [ ] Supabase `venues` table has a GIN index on the `vibes` column (required for `overlaps` and `contains` performance)
- [ ] Run `npx tsc --noEmit` from `web/` to confirm clean baseline before any changes

---

## Appendix C: TypeScript Type Verification Commands

Run these after each phase to catch issues early:

```bash
# From web/ directory
npx tsc --noEmit                    # Full type check
npx tsc --noEmit --incremental      # Faster incremental check
npm run build                        # Full production build (catches everything)
```

Common errors to watch for:
- `Type 'never' is not assignable to...` -- Cast after Supabase null guards
- `Property 'X' does not exist on type...` -- Missing optional field in DogVenue type
- `Argument of type '...' is not assignable to parameter of type 'never'` -- Missing `as never` on insert/update
