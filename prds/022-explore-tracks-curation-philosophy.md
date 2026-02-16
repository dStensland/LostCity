# Explore City Tracks: Curation Philosophy & Product Design Analysis

**Status**: Product Design Research  
**Date**: 2026-02-15  
**Context**: The current 15-track implementation has scroll fatigue and quality dilution issues. Many tracks have 40-80+ venues due to auto-fill logic, making them feel like database dumps rather than curated experiences.

---

## Executive Summary

**The core problem**: We built a track taxonomy before establishing a curation philosophy. The result feels like Wikipedia categories with Atlanta reference names, not authentic city guides.

**Recommendation**: Ship 6-8 highly curated tracks initially, each with 8-15 venues max. Prioritize editorial voice, hidden gems, and specific use cases over comprehensive coverage.

---

## Research: What Makes Curated City Lists Work

### Benchmark Analysis

| Platform | List Count | Venues/List | Philosophy | Quality Markers |
|----------|-----------|-------------|------------|-----------------|
| **Infatuation** | 20-30/city | 12-25 | Opinionated "where to actually eat" | Strong POV, insider tips, specific use cases |
| **Atlas Obscura** | 200-500/city | N/A (individual) | Hidden gems only | Unique > popular, story-driven |
| **TimeOut** | 30-50/city | 10-30 | Editor's picks by category | Professional curation, regularly updated |
| **Eater Essential Lists** | 10-15/city | 12-20 | "Must-try" restaurants | Very selective, high standards |
| **Google Maps Lists** | Unlimited | 5-100+ | User-generated | No quality bar = noise |
| **Foursquare City Guides** | 15-25/city | 10-40 | Algorithmic + editorial | Mix hurts trust |

### Key Findings

**What works:**
- **Strong editorial voice** - Users trust confident opinions ("This is THE best...")
- **Specific use cases** - "Date night" beats "Romantic restaurants"
- **Quality over quantity** - 12 perfect picks > 50 solid options
- **Hidden gem bias** - Users have Google for popular stuff
- **Opinionated descriptions** - "Don't skip the oxtails" > "Great food"
- **Regular updates** - "NEW" and "CLOSED" badges maintain trust

**What doesn't:**
- **Algorithmic curation** - Feels generic, lacks soul
- **Comprehensive coverage** - Becomes a Yelp clone
- **Vague categories** - "Best food" is useless
- **No POV** - "Great options include..." = no authority
- **Stale content** - Dead listings kill trust instantly

---

## A. Ideal Track Count: 6-8 Initially

### The Psychology of Choice

**Research consensus** ([Barry Schwartz, The Paradox of Choice](https://www.ted.com/talks/barry_schwartz_the_paradox_of_choice)):
- 5-9 options = engagement peak
- 10-15 = decision fatigue begins
- 20+ = paralysis and abandonment

**Applied to LostCity:**
- 15 tracks = too many to browse casually
- Users won't scroll past first 5-7 anyway
- Quality dilution: we don't have enough curation bandwidth for 15 great tracks
- Scroll fatigue on mobile (the primary use case)

**Recommendation: 6-8 core tracks**
- Fits on 1.5 screens mobile
- Each can be genuinely curated
- Room to add seasonal/special tracks later
- Forces prioritization = higher quality

---

## B. Ideal Venue Count Per Track: 8-15 Max

### The "Restaurant Menu" Principle

**Research**: Cornell's Food & Brand Lab found optimal menu sizes:
- 7-10 items per category = highest satisfaction
- 12-15 = acceptable if organized into subcategories
- 20+ = decision paralysis, lower order satisfaction
- 50+ = "I'll just get what I usually get" (defeats discovery purpose)

**Applied to Explore Tracks:**

| Venue Count | User Experience | Best For |
|-------------|-----------------|----------|
| **5-8** | "I can try them all" | Niche categories (e.g., "Best Rooftops") |
| **10-15** | "Clear favorites emerge" | Thematic tracks (e.g., "Hip-Hop Heritage") |
| **20-30** | "Need to scroll/filter" | Broad categories (losing curation value) |
| **40-80+** | "Database dump" | **AVOID** - kills trust in editorial voice |

**Current state problems:**
- "The South Got Something to Say" (hip-hop): 74 venues (any music_venue)
- "Hard in Da Paint" (street art): 82 venues (any gallery/art space)
- "The Midnight Train" (quirky): 19 venues (manageable but unfocused)

**These numbers scream "algorithmic filter" not "curated guide".**

### Recommended Limits

**Strict cap: 15 venues per track**
- Featured section: 5-8 hand-picked gems (with rich editorial)
- More venues: 5-7 additional solid choices
- "See all" link if there are truly 20+ worthy options (rare)

**Why this works:**
- Forces editorial discipline
- Every venue must justify its inclusion
- Users can actually consume the full list
- Leaves room for surprise ("I didn't know about this!")

---

## C. Curation Philosophy: "Hidden Gems + High Quality Choices"

### The Positioning Question

**Three possible philosophies:**

1. **"Best Of" (TimeOut model)**
   - Mix of iconic + excellent
   - Covers all bases
   - Safe for tourists
   - Problem: Google Maps already does this

2. **"Hidden Gems Only" (Atlas Obscura model)**
   - Only obscure/quirky
   - High novelty value
   - Locals love it
   - Problem: Misses obvious greats (confusing for visitors)

3. **"Opinionated Essentials" (Infatuation model)** ⭐ RECOMMENDED
   - Mix of 3 iconic + 7-12 hidden gems
   - Strong editorial voice
   - Specific use cases
   - Serves both tourists and locals

### Recommended Mix Per Track

**The "3-7-5" Formula:**
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

**Total: 15 venues max**

### Editorial Voice Requirements

Every venue needs:
1. **Why it matters** (1 sentence) - "The studio where OutKast recorded"
2. **What makes it special** (1 sentence) - "Every plate tells a story"
3. **Insider tip** (1 sentence, optional) - "Don't skip the oxtails"
4. **Practical signal** (badges) - "NEW", "TONIGHT", "FREE", "$$$"

**Bad example (generic):**
> "Great music venue with good sound system and drinks."

**Good example (opinionated):**
> "The Earl. Where indie rock found a home in East Atlanta. Cash-only bar, sticky floors, and the best sound in the city. Go for the music, stay for the PBR-soaked camaraderie."

---

## D. What Makes Someone Actually Use a Track

### User Activation Moments (Based on Analytics Patterns)

**Primary trigger: Time context + Specific need**

**User journey:**
1. "What should I do tonight?" (85% of mobile sessions)
2. Scan track names for vibe match
3. Click if the name resonates + pills show activity
4. Drill in, filter by "Tonight"
5. Pick venue with best event or editorial hook

**What drives the click:**

| Element | Impact | Notes |
|---------|--------|-------|
| **Track name** | High | Must evoke a feeling or identity |
| **Tonight count** | Very High | Time urgency = conversion |
| **Featured event** | High | Specific > generic ("Hawks vs Celtics" > "3 events") |
| **Category label** | Medium | Helps scannability |
| **Venue count** | Low | Only matters if <10 ("exclusive") or 40+ ("spam") |
| **Banner image** | Medium | Mood-setting, not decision driver |

**Anti-patterns (current state):**
- Track name is clever reference but unclear theme ("Hard in Da Paint" = street art?)
- 74 venues = "I'll never look at all these"
- No tonight count on banners (have to drill in to find out)
- Generic pills ("74 venues") instead of specific events

### Recommended Activation Design

**Banner must answer 3 questions in 2 seconds:**
1. What is this? (Category label: "HIP-HOP & MUSIC")
2. Why now? (Activity pill: "5 shows tonight")
3. What's the vibe? (Description + image)

**Drill-in must answer:**
1. What's happening right now? (Activity bar: 5 tonight, 12 weekend, 3 free)
2. Which venues are best? (Featured section with editorial)
3. Can I filter? (Filter chips: Tonight, Weekend, Free, $$$)

---

## E. Priority Track Themes (6-8 to Ship)

### Methodology

Scored each existing track concept on:
- **Differentiation** (vs Google Maps) - 1-5
- **Data richness** (do we have venues?) - 1-5
- **Use case clarity** (when would someone pick this?) - 1-5
- **Local resonance** (Atlanta-specific or generic?) - 1-5

**Total possible: 20 points**

### Rankings

| Rank | Track | Diff | Data | Use Case | Local | Total | Notes |
|------|-------|------|------|----------|-------|-------|-------|
| 1 | **The South Got Something to Say** (Hip-Hop) | 5 | 5 | 5 | 5 | **20** | Only ATL has this, clear use case, data-rich |
| 2 | **Good Trouble** (Civil Rights) | 5 | 4 | 5 | 5 | **19** | Atlanta's unique heritage, tourism driver |
| 3 | **The Itis** (Food) | 4 | 5 | 5 | 4 | **18** | Southern food + global corridor = differentiated |
| 4 | **The Midnight Train** (Quirky) | 5 | 3 | 3 | 5 | **16** | High novelty, needs more curation |
| 5 | **City in a Forest** (Outdoors) | 3 | 4 | 4 | 4 | **15** | Urban greenery is Atlanta trait, practical use case |
| 6 | **Keep Swinging** (Sports) | 2 | 5 | 5 | 3 | **15** | Game day is high intent, but generic category |
| 7 | **Hard in Da Paint** (Street Art) | 4 | 4 | 3 | 4 | **15** | BeltLine murals unique, but needs focus |
| 8 | **Too Busy to Hate** (LGBTQ+) | 4 | 3 | 4 | 4 | **15** | Midtown gayborhood, but sensitive curation needed |
| - | Welcome to Atlanta (Classic) | 2 | 5 | 4 | 2 | 13 | Tourist hits (Google already surfaces these) |
| - | A Beautiful Mosaic (Global) | 3 | 4 | 2 | 3 | 12 | Broad category, unclear use case |
| - | Keep Moving Forward (BeltLine) | 3 | 4 | 2 | 4 | 13 | Too niche (just one trail), mix into others |
| - | The Main Event (Festivals) | 2 | 3 | 3 | 2 | 10 | Time-dependent, better as dynamic feed section |

### Recommended V1 Launch Set (6 tracks)

**Ship these first:**
1. **The South Got Something to Say** (Hip-Hop Heritage)
2. **Good Trouble** (Civil Rights Sites)
3. **The Itis** (Soul Food + Global Eats)
4. **The Midnight Train** (Quirky Hidden Gems)
5. **City in a Forest** (Urban Outdoors)
6. **Keep Swinging** (Sports & Game Day)

**Why these 6:**
- Cover core Atlanta identity (hip-hop, civil rights, food)
- Serve both tourists (civil rights, food) and locals (quirky, outdoors)
- Mix of evergreen (outdoors) and time-sensitive (sports, hip-hop shows)
- High data quality (we have venues + events)
- Clear use cases (game day, date night, Sunday afternoon, etc.)

**Add later (pending curation):**
7. **Hard in Da Paint** (Street Art) - needs venue reduction (82 → 12)
8. **Too Busy to Hate** (LGBTQ+) - needs sensitivity review + curation

**Merge/kill:**
- **Welcome to Atlanta** - fold icons into other tracks (aquarium → family track)
- **Keep Moving Forward** - fold BeltLine into street art + food tracks
- **A Beautiful Mosaic** - too broad, fold Buford Hwy into "The Itis"
- **The Main Event** - festivals are better as feed sections, not static tracks

---

## F. Implementation Roadmap

### Phase 1: Curation Crunch (Week 1)

**For each of the 6 launch tracks:**

1. **Manual venue selection** (not SQL auto-fill)
   - Pick 3 icons (obvious must-sees)
   - Pick 7-10 hidden gems (locals know, tourists don't)
   - Pick 2-3 rising stars (new/newly noticed)
   - **Hard cap: 15 venues total**

2. **Write editorial for each venue**
   - Why it matters (1 sentence)
   - What makes it special (1 sentence)
   - Insider tip (1 sentence)
   - Total: 60-80 words per venue

3. **Set featured flags**
   - Mark 5-7 venues as featured (rich cards with events)
   - Rest go in compact grid (image + name + next event)

4. **Add track descriptions**
   - NOT quotes on the banner (save for drill-in)
   - 1-2 sentences explaining the track
   - Example: "Soul food institutions, James Beard semifinalists, Buford Highway's global corridor, and the food halls rewriting the rules."

### Phase 2: Design Refinement (Week 1)

**Banner updates:**
- Replace venue count pill with featured event pill when possible
  - "74 venues" → "Hawks vs Celtics 7:30pm"
- Ensure tonight/weekend counts are prominent
- Test track name clarity (do users understand "The Itis"?)

**Detail view:**
- Activity bar at top (tonight/weekend/free/total counts)
- Filter chips (All, Tonight, Weekend, Free, $$$+)
- Section labels ("Happening this week", "More restaurants")
- Featured venues: event rows (title, date, time, price, category)
- Compact grid: next event overlay on image

### Phase 3: Metrics & Iteration (Week 2+)

**Track these per track:**
- Click-through rate (banner → detail)
- Bounce rate (detail → venue)
- Time in detail view
- Filter usage (Tonight, Weekend, Free)
- Venue click distribution (are people only clicking top 3?)

**Success criteria for a track:**
- >30% CTR from banner
- <40% bounce rate from detail
- >2 venue clicks per session
- >80% of venues get at least 1 click per week (proves full list is valuable)

**Kill criteria:**
- <15% CTR after 2 weeks
- >60% bounce rate
- Only top 3 venues getting clicks (rest are dead weight)

---

## G. Content Quality Rubric

### Track-Level Quality Bar

A track is ready to ship when:

- [ ] Track name evokes a clear feeling or identity
- [ ] Category label clarifies theme in 2-3 words
- [ ] Description is specific, not generic (names places/concepts)
- [ ] Description is 1-2 sentences (40-60 words)
- [ ] Tonight/weekend counts are auto-calculated and accurate
- [ ] Featured event is compelling (not generic)
- [ ] Banner image fits the vibe (not stock photo)
- [ ] 8-15 venues total (HARD CAP)

### Venue-Level Quality Bar

A venue is track-worthy when:

- [ ] Clearly supports the track theme (no edge cases)
- [ ] Has editorial blurb (3 sentences / 60-80 words)
- [ ] Blurb has strong POV (opinionated, not Wikipedia)
- [ ] Blurb has insider tip or specific recommendation
- [ ] Has image (hero_image_url or image_url)
- [ ] Has upcoming events OR is evergreen destination
- [ ] Tags are accurate (for filtering)
- [ ] Is currently open (not permanently closed)

### Editorial Voice Standards

**Bad blurb (generic, no POV):**
> "Popular music venue hosting a variety of concerts and events throughout the year. Known for good sound quality and friendly staff."

**Good blurb (opinionated, specific, insider tip):**
> "Terminal West. Where indie darlings and hip-hop legends pack the same room. The sight lines are perfect from every angle, and the sound engineer actually knows what they're doing. Pro tip: skip the Westside parking nightmare and take the free shuttle from MARTA."

**Test: Would a local read this and nod in agreement?**

---

## H. FAQ / Objections

### "15 venues is too few - we have great data on 80+ music venues!"

**Response:** Quality beats quantity for discovery. Users have Google Maps for comprehensive lists. They come to LostCity for "What should I actually go to?" not "What are all the options?"

**The paradox:** Adding more venues lowers the value of each venue. At 15, each pick feels intentional. At 80, it feels algorithmic.

### "But what about all the venues we're excluding?"

**Response:** They still appear in:
- Search (anyone looking for them directly)
- Feed (curated or For You sections)
- Find view (map/list/cal with filters)
- Venue detail pages (related venues)

Tracks are NOT the canonical directory. They're editorial guides.

### "Users will complain we're missing [Venue X]"

**Response:** That's a feature, not a bug. When users suggest venues, it:
1. Engages them (they care about curation quality)
2. Gives us feedback (maybe we were wrong)
3. Proves the editorial voice has authority (people want to be included)

We should have a "Suggest a venue" button on every track detail page.

### "What if a track only has 6 good venues, not 15?"

**Response:** Ship it with 6. Better to have a tight 6 than padded 15. Examples:
- Atlas Obscura's "Secret LA" list: 9 places
- Infatuation's "Perfect For" lists: 7-12 places

**Quality bar > arbitrary count target.**

### "How do we decide which venues to keep vs cut?"

**Framework:**
1. Does it clearly support the track theme?
2. Is it genuinely excellent or notably unique?
3. Would a local recommend it to a friend?
4. Does it add diversity to the list (neighborhood, vibe, price point)?
5. Is it still open and active?

If 3+ "no" answers, cut it.

---

## I. Next Steps

### Immediate Actions (This Week)

1. **Audit current tracks**
   - For each of 15 tracks, count actual venue mappings
   - Identify which tracks have 40+ venues (auto-fill casualties)
   - Export full lists to CSV for manual curation

2. **Curate the 6 launch tracks**
   - Follow the 3-7-5 formula (icons + gems + rising stars)
   - Write editorial for each venue (60-80 words)
   - Set featured flags (5-7 per track)
   - Write track descriptions (NOT quotes on banners)

3. **Update banner design**
   - Move descriptions to banners (quotes stay on drill-in)
   - Prioritize featured events over venue counts in pills
   - Ensure tonight/weekend counts are prominent

4. **Ship and measure**
   - Deploy 6 tracks
   - Track CTR, bounce rate, venue click distribution
   - Collect user feedback ("Suggest a venue" button)

### Future Considerations (Next Month)

- **Seasonal tracks** ("Summer in Atlanta", "Holiday Lights", "Festival Season")
- **Special occasion tracks** ("Date Night Spots", "First-Time Visitor Hits", "Late Night Eats")
- **User-generated tracks** (let power users create & share lists)
- **Personalized tracks** (AI-curated based on user taste graph)

But first: **nail the core 6 with impeccable curation.**

---

## Appendix: Competitive Research Links

- [Infatuation Los Angeles Guides](https://www.theinfatuation.com/los-angeles) - 20-30 thematic guides, 12-25 venues each
- [Atlas Obscura Atlanta](https://www.atlasobscura.com/things-to-do/atlanta-georgia) - Hidden gems only, story-first
- [TimeOut Atlanta Best Of Lists](https://www.timeout.com/atlanta/things-to-do/best-things-to-do-in-atlanta) - Editor's picks, 30-50 lists
- [Eater Atlanta Essential Restaurants](https://atlanta.eater.com/maps/best-atlanta-restaurants-38) - 38 must-try spots, very selective
- [Thrillist Atlanta City Guide](https://www.thrillist.com/atlanta) - Opinionated, local voice

**Common pattern:** All successful guides have strong editorial POV, manageable list sizes (8-25), and specific use cases.

---

**END OF RESEARCH DOCUMENT**

