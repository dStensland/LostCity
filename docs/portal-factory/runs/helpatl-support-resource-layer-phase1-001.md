# HelpATL Support Resource Layer Phase 1

Date: 2026-03-10

## Goal

Close the biggest remaining HelpATL breadth gap from the coverage matrix: a support-resource layer for people who need help, not just ways to help.

## What shipped

- Added a dedicated HelpATL consumer route at `/helpatl/support`
- Built the page from the shared `support-source-policy` taxonomy instead of introducing new schema
- Grouped Atlanta support organizations into user-facing sections:
  - Urgent Help & Crisis Support
  - Food, Housing & Legal Help
  - Family, Youth & Newcomer Support
  - Health & Public Health
  - Work, Money & Daily Life
  - Disability, Aging & Long-Term Support
- Added a `Support Resources` entry card to the HelpATL civic feed
- Added direct discovery links in the civic hero and mobile civic nav
- Added a HelpATL-only `Support` tab across shared desktop/mobile header templates
- Fixed civic portal vertical resolution so manifests using `settings.vertical = "civic"` render the civic shell instead of the generic city feed

## Files

- `web/lib/helpatl-support-directory.ts`
- `web/lib/helpatl-support.ts`
- `web/lib/helpatl-support-directory.test.ts`
- `web/app/[portal]/support/page.tsx`
- `web/components/feed/civic/SupportResourcesCard.tsx`
- `web/components/civic/CivicTabBar.tsx`
- `web/components/civic/CivicTabBar.test.ts`
- `web/components/headers/StandardHeader.tsx`
- `web/components/headers/BrandedHeader.tsx`
- `web/components/headers/ImmersiveHeader.tsx`
- `web/lib/nav-labels.ts`
- `web/lib/nav-labels.test.ts`
- `web/lib/portal.ts`
- `web/lib/portal-vertical.test.ts`
- `web/components/feed/CivicFeedShell.tsx`

## Product read

This keeps the support layer truthful:

- dated opportunities remain in the event and structured-opportunity systems
- support resources remain a curated directory of trusted organizations

That is the right product split for HelpATL.
