---
name: Arts Portal Research & Open Calls Wedge
description: Research findings on Atlanta arts scene + design decisions for Lost Arts portal, Open Calls as adoption wedge
type: project
---

## Research Findings (2026-03-23)

**Structural reality:** Funding collapsing (NEA cuts, Georgia near-last in arts funding, Fulton County grants halved). Art Papers closing 2026. MINT Gallery evicted 19 artists in 8 days (Aug 2024). Goat Farm has 1,218-person studio waitlist. Mid-career artists leave for NYC/LA.

**Why:** Atlanta is "culturally vibrant, structurally underserved" (ArtReview, Hyperallergic). DIY production culture is strong. Documentation infrastructure (critics, archives) is crumbling. Art Papers closing creates a documentation vacuum.

**Three genuine gaps:**
1. **Open Calls aggregation** — Burnaway does monthly manual roundups. No automated, real-time, local-level aggregation exists. Highest-frequency use case for artists.
2. **Exhibition Record / Living CV** — No place to look up an Atlanta artist's show history. Artists maintain CVs in PDFs. Galleries don't aggregate. Art Papers was closest to record-of-record.
3. **Studio/Workspace Directory** — Scattered small studios discovered by word of mouth. No central view of availability, waitlists, application processes.

**What would make artists reject it:**
- Wrong data (tight community, trust is everything, destroyed faster than built)
- Monetizing artists (financial pressure from every direction)
- Ignoring Black arts ecosystem (parallel, substantial, often invisible in coverage)
- Being just another events calendar (ArtsATL, GULCH, Google exist)
- Social networking features (everyone already knows everyone)

**Key sources:** ArtsATL, Burnaway, The Bakery ATL, Art Papers, Atlanta Magazine, The Art Newspaper, Hyperallergic, WABE, Rough Draft Atlanta, ArtReview.

## Design Decisions Locked

**Open Calls is the wedge feature** — why artists show up first. Highest frequency, lowest cold start risk, useful from day one with 10 listings.

**Confidence tiers (not curation):**
- **Verified** — crawled from issuing org's website (source is the authority)
- **Aggregated** — found on reputable aggregator (CaFE, EntryThingy, Submittable)
- **Discovered** — found via social, newsletters, less structured sources

**Disciplines:** Visual + performing arts. Film/writing included when organically discovered from local sources, but not actively targeted (they have their own national pipelines — FilmFreeway, Submittable for lit journals).

**Personal pipeline (A+B model):**
- A (launch): Listings with deadlines, confidence tiers, click-through to source, filterable by discipline/deadline/type
- B (launch): Save/watch opportunities, deadline reminders, mark "applied" — personal submission pipeline
- C (future, earned): Applied → accepted → exhibition auto-links to Living CV. Requires org participation or reliable matching.

**Opportunity types:** Gallery exhibitions, juried shows, residencies, grants, fellowships, public art commissions, performing arts calls.

**Ships as part of full Arts portal** (not standalone). All 5 screens together: Open Calls Board, Feed/Discovery, Exhibition Detail, Artist Profile/Living CV, Studios & Workspaces.

**Anti-features confirmed:** No social comments, no artist networking, no sales/marketplace, no monetizing artists.

**How to apply:** Open Calls leads adoption strategy. Exhibition data and artist profiles are retention layers that build over time. Studios is practical utility. Data accuracy is trust-critical — confidence tiers are the honesty mechanism.
