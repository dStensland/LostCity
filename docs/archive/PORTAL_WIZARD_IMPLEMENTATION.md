# Portal Onboarding Wizard - Implementation Summary

**Date**: 2026-02-10
**Status**: Complete ✅
**Reference**: `prds/002-portal-onboarding-wizard.md`

## Overview

Implemented a multi-step wizard for creating portals through a guided onboarding flow. The wizard replaces the old single-modal portal creation with a 5-step process that demonstrates the "bespoke in minutes" value proposition.

## Files Created

### Core Wizard
- `/web/app/admin/portals/create/page.tsx` - Main wizard container with step navigation
- `/web/lib/vertical-templates.ts` - Vertical-specific portal templates

### Step Components
- `/web/app/admin/portals/create/steps/IdentityStep.tsx` - Step 1: Name, slug, type, vertical
- `/web/app/admin/portals/create/steps/AudienceStep.tsx` - Step 2: City, radius, neighborhoods, categories
- `/web/app/admin/portals/create/steps/BrandingStep.tsx` - Step 3: Visual preset, theme, colors, logo
- `/web/app/admin/portals/create/steps/SectionsStep.tsx` - Step 4: Section templates and ordering
- `/web/app/admin/portals/create/steps/ReviewStep.tsx` - Step 5: Summary and launch

## Files Modified
- `/web/app/admin/portals/page.tsx` - Removed old modal, added link to wizard

## Features Implemented

### Step 1: Identity
- Portal name with live slug preview
- Portal type selection (city/event/business/personal)
- Vertical template selection (city/hotel/film/community)
- Tagline (optional)
- **Creates portal as draft** via POST `/api/admin/portals`
- Pre-fills subsequent steps with vertical template defaults

### Step 2: Audience & Location
- City dropdown (Atlanta/Nashville/Denver)
- Geo radius slider (1-50km)
- Neighborhood multi-select (Atlanta only, uses `PREFERENCE_NEIGHBORHOOD_NAMES`)
- Category focus pills (optional filtering)
- Updates portal filters via PATCH `/api/admin/portals/[id]`

### Step 3: Branding
- Visual preset grid (4 featured presets: default, cosmic_dark, corporate_clean, vibrant_community)
- Live color preview for each preset
- Light/dark theme toggle
- Primary color override with color picker
- Logo URL input
- Updates portal branding via PATCH `/api/admin/portals/[id]`

### Step 4: Sections
- Pre-built section templates (tonight, this-weekend, popular, free-events, nearby-venues, our-picks)
- Checkbox selection with auto/curated badges
- Drag-to-reorder (up/down arrows)
- Creates sections via POST `/api/admin/portals/[id]/sections`

### Step 5: Review
- Summary cards showing all configuration choices
- Preview URL (with `?preview=true` flag)
- Launch button sets `status: "active"` via PATCH
- Redirects to portal settings on completion

## Vertical Templates

Defined in `/web/lib/vertical-templates.ts`:

| Vertical | Portal Type | Visual Preset | Default Sections |
|----------|-------------|---------------|------------------|
| **City Guide** | city | default | tonight, this-weekend, popular, free-events |
| **Hotel Concierge** | business | cosmic_dark | our-picks, tonight, nearby-dining, drinks |
| **Film & Arts** | event | cosmic_dark | this-week, screenings, galleries, performances |
| **Community** | personal | vibrant_community | this-weekend, free-events, local-venues |

Each template includes:
- Default filters (categories, neighborhoods)
- Pre-configured sections with auto-filters
- Recommended visual preset

## Technical Details

### State Management
- Client-side React state with `useState`
- Portal created as `status: "draft"` on Step 1
- Each subsequent step PATCHes the portal
- Draft persists in database (can resume later)

### API Integration
- Uses existing `POST /api/admin/portals` for creation
- Uses existing `PATCH /api/admin/portals/[id]` for updates
- Uses existing `POST /api/admin/portals/[id]/sections` for sections
- Rate limited via `RATE_LIMITS.write`
- Admin auth required via `canManagePortal()`

### Validation
- TypeScript strict typing throughout
- Required fields enforced (name, slug)
- Slug auto-generated from name
- Color validation via `<input type="color">`
- Section ordering tracked via `display_order`

## What's NOT Included (Future Enhancements)

From the PRD "Nice-to-Have" section:
- Collaborative setup (team invites during wizard)
- Source subscription step (auto-subscribe to event sources)
- Custom domain setup (DNS configuration inline)
- Import existing content (CSV/iCal import)
- Map-based geo picker (click-on-map to set center)
- Full portal preview renderer (embedded iframe preview)

## Usage

1. Navigate to `/admin/portals`
2. Click "+ New Portal"
3. Complete 5 steps:
   - **Identity**: Name, slug, type, vertical
   - **Audience**: City, radius, neighborhoods, categories
   - **Branding**: Visual preset, theme, colors
   - **Sections**: Select and order content sections
   - **Review**: Preview and launch
4. Portal created and redirected to settings

## Demo Flow (3 minutes)

Example: Creating FORTH Hotel portal
1. Identity: "FORTH Hotel", business type, hotel vertical
2. Audience: Atlanta, 3km radius from Midtown
3. Branding: Cosmic Dark preset, upload logo, adjust accent color
4. Sections: Pre-filled with hotel template, reorder "Our Picks" to top
5. Review: Preview, launch

**Result**: `forth.lostcity.app` live in <3 minutes

## Testing Checklist

- [x] TypeScript compiles without errors (`npx tsc --noEmit`)
- [x] Next.js build succeeds (`npm run build`)
- [x] Route exists at `/admin/portals/create`
- [x] All step components render
- [x] Admin auth required (uses existing layout)
- [x] Creates draft portal on Step 1
- [x] Updates portal on each step
- [x] Sets status to "active" on launch
- [ ] Manual testing: Create a portal end-to-end
- [ ] Manual testing: Verify sections created correctly
- [ ] Manual testing: Verify filters applied
- [ ] Manual testing: Verify branding applied

## Next Steps

1. Manual QA: Create a test portal through the wizard
2. Fix any UX issues discovered
3. Add analytics tracking (track wizard completion rate)
4. Consider adding:
   - Draft resume feature (show existing drafts on entry)
   - Skip step option (for power users)
   - Duplicate existing portal feature
   - Template marketplace (share/import templates)
