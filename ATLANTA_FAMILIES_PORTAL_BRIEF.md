# Atlanta Families Portal - Content Design Brief

## Objective
Design the optimal portal experience for Atlanta families, making it THE go-to resource for family-friendly events and activities in Atlanta.

---

## Tasks for Content Designer

### 1. Current State Analysis
Explore and document:
- **Portal configuration**: Check database for existing Atlanta Families portal setup
- **Main Atlanta portal**: What sources, categories, venues exist?
- **Crawlers**: Review `crawlers/sources/` for available event sources
- **Schema**: Look at `lib/portal.ts`, `lib/portal-context.tsx`, portal tables

### 2. Content Structure Recommendations
Design the information architecture:
- **Feed experience**: How should curated content be organized?
- **Category emphasis**: Which categories for families? (museums, parks, theaters, libraries, festivals)
- **Category hiding**: What to exclude? (nightlife, bars, 21+)
- **Default filters**: Age-appropriate, family-friendly by default
- **Time-based organization**: Weekends, school breaks, after-school, summer camps

### 3. Source Curation
From the main Atlanta portal, determine:

**Include (family-friendly):**
- Museums (Children's Museum, Fernbank, High Museum family programs)
- Libraries (Fulton County Library system)
- Parks & outdoor (Piedmont Park, Stone Mountain, botanical gardens)
- Theaters (family shows, puppet theaters)
- Sports (Braves, United family sections)
- Festivals (appropriate ones)
- Educational venues
- Zoos, aquariums, science centers

**Exclude:**
- Nightlife venues
- Bars, breweries (unless family hours)
- 21+ events
- Adult entertainment
- Late-night shows

**Add new sources:**
- Atlanta Parent magazine events
- Local school district calendars
- Library story times
- Recreation center programs
- Summer camps
- Birthday party venues

### 4. Family-Specific Customization Ideas

**Age Appropriateness:**
- Toddler (0-3)
- Little Kids (4-7)
- Big Kids (8-12)
- Teens (13-17)
- All Ages
- Adults can enjoy too

**Practical Info Parents Need:**
- Cost level (Free / $ / $$ / $$$)
- Duration estimate
- Energy level required (chill vs active)
- Indoor vs outdoor
- Stroller-friendly
- Parking availability
- Nearby family dining

**Content Features:**
- "Rainy day" activity filter
- "Under an hour" quick activities
- "Free this weekend" section
- "New this season" highlights
- "Birthday party venues" collection
- "Summer camps" seasonal section
- "School break survival" guides

**Social/Trust Features:**
- "Family tested" badges
- Parent tips & reviews
- "X families attended" social proof
- Age recommendations from parents
- "Bring snacks" / "Food available" indicators

**Calendar Features:**
- School calendar integration
- "Plan your weekend" view
- Recurring programs (weekly story time, etc.)
- Save events to family calendar

### 5. Deliverables Expected

#### A. Portal Experience Brief
```markdown
## Atlanta Families Portal

### Audience Profile
- Parents with children 0-17 in metro Atlanta
- Primary: Moms planning family activities (research shows)
- Secondary: Dads, grandparents, caregivers
- Tech-comfortable, mobile-first
- Time-poor, need quick decisions
- Trust and safety conscious

### Key Behaviors
- Plan weekends on Thursday/Friday
- Search "free things to do"
- Look for age-appropriate activities
- Check weather before outdoor plans
- Coordinate with other families

### Values
- Quality family time
- Educational enrichment
- Affordability / value
- Convenience
- Safety
```

#### B. Recommended Branding Configuration
Using the new deep white-labeling system:
```json
{
  "visual_preset": "family_friendly",
  "primary_color": "#059669",
  "header": {
    "template": "branded",
    "logo_position": "center",
    "logo_size": "lg",
    "nav_style": "pills"
  },
  "ambient": {
    "effect": "subtle_glow",
    "intensity": "subtle"
  },
  "component_style": {
    "border_radius": "lg",
    "shadows": "medium",
    "card_style": "elevated",
    "button_style": "pill",
    "glow_enabled": false,
    "animations": "subtle"
  },
  "category_colors": {
    "family": "#059669",
    "community": "#0891b2",
    "art": "#d97706",
    "music": "#ec4899",
    "sports": "#3b82f6"
  }
}
```

#### C. Source Inclusion/Exclusion List
With reasoning for each

#### D. Prioritized Feature Ideas
Impact vs effort matrix for family-specific features

#### E. Content Structure Outline
- Homepage sections
- Navigation structure
- Filter organization
- Detail page enhancements

---

## Key Files to Explore

```
lib/portal.ts                    # Portal data fetching
lib/portal-context.tsx           # Portal types and context
lib/visual-presets.ts            # New preset system
lib/apply-preset.ts              # Preset application logic
lib/plan-features.ts             # Feature gating by plan

crawlers/sources/                # All event source crawlers
crawlers/main.py                 # Crawler orchestration

components/headers/              # New header templates
components/ambient/              # New ambient effects
components/PortalTheme.tsx       # CSS variable injection

app/[portal]/page.tsx            # Portal main page
app/[portal]/layout.tsx          # Portal layout

database/migrations/             # Schema for portals
```

---

## Success Criteria

The Atlanta Families portal should:
1. Feel distinctly different from the main Atlanta portal
2. Surface family-appropriate content by default
3. Make weekend planning effortless for parents
4. Build trust through safety signals and parent reviews
5. Become the first place Atlanta parents check for activities
