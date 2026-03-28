# B2C Marketing Push — Atlanta Consumer Platform

**Date:** 2026-03-28
**Status:** Approved
**Timeline:** 60 days
**Budget:** $0 (sweat equity only)

---

## Goals

1. **User acquisition** — Get Atlantans using LostCity weekly to decide what to do
2. **Community seeding** — Build enough density in 2-3 neighborhoods that Hangs (social coordination) actually works
3. **B2B proof point** — Real consumer traction becomes the sales demo for FORTH, Gozio, and future portal customers

The thesis: sincere community building produces authentic traction, which is the most compelling B2B proof. No vanity metrics, no manufactured engagement.

## Target User

**The "what are we doing tonight?" person.** 25-35, socially active in Atlanta, already coordinating plans in group chats on Thursday afternoon. They have the problem LostCity solves and they pull friends in naturally. Transplants and niche enthusiasts will discover LostCity through the same channels, but the core use case must land with this person first.

## Success Metrics (Day 60)

| Metric | Target |
|--------|--------|
| Registered users (2+ sessions) | 200+ |
| Hangs created (non-founder) | 30+ |
| Venue partners (visible LostCity presence) | 10+ |
| Neighborhoods with active user clusters | 3+ |
| Newsletter subscribers | 400+ |
| Credible B2B narrative | "X hundred Atlantans use this weekly" |

---

## Campaign Structure

Three overlapping tracks, not sequential phases:

| Track | Purpose | Timeline | Effort Type |
|-------|---------|----------|-------------|
| **Seed** | 30 early adopters + 10 venue partners | Days 1-21 (then sustain) | Relationship-building |
| **Surface** | Show up where Atlantans already look for plans | Days 1-60 (ongoing) | Technical builds + weekly posting |
| **Sustain** | Weekly rhythm that drives retention | Days 14-60 (ongoing) | Automated systems |

Front-load personal effort in weeks 1-3 (Seed). Surface and Sustain are built once and run.

---

## Track 1: Seed

### Lost City Locals Program

A private invitation to 30 people who become street team, feedback loop, and social proof.

**Recruitment targets (in priority order):**

1. **Connectors** — The friend who always knows what's going on. Every friend group has one. They're doing LostCity's job manually in group chats. Recruit 5-10 of these.
2. **Venue-adjacent people** — Bartenders, event promoters, gallery owners. They have audiences and credibility.
3. **Recent transplants** — Moved to Atlanta in the last year, actively building a social life. Highest unmet need.

**Recruitment pitch:**
"I built something that solves the 'what are we doing tonight' problem and I want 30 people to help me shape it before it goes wide. You're one of them."

This is genuine — early Hangs only work if participants know each other. The exclusivity is functional, not manufactured.

**Asks of Locals:**
- Use LostCity instead of Google/Instagram when deciding weekend plans
- Create at least one Hang in the first two weeks
- Report what's broken, confusing, or missing
- Invite 2-3 friends when ready (not immediately — let them get comfortable first)

### 10 Venue Partnerships

**Selection criteria:**
- Personal relationship or warm intro available
- Repeat crowds (regulars bars, weekly event venues) over one-off destinations
- Geographic clustering — 3-4 venues in the same neighborhood > 10 spread across the metro
- Owner/manager is accessible and would care about discoverability

**What you offer:**
- "Your events are already on LostCity. I want to make sure they're accurate and show you how people find you." (Data already exists — this is a value conversation, not a sales pitch.)
- Embeddable event widget for their website (free, zero effort)
- QR code or table card: "See what's happening tonight" → opens LostCity
- Visibility into how people discover them (referral counts, search appearances)

**What you ask:**
- Display the QR/table card
- Mention LostCity when people ask "what else is going on tonight?"
- Verify their event data is accurate (improves data quality on both sides)

---

## Track 2: Surface

### Reddit r/Atlanta (highest leverage — start day 1)

430K+ members. Weekly "things to do" threads, constant "just moved here" and "visiting this weekend" posts. Only zero-cost channel with built-in reach from day 1.

**Strategy: Become the person who always has the answer. Not a LostCity shill.**

- **Weekly roundup post every Thursday/Friday.** "What's happening in Atlanta this weekend" — a genuinely useful curated list with editorial voice. Link to LostCity for the full view. The data advantage is massive: 11K events means nobody else can produce this without hours of manual work.
- **Answer transplant and visitor posts** with specific, helpful recommendations. Mention LostCity naturally: "I built a thing that tracks all of this if you want the full picture."
- **Never spam links.** Value first, always. The product sells itself when people actually look at it.

**Technical build:** Script that pulls weekend highlights from the API, formats as a Reddit-ready post, drafts for review and personalization. 30 minutes/week of operator time.

**Commitment: 8 consecutive weekly posts minimum.** Consistency is what builds credibility on Reddit. Miss a week and you're just another app promo.

### SEO — Programmatic Landing Pages (start day 1, compounds weeks 4-12+)

High-intent queries with weak local competition. Generated from existing data.

**Target pages:**
- "Things to do in Atlanta this weekend"
- "Free events in Atlanta today"
- "Live music Atlanta tonight"
- "Things to do in [neighborhood] this weekend"
- Category + time combinations: "comedy shows Atlanta Friday," "art openings Atlanta this week"

**Requirements:**
- Server-rendered, fast-loading
- Proper JSON-LD Event structured data on all event pages (Google rich results)
- Auto-updating from the API — no manual content
- Internal linking between event pages, venue pages, and landing pages

**Technical build:** Programmatic SEO pages querying the API by date/category/neighborhood. Most infrastructure likely exists already — this is routing + templates + structured data.

### Group Chat Bot (prototype, validate with Locals)

The "what are we doing tonight?" conversation happens in iMessage and WhatsApp group chats.

- SMS or WhatsApp number: text "what's happening tonight in East Atlanta?" → get 5 picks with links
- Friends add the number to their group chat
- Every response links back to LostCity

**Technical build:** Twilio + API integration. Straightforward.

**Validation gate:** Test with 5 Locals group chats before investing further. If people don't actually add a bot to their group chat, kill it.

---

## Track 3: Sustain

### Weekly Email — "This Week in Atlanta"

The single most important retention mechanism. Push channel you own, no algorithm dependency, weekly habit trigger.

- **Thursday send, every week.** Non-negotiable timing — when people plan weekends.
- **Auto-generated, editorially polished.** API produces the content: biggest events, free things to do, new venues, trending Hangs. Operator adds 2-3 sentence editorial take at the top. "Atlanta's got three food festivals competing this Saturday. Here's how to choose."
- **5-7 highlights, not comprehensive.** CTA is always "See everything on LostCity." Email is the hook, product is the depth.
- **Built-in growth loop.** Every email has "Forward this to a friend." Every Reddit post, venue card, and bot response includes newsletter signup.

**Technical build:** Email template + API query + send pipeline (Resend or Buttondown). ~1 day to build. 10 minutes/week for the editorial line.

**Subscriber targets:**
- Day 14: 50 (Locals + forwards)
- Day 30: 150
- Day 60: 400+

### Programmatic Social Accounts

@LostCityATL on Instagram and Twitter/X. Not a content creator play — an automated useful-information feed.

- Auto-post 2-3x daily: interesting events with images, short caption, link. "Free jazz in Candler Park tonight, 7pm."
- Prioritize events with good images from the data
- No engagement grinding, no stories, no reels
- Steady stream of "here's what's happening" that people follow when they discover LostCity through other channels

**Technical build:** Script that queries API for top events, picks ones with images, formats and publishes via platform APIs. Fully automated.

### Hangs Flywheel

The retention layer competitors can't copy. Already shipped — no technical build needed.

- Locals seed the first Hangs
- Each Hang signals to the creator's friends: "Sarah is going to the Beltline Night Market Saturday"
- The pull isn't "open LostCity" — it's "your friend is doing something, want to join?"
- Density matters: 30 people in 3 neighborhoods > 100 scattered across the metro

The work is social, not technical: ensuring Locals actually use Hangs and that notification/visibility UX is compelling enough to pull in friends-of-friends.

---

## Week-by-Week Execution Schedule

### Week 1: Foundation
- [ ] Identify and reach out to first 15 Locals candidates
- [ ] Identify 10 target venues, start conversations with first 5
- [ ] Set up @LostCityATL Instagram and Twitter accounts
- [ ] Build Reddit weekend roundup generation script
- [ ] Post first Reddit roundup (Thursday/Friday)
- [ ] Start SEO programmatic page implementation

### Week 2: Activation
- [ ] Onboard first 10-15 Locals — walkthrough, get them using it
- [ ] First venue partnerships confirmed (QR codes, widget installs)
- [ ] Build email newsletter pipeline
- [ ] Build social auto-posting script
- [ ] Second Reddit roundup post
- [ ] Deploy first programmatic SEO pages

### Week 3: Density
- [ ] 30 Locals onboarded
- [ ] First Hangs created by Locals (not you)
- [ ] 5+ venues with visible LostCity presence
- [ ] First newsletter send (to Locals + early signups)
- [ ] Social auto-posting live
- [ ] Third Reddit roundup
- [ ] Prototype group chat bot, test with 3 Locals group chats

### Weeks 4-6: Sustain + Expand
- [ ] Locals start inviting friends (2-3 each)
- [ ] Weekly rhythm locked: Reddit Thursday, newsletter Thursday, social daily
- [ ] Remaining venue partnerships live
- [ ] SEO pages indexing and ranking
- [ ] Evaluate group chat bot — double down or kill
- [ ] Monitor Hangs activity — is it self-sustaining or still founder-driven?

### Weeks 7-8: Measure + Narrative
- [ ] Hit 200+ active users or diagnose why not
- [ ] Compile B2B narrative: user count, Hangs activity, venue partnerships, newsletter subscribers
- [ ] Identify which channels are actually working and double down
- [ ] Kill anything that isn't producing signal
- [ ] Document learnings for next 60-day cycle

---

## Technical Builds Required

| Build | Effort | Priority | Track |
|-------|--------|----------|-------|
| Reddit roundup generation script | Half day | P0 — Day 1 | Surface |
| Email newsletter pipeline | 1 day | P0 — Week 2 | Sustain |
| Programmatic SEO pages | 1-2 days | P1 — Week 1-2 | Surface |
| Social auto-posting script | Half day | P1 — Week 2 | Sustain |
| Venue widget (PRD 033) | 1-2 days (if not built) | P1 — Week 2 | Seed |
| QR code / table card generator | 2 hours | P1 — Week 1 | Seed |
| Group chat bot (Twilio) | 1 day | P2 — Week 3 | Surface |
| JSON-LD structured data audit | Half day | P2 — Week 1 | Surface |

Total technical build time: ~5-7 days of focused work, spread across the first 3 weeks.

---

## What This Plan Deliberately Does NOT Include

- **Paid ads** — Wrong tool at zero budget and pre-PMF
- **Influencer campaigns** — No budget, and Atlanta micro-influencers charge $200-500/post
- **Press/PR push** — Nothing to announce yet. PR works when you have a story ("500 Atlantans use this weekly"), not when you have a product
- **App store optimization** — Assumes web-first (correct for LostCity's current architecture)
- **Launch event** — Tempting but premature. A launch event with 20 people is sad. A launch event with 200 existing users is a celebration.
- **Content marketing / blog** — Time-intensive, slow payoff, and the weekly Reddit + email posts cover the same ground more efficiently

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Reddit posts get removed as self-promotion | Medium | Lead with value, not links. Build comment karma first. Follow subreddit rules exactly. |
| Locals churn after initial excitement | High | Keep the group small and high-touch. Ask for feedback actively. Make them feel like co-builders, not beta testers. |
| Venue partners agree but never actually display materials | High | Make it zero-effort (you install the widget, you deliver the QR cards). Follow up in person. |
| Hangs doesn't get adoption even with seed users | Medium | If coordination features don't land, pivot messaging to pure discovery. The product still works without social. |
| 200 users in 60 days is too aggressive at $0 budget | Medium | The real minimum viable signal is 100 users + a credible growth curve. Adjust narrative accordingly. |
| Newsletter subscriber growth stalls | Medium | Cross-promote aggressively: Reddit posts include signup link, venue QR codes include signup, every Hang invite includes signup. |

---

## Decision Log

- **Approach chosen:** Scene Seeder (primary) + surgical elements of Utility Wedge and Content Wedge
- **Beachhead user:** "What are we doing tonight?" crowd, 25-35, socially active
- **Geographic focus:** 2-3 Atlanta neighborhoods with clustering, not metro-wide
- **Channel priority:** Reddit (day 1) > Email (week 2) > SEO (week 1, slow payoff) > Social (week 2, automated) > Group chat bot (week 3, experimental)
- **What we're NOT doing:** Paid ads, influencer campaigns, press, launch events, content marketing
