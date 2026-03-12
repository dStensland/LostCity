# HelpATL Wave 2 Research Synthesis

**Status:** Complete — 2026-03-08
**Wave 1 sources:** 1A (Mobilize), 1B (HOA/Golden), 1C (Eventbrite Charity), 1D (Legistar), 1EF (School Boards + P2/P3), 4AB (Competitor), 4C/5C (Civic Tech + Activism Orgs), 5AB (Volunteer Ecosystem + Govt Inventory)
**Feeds into:** `helpatl-content-strategy.md` §3, §4, §7, §10

---

## 1. Channel Viability Matrix

### Methodology

For each of the 9 proposed cause channels, I estimated monthly event supply by cross-referencing Wave 1 volume data across all four source types. "Viable" means a channel can sustain at least 5 upcoming events from 2+ source types without dead weeks in normal (non-peak) months.

**Monthly supply by source (baseline, non-peak):**

- HOA/Golden: ~851 timeslots/month total. By cause: food-security ~517, civic-community ~118, education ~154, environment ~78, health ~26, youth-family ~19, arts ~8, animals (animals category weak — mostly under Idealist/own platforms)
- Mobilize: ~30-50 civic-relevant in-person Atlanta metro/month. Key causes: housing 19, education 23, lgbtq 18, voting-rights 39, immigration 38, racial-equity 20, transit 16, healthcare 9, environment 7. NOTE: electoral/partisan events dominate (88%); truly civic-actionable events are ~30-50/month metro-wide.
- Legistar: DeKalb ~6/month, Fulton ~2/month. Atlanta BROKEN (0 until API is fixed). School boards: ~8-10/month combined (DeKalb 1-2, APS 3-4, FCS 3). Total crawlable government meetings today: ~16-20/month.
- Eventbrite Charity: ~150-170 net-new events/cycle from Atlanta. By subcategory: education ~16%, healthcare ~9%, human-rights ~8%, animal-welfare ~8%, environment ~4%, poverty ~10%. Price: 0 free events in 80-event sample — 100% paid/donation-based, which matters for the inclusion criterion (events above $50 excluded).

### Channel Viability Table

| Channel | HOA Volume | Mobilize Volume | Legistar Volume | Eventbrite Volume | Total Est./Month | Viable? |
|---|---|---|---|---|---|---|
| **Food Security** | 517 timeslots | 0 (not a Mobilize cause) | 0 (no direct meetings) | ~30 (poverty+hunger subcats) | **500+ timeslots, 30+ events** | YES — by far the richest |
| **Environment** | 78 timeslots | 7 events | 0 (EPA hearings not in Legistar) | ~20 events | **90-100** | YES — solid baseline |
| **Education** | 154 timeslots | 23 events | 8-10 school board meetings | ~25 Eventbrite events | **180-200** | YES — multi-source, strong |
| **Housing** | Partial (~20 via HOA civic) | 19 events | Zoning hearings (when Atlanta Legistar fixed) | ~20 events | **50-70** | YES — but Organize side thin without Legistar Atlanta |
| **Health** | 26 timeslots | 9 events | 0 | ~15 events | **40-50** | MARGINAL — viable but thin. Animal welfare/Eventbrite healthcare overlap muddies the count. |
| **Animals** | HOA animals category near-zero on Golden (not separately tracked; Lifeline/PAWS/Furkids on own platforms) | 0 | 0 | ~30 events (8% of sample = ~35/cycle) | **30-40** | MARGINAL — viable only if Eventbrite Charity URL added AND dedicated org crawlers built. Without them: 0 supply from HOA. |
| **Transit** | 0 (no HOA transit category) | 16 events | MARTA board 2-3/month (not yet crawled) | ~5 events (BeltLine) | **20-25** | MARGINAL — barely viable. ThreadATL/CFPT have low frequency. Feed would die without MARTA board. |
| **Public Safety** | 0 | 0 (Mobilize has no neutral public-safety content) | Police oversight board (when Atlanta Legistar fixed) | 0 | **0-5** | NO — empty at launch. Politically loaded. Highest editorial risk. |
| **Arts & Culture** | 8 timeslots | 0 | Arts commission (irregular) | ~10 events | **15-20** | NO — volume too thin. HOA arts is 0.9% of their total. Without dedicated arts org crawlers, this channel is empty. |

### Go / No-Go Decision Per Channel

**GO (seed in v1):**

1. **Food Security** — Dominant HOA category (517 timeslots/month). No risk of dead weeks. Multiple source types. Engage tags: `volunteer`, `donate`, `attend`.

2. **Education** — HOA (154), school boards (8-10 meetings/month), Mobilize (23 events), Eventbrite (25). Crosses all three modes organically. Strong anchor for Participate mode.

3. **Environment** — HOA (78), Mobilize (7), Eventbrite (~20). Park cleanups, tree planting, EPA hearings. Natural cross-mode channel. Peak season (March-April) spikes significantly.

4. **Housing** — Mobilize (19), Eventbrite (20), zoning hearings from Legistar. Thin on Serve side (Habitat uses GivePulse, not HOA), but Participate and Organize modes carry it. Build ACFB/Habitat crawlers to strengthen Serve side.

**CONDITIONAL GO (seed in v1 with explicit thin-channel warning):**

5. **Health** — 40-50 events/month, but source mix is weak. HOA health events (26) are the anchor; Eventbrite Healthcare adds 15. Mobilize healthcare (9) is LGBTQ-adjacent and not neutrally framed. Go if we're honest that this channel will feel thin and commit to adding org-specific crawlers (Open Hand, hospitals) in v2.

**NO-GO at launch, revisit in v2:**

6. **Animals** — Viable in principle but HOA coverage is near-zero (animals category is weak on Golden). All Atlanta animal volume lives on LifeLine, PAWS, Furkids own platforms and Eventbrite. Must build those org-specific crawlers AND add the Eventbrite Charity URL first. Do not launch this channel empty. Estimated build time to viability: 3-4 weeks of dedicated crawler work.

7. **Transit** — 20-25 events/month but extremely concentrated: Mobilize carries most of it. ThreadATL and CFPT both hold ~1 public event/month. Without MARTA board meetings crawled, dead weeks are likely outside peak advocacy moments. Add after MARTA board crawler is live.

8. **Public Safety** — Zero supply from any crawlable source today. Police oversight board depends on Atlanta Legistar being fixed (currently broken). The cause itself is politically loaded in ways that make neutral editorial framing difficult (see 4C research). Do not launch this channel in v1 under any circumstances.

9. **Arts & Culture** — 15-20 events/month from HOA + Eventbrite. Too thin and HOA's arts category is 0.9% of their inventory. Not distinctive enough to earn a channel slot over channels with 10x the volume. Defer until arts org crawlers (Fulton County Arts, ArtsATL, individual venue event calendars) are built.

### Revised v1 Channel Set

**Launch with 4 confirmed + 1 conditional:**
1. Food Security
2. Education
3. Environment
4. Housing
5. Health (conditional — honest about thin coverage)

This is fewer than the 5-6 originally proposed, but more honest. An empty channel at launch teaches users the platform doesn't work. Four solid channels teach them what HelpATL is.

---

## 2. Tag Inference Rule Set

### Philosophy

Manual tagging is not a strategy. Every tag in v1 must be inferable at crawl time from either (a) source identity or (b) high-confidence keyword patterns. Where inference fails, the event goes untagged rather than mis-tagged.

### 2A. Source-Based Tagging (Highest Confidence, Apply First)

These rules fire on source identity before any text analysis. They are correct by construction.

#### HOA / Golden Volunteer (Hands On Atlanta)

```python
# HOA platform-level tags (all events from this source)
BASE_TAGS = ["volunteer", "drop-in"]
BASE_CATEGORY = "community"

# HOA category-to-cause mapping (from Golden category field)
HOA_CATEGORY_CAUSE_MAP = {
    "Hunger + Food Insecurity": ["food-security"],
    "Environment + Sustainability": ["environment"],
    "Education": ["education"],
    "Civic + Community": [],  # too broad — fall through to keyword matching
    "Health + Wellness": ["health"],
    "Youth + Family Services": ["youth"],
    "Arts + Culture": ["arts-culture"],
    "Civil + Human Rights": ["housing"],  # HOA's civil-rights category skews housing/equity
    "Senior Services": ["health"],
    "Court Ordered Approved": [],  # administrative tag, not a cause
    "Family Friendly": [],  # cross-cutting tag, not a cause — add as flag
}

# HOA engagement tags: all events are Serve mode
ENGAGEMENT_TAGS = ["volunteer"]

# Commitment inference from description keywords
ORIENTATION_KEYWORDS = ["orientation required", "training required", "background check",
                         "must complete", "prior training", "certification required"]
# If any keyword found → remove "drop-in", add "orientation-required" or "training-required"
```

**Accuracy estimate:** 85-90% for cause tags when HOA category is populated and specific. The "Civic + Community" category (13.9% of timeslots) is too broad and falls through to keyword matching.

#### Mobilize.us

```python
# Mobilize source-level tags (all events from this source)
# NOTE: All Mobilize events are Organize mode
BASE_CATEGORY = "community"

# Mobilize event_type → engagement tag
MOBILIZE_TYPE_ENGAGEMENT_MAP = {
    "RALLY": ["rally"],
    "COMMUNITY": ["attend"],
    "SOLIDARITY_EVENT": ["rally"],
    "VISIBILITY_EVENT": ["rally"],
    "MEETING": ["organize"],  # Note: public meetings vs. internal organizer meetings — differentiate below
    "TOWN_HALL": ["public-comment", "attend"],
    "WORKSHOP": ["attend"],
    "TRAINING": ["attend"],
    "VOTER_REG": ["canvass"],  # voter registration is outreach, not canvassing, but closest tag
    "COMMUNITY_CANVASS": ["canvass"],
    "FUNDRAISER": ["donate"],
    "MEET_GREET": ["attend"],
    "DEBATE_WATCH_PARTY": ["attend"],
    # Exclude: CANVASS, PHONE_BANK, TEXT_BANK, AUTOMATED_PHONE_BANK, RELATIONAL,
    #          FRIEND_TO_FRIEND_OUTREACH, LETTER_WRITING, POSTCARD_WRITING,
    #          PETITION, PLEDGE, INTEREST_FORM, DONATION_CAMPAIGN,
    #          SOCIAL_MEDIA_CAMPAIGN, DATA_ENTRY, POLL_MONITORING, HOTLINE
}

# Cause tags inferred from description text (see keyword section below)
# org_type signals:
# - C3/C4 + is_nonelectoral → reliable civic content
# - GRASSROOTS_GROUP → mixed; apply stricter keyword check
# - CAMPAIGN/PARTY_COMMITTEE → exclude from main feed (electoral)
# - GOVERNMENT → civic-always, tag with relevant jurisdiction
```

**Accuracy estimate:** 90%+ for engagement tags (event_type is structured and reliable). 70% for cause tags (description keyword matching per section 2B below).

#### Legistar (DeKalb, Fulton, future Atlanta)

```python
# Legistar source-level tags
BASE_CATEGORY = "community"

# Jurisdiction tag from source identity
LEGISTAR_JURISDICTION_MAP = {
    "dekalbcountyga": "dekalb-county",
    "fulton": "fulton-county",
    "atlanta": "city-atlanta",  # for when it's fixed
}

# All Legistar events
BASE_ENGAGEMENT_TAGS = ["attend"]

# Public comment detection from EventItems
# If any EventItemTitle contains "PUBLIC COMMENT" or "COMMENT FROM THE PUBLIC"
# → add engagement tag "public-comment"
# → remove "attend"

# Body-to-cause mapping (from EventBodyName field)
LEGISTAR_BODY_CAUSE_MAP = {
    "Planning Commission": ["housing"],
    "Zoning Board of Appeals": ["housing"],
    "Board of Commissioners - Zoning Meeting": ["housing"],
    "Transportation Committee": ["transit"],
    # Full Council / Committee of the Whole → no single cause tag (multi-topic)
}

# Jurisdiction tag always applied; cause tag only when body is cause-specific
```

**Accuracy estimate:** 95%+ for engagement and jurisdiction tags (structured API fields). Cause tags only for specific-body meetings (~20% of meetings). Full-council meetings get no cause tag — intentionally, they're multi-topic.

#### School Boards (APS, FCS, DCSD)

```python
# Source-level tags for all three school board crawlers
BASE_CATEGORY = "community"
CAUSE_TAGS = ["education"]
ENGAGEMENT_TAGS = ["attend"]
JURISDICTION_MAP = {
    "atlanta-public-schools-board": "aps",
    "fulton-county-schools-board": "fulton-schools",
    "dekalb-county-schools-board": "dekalb-schools",
}

# Public comment detection:
# DCSD: "Community Input Session" is a standing agenda item — hardcode public-comment tag for all DCSD meetings
# APS: Not confirmed as standing item — default to "attend" unless description keyword match
# FCS: Not a standing item — default to "attend"
```

**Accuracy estimate:** 99% for cause and jurisdiction tags (source identity is definitive). Public-comment tag: 95% accurate for DCSD (hardcoded), ~50% for APS/FCS (needs description check).

#### Eventbrite Charity & Causes

```python
# Eventbrite category-level tags (when category = "Charity & Causes")
BASE_CATEGORY = "community"

# Subcategory → cause tag mapping
EVENTBRITE_CHARITY_SUBCAT_CAUSE_MAP = {
    "Education": ["education"],
    "Running": [],  # 5K/10K fundraiser runs — no cause tag unless org keyword match
    "Poverty": ["food-security", "housing"],
    "Healthcare": ["health"],
    "Human Rights": ["housing"],  # human rights on Eventbrite is mostly housing/immigration
    "Animal Welfare": ["animals"],
    "Environment": ["environment"],
    "Career": [],  # skip — often job/workforce adjacent
    "Mental Health": ["health"],
    "Other": [],  # fall through to keyword matching
}

# Engagement tag by Eventbrite format
EVENTBRITE_FORMAT_ENGAGEMENT_MAP = {
    "Dinner or Gala": ["donate"],
    "Race or Endurance Event": ["volunteer"],  # participants are effectively volunteers
    "Class, Training, or Workshop": ["attend"],
    "Seminar or Talk": ["attend"],
    "Meeting or Networking Event": ["attend"],
    "Tournament": [],  # sports/gaming tournaments — weak civic signal
    "Concert or Performance": [],  # not civic content
    "Conference": ["attend"],
}

# Filter: exclude events with ticket price > $50 (inclusion criterion)
# Filter: exclude is_online_event = True (virtual races/events)
```

**Accuracy estimate:** 80% for cause tags when subcategory is populated and specific. "Other" subcategory (25% of events) falls through to keyword matching, which reduces to ~65% accuracy for that slice.

---

### 2B. Keyword-Based Cause Tagging (Applies after source-based rules)

Used when: source provides no structured cause signal (Mobilize description text, Eventbrite "Other" subcategory, HOA "Civic + Community" category).

**Keyword patterns per cause, derived from actual event title/description samples in Wave 1 audits:**

```python
CAUSE_KEYWORD_PATTERNS = {
    "food-security": [
        # Direct food programs (HOA/ACFB sample vocabulary)
        "food bank", "food pantry", "food sort", "food distribution", "food drive",
        "hunger", "meal", "meal delivery", "meal prep", "meal service",
        "grocery", "nutrition", "food insecurity",
        "feed the hungry", "feed the homeless", "food access",
        "lunchbag", "backpack program", "commodity", "usda",
        "food pick", "food rescue", "gleaning",
        # Mobilize/advocacy vocabulary
        "food justice", "food policy", "food desert", "snap benefits",
    ],
    "environment": [
        # HOA/Park Pride/Trees Atlanta sample vocabulary
        "cleanup", "clean up", "clean-up", "litter", "trash", "debris removal",
        "tree planting", "tree", "reforestation",
        "park", "trail", "greenway", "watershed", "river sweep", "stream",
        "nature", "wildlife", "native plant", "invasive species",
        "recycling", "compost", "sustainability",
        # Mobilize advocacy vocabulary
        "climate", "climate change", "carbon", "fossil fuel", "clean energy",
        "solar", "conservation", "environment", "epa", "emissions",
    ],
    "education": [
        # HOA/school board sample vocabulary
        "tutor", "tutoring", "mentor", "mentoring", "literacy", "reading",
        "stem", "school", "student", "homework", "after-school", "after school",
        "college", "youth program", "youth education", "academic",
        "library", "books", "book drive",
        # School board/Mobilize vocabulary
        "school board", "board of education", "school budget", "school closing",
        "aps forward", "education funding", "public school",
    ],
    "housing": [
        # Habitat/HOA sample vocabulary
        "habitat for humanity", "build day", "home repair", "housing",
        "shelter", "homeless", "houseless", "transitional housing",
        # Mobilize/Legistar vocabulary
        "zoning", "rezoning", "variance", "affordable housing", "eviction",
        "tenant", "landlord", "rent", "displacement", "gentrification",
        "housing authority", "development", "land use",
    ],
    "health": [
        # HOA health sample vocabulary
        "health fair", "blood drive", "blood donation",
        "wellness", "mental health", "clinic",
        "first aid", "cpr", "aed",
        # Mobilize/Eventbrite vocabulary
        "healthcare", "health care", "medicaid", "medicare", "insurance",
        "disability", "accessibility", "abled",
        "harm reduction", "overdose", "naloxone",
        # LGBTQ health (from Mobilize sample)
        "lgbtq health", "hiv", "prep", "transgender healthcare",
    ],
    "animals": [
        "animal", "shelter", "foster", "adoption", "adopt a pet",
        "dog", "cat", "rescue", "spay", "neuter",
        "lifeline", "paws atlanta", "furkids", "humane society",
        "wildlife", "animal welfare", "animal rights",
    ],
    "transit": [
        "marta", "bus", "transit", "transportation", "rail",
        "bike lane", "bicycle", "pedestrian", "walkability",
        "beltline", "streetcar", "light rail", "highway",
        "commute", "traffic", "parking",
        "thread atl", "cfpt", "transpo", "transit equity",
    ],
    "public-safety": [
        # Use with caution — see exclusion note below
        "police", "law enforcement", "court", "criminal justice",
        "community safety", "neighborhood watch", "public safety",
        "oversight", "accountability", "reform",
        "incarceration", "prison", "reentry",
    ],
    "arts-culture": [
        "art", "mural", "gallery", "museum", "cultural",
        "arts education", "music education", "theater",
        "heritage", "preservation", "historic",
        "community art", "arts access",
    ],
    "immigration": [
        # Not a channel in v1, but tag-inferable for Mobilize events
        "immigration", "immigrant", "ice", "deportation",
        "daca", "asylum", "refugee", "glahr", "undocumented",
    ],
}

# Minimum keyword density for cause assignment: 1 match in title OR 2 matches in description
# Exception: proper nouns (MARTA, Habitat for Humanity, LifeLine) are 1-match sufficient anywhere
```

**Estimated keyword tagging accuracy by cause:**

| Cause | Keyword Accuracy | Notes |
|---|---|---|
| food-security | 90%+ | Vocabulary is distinctive; false positives rare |
| environment | 85% | "Park" alone is ambiguous (social events at parks); requires 2+ signals or title match |
| education | 85% | "School" alone is ambiguous; "school board" is definitive |
| housing | 80% | "shelter" is ambiguous (emergency shelter vs. storm shelter); "habitat" is definitive |
| health | 70% | Broadest cause — many co-occurring signals needed to avoid tagging anything medical-adjacent |
| animals | 90%+ | Very distinctive vocabulary; low false-positive risk |
| transit | 85% | "MARTA" and "BeltLine" are definitive; "bike" alone can be event non-civic |
| public-safety | 50% | High false-positive and political skew risk — use cautiously, see note below |

**Note on public-safety keyword tagging:** Do not apply keyword-based public-safety tags automatically. The word "police" in a "No Kings" rally title means something completely different than in a "Neighborhood Watch" event. This cause requires structured source-level inference (police oversight board from Legistar, specific known orgs) or human review — not keyword matching. Exclude from v1 automated tagging.

---

### 2C. What Cannot Be Reliably Tagged

**Commitment level (drop-in vs. training-required):** HOA's Golden platform shows the word "Orientation" in some listings but it's in free-text description, not a structured field. Keyword matching for "orientation required" catches ~40% of cases. The other 60% require either (a) direct API field access (Golden API, gated behind partnership) or (b) accepting that commitment level is untagged for most events in v1. Recommendation: default all HOA events to `drop-in` tag unless explicit negative signals ("background check required," "orientation required," "must attend training") are found in description. This is an acceptable false-positive direction — better to tag something as drop-in that requires a brief orientation than to miss a genuinely drop-in opportunity.

**Multi-cause events:** The single-largest failure mode. "Young People's Hearing" at City Hall touches education, housing, and healthcare simultaneously. A "Liberty and Justice" rally may list 7 causes in its description. Policy: assign all cause tags matched (multi-tag is fine); rank by keyword density for primary-cause display. Do not attempt to pick one winner — it causes more misclassification than multi-tagging.

**Electoral vs. civic Mobilize events:** `is_nonelectoral` on the sponsor object is the only reliable signal. Keyword-based detection of electoral content ("vote for," "elect," "campaign contribution") has too many false positives (a GOTV event is both civic and electoral). Use `is_nonelectoral` flag directly; do not attempt keyword-based electoral filtering.

**Fallback for untaggable events:** Events with no cause tag from either source-based or keyword rules get `category = "community"` with no cause tag. They still appear in the feed (unfiltered view) and in geo channels. They simply don't appear in cause channels. This is correct behavior — better invisible in cause channels than incorrectly classified.

---

## 3. Feed Volume Projections

### Methodology

Weekly projections assume: all confirmed v1 sources are crawled (HOA, Mobilize, Legistar DeKalb+Fulton, school boards, Eventbrite Charity URL added). The Idealist API is not approved yet. United Way and JustServe are deferred. MARTA board is not yet crawled.

Monthly → weekly conversion: divide by 4.3, then apply rolling 14-day window for Participate/Organize (they use 14-day lookahead vs. 7-day for Serve).

---

### Feed Section Volume Table

| Feed Section | Mode | Sources | Events/Week (Normal) | Events/Week (Peak) | Dead Weeks? | Viable? |
|---|---|---|---|---|---|---|
| **This Week: Volunteer** | Serve | HOA (851 timeslots/month), Eventbrite Charity (~35/week net-new) | 200-230 items | 500+ (MLK Day, April, Nov) | Never | YES — overwhelmingly so |
| **Public Meetings** | Participate | Legistar DeKalb+Fulton (8/month), School Boards (2-3/week net), MARTA (deferred) | 4-6 meetings per 14-day window | 8-10 | Rare — mid-summer recesses | YES — marginal but sustainable |
| **Taking Action** | Organize | Mobilize (~30-50 civic/month = 7-12/week), Eventbrite advocacy (~10/week) | 10-20 events | 30+ (election season, protest surges) | Possible (political off-seasons) | YES — with explicit fragility |
| **Your Neighborhood** | All | Geo-filtered from above | Depends on user location | — | If sparse ITP coverage | CONDITIONAL — see notes |

---

### Detailed Analysis Per Section

#### This Week: Volunteer (Serve Mode)

**Non-peak baseline:** HOA alone produces ~200 timeslots/week. At an ~85% unique-event dedup rate (many timeslots are recurring series), that's ~170 distinct volunteer opportunities visible on any given week. Eventbrite Charity adds ~35 net-new events/week.

**Feed display:** This section will always have content — the question is how to surface signal from the volume. At 200+ items, the feed should NOT show all of them. The section should show 6-8 representative events by cause diversity, with "See all volunteer events" routing to a filtered view.

**Peak handling:** MLK Day weekend produces 400+ HOA projects in a single day. The feed architecture must handle this gracefully — a dedicated "MLK Day" feed section (promoted from regular volunteer section) 2 weeks before the event, collapsing back to normal after.

**Quality concern:** 61% of HOA timeslots are food-related. Without deliberate cause diversity in display logic, the volunteer section will look like a food bank directory. Display logic must sample across causes, not just sort by date.

#### Public Meetings (Participate Mode)

**Baseline:** DeKalb (~6/month) + Fulton (~2/month) + 3 school boards (~8-10/month) = 16-18 meetings/month. Per 14-day lookahead window: ~8-9 upcoming meetings at any given time.

**This is below the strategy's original launch threshold** (10 upcoming meetings from 2+ jurisdictions). However, counting against two counties + three school districts = 5 distinct jurisdictions. The threshold should be interpreted as 2+ jurisdictions, not 2+ sources. Current crawlable supply meets that interpretation.

**Dead week risk:** Summer recesses (mid-July to mid-August) reduce school board activity significantly. Government meetings continue. Net expected dip: 4-5 meetings/14-day window during peak recess. The section should remain visible if there are 3+ upcoming meetings — hiding it entirely during recesses would create a confusing "where did this go?" experience.

**The Atlanta Legistar gap:** Atlanta City Council alone adds an estimated 15-25 meetings/month (full council + 7 committees). When the Legistar API is fixed, this section doubles. Until then, the section is viable but thin. Do not represent to users that they're seeing all Atlanta government meetings — they're not.

**What would make this section genuinely strong:** Add NPU meetings as recurring events (25 NPUs × 1/month = 25 additional meetings). The research (5AB) suggests seeding NPU meetings as recurring series manually. This would transform the Public Meetings section from thin-but-viable to rich. This should be a Week 1 data task, not a crawler build — it's 25 manual record creates.

#### Taking Action (Organize Mode)

**Baseline:** 30-50 Mobilize metro events/month. After filtering electoral/partisan content and non-public-facing types (CANVASS, PHONE_BANK, etc.), realistic Atlanta civic events per Wave 1 audit: ~125 in-person metro events total, but only ~37 from nonelectoral orgs statewide, and approximately 50-70 public-facing types (COMMUNITY, RALLY, SOLIDARITY_EVENT, MEETING, TOWN_HALL, WORKSHOP, VOTER_REG). Per week: 10-15 events.

**The electoral content challenge:** 88% of Mobilize events are partisan/electoral. The filtering logic must be aggressive or this section will look like a Democratic Party organizing hub. The `is_nonelectoral` flag on the sponsor is the cleanest filter, but it cuts supply to ~37 events statewide — approximately 15-20 in the Atlanta metro. That's ~4-5/week at current volumes. Acceptable but thin.

**Alternatively:** Include all public-facing event types regardless of electoral status, but label them transparently ("via Indivisible ATL," "via Democratic Party of Georgia"). Let users self-sort. This produces 10-15/week but requires explicit source attribution to maintain platform neutrality. The 4C/5C research strongly recommends this labeling approach.

**Dead week risk:** Political organizing ebbs significantly in off-election years (2027). In 2026 with midterm prep building, volumes will be higher than normal. Plan for thin summers (June-August) when many organizing campaigns are in planning/quiet mode.

**Political balance note (from 4C research):** Taking Action sourced primarily from Mobilize will skew progressive/Democratic. This is factually unavoidable given Mobilize's design. Mitigation: (1) explicit source attribution, (2) add Eventbrite civic/advocacy events (which capture conservative-adjacent events like Chamber events, NAACP events across the political spectrum), (3) do not describe the section as "civic action" — describe it as "advocacy and organizing events" to set accurate expectations.

#### Your Neighborhood (Geo-Filtered)

**Assessment:** This section is conditional on geo data quality and user location. With the current events DB, venues do have lat/lng in most cases. But the matching engine currently does not implement the `geo` rule type — this is a confirmed technical blocker (noted in `helpatl-content-strategy.md` §8).

**Volume with geo filter:** If user is in ITP Atlanta, geo-filtering the 16-18 meetings/week and 10-15 Organize events and 170+ Serve events to within 10 miles will return meaningful results. If user is in OTP (Marietta, Duluth), government meeting coverage drops sharply (no Cobb/Gwinnett Legistar crawlers in v1).

**Recommendation:** Do not launch Your Neighborhood section in v1 until the geo rule is implemented in the matching engine. Show it only after user location is set. Hide it entirely rather than showing un-geo-filtered content labeled as "your neighborhood."

---

### Updated Launch Thresholds

The original thresholds from `helpatl-content-strategy.md` §10 were:

| Mode | Original Minimum | Original Target |
|---|---|---|
| Serve | 20 upcoming events from 3+ sources | 50+ events from 5+ sources |
| Participate | 10 upcoming meetings from 2+ jurisdictions | 30+ meetings covering city + 2 counties + 3 school boards |
| Organize | 5 upcoming events from 1+ source | 15+ events from 2+ sources |

**Updated thresholds based on Wave 1 data:**

| Mode | Revised Minimum | Rationale |
|---|---|---|
| Serve | 50 upcoming drop-in events from 2+ sources | Original minimum (20) is too easy — HOA alone exceeds it before any dedup. Raise to 50 to ensure actual diversity of content |
| Participate | 8 upcoming meetings from 3+ jurisdictions within 14 days | Revised from "2+ jurisdictions" to "3+ jurisdictions" — with DeKalb, Fulton, and school boards, 3 is achievable today and prevents a two-body monopoly that would feel thin |
| Organize | 8 upcoming events from 2+ orgs | Original minimum (5) is achievable from a single day of Mobilize. Raise to 8, and require 2+ orgs to ensure the section doesn't look like one organization's event page |
| Interest Channels | 3 channels each with 5+ upcoming matches | Start lower than 5 channels — better to launch 3 working channels than 5 with 1-2 empty |

**Minimum viable launch state:** All three mode sections have content, at least 3 interest channels have matches, and no section has been empty for the prior 7 days.

---

## 4. Key Decisions Requiring Human Input

These are not technical questions. They are product and strategy decisions with meaningful tradeoffs.

---

### Decision 1: Electoral Content Inclusion Policy

**Question:** Should the Taking Action section include electoral/partisan Mobilize events (with source labeling) or filter them to nonelectoral only?

**Option A — Nonelectoral only (`is_nonelectoral: true` filter)**
- Supply: ~15-20 Atlanta events/week
- Risk: Section sometimes thin; misses high-interest events (e.g., a major rally even if organized by a partisan group is genuinely newsworthy)
- Benefit: Clean platform positioning; no political controversy about "choosing sides"

**Option B — All public-facing types with explicit source labeling**
- Supply: ~30-50 Atlanta events/week
- Risk: Platform will visibly skew progressive/Democratic given Mobilize's composition; could alienate non-progressive users
- Benefit: Fuller content, more compelling feed, accurately reflects what's happening civically

**Option C — Source-type based, not electoral-flag based**
- C3/C4 orgs: always include
- GRASSROOTS_GROUP orgs: include COMMUNITY, RALLY, SOLIDARITY, TOWN_HALL; exclude CANVASS, PHONE_BANK
- CAMPAIGN/PARTY_COMMITTEE: exclude entirely
- Supply: ~25-35 Atlanta events/week
- Benefit: Principled middle ground; includes advocacy without electoral operations

**Recommendation from research:** Option C. The `is_nonelectoral` flag is too restrictive (cuts 88% of Mobilize content including legitimate rallies), and Option B risks making the platform look like a Democratic organizing tool. Option C keeps the genuinely public-facing events while excluding partisan operations.

---

### Decision 2: Channel Launch Count

**Question:** Launch with 4 confirmed channels (Food Security, Education, Environment, Housing) or include Health as a 5th despite thin coverage?

**Arguments for 4:**
- Health coverage is genuinely thin at launch (40-50 events/month, weak source diversity)
- A channel with sparse content teaches users the platform doesn't have what they need
- 4 strong channels beat 5 mixed-quality channels

**Arguments for 5:**
- Health is a common civic concern; excluding it makes the platform feel incomplete
- Even 40-50 events/month is enough to show 4+ upcoming events in the section at any time
- Can always suppress the channel display if matches drop below threshold

**Recommendation from research:** Launch with 4, add Health in month 2 after the Eventbrite Charity URL change and Mobilize crawler are live. Health coverage improves meaningfully once those sources are crawled. Committing to it at launch before those sources are running risks a dead channel in the first weeks.

---

### Decision 3: Feed Structure — Tabs vs. Separate Sections

**Question:** Should Serve / Participate / Organize be three separate scrollable feed sections, or one section with mode tabs?

**Volume reality check from projections:**
- Serve: 170-230+ items/week (needs aggressive curation to show 6-8)
- Participate: 8-9 meetings/14 days (shows all, no curation needed)
- Organize: 10-15 events/week (shows 4-6 with "see all")

**The asymmetry problem:** Serve has 20-30x the volume of Participate. In a single scrollable feed, Serve will visually dominate regardless of design. Users who primarily care about government meetings will scroll past an ocean of food bank shifts. This is the wrong experience.

**Option A — Three separate sections (current strategy)**
- Pros: Clear mode separation, each section can have its own editorial voice
- Cons: Organize section may be too thin to earn its own section some weeks (4-5 events)
- Risk: Thin sections communicate "nothing is happening" even when Serve is overflowing

**Option B — One section with three tabs (Serve / Participate / Organize)**
- Pros: Solves the volume asymmetry; user self-selects mode; thin Organize tab is fine inside a tab structure
- Cons: Buries content behind tabs; users may not discover all three modes; tab UX is harder to make feel alive
- Risk: Default tab (Serve) becomes the only thing most users see; Participate and Organize have lower discoverability

**Option C — Hybrid: Primary section (Serve), compact preview sections for Participate and Organize**
- Serve: Full scrollable section with 6-8 cards + "see all"
- Participate: 3-card compact row ("What's being decided") + "See all meetings"
- Organize: 3-card compact row ("Taking action") + "See all actions"
- Pros: All three modes visible in one scroll; Serve volume doesn't hide the others
- Cons: Participate and Organize feel secondary; may underrepresent their importance

**Recommendation from research:** Option C (Hybrid). The volume data makes equal-treatment sections wrong — Serve will always dominate numerically. Compact preview rows with clear "See all" routing to full filtered views is the right access-layer model per the feed philosophy. The homepage should feel alive (Serve dominates) while surfacing that there's more depth (meetings row, action row below). This matches LostCity's broader feed philosophy: "reduce friction, preserve agency."

---

### Decision 4: NPU Meetings — Manual Seed vs. Wait for Crawler

**Question:** Should we manually seed 25 NPU recurring events now, or wait for an NPU calendar crawler?

**Context:** 25 NPU meetings/month would significantly strengthen the Participate section. The city planning calendar (`atlcitydesign.com`) may or may not have reliable machine-readable data (not confirmed by Wave 1 research). Manual seeding is ~2-3 hours of data entry for a data specialist.

**Arguments for seeding now:**
- Each NPU meets on the same day/time every month — high data stability, low maintenance risk
- 25 meetings/month transforms Participate section from thin to rich
- No crawler needed; direct DB inserts as recurring events

**Arguments for waiting:**
- Manual data can go stale (NPUs sometimes change meeting day/time/location)
- 25 records is non-trivial if several need address corrections later
- Dependency on someone knowing each NPU's schedule

**Recommendation from research:** Seed the top 10-12 NPUs (those covering ITP neighborhoods: NPU-E (Midtown), NPU-F (Buckhead/Garden Hills), NPU-N (Atlantic Station/English Ave area), NPU-O (Old Fourth Ward/Inman Park), NPU-T (Little Five Points/Candler Park), etc.) as manual recurring events now. Defer the OTP NPUs to v2. This is ~1-2 hours of work, provides meaningful content lift, and covers the neighborhoods most HelpATL users will live in. This is a high-leverage, low-risk action item.

---

### Decision 5: The Eventbrite Price Filter

**Context:** The current `helpatl-content-strategy.md` §10 inclusion criteria says "Must be free or donation-based (no paid ticket events above $50)." The Eventbrite Charity audit found 0 free events in the 80-event sample — every event had a ticket price or donation amount.

**This creates a conflict:** If we add the Eventbrite Charity URL (recommended — 10-minute config change), and we enforce the $50 price cap, many legitimate events may get excluded. A charity gala at $200/ticket is not useful for a civic feed; a $25 charity walk is.

**Options:**
- Keep $50 cap: Filters most galas, keeps walks and workshops. Some legitimate community events at $60-75 might be cut.
- Raise cap to $100: Catches more events, including some galas that are out of audience range.
- Price-by-category: Free cap for volunteer events; $100 cap for fundraiser events; no cap for government meetings (always free).
- No price cap for Eventbrite Charity: Surface all, trust the dedup system and user judgment.

**Recommendation from research:** Price-by-category is the right model in principle but requires subcategory data to implement cleanly (Eventbrite subcategory requires adding `subcategory` to the expand parameter). For v1, apply a $75 cap to Eventbrite Charity events. This keeps charity walks ($25-50 registration), workshops ($30-60), and community events while filtering black-tie galas ($150+). Revisit when subcategory-aware pricing is implemented.

---

## 5. Summary: What to Build in What Order

Prioritized by impact on feed viability, not by implementation difficulty.

### Week 1 (Data tasks, no crawler builds required)

1. **Add Eventbrite Charity URL** to `crawlers/sources/eventbrite.py` + add `is_online_event` filter — 10 minutes. Immediate +30-35 weekly events.
2. **Seed 10-12 ITP NPU meetings** as recurring events — 2-3 hours. Transforms Participate section.
3. **Activate DeKalb Legistar crawler** (fully crawlable, no blockers) — 1-2 days for crawler-dev.
4. **Activate Fulton County Legistar crawler** (same API schema as DeKalb) — 1-2 days for crawler-dev.

### Week 2-3 (Crawler builds)

5. **Build HOA/Golden Playwright crawler** — highest leverage single crawler (~170 unique opportunities/week). Addresses the Serve section volume gap immediately.
6. **Activate DeKalb County Schools crawler** (`/board/meeting-calendar` is clean HTML, lowest-effort school board) — 1 day.
7. **Build Mobilize.us API crawler** (fully public API, documented in Wave 1) — 2-3 days. Unlocks Organize mode and Taking Action section.

### Week 3-4 (Parallel)

8. **Submit Idealist/VolunteerMatch API inquiry** — 1 hour. 2-4 week response timeline.
9. **Activate APS Board crawler** (Playwright against JS calendar) — 2-3 days.
10. **File Granicus support ticket** about broken Atlanta Legistar API — 1 hour. Could unlock 15-25 meetings/month.

### Month 2

11. Build MARTA board crawler (strengthens Transit channel viability)
12. Add Health channel to HelpATL once Eventbrite Charity + Mobilize sources are live
13. Evaluate JustServe and Fulton Schools crawler (PDF calendar difficulty — assess with fresh eyes)
14. Build animal org crawlers (LifeLine, PAWS, Furkids) to support future Animals channel

---

*Wave 2 Synthesis complete. Ready to update `helpatl-content-strategy.md` with validated numbers and decisions pending human input on the 5 open decisions above.*
