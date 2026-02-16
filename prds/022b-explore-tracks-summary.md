# Explore City Tracks: Product Design Summary

**For**: Product & Engineering Leadership  
**Date**: 2026-02-15  
**Research**: See `022-explore-tracks-curation-philosophy.md` (comprehensive analysis)  
**Implementation**: See `022a-explore-tracks-action-plan.md` (week-by-week plan)

---

## Your Questions, Answered

### 1. How many tracks is the right number?

**Answer: 6-8 tracks initially**

**Why:**
- **Psychology of choice**: Research shows 5-9 options = peak engagement, 10-15 = decision fatigue, 20+ = paralysis
- **Mobile scroll fatigue**: 15 tracks requires 3+ screens of scrolling on mobile (primary use case)
- **Quality over quantity**: We don't have editorial bandwidth to curate 15 excellent tracks
- **Competitive benchmark**: Successful city guides ship 10-30 lists, but they have full editorial teams. We should start tight and expand.

**Ship these 6 first:**
1. The South Got Something to Say (Hip-Hop)
2. Good Trouble (Civil Rights)
3. The Itis (Soul Food + Global Eats)
4. The Midnight Train (Quirky Hidden Gems)
5. City in a Forest (Urban Outdoors)
6. Keep Swinging (Sports & Game Day)

**Why these 6:**
- Cover core Atlanta identity (hip-hop, civil rights, food)
- Serve both tourists and locals
- High differentiation vs Google Maps
- Clear use cases (game day, date night, Sunday hike)
- We have rich data (venues + events)

---

### 2. How many venues per track?

**Answer: 8-15 max (strict cap)**

**Why:**
- **Restaurant menu principle**: Cornell research shows 7-10 items per category = highest satisfaction, 20+ = decision paralysis
- **Curation signal**: At 15, each pick feels intentional. At 80, it feels algorithmic.
- **Discovery friction**: Users won't scroll through 40+ venues. They want "What should I actually go to?" not "What are all the options?"

**Current state problems:**
- "The South Got Something to Say": 74 venues (any music_venue = database dump)
- "Hard in Da Paint": 82 venues (any gallery = no curation)
- "The Midnight Train": 19 venues (manageable but needs focus)

**Recommended structure per track:**
- **5-7 featured venues** (rich cards with event rows, editorial blurbs)
- **5-8 more venues** (compact grid with next event overlay)
- **"See all" link** only if 20+ truly worthy (rare)

**Quality bar > arbitrary count.**

---

### 3. Should tracks prioritize hidden gems or mix iconic + hidden?

**Answer: Mix of iconic + hidden (the "Infatuation model")**

**The 3-7-5 formula per track:**
- **3 Icons** - "You can't talk about X without [Venue]"
  - Establishes credibility
  - Anchors the theme
  - Tourists need these
  
- **7 Hidden Gems** - "Locals know, but visitors miss"
  - Discovery value
  - Differentiation from Google
  - Word-of-mouth potential
  
- **5 Rising Stars** - "Just opened" or "Finally getting noticed"
  - Freshness signal
  - Engagement driver
  - Shows we're up-to-date

**= 15 venues max**

**Why not "hidden gems only" (Atlas Obscura model)?**
- Confusing for tourists ("Where's the Georgia Aquarium?")
- Misses obvious greats that deserve recognition
- Too niche for a general city guide

**Why not "best of" (TimeOut model)?**
- Google Maps already does this
- No differentiation
- Boring for locals

**The mix serves everyone:**
- Tourists trust us (we include the icons)
- Locals discover new spots (hidden gems)
- Everyone stays engaged (rising stars = fresh content)

---

### 4. How should featured vs non-featured work?

**Answer: Featured = rich event cards, non-featured = compact grid**

**Featured venues (5-7 per track):**
- Show upcoming event rows (title, date, time, price, category)
- Full editorial blurb (60-80 words)
- Larger images
- "TONIGHT", "FREE", etc. badges
- Sort order: icons first, then gems with most events

**Non-featured venues (5-8 per track):**
- Compact 2-col grid layout
- Next event overlay on image ("SAT 6PM Supper Club")
- Short blurb (1-2 sentences, truncated)
- Still curated, just less visual weight

**What makes a venue featured-worthy:**
- Has upcoming events (not just evergreen)
- Strong editorial hook (great story to tell)
- High quality image
- Diversity of category/neighborhood (don't feature 5 music venues in East Atlanta)

**Users understand the hierarchy:**
- Top section = happening this week (featured, event-rich)
- Bottom grid = more great spots (compact, next event shown)

---

### 5. Track identity: Perfect name-to-content match vs vibes-based?

**Answer: Name should evoke feeling, but category label must clarify theme**

**Current problem:**
- "Hard in Da Paint" is an incredible Atlanta reference (Waka Flocka)
- But users don't immediately know it means street art galleries
- Without the category label ("STREET ART & GALLERIES"), it's confusing

**Solution (already implemented in comp D2):**
1. **Track name** - Evocative Atlanta reference (cultural resonance)
2. **Category label** - Clarifies theme in 2-3 words (scannability)
3. **Description** - Specific details (what you'll actually see)

**Example:**
- Name: "Hard in Da Paint" (Atlanta cultural reference)
- Category: "STREET ART & GALLERIES" (clarifies theme)
- Description: "Krog Tunnel graffiti, BeltLine murals that change monthly, gallery crawls in Castleberry Hill, and the art that makes Atlanta a canvas."

**Test**: Can someone scan the banner in 2 seconds and answer:
1. What is this? (Category label)
2. Why now? (Activity pills: "5 tonight")
3. What's the vibe? (Name + description + image)

**If yes**, the track identity works. If no, tune the category label or description.

---

## The Activation Moment

**What makes someone actually USE a track?**

### User Journey (85% mobile, 15% desktop)

1. "What should I do tonight?" (time context)
2. Scan track banners for vibe match (2 seconds each)
3. Click if:
   - Track name resonates (identity)
   - Pills show activity ("5 tonight", "Hawks vs Celtics 7:30")
   - Description sounds interesting
4. Drill in, see activity bar (5 tonight, 12 weekend, 3 free)
5. Filter by "Tonight" (reduces noise)
6. Pick venue with:
   - Best event (specific > generic)
   - Editorial hook ("Don't skip the oxtails")
   - Alive signal (TONIGHT badge, event row)

### What Drives the Click (Ranked by Impact)

| Element | Impact | Why |
|---------|--------|-----|
| **Tonight count** | Very High | Time urgency = conversion |
| **Track name** | High | Must evoke feeling or identity |
| **Featured event** | High | Specific ("Hawks vs Celtics") > generic ("3 events") |
| **Category label** | Medium | Helps scannability |
| **Banner image** | Medium | Mood-setting, not decision driver |
| **Venue count** | Low | Only matters if <10 (exclusive) or 40+ (spam) |

**Anti-pattern (current state):**
- Venue count pill ("74 venues") instead of featured event
- No tonight count on banner (have to drill in to find out)
- Track name is clever but theme is unclear without category label

**Best practice (comp D2):**
- Activity pills: "5 shows tonight", "Hawks vs Celtics 7:30", "Free tours daily"
- Category label: "HIP-HOP & MUSIC"
- Description: Specific details, not generic ("The studios where OutKast recorded...")

---

## Design Principles

### 1. Clarity over Cleverness

**Bad**: Track name is obscure reference with no context  
**Good**: Reference name + category label + specific description

### 2. Specific over Generic

**Bad**: "Great music venue with good sound"  
**Good**: "Where indie darlings and hip-hop legends pack the same room. The sight lines are perfect from every angle. Pro tip: skip the parking nightmare and take the MARTA shuttle."

### 3. Opinionated over Neutral

**Bad**: "Popular restaurant with a variety of options"  
**Good**: "The oxtails are transcendent. Don't skip them."

### 4. Quality over Quantity

**Bad**: 74 venues (every music_venue in DB)  
**Good**: 15 hand-picked, each justified

### 5. Alive over Static

**Bad**: "12 restaurants" (timeless, boring)  
**Good**: "Wine dinner tonight at 7pm" (urgent, compelling)

---

## Success Metrics (Track in Analytics)

**Per track, monitor:**
- **CTR** (banner → detail): Goal >30%, kill if <15%
- **Bounce rate** (detail → venue): Goal <40%, kill if >60%
- **Venue clicks per session**: Goal >2 avg
- **Venue click distribution**: Goal 80%+ of venues get ≥1 click per week

**If failing:**
- Swap out low-click venues (re-curate)
- Test different track name or description
- Merge with another track or hide

**If succeeding:**
- Add more tracks (seasonal, special occasion)
- Let users suggest venues
- Enable user-generated tracks (power users)

---

## Next Steps (This Week)

### Day 1: Data Audit
- Export current track-venue counts
- Identify bloated tracks (40+ venues)
- Export full venue lists for top 6 tracks

### Days 2-4: Curation Sprint
- Manually curate 6 launch tracks
- Follow 3-7-5 formula (icons + gems + rising stars)
- Write 60-80 word editorial for each venue
- Mark 5-7 as featured per track
- Cap at 15 venues per track

### Day 5: Track Descriptions
- Write banner descriptions (NOT quotes)
- 1-2 sentences, 40-60 words, specific not generic
- Hide 9 non-launch tracks (set is_active = false)

### Day 6: Design Polish
- Verify banner pills show tonight/weekend/free
- Verify activity bar on drill-in
- Test filter chips (Tonight, Weekend, Free)

### Day 7: Deploy & Monitor
- Create migration (combine all curation SQL)
- Test locally
- Deploy to staging
- Set up analytics tracking
- Monitor for 1 week (CTR, bounce rate, clicks)

---

## The Big Picture

**What we're building**: Curated city guides with strong editorial voice, not comprehensive directories.

**Who it serves**:
- **Tourists**: Icons establish credibility, descriptions provide context
- **Locals**: Hidden gems offer discovery, rising stars show we're current
- **Both**: Specific use cases (game day, date night, quirky Sunday) beat vague categories

**Why it matters**:
- **Differentiation**: Google Maps does "all the options." We do "what to actually go to."
- **Trust**: 15 hand-picked venues > 80 algorithmic matches. Quality = authority.
- **Engagement**: Specific events + editorial voice = "I want to go there now."

**What success looks like**:
- User opens app: "What should I do tonight?"
- Scans 6 track banners, clicks "The South Got Something to Say"
- Sees "5 shows tonight", filters by Tonight
- Reads editorial: "The Earl. Cash-only bar, sticky floors, best sound in the city."
- Clicks venue, RSVPs to event
- **We helped them discover something they wouldn't have found on Google.**

That's the win.

---

**END OF SUMMARY**

