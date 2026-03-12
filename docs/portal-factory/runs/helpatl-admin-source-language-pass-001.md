# HelpATL Admin Source Language Pass 001

Date: 2026-03-10
Owner: Codex
Scope: Admin surface terminology cleanup

## Why this run happened

The platform docs and tooling now distinguish between:

- `Live Event Sources`
- `Ongoing Opportunity Sources`

The admin UI was still using lower-level subscription language, which made the model harder for operators to understand.

## Updated surfaces

- `/Users/coach/Projects/LostCity/web/app/[portal]/admin/subscriptions/page.tsx`
- `/Users/coach/Projects/LostCity/web/app/[portal]/admin/page.tsx`
- `/Users/coach/Projects/LostCity/web/app/admin/federation/page.tsx`

## What changed

### Portal admin subscriptions screen

- renamed the page from `Subscriptions` to `Live Event Sources`
- clarified that this screen manages dated feeds and live calendars
- added a note explaining that `Ongoing Opportunity Sources` are managed separately
- changed action language from `Subscribe/Unsubscribe` to `Add/Remove`

### Portal admin dashboard

- renamed the summary stat from `Active Subscriptions` to `Live Event Sources`
- updated quick-action copy and federation help text to explain the split

### Global federation dashboard

- clarified that `Subscriptions` means live event subscriptions
- updated overview copy to reflect ownership, sharing, live event subscriptions, and portal access

## Verification

Passed:

```bash
cd /Users/coach/Projects/LostCity/web
npm run lint -- 'app/[portal]/admin/subscriptions/page.tsx' 'app/[portal]/admin/page.tsx' 'app/admin/federation/page.tsx'
```

## Residual gap

This is copy only. The next deeper operator improvement would be a dedicated admin view for `Ongoing Opportunity Sources` so they are visible as a first-class inventory instead of only being explained in text.
