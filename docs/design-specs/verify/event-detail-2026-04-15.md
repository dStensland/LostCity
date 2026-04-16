# Visual Verification: Event Detail Page

**Reference:** Pencil comp `LhPKq` (Event Concert — Mobile)
**Live:** http://localhost:3000/atlanta/events/180518
**Date:** 2026-04-15
**Viewport:** Desktop 1440px (mobile resize unavailable — Chrome window constraint)
**Note:** Verified at desktop width. The two-column DetailShell layout is visible (340px sidebar + fluid content). Mobile stacking not verified in this pass.

## Reference
See `docs/design-specs/screenshots/event-concert-mobile.png` and Pencil node `LhPKq`.

## Verified Elements

### Correct
- Section headers: mono uppercase with Phosphor icon + label + count badge ✓
- Section dividers: 8px `--night` bands between sections ✓
- Title: large bold cream text (~26px) ✓
- VenueRow: separate row with coral MapPin icon + venue·neighborhood text ✓
- DateRow: separate row with muted CalendarBlank icon + date/time text ✓
- No genre pills in identity zone ✓
- CTA button: pill-shaped (rounded-[22px]), coral, with Ticket icon + "Get Tickets" label ✓
- RSVP circle button: in same row as CTA, twilight border, hand-waving icon ✓
- Secondary actions: save/invite/calendar/share as 40px square buttons below CTA ✓
- ConnectionsSection: Phosphor icons (MapPin for org/venue, Repeat for series) in twilight icon boxes ✓
- Connection rows: `--night` background, no border on standard rows, arrow-right icons ✓
- GettingThere: address text visible at top of card ✓
- AboutSection: description text with mono "ABOUT" header ✓
- ShowSignalsSection: show/ends/tickets grid with mono labels ✓

### Critical
- **"Who's Going" orphaned header.** Section header renders but no content below it. The trait `hasSocialData` returns true for all events, but `SocialProofSection` renders nothing when there's no social data to show. Either the trait needs to check for actual data, or the section needs to render an empty state instead of null.

### Major
- None visible at desktop width.

### Minor
- **Hero fallback icon very faint.** The category icon dots in the hero fallback are barely visible. Spec calls for 64px icon at 35% opacity — the live render appears smaller/fainter. Needs manual check at mobile width.
- **PriceRow absent.** This event doesn't have price data, so the row correctly doesn't render. Not a bug, but means this event doesn't fully exercise the three-row identity pattern. Need to verify on a priced event.

### Needs Manual Check
- Mobile layout (sidebar stacking above content) — unable to verify, viewport resize didn't constrain Chrome screenshots.
- Gradient direction on hero — no image on this event, so can't verify the top-darkening gradient vs bottom-darkening.
- Film series detail page with poster hero — not tested in this pass.
- Place detail pages (cinema, restaurant) — not tested in this pass.
