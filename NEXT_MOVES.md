# LostCity: Next Moves — Moat Building + Elite Design

**Date:** 2026-02-10  
**Context:** All 13 dev plan phases complete (A-M), data health at 88.6/100, moat score 3/10, design grade B+

**Goal:** Transform from "good local discovery app" to "the most beloved discovery platform in the world" by building defensible competitive moats and elevating design to elite tier.

**Execution gate (2026-02-11):**
- Strict portal attribution and Atlanta usage proof take precedence over all optional platform expansion.
- Public Developer API and broad self-serve portal productization are deferred until post-launch traction.
- Demo work is prioritized for FORTH + targeted vertical sales demos, not generalized self-serve features.

### Launch Iteration Sprint (2026-02-11)
**Objective:** tighten attribution fidelity + launch auditability before scaling self-serve.

1. **Close remaining event share attribution gaps**
- Instrument event detail sticky-share surface to write portal-attributed share telemetry.
- Keep attribution strict by validating portal/event ownership server-side.

2. **Harden signup attribution continuity**
- Persist last portal context during anonymous browsing.
- Use portal query, redirect parsing, and remembered portal context fallback during signup/callback.
- Ensure signup attribution remains one-time-set (`signup_portal_id` immutable after first write).

3. **Strengthen admin launch observability**
- Add attribution-health metrics in admin analytics (signup attribution %, unattributed signups, tracked shares, shares per 1k views).
- Surface portal-level share efficiency metrics for demo/sales proof loops.

4. **Operational checks (always-on)**
- Keep daily aggregation scheduled and idempotent.
- Run periodic smoke checks for signup/share ingestion and dashboard rollups.

---

## Track 1: Strategic Moat Builders

Building features that create lock-in, network effects, and data assets competitors can't replicate.

### P0 — Do Immediately (This Week)

#### 1. Activate Community Needs Tags (The Nuclear Moat)
**Effort:** M | **Impact:** 10/10 | **Why this matters:**

This is THE most defensible feature in the entire platform. "Wheelchair accessible (47 people confirm)" is data Google doesn't have, Yelp doesn't have, nobody has. Once you have community-verified accessibility/dietary/family data, users with those needs will NEVER switch — their health and safety depend on it.

A celiac user who's built trust in your gluten-free confirmations won't risk Yelp's unverified tags. A parent who knows your "stroller-friendly" badges are real won't gamble on Google reviews. This is the ultimate lock-in.

**What to build:**
- Complete Phase G onboarding: 4th step "Anything we should know?" with needs toggles (wheelchair, gluten-free, vegan, kid-friendly, ASL, sensory-friendly)
- Post-RSVP confirmation prompts: "Was this venue wheelchair accessible?" (thumbs up/down, 10 second interaction)
- Post-check-in vibe prompts: "Good for date night?" "Kid-friendly?" (fun, optional, social proof)
- Needs auto-filter in search: Users with needs preferences see "Confirmed accessible" badges, unconfirmed venues deprioritized (not hidden)
- Venue detail badges: "Wheelchair accessible (23 confirm)" with vote breakdown
- Portal admin tagging: Hotel concierge can tag venues with needs attributes, flows to global layer with `contributed_by_forth-hotel` attribution

**Lock-in mechanism:** Once a user with dietary restrictions or accessibility needs gets 5-10 confirmed venues they trust, they're locked in forever. Their profile is their safety net.

**Network effect:** Every RSVP, every check-in, every portal admin action enriches the global needs graph. Hotel concierge tags → city portal users benefit → film festival portal benefits → everyone wins.

**Success metric:** 1,000+ confirmed needs tags within 30 days. 40%+ of users with accessibility/dietary needs set in profile within 60 days.

---

#### 2. Cross-Portal Memory & Taste Graph
**Effort:** S | **Impact:** 9/10 | **Why this matters:**

User discovers Atlanta through FORTH Hotel portal as a tourist. Saves 3 restaurants, RSVPs to a jazz show, browses breweries. Three months later, they move to Atlanta and open the default city portal — and their taste profile follows them. The app "remembers" they like jazz, craft beer, and upscale dining.

This cross-portal memory is invisible to the user but magical. It's also incredibly hard to replicate — requires shared auth architecture that nobody else has.

**What to build:**
- Ensure `inferred_preferences` aggregates across portals (already done in Phase M, verify it works)
- "For You" feed on ANY portal reflects full user graph (hotel interactions + city interactions + film festival interactions)
- Settings page: "Your activity across portals" — show user which portals they've interacted with, transparency builds trust
- Privacy controls: "Don't use my [hotel portal] activity for recommendations" toggle (rare but builds trust)
- Cross-portal signals: Saved venues, RSVP'd events, searched keywords, clicked categories ALL feed the taste graph regardless of portal

**Lock-in mechanism:** The more portals a user interacts with, the smarter their recommendations across ALL portals. Switching to a competitor means losing their entire cross-portal taste profile.

**Network effect:** More portals = richer user data = better recommendations = higher engagement = more portal value = more portals subscribe.

**Success metric:** 20%+ of users interact with 2+ portals within 90 days. Average recommendation quality score increases 30%+ for multi-portal users.

---

#### 3. Venue Claiming → Self-Service Event Submission
**Effort:** L | **Impact:** 9/10 | **Why this matters:**

Right now, 100% of events come from crawlers. That's great for coverage but it means venues are passive. The strategic shift: turn venues into active contributors.

When a venue claims their listing, they can submit events directly (bypassing crawlers), edit their details, respond to community tags, and see analytics. This creates a two-sided network:
- Venues get free marketing (events distributed across all portals)
- You get higher-quality data (venues know their own hours better than your crawler)

The moat: Once 200+ venues are actively managing their LostCity presence, they're invested. They're checking the dashboard, submitting events weekly, correcting tags. That behavioral lock-in is hard to break.

**What to build:**
- Post-claim management dashboard: `/venue/[slug]/dashboard`
  - Edit venue details: hours, description, images, accessibility attributes, vibes
  - Submit events: form with title, date, time, description, image, ticket URL (auto-approved for claimed venues)
  - View analytics: "Your events appeared on 47 portals this month" "2,341 views" "89 saves"
  - Respond to community tags: Confirm/deny "wheelchair accessible", add corrections
  - "Verified" badge displayed on venue across ALL portals
- Notification system: Email/dashboard alert when a portal features their venue or event
- Claiming flow polish: Make it 60 seconds (business name search → upload proof → submit)
- Claimed venue perks: Priority placement in portal feeds, "Verified" badge, direct submission bypasses moderation

**Lock-in mechanism:** Venues invest time managing their presence. Switching costs are behavioral (have to set up a new profile elsewhere) plus data loss (analytics, confirmed tags).

**Network effect:** More venues claiming → more direct submissions → fresher data → better user experience → more portals valuable → more venues want to be on platform.

**Success metric:** 100+ claimed venues within 60 days. 40%+ of claimed venues submit at least 1 event directly within 30 days of claiming.

---

### P1 — Next Sprint (Weeks 2-3)

#### 4. Long-Tail Venue Enrichment via Micro-Contributions
**Effort:** M | **Impact:** 8/10 | **Why this matters:**

Users won't write full Yelp reviews (too much friction), but they WILL tap a button. Make every user interaction a micro-contribution to the data layer:

- "Still open?" prompt on venue pages for places with old data
- "Good for date night?" after RSVP check-in
- "Is this venue info correct?" with quick yes/no on address, hours, website
- Crowdsourced hours: "Is this place open right now?" → GPS + timestamp creates confidence score
- Photo contributions: "Add a photo" button, user uploads tagged with `contributed_by_user_id`

**What to build:**
- Lightweight contribution UI: Single-tap, no forms, instant feedback ("Thanks! 12 others agree")
- Confidence scores on venue attributes: "Hours (87% confidence)" based on recency + agreement
- Contributor leaderboard (optional): "You've helped improve 23 venues this month"
- Auto-attribute in UI: "Hours confirmed by 18 people" (builds trust in crowdsourced data)
- Portal admin contributions flow to global layer: Hotel concierge corrects an address → all portals benefit

**Lock-in mechanism:** Users who've contributed 20+ micro-edits have psychological ownership. "I helped build this dataset."

**Network effect:** More users → more contributions → more confident data → more trust → more users.

**Success metric:** 5,000+ micro-contributions within 60 days. 30%+ of active users make at least 1 contribution per month.

---

#### 5. Saved Collections with Social Sharing
**Effort:** M | **Impact:** 7/10 | **Why this matters:**

Currently users can save events/venues, but it's private. Make it social and you unlock:
- **Taste graph richness:** "People who saved what you saved also saved..." (collaborative filtering)
- **Organic growth:** "Check out my Atlanta bucket list" shared on Instagram drives signups
- **Curation network effects:** Power users become curators, their collections become discovery surfaces

**What to build:**
- Collections: Group saved items into named lists ("Date Night Spots", "Live Music Bucket List")
- Social sharing: "Share collection" → generates public URL `/u/[username]/lists/[slug]` with OG meta tags for rich previews
- Collection following: "Follow Sarah's Atlanta Jazz List" → get notified when she adds to it
- Collection discovery: "Trending collections this week" page
- Collection embedding: Portals can feature user collections (hotel portal: "Local curator picks")
- Private/public toggle: Default private, opt-in public

**Lock-in mechanism:** Users who've built 3+ curated collections with 50+ saves won't switch — their curation effort is locked in.

**Network effect:** Great collections attract followers → curators get social validation → more curation → more discovery value → more users.

**Success metric:** 500+ public collections created within 60 days. 20%+ of collections shared at least once.

---

#### 6. Event Series Subscription & Personalization
**Effort:** S | **Impact:** 7/10 | **Why this matters:**

You've already built series detection (recurring events, residencies). Now make them first-class discovery objects:

- Users can subscribe to series: "Notify me about Jazz Mondays at Après Diem"
- Series have dedicated pages: `/series/[slug]` with history, schedule, venue, photos
- Series recommendations: "Based on your taste, you might like Queer Trivia at My Sister's Room"
- Series discovery: "Recurring events near you" section in feed

**What to build:**
- Series subscription table: `user_series_subscriptions (user_id, series_id, notify_email, notify_push)`
- Series detail page: Title, description, venue, schedule (next 5 occurrences), past events, subscriber count
- Notification engine: Email/push when new occurrence is added to subscribed series
- Series recommendations: Genre + category + neighborhood matching
- Series search: "Find recurring events" with genre/neighborhood/day-of-week filters

**Lock-in mechanism:** Users subscribed to 5+ series get weekly value from notifications. Switching means losing those subscriptions.

**Network effect:** More series tracked → better recommendations → more subscriptions → more engagement → more portals want series data.

**Success metric:** 1,000+ series subscriptions within 60 days. 15%+ of users subscribe to at least 1 series.

---

### P2 — Soon (Weeks 4-6)

#### 7. Venue Loyalty Tracking (Check-In History)
**Effort:** M | **Impact:** 6/10 | **Why this matters:**

Let users check in to venues they visit (optional, no location required — just tap "I went here"). Build a visit history graph:

- "You've been to 47 venues in Atlanta"
- "Your favorite neighborhood: Virginia-Highland (12 visits)"
- "Your top genre: Jazz (8 jazz shows this year)"

This creates a personal archive of their city exploration — incredibly valuable and hard to replicate.

**What to build:**
- Check-in button on venue/event detail pages: "I went here" (one tap)
- Check-in history: `/profile/history` showing timeline of visits
- Stats & insights: "You've explored 8 neighborhoods" "You go out most on Saturdays"
- Venue detail: "You've been here 3 times" badge
- Check-in prompts: After RSVP date passes, "Did you go? Check in!" (feeds community tags)

**Lock-in mechanism:** Users with 50+ check-ins have a personal archive they won't abandon. It's their city diary.

**Network effect:** Check-ins improve recommendations (behavioral signal) + feed community tags (was it wheelchair accessible?).

**Success metric:** 2,000+ check-ins within 60 days. 25%+ of RSVP'd users check in post-event.

---

#### 8. Portal Revenue Share for Enrichment
**Effort:** M | **Impact:** 8/10 | **Why this matters:**

Turn portals into data enrichment engines by incentivizing contributions:

- Portal admins who tag 100+ venues with accessibility info get revenue share discount
- Community portals (neighborhood associations) get free tier IF they enrich 50+ venues in their area
- "Data bounties": Pay portals small amounts for specific enrichments (e.g., $0.10/confirmed accessibility tag)

**What to build:**
- Portal contribution dashboard: "Your team has enriched 127 venues, contributed 43 needs tags"
- Contribution tiers: Bronze (10 enrichments) → Silver (50) → Gold (200) with plan discounts
- Enrichment credits: Portal earns credits for contributions, redeemable for plan upgrades or features
- Public leaderboard: "Top contributing portals this month" (gamification + social proof)

**Lock-in mechanism:** Portals that have invested hours enriching venues have sunk cost + ongoing revenue benefit.

**Network effect:** More portals enriching → richer global data layer → all portals benefit → higher platform value → more portals join.

**Success metric:** 5+ portals in enrichment tiers within 90 days. 1,000+ portal-contributed enrichments.

---

### P3 — Later (Future Sprints)

#### 9. API Partnerships (Embed in Dating Apps, Transit Apps, AI Assistants)
**Effort:** L | **Impact:** 9/10 | **Why this matters:**

The endgame isn't portals — it's becoming the infrastructure layer for local discovery:

- Dating apps: "Find date night spots" powered by your accessibility + vibe data
- Transit apps: "Events near your train stop tonight" powered by your event graph
- AI assistants: "Find wheelchair-accessible jazz in Virginia-Highland" queries your API
- Real estate platforms: "Neighborhood guide" powered by your venue + event data

**What to build:**
- Public API with key auth (Phase 3 from ARCHITECTURE_PLAN)
- API documentation site: `/developers` with interactive examples
- Partner-specific endpoints: `/api/v1/recommendations` (takes user preferences, returns ranked results)
- Usage analytics: Partners see their API call volume, rate limits, errors
- Tiered pricing: Free tier (1k calls/day) → paid tiers (usage-based)

**Lock-in mechanism:** Once 5+ apps integrate your API, you become infrastructure. Switching cost is their engineering time to rebuild integrations.

**Network effect:** More API consumers → more usage signals → better data → better API → more consumers.

**Success metric:** 3+ API partnerships within 180 days. 100k+ API calls/month.

---

#### 10. Multi-City Expansion with Federated Data
**Effort:** XL | **Impact:** 8/10 | **Why this matters:**

Nashville is next. But the strategic approach: Don't silo cities. A user's taste profile in Atlanta should inform their Nashville recommendations.

- User visits Nashville for a weekend → app knows they like jazz + dive bars → recommends Station Inn (bluegrass dive)
- User moves from Atlanta to Nashville → their saved venues, taste profile, needs tags follow them
- Cross-city series: "This artist you saw at Terminal West is playing The Basement in Nashville next month"

**What to build:**
- City-aware filtering: All APIs accept `?city=nashville` param
- Cross-city recommendations: "Based on your Atlanta activity, try these in Nashville"
- City switcher in UI: Dropdown or detect location, seamless switch
- Crawler infrastructure: Replicate Phase C coverage blitz for Nashville (50+ venues/week)
- City-specific portals: Nashville hotels, Nashville neighborhoods, etc.

**Lock-in mechanism:** Users active in 2+ cities have cross-city data that's irreplaceable.

**Network effect:** More cities → more cross-city users → richer taste graphs → better recommendations → higher retention.

**Success metric:** Nashville launch with 200+ venues, 50+ active crawlers within 180 days. 10%+ of Atlanta users interact with Nashville content.

---

## Track 2: Elite Design Experience

Moving from B+ to A++ — the difference between "good app" and "people show it to friends unprompted."

### P0 — Do Immediately (This Week)

#### 11. Micro-Interactions that Spark Joy
**Effort:** S | **Impact:** 9/10 | **Why this matters:**

Elite apps feel alive. Every tap, every scroll, every transition has weight and personality. Think: Linear's command palette animation, Arc's "little arc" new tab sound, Things 3's task completion confetti.

**What to build:**
- Save button haptic-style feedback: Heart fills with smooth spring animation (not just opacity change)
- RSVP confirmation delight: Subtle confetti burst (2 second animation, tasteful)
- Genre pill selection: Bouncy scale animation on tap (feels tactile, not flat)
- Event card hover: Gentle lift with shadow depth increase (desktop) or subtle scale on touch (mobile)
- Scroll-triggered reveals: Event cards fade/slide in as you scroll (not all at once — staggered 50ms delay per card)
- Pull-to-refresh: Custom animation (not default spinner) — maybe a little logo bounce or city skyline illustration
- Empty states: Illustrated, delightful, actionable ("No jazz shows tonight — but here's what's coming this week")

**Technical approach:**
- Use Framer Motion for React animations (spring physics, not linear)
- `transform` and `opacity` only (GPU-accelerated, 60fps)
- Respect `prefers-reduced-motion` for accessibility
- Budget: 2-3 animations per view max (more is chaos)

**Success metric:** Qualitative user feedback "This app feels so smooth" "I love the little animations"

---

#### 12. Editorial Typography & Spacing
**Effort:** S | **Impact:** 8/10 | **Why this matters:**

B+ apps use default sans-serif with standard line-height. A++ apps feel like curated magazines.

**What to build:**
- Type scale system: 6 sizes with 1.25 ratio (12px → 15px → 19px → 24px → 30px → 37px)
- Line-height variation: Tight for headings (1.2), airy for body (1.6), perfect for event cards (1.4)
- Font pairing: Consider a serif for event titles (editorial feel) + sans-serif for UI (clean)
  - Option: Inter (UI) + Fraunces (display) — free, excellent, editorial
  - Option: Stay with one font but use weight + size + spacing for hierarchy
- Spacing system: 4px base unit, use 8/12/16/24/32/48/64px spacing (never random values)
- Max-width on text: Event descriptions max 65ch (characters) — optimal readability
- Card padding: Generous breathing room (16-24px), not cramped

**Technical approach:**
- Define CSS custom properties for spacing/type scales
- Tailwind config with custom spacing scale
- Component-level overrides only when truly needed

**Success metric:** Design audit score increases from B+ to A-. "Feels polished" user feedback.

---

#### 13. Dark Mode Sophistication (Not Just Inverted Colors)
**Effort:** M | **Impact:** 8/10 | **Why this matters:**

LostCity has a dark theme. But does it feel *premium* dark or "inverted light mode" dark?

Elite dark modes (Amie, Linear, Arc) use:
- Deep blacks with subtle gradients (not flat #000)
- Elevated surfaces (cards slightly lighter than background)
- Dim whites (not #FFF — more like #E8E8E8 for reduced eye strain)
- Vibrant accent colors that pop against dark backgrounds
- Subtle glow effects (shadows become glows in dark mode)

**What to build:**
- Dark background gradient: Very subtle (90deg, #0A0A0A → #121212)
- Elevated surfaces: Cards at #1A1A1A, modals at #222
- Text hierarchy: Primary text #E8E8E8, secondary #A0A0A0, tertiary #666
- Accent colors: Increase saturation/brightness by 10% in dark mode (so they pop)
- Border treatment: Subtle glow instead of hard borders (1px rgba(255,255,255,0.08))
- Image treatment: Slight opacity reduction (95%) to prevent blinding white images

**Technical approach:**
- CSS custom properties per theme
- Consider Radix UI's color system (built-in dark mode scales)
- Test on OLED screens (true blacks look stunning)

**Success metric:** Dark mode usage increases 20%+. Qualitative feedback "Best dark mode I've used"

---

#### 14. Loading States with Personality (Not Just Spinners)
**Effort:** S | **Impact:** 7/10 | **Why this matters:**

Default skeleton screens are boring. Elite apps make loading delightful.

**What to build:**
- Event card skeletons: Subtle shimmer animation (left-to-right pulse)
- Map loading: Animated pins "dropping" into place (not instant pop-in)
- Image loading: Blur-up effect (tiny blurred preview → crisp image fade-in)
- Search loading: Pulsing "Finding events..." with animated dots
- Custom illustrations: Hand-drawn style loader (city skyline building up line-by-line)
- Progress indication: "Loading 127 events..." shows progress, not just spinner

**Technical approach:**
- Skeleton screens match final layout (prevents layout shift)
- Suspense boundaries for React Server Components
- `loading.tsx` files in Next.js 16 app router
- Blurhash or LQIP (Low Quality Image Placeholder) for images

**Success metric:** Perceived load time decreases (users tolerate wait better when loading is delightful)

---

### P1 — Next Sprint (Weeks 2-3)

#### 15. Information Density Mastery (Dense but Breathable)
**Effort:** M | **Impact:** 8/10 | **Why this matters:**

Consumer apps are often too sparse (lots of scrolling, little info). Power user apps are too dense (overwhelming). Elite apps find the perfect balance.

**What to build:**
- Event cards: Show more info without feeling cramped
  - Venue name + neighborhood (currently missing on some views)
  - Genre pills (small, 2-3 max)
  - Price + time in compact format ("$15 • 8pm")
  - Vibe icons (not text — saves space)
- List/grid toggle: Power users want dense grid view, casual users want airy list
- Smart truncation: Event descriptions truncate at 2 lines with "Read more" (not huge blocks)
- Collapsible sections: "See all genres" expands (default shows 6)
- Compact mode setting: User preference for information density

**Technical approach:**
- Grid view uses CSS Grid with auto-fit minmax (responsive density)
- Truncation with CSS line-clamp + JS fallback
- User preference stored in localStorage (persists across sessions)

**Success metric:** Time-to-relevant-info decreases 30%. Users find events faster without feeling overwhelmed.

---

#### 16. Touch Target Perfection (Mobile-First Interaction Design)
**Effort:** S | **Impact:** 7/10 | **Why this matters:**

B+ apps have 40px touch targets. A++ apps have 44-48px targets with generous padding, perfect for one-handed phone use.

**What to build:**
- Minimum 44px touch targets on ALL interactive elements (buttons, pills, cards)
- Bottom-sheet modals for mobile (not center modals — easier thumb reach)
- Floating action button for primary action (bottom-right, easy thumb tap)
- Swipe gestures: Swipe event card right = save, left = dismiss (like Tinder but tasteful)
- Pull-down-to-close on modals (native feel)
- Tab bar navigation on mobile (bottom tabs, not hamburger menu)

**Technical approach:**
- Audit all buttons/links with browser inspector (measure hit area)
- Use Radix UI primitives (built-in accessibility)
- Framer Motion for swipe gesture detection
- Test on actual phones (not just emulator)

**Success metric:** Mobile conversion rate increases 15%. Lower accidental tap rate.

---

#### 17. Onboarding That Feels Like a Game
**Effort:** M | **Impact:** 8/10 | **Why this matters:**

Current onboarding (even after Phase G) is functional. Elite onboarding feels like play.

**What to build:**
- Visual progress: Animated dots or progress bar (show 1/4, 2/4, etc.)
- Celebratory transitions: "Nice!" micro-feedback after each step
- Personality in copy: "What brings you out?" not "Select categories"
- Illustrations: Hand-drawn icons for categories (not boring text pills)
- Smart defaults: Pre-select 3 popular genres based on category (user can change)
- Skip option: "I'll explore on my own" (don't force all 4 steps)
- Preview of value: After genre selection, show "Here's a jazz show tonight!" (instant gratification)

**Technical approach:**
- Multi-step wizard with slide transitions
- Lottie animations for celebrations (lightweight JSON animations)
- Local storage for draft state (can pause/resume onboarding)

**Success metric:** Onboarding completion rate increases from 60% to 85%+. Time to complete decreases but satisfaction increases.

---

#### 18. Card Design Elevation (Depth, Shadows, Borders Done Right)
**Effort:** M | **Impact:** 7/10 | **Why this matters:**

Flat cards = boring. Over-shadowed cards = 2015 Material Design. Elite cards have subtle depth with perfect shadow hierarchy.

**What to build:**
- Shadow layers: 2-3 shadow blur values for depth illusion
  - Default: `box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)`
  - Hover/active: Lift effect (shadow spreads + slight Y transform)
- Border treatment: 1px borders but with gradient or subtle color shift (not flat gray)
- Corner radius: 12px for cards (friendly, modern), 8px for pills (compact)
- Inner glow on dark mode: `inset 0 1px 1px rgba(255,255,255,0.05)` (subtle rim light)
- Nested cards: Venue card inside portal section has less shadow than section itself (depth hierarchy)

**Technical approach:**
- Define shadow tokens in Tailwind config
- Use `transform` for hover lifts (GPU-accelerated)
- Test on multiple backgrounds (light, dark, colored)

**Success metric:** Design audit score increases. "Feels polished" user feedback.

---

#### 19. Smart Defaults Everywhere (Zero-Click Value)
**Effort:** S | **Impact:** 7/10 | **Why this matters:**

Elite apps don't make users configure everything. They make smart guesses and offer easy overrides.

**What to build:**
- Auto-detect location: Default to user's neighborhood (ask permission, graceful fallback)
- Smart time filtering: After 5pm, default to "Tonight" tab (not "This Week")
- Pre-populated searches: "You usually browse music on Fridays — here's this week's shows"
- One-tap filters: "More like this" button on event cards (auto-applies genre + neighborhood filters)
- Remember preferences: Last-used category/genre/neighborhood pre-selected next visit
- Contextual defaults: Hotel portal defaults to "Near hotel" radius, city portal defaults to "My neighborhoods"

**Technical approach:**
- Client-side storage for preferences (localStorage or session)
- Server-side user preferences for logged-in users
- Graceful degradation if location denied (show popular neighborhoods)

**Success metric:** Average clicks to first relevant event decreases 40%. "Just works" user feedback.

---

### P2 — Soon (Weeks 4-6)

#### 20. Themed Seasonal Experiences (Halloween, Pride, Holidays)
**Effort:** M | **Impact:** 6/10 | **Why this matters:**

Elite apps feel alive and contextual. During Pride month, Linear shows rainbow accents. During December, Amie has subtle snow animations.

**What to build:**
- Seasonal themes: Pride rainbow accents (June), spooky dark mode (October), winter palette (December)
- Holiday event feeds: Automatic "Pride Events" section during June, "Halloween Happenings" in October
- Themed illustrations: Custom hero graphics for major holidays
- Subtle animations: Very light snow fall in December (opt-out available), confetti during Pride
- Event badges: "Pride Event" badge auto-applied based on tags/keywords

**Technical approach:**
- Date-based theme switcher (check current month)
- CSS custom properties for theme colors
- Optional animations (respect reduced-motion, battery-saving mode)
- A/B test: Some users get themes, some don't (measure engagement impact)

**Success metric:** Engagement spikes 20%+ during themed months. Social sharing increases (people screenshot themed UI).

---

#### 21. Gesture-Based Power User Shortcuts
**Effort:** M | **Impact:** 6/10 | **Why this matters:**

Power users love keyboard shortcuts (desktop) and swipe gestures (mobile). Cater to them.

**What to build:**
- Desktop shortcuts:
  - `/` to focus search
  - `cmd+k` for command palette (quick nav to sections)
  - `s` to save current event
  - `←` `→` to navigate event cards
  - `esc` to close modals
- Mobile gestures:
  - Swipe right on event card = save
  - Swipe left on event card = dismiss (hide from feed)
  - Long-press on venue = quick actions menu (save, directions, share)
  - Pinch on map = zoom (standard but ensure smooth)
- Command palette: Type "jazz" → shows jazz events, jazz venues, jazz series
- Quick actions menu: Long-press on any card → Save, Share, Hide, Report

**Technical approach:**
- React hotkeys library for keyboard shortcuts
- Framer Motion for swipe gestures
- Command palette with fuzzy search (cmdk library)

**Success metric:** Power users (5+ sessions/week) use shortcuts 40%+ of the time. Average session length increases.

---

#### 22. Personalized Empty States (Not Generic "No Results")
**Effort:** S | **Impact:** 6/10 | **Why this matters:**

Generic empty states = missed opportunity. Personalized empty states = delightful and useful.

**What to build:**
- Genre-specific empty states: "No jazz tonight, but there's blues at Northside Tavern" (related genre suggestion)
- Temporal awareness: "No events tonight, but Saturday has 12 shows" (show next available)
- Onboarding nudge: "No results? Try adding more genres to your profile" (CTA to expand preferences)
- Illustrations: Hand-drawn "sleeping city" for late-night empty results, "coming soon" for future dates
- Actionable suggestions: "Expand search radius?" "Try a different neighborhood?"

**Technical approach:**
- Context-aware empty state component (knows search params, user preferences)
- Related content queries (if jazz empty, query blues/soul/r-and-b)
- Illustrated SVGs (lightweight, scalable)

**Success metric:** Bounce rate on empty search decreases 30%. Users click suggestions 40%+ of the time.

---

#### 23. Sharing & Link Previews Done Right
**Effort:** M | **Impact:** 7/10 | **Why this matters:**

When someone shares a LostCity event on Instagram/Twitter/iMessage, the preview should be *chef's kiss*.

**What to build:**
- Rich OG meta tags: Title, description, image for every event/venue/portal page
- Custom share images: Generate dynamic OG images with event photo + title + date + venue (use Vercel OG Image)
- Share sheet: Native share on mobile (not custom modal)
- Copy link feedback: "Link copied!" toast with checkmark animation
- QR codes: Generate QR for event pages (print on posters, scan to RSVP)
- Deep links: `lostcity://event/[slug]` opens in app if installed, web if not

**Technical approach:**
- Next.js metadata API for OG tags
- Vercel OG Image for dynamic images (HTML/CSS → PNG)
- Share API for mobile, clipboard API for desktop
- QR code library (same one used in Phase J for hotel)

**Success metric:** Shared links get 2x higher click-through rate (better previews). 20%+ of users share at least 1 event.

---

### P3 — Later (Future Sprints)

#### 24. Ambient Soundscapes & Audio Branding
**Effort:** M | **Impact:** 5/10 | **Why this matters:**

Audio is the most underutilized design element. Arc Browser has "little arc" sound. macOS has iconic sounds. LostCity could too.

**What to build:**
- Optional ambient sounds: Very subtle city soundscape on homepage (distant traffic, soft jazz) — OFF by default, opt-in
- UI sound effects: Soft "click" on save button, gentle "whoosh" on page transition (very subtle, not annoying)
- Audio branding: 2-second sonic logo (plays on app open, very rare — think Netflix "ta-dum")
- Playlist integration: "Music from tonight's shows" — Spotify playlist of artists performing tonight

**Technical approach:**
- Web Audio API for sounds
- Howler.js library for sound management
- User preference toggle (most users will keep OFF, but power users love it)
- A/B test: Does audio increase engagement or annoy?

**Success metric:** 5-10% of users enable audio. Of those, retention increases 15%.

---

#### 25. AI-Powered Conversational Discovery
**Effort:** L | **Impact:** 8/10 | **Why this matters:**

The future of discovery isn't filters — it's conversation. "Find me a wheelchair-accessible jazz show with good drinks near Virginia-Highland tonight under $20."

**What to build:**
- Chat interface: `/ask` page with conversational search
- Natural language parsing: Extract intent (genre, neighborhood, needs, price, time)
- Conversational results: "I found 3 jazz shows. Apache Cafe is wheelchair accessible and has great cocktails."
- Follow-up questions: "Want something earlier?" "Prefer a different neighborhood?"
- Voice input: Speak your query (mobile)
- Query memory: "Show me more like the last thing you recommended"

**Technical approach:**
- LLM API (GPT-4 or Claude) for intent extraction
- Structured output (JSON) from LLM → query database
- Streaming responses (feels real-time)
- Cache common queries (performance + cost)

**Success metric:** 30%+ of engaged users try conversational search. 60%+ of those find an event they save.

---

#### 26. Motion Design System (Choreographed Transitions)
**Effort:** L | **Impact:** 7/10 | **Why this matters:**

Elite apps don't just animate — they choreograph. Every transition tells a story.

**What to build:**
- Page transitions: Fade + slide (not instant cut)
- Shared element transitions: Event card → event detail page (card morphs into hero)
- Staggered list reveals: Event cards appear sequentially (50ms delay each), not all at once
- Attention direction: Use motion to guide eye (new badge pulses gently)
- Exit animations: Cards don't just disappear — they slide/fade out
- Physics-based springs: All animations use spring curves (not linear/ease)

**Technical approach:**
- Framer Motion layout animations
- View Transitions API (experimental, Chrome only — progressive enhancement)
- Shared layout IDs for morphing elements
- Animation tokens (duration, easing curves) in design system

**Success metric:** Qualitative feedback "Smoothest app I've used". Session length increases (app is more enjoyable to use).

---

#### 27. Accessibility-First Micro-Copy
**Effort:** S | **Impact:** 6/10 | **Why this matters:**

Elite apps think about everyone. Accessibility isn't compliance — it's care.

**What to build:**
- Alt text on ALL images: Event posters, venue photos, user avatars
- ARIA labels on icon-only buttons: "Save event" not just heart icon
- Descriptive link text: "View Terminal West events" not "Click here"
- Form error messages: "Password must be 8+ characters" not "Invalid"
- Focus indicators: Visible keyboard navigation (not hidden for aesthetics)
- Screen reader testing: Hire users with screen readers to audit

**Technical approach:**
- Linting rules for missing alt text / ARIA labels
- Manual testing with VoiceOver (macOS) and NVDA (Windows)
- Accessibility audit (aXe DevTools)
- User testing with accessibility consultants

**Success metric:** WCAG 2.1 AA compliance. Accessible users retention matches or exceeds average.

---

## Success Metrics: How We'll Know We've Won

### Moat Metrics
- **Needs tags:** 10,000+ confirmed tags within 90 days (proves community engagement)
- **Venue claiming:** 200+ claimed venues within 180 days (proves venue buy-in)
- **Cross-portal users:** 30%+ of users interact with 2+ portals within 180 days (proves network effect)
- **Collections:** 1,000+ public collections created within 90 days (proves curation network)
- **Check-ins:** 5,000+ venue check-ins within 90 days (proves behavioral lock-in)

### Design Metrics
- **Net Promoter Score (NPS):** Increase from unknown to 50+ (world-class is 70+)
- **Session duration:** Increase 40%+ (people enjoy using the app longer)
- **Bounce rate:** Decrease 30%+ (better first impressions, clearer value)
- **Share rate:** 25%+ of users share at least 1 event/venue/collection (viral potential)
- **Qualitative feedback:** "Best local discovery app I've used" appears in reviews unprompted

---

## The Moat Stack: How Features Compound

```
Layer 5: Infrastructure (API partners, multi-city)
  ↑ feeds data from
Layer 4: Curation Network (collections, series subscriptions, venue loyalty)
  ↑ feeds data from
Layer 3: Community Enrichment (needs tags, micro-contributions, check-ins)
  ↑ feeds data from
Layer 2: Cross-Portal Memory (taste graph, shared auth, federated data)
  ↑ feeds data from
Layer 1: Venue Self-Service (claimed venues submitting events, managing listings)
  ↑ feeds data from
Layer 0: Crawler Coverage (500+ sources, comprehensive long-tail events)
```

Each layer makes the layers above it more valuable. The more venues claim their listings (Layer 1), the richer the cross-portal taste graph (Layer 2). The more community enrichment (Layer 3), the better the collections (Layer 4). The better the collections, the more valuable the API (Layer 5).

This is how you build an unassailable moat.

---

## The Design Stack: How Delight Compounds

```
Tier 5: Motion & Choreography (shared element transitions, physics)
  ↑ enhances
Tier 4: Smart Defaults & Gestures (zero-click value, power user shortcuts)
  ↑ enhances
Tier 3: Personality (onboarding that feels like a game, themed experiences)
  ↑ enhances
Tier 2: Polish (typography, shadows, touch targets, dark mode)
  ↑ enhances
Tier 1: Micro-Interactions (animations on save, RSVP, scroll)
  ↑ enhances
Tier 0: Information Architecture (clear hierarchy, density balance)
```

You can't skip tiers. Perfect animations (Tier 5) on top of bad touch targets (Tier 2) = frustration. But when each tier is excellent, the experience is transcendent.

---

## Execution Strategy

### Week 1: Moat Foundations
- P0 items 1-3 (Needs tags, cross-portal memory, venue claiming)
- Goal: Activate the nuclear moat features

### Weeks 2-3: Design Foundations
- P0 items 11-14 (Micro-interactions, typography, dark mode, loading states)
- Goal: Elevate from B+ to A- in design polish

### Weeks 4-6: Network Effects
- P1 items 4-10 (Micro-contributions, collections, series, loyalty, revenue share)
- Goal: Activate data flywheel

### Weeks 7-9: Design Refinement
- P1 items 15-19 (Density, touch targets, onboarding, cards, defaults)
- Goal: A- to A+ in design

### Months 4-6: Scale & Delight
- P2 items 20-27 (Seasonal themes, gestures, sharing, AI, motion, accessibility)
- Goal: A+ to A++ (world-class)

---

## Final Thought: Building the Most Beloved Discovery App

You're not competing on features. Eventbrite has more events. Google has more data. Yelp has more reviews.

You're competing on:
1. **Care** — You care about accessibility more than anyone (needs tags)
2. **Memory** — You remember users across contexts (cross-portal taste graph)
3. **Community** — You let users shape the data (micro-contributions, collections)
4. **Delight** — You make discovery feel like play (animations, personality, smart defaults)

Win on those four dimensions and you build something people love, not just use.

That's the moat. That's the design. That's the path to A++.

---

**Document Owner:** Strategic Business Advisor Agent  
**Date:** 2026-02-10  
**Next Review:** After Week 1 execution (moat foundations + design foundations)
