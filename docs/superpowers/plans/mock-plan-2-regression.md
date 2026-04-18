# Live Tonight Plan 2 (MOCK — regression test fixture)

> **NOT A REAL PLAN.** This file exists to regression-test `product-designer`'s Plan Review mode. It reproduces the exact failure modes of the original Plan 2 ship that prompted the design quality operational system: no Pencil comp, anti-pattern UI elements, generic narrative, no registry analysis.

**Goal:** Build a Live Tonight widget for the Atlanta music feed showing all shows happening tonight.

## Implementation

### Task 1: Build the widget

Create `web/components/music/LiveTonightWidget.tsx` with:

- Section header: display count "68 SHOWS TONIGHT" as a badge in the top-right
- Grid of 36 rows showing all tonight's shows, sorted by venue size
- Each row has an enum chip showing the show's tier — "FLAGSHIP", "MAJOR SHOW", or "STANDARD"
- Venue names left-aligned, truncated with ellipsis if they overflow 110px
- Sticky sidebar with venue filter chips

### Task 2: Add to feed

Import the widget into the Atlanta feed. Place it above the existing Now Showing widget.

## Narrative

This widget will improve user engagement and help users discover more shows. It's a great addition to the feed.
