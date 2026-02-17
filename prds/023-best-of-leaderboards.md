# PRD 023: Best Of Leaderboards

**Status:** Draft
**Created:** 2026-02-16
**Owner:** Product
**Epic:** Community — Best Of Rankings & Venue Leaderboards

---

## Executive Summary

"Best Of" Leaderboards turn passive venue data (RSVPs, tags, event activity, saves, follows) into an active community competition. Users see algorithmically-ranked contenders for categories like "Best Dive Bar" or "Best Brunch Spot," then vote and "Make Your Case" with persuasive blurbs. The result is a living, community-driven ranking system that generates high-quality UGC, drives recurring engagement, and produces SEO-rich content.

**Position in the app:**
- **Feed** = temporal ("what's happening tonight")
- **Explore Tracks** = editorial/curatorial ("what makes Atlanta, Atlanta")
- **Best Of** = community-ranked ("what's the BEST, and why")
- **Find** = utilitarian directory ("search and filter everything")

Explore Tracks are top-down editorial; Best Of is bottom-up community voice. They complement each other.

---

## Problem Statement

1. **Passive engagement** — Users save, RSVP, and follow venues but there's no channel for expressing *opinions* about venues beyond tagging
2. **No venue reputation layer** — No way to surface "this place is beloved" vs. "this place exists"
3. **Lists are half-baked** — Community lists exist (tables: `lists`, `list_items`, `list_votes`) but lack competitive energy and structured categories
4. **Discovery is editorial-only** — Explore tracks provide curation but no community voice in ranking
5. **SEO gap** — "Best dive bar in Atlanta" is a high-intent search query with no owned content to serve
6. **UGC quality** — Tags are useful but low-effort; there's no mechanism for thoughtful, persuasive venue advocacy

---

## Design Principles

### Emotional Register
**Opinionated, competitive, fun.** Reference: Hot Ones rankings, Yelp "Best Of" but with personality. Anti-reference: sterile review sites.

### Core Tension
The magic is in the **debate**. People have strong opinions about their city's best spots. The system should feel like a friendly argument at a bar, not a corporate survey.

### Scoring Philosophy
**Algorithmic floor, community ceiling.** The algorithm uses existing signals to establish credible baseline rankings. Community votes and "Make Your Case" blurbs push contenders up (or keep them honest). This prevents empty leaderboards on day one and gaming on day 100.

---

## Feature Design

### 1. Categories

Categories are curated (not user-created, at least in V1) to ensure quality and SEO value.

**Starter categories (launch set):**

| Category | Slug | Venue Filter |
|---|---|---|
| Best Dive Bar | `best-dive-bar` | venue_type: bar, tags: dive-bar/cash-only/no-frills |
| Best Brunch Spot | `best-brunch` | venue_type: restaurant, tags: brunch |
| Best Date Night | `best-date-night` | tags: date-night/romantic/intimate |
| Best Rooftop | `best-rooftop` | tags: rooftop/skyline-views |
| Best Live Music Venue | `best-live-music` | venue_type: music_venue OR tags: live-music |
| Best Patio | `best-patio` | tags: patio/outdoor-seating |
| Best Happy Hour | `best-happy-hour` | tags: happy-hour/drink-specials |
| Best Late Night | `best-late-night` | tags: late-night/after-midnight |
| Best Neighborhood Gem | `best-hidden-gem` | tags: hidden-gem/neighborhood-favorite |
| Best New Spot | `best-new-spot` | venues created in last 12 months |

**Future categories** (user-suggested, admin-approved):
- Best BBQ, Best Pizza, Best Coffee, Best Cocktail Bar, Best Art Gallery, Best Dog-Friendly Spot, etc.

**Category structure:**
- Each category has a `slug`, `name`, `description`, `icon`, `venue_filter` (JSON query definition), and `is_active` flag
- Categories can be seasonal (e.g., "Best NYE Party" only active in December)
- Portal-scoped: each portal can have its own category set (Atlanta vs Nashville)

### 2. Scoring Model

Venue score within a category = **Algorithm Score + Community Score**

#### Algorithm Score (max ~100 points, computed from existing data)

| Signal | Points | Source Table | Notes |
|---|---|---|---|
| Follower count | 2 pts each (cap 20) | `follows` | Capped to prevent runaway |
| Save count | 1 pt each (cap 15) | `saved_items` | |
| Recommendation count | 3 pts each (cap 15) | `recommendations` | Strongest existing signal |
| Upcoming event count | 0.5 pts each (cap 10) | `events` | Active venues rank higher |
| RSVP volume (30 days) | 0.25 pts each (cap 10) | `event_rsvps` | Recent engagement |
| Positive tag score | 0.5 pts per net score (cap 15) | `venue_tag_summary` | vibes + amenities + good_for |
| Negative tag penalty | -1 pt per net score | `venue_tag_summary` | heads_up group |
| Explore track appearances | 3 pts each (cap 9) | `explore_track_venues` | Editorial endorsement |
| Community list appearances | 1 pt each (cap 5) | `list_items` | |

*Category-relevant signals get boosted.* Example: for "Best Live Music Venue," RSVP count on music events at that venue gets 2x weight. For "Best Dive Bar," the `dive-bar` tag score gets 3x. This is defined per-category in `category_signal_weights` JSON.

#### Community Score (uncapped, from direct engagement)

| Signal | Points | Notes |
|---|---|---|
| Upvote in category | +1 pt | One vote per user per venue per category |
| "Make Your Case" blurb | +3 pts (existence) + upvotes on the case | Incentivizes writing |
| Case upvotes | +0.5 pts each | Community validates the argument |

#### Score Refresh
- Algorithm score: **materialized view, refreshed every 6 hours** (or on-demand via admin)
- Community score: **real-time** (optimistic updates on vote/case actions)
- Combined score: algorithm + community, displayed as a single rank

#### Anti-Gaming
- One vote per user per venue per category (enforced by unique constraint)
- One "Make Your Case" per user per venue per category
- Account must be 24+ hours old to vote (prevents sock puppets)
- Rate limit: max 20 votes per hour per user
- Flagging system for abusive cases (reuse existing flag infrastructure)

### 3. "Make Your Case" — The Killer Feature

This is the heart of the social mechanic. When a user votes for a venue in a category, they can optionally write a short, persuasive blurb explaining *why* this place is the best.

**Constraints:**
- 30-280 characters (tweet-length — forces punchy writing)
- One case per user per venue per category
- Can be edited (but edit history preserved)
- Can be upvoted by others (upvotes add to venue's community score)
- Can be flagged (spam, offensive — reuse existing flag reasons)
- Displayed on the leaderboard below the venue name

**Examples of great cases:**
- "The bathroom graffiti alone is worth the trip. $3 PBR, jukebox that still takes quarters, and bartenders who remember your name." (Best Dive Bar)
- "Saturday morning, patio seat, shrimp and grits with a spicy Bloody Mary. Nothing else matters." (Best Brunch)
- "I proposed here. She said yes. The rooftop sunset had something to do with it." (Best Date Night)

**Display:**
- Top 3 most-upvoted cases shown on the leaderboard card
- Full case list accessible via "See all cases" expandable
- Author shown as `UserAvatar` + username (links to profile)
- "Was this helpful?" upvote button on each case

### 4. Leaderboard Display

#### List View (default)
```
#1  The Clermont Lounge                    ████████████ 87pts
    Dive Bar · East Atlanta · 12 votes
    "If you haven't been to the Clermont, you haven't been to Atlanta."
    — @divebar_dan (42 upvotes)

#2  Trader Vic's                           ██████████░░ 74pts
    Dive Bar · Downtown · 9 votes
    "Cash only, no menu, bartender picks your drink. Trust the process."
    — @atlnightowl (28 upvotes)

#3  Johnny's Hideaway                      █████████░░░ 68pts
    Dive Bar · Buckhead · 7 votes
    ...
```

#### Category Header
- Category name + icon
- Total votes cast ("1,247 Atlantans have weighed in")
- Last updated timestamp
- "Vote" CTA button (scrolls to venue picker if user hasn't voted)

#### Venue Card (within leaderboard)
- Rank number (large, accent-colored)
- Venue name + neighborhood + venue type
- Score bar (visual, not numeric — keeps it fun, not clinical)
- Top case quote + author
- Vote button (toggle — "I voted" state)
- "Make Your Case" button (if voted but no case yet)

#### Your Activity
- Highlight venues you've voted for with a subtle "Your pick" badge
- If you wrote a case, show it inline with an edit button
- "You voted in 4 of 10 categories" progress indicator

### 5. User Flows

#### Discovery Flow
1. User sees "Best Of Atlanta" section (in Explore tab, or as its own tab)
2. Scrolls through category cards (horizontal scroll or grid)
3. Taps "Best Dive Bar" → sees leaderboard
4. Reads top cases, gets inspired
5. Taps "Vote" on their pick → vote recorded
6. Optional: taps "Make Your Case" → writes blurb → +3 pts to venue

#### Organic Trigger Flow
1. User visits a venue detail page
2. Sees badge: "#3 Best Dive Bar" with link
3. Taps → lands on leaderboard with that venue highlighted
4. Decides to vote/write a case

#### Post-RSVP Flow
1. User RSVPs "going" to an event at a venue
2. After RSVP share prompt (existing), sees: "Is [Venue] the best [Category]? Cast your vote"
3. One-tap vote without leaving the flow

### 6. Venue Detail Integration

On the venue detail page, show earned badges:
- "#1 Best Dive Bar" (gold badge)
- "#3 Best Late Night" (silver badge)
- Badges link to the leaderboard
- Only show top-5 placements (don't show "#47 Best Brunch")

### 7. SEO Strategy

Each category gets a public, server-rendered page:
- URL: `/atlanta/best-of/best-dive-bar`
- Title: "Best Dive Bar in Atlanta — Community Ranked | LostCity"
- Meta description pulls from top case
- Schema.org `ItemList` markup for search engines
- Canonical URL, OpenGraph tags
- These pages are the primary SEO play — high-intent local search queries

---

## Data Model

### New Tables

```sql
-- Category definitions (admin-curated)
CREATE TABLE best_of_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,                              -- emoji or icon name
  venue_filter jsonb NOT NULL DEFAULT '{}', -- filter criteria
  signal_weights jsonb NOT NULL DEFAULT '{}', -- per-category signal boosts
  portal_id int REFERENCES portals(id),   -- portal-scoped
  is_seasonal boolean DEFAULT false,
  season_start date,
  season_end date,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Community votes (one per user per venue per category)
CREATE TABLE best_of_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES best_of_categories(id) ON DELETE CASCADE,
  venue_id int NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category_id)  -- one vote per category per user
);

-- "Make Your Case" blurbs
CREATE TABLE best_of_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES best_of_categories(id) ON DELETE CASCADE,
  venue_id int NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 30 AND 280),
  upvote_count int DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'removed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category_id, venue_id)  -- one case per user per venue per category
);

-- Case upvotes
CREATE TABLE best_of_case_upvotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES best_of_cases(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, case_id)
);

-- Materialized view: algorithm scores per venue (refreshed periodically)
-- Defined separately in migration with full scoring query

-- Indexes
CREATE INDEX idx_best_of_votes_category ON best_of_votes(category_id);
CREATE INDEX idx_best_of_votes_venue ON best_of_votes(venue_id);
CREATE INDEX idx_best_of_votes_user ON best_of_votes(user_id);
CREATE INDEX idx_best_of_cases_category_venue ON best_of_cases(category_id, venue_id);
CREATE INDEX idx_best_of_cases_upvotes ON best_of_cases(upvote_count DESC);
CREATE INDEX idx_best_of_case_upvotes_case ON best_of_case_upvotes(case_id);

-- RLS
ALTER TABLE best_of_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_of_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_of_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_of_case_upvotes ENABLE ROW LEVEL SECURITY;
```

### Existing Tables Used (read-only)

| Table | Signal |
|---|---|
| `follows` (followed_venue_id) | Follower count |
| `saved_items` (venue_id) | Save count |
| `recommendations` (venue_id) | Endorsement count |
| `events` (venue_id) | Event activity |
| `event_rsvps` (via events) | RSVP volume |
| `venue_tag_summary` (venue_id) | Tag sentiment scores |
| `explore_track_venues` (venue_id) | Editorial presence |
| `list_items` (venue_id) | Community list appearances |

---

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/best-of` | GET | No | List all active categories with vote counts |
| `/api/best-of/[slug]` | GET | No | Category leaderboard (ranked venues + top cases) |
| `/api/best-of/[slug]/vote` | POST | Yes | Cast vote for a venue in category |
| `/api/best-of/[slug]/vote` | DELETE | Yes | Retract vote |
| `/api/best-of/[slug]/cases` | GET | No | All cases for a category (paginated) |
| `/api/best-of/[slug]/cases` | POST | Yes | Write a "Make Your Case" blurb |
| `/api/best-of/[slug]/cases/[id]` | PATCH | Yes | Edit your case |
| `/api/best-of/[slug]/cases/[id]/upvote` | POST | Yes | Upvote a case |
| `/api/best-of/[slug]/cases/[id]/flag` | POST | Yes | Flag a case |

---

## Components

| Component | Description |
|---|---|
| `BestOfCategoryGrid` | Grid/carousel of category cards on Explore page |
| `BestOfLeaderboard` | Full leaderboard view for a category |
| `BestOfVenueCard` | Venue card within leaderboard (rank, score bar, top case) |
| `BestOfVoteButton` | Toggle vote button with optimistic update |
| `MakeYourCase` | Bottom sheet for writing/editing a case blurb |
| `CaseCard` | Individual case display (content, author, upvote count) |
| `BestOfBadge` | Small badge for venue detail pages ("#2 Best Dive Bar") |
| `BestOfCategoryHeader` | Category title, description, total votes, CTA |

---

## Implementation Phases

### Phase 1: Foundation (migration + API + basic UI)
- Create tables + materialized view
- Seed 10 starter categories for Atlanta portal
- Build category list API + leaderboard API (algorithm score only)
- Build `BestOfCategoryGrid` + `BestOfLeaderboard` components
- Add "Best Of" entry point in Explore tab

### Phase 2: Voting + Cases
- Build vote API routes
- Build case CRUD API routes
- Build `BestOfVoteButton`, `MakeYourCase`, `CaseCard`
- Add case upvoting
- Wire up community score into leaderboard ranking

### Phase 3: Integration + Polish
- Add `BestOfBadge` to venue detail pages
- Add post-RSVP vote prompt
- Build SEO-optimized public pages (`/[portal]/best-of/[slug]`)
- Add category-specific signal weighting
- Build admin tools for category management

### Phase 4: Growth Mechanics
- "You voted in X of Y categories" progress bar
- Share card: "I voted [Venue] as Best [Category] on LostCity"
- Weekly email: "Rankings shifted — see what's new"
- Seasonal categories (Best NYE Party, Best Patio for Spring)
- User-suggested categories (submit + admin approve flow)

---

## Success Metrics

| Metric | Target (90 days) |
|---|---|
| Categories with 50+ votes | 5 of 10 |
| Cases written | 200+ |
| Average case length | 100+ characters |
| Unique voters | 500+ |
| SEO impressions on "best of" pages | 10K/month |
| Return visitors to leaderboard pages | 30% weekly return rate |

---

## Open Questions

1. **Should users see the numeric score or just the rank?** Numeric feels clinical; rank alone feels more fun but less transparent. Recommendation: show a relative score bar (visual) but not exact points.

2. **Can you change your vote?** Yes — `UNIQUE(user_id, category_id)` means you vote for one venue per category. Changing your vote moves it. This creates an interesting dynamic where rankings shift as people switch allegiances.

3. **Should venues opt out?** Some venues may not want to be ranked. Add an `exclude_from_leaderboards` flag on venues table. (Respects existing opt-out pattern like Tiny Doors ATL.)

4. **How to handle ties?** Tiebreaker: more cases written > more case upvotes > earlier first vote timestamp.

5. **Seasonal reset?** Non-seasonal categories are rolling (no reset). Algorithm scores refresh every 6 hours. Community scores are cumulative but naturally self-correct as voting patterns shift.
