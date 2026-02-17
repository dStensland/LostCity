# Volunteer Source Investigation Report

## Investigation Date
2026-02-16

## Sources Investigated

### 1. IRC Atlanta (International Rescue Committee Atlanta)
- **Slug**: `irc-atlanta`
- **Status**: DEACTIVATED
- **Website**: https://www.rescue.org/united-states/atlanta-ga
- **Expected Events**: 0

#### Investigation Results
- **Issue**: No public event calendar exists on their website
- **Crawler Status**: Found 30 HTML containers but 0 events (containers were not event listings)
- **Root Cause**: IRC Atlanta uses email-based volunteer recruitment instead of public event listings
- **Contact Method**: VolunteerATL@Rescue.org for volunteer orientation
- **Volunteer Page**: https://www.rescue.org/volunteer-opportunities/atlanta-ga

#### Why 0 Events
IRC Atlanta's volunteer program operates through direct email contact. They do not publish a calendar of upcoming orientation sessions or events. The website provides program descriptions and contact information, but no specific event dates.

#### Recommendation
**Marked as INACTIVE**. This source should remain inactive unless IRC Atlanta begins publishing a structured events calendar or uses a platform like Eventbrite for public event listings.

#### Alternative Approach
Could create a permanent venue record with general information pointing users to contact VolunteerATL@Rescue.org, but this wouldn't include crawled events.

---

### 2. Red Cross CPR Atlanta (American Red Cross CPR & First Aid Training)
- **Slug**: `red-cross-cpr-atlanta`
- **Status**: DEACTIVATED
- **Website**: https://www.redcross.org/take-a-class
- **Expected Events**: 0

#### Investigation Results
- **Issue**: Uses interactive class finder tool requiring form submission
- **Crawler Status**: No static calendar page to scrape
- **Root Cause**: Red Cross class listings require zip code and radius search via interactive form at redcross.org/take-a-class
- **Previous Target URL**: /local/georgia/about-us/news-and-events (redirects and contains news, not classes)

#### Why 0 Events
The Red Cross class finder is a dynamic search tool. Users enter their zip code and search radius, and the system queries a database to show available classes. There is no static HTML page listing all upcoming classes that could be scraped with BeautifulSoup.

#### Technical Options (Not Recommended)
1. **Playwright automation**: Could automate form submission with Atlanta zip codes, but fragile and may break with site changes
2. **API integration**: Red Cross likely has an internal API, but not public
3. **Web scraping detection**: Interactive tools often have bot protection

#### Recommendation
**Marked as INACTIVE**. The interactive class finder cannot be reliably scraled with current crawler architecture.

#### Alternative Approach
Create a permanent venue record for "American Red Cross Atlanta Training Center" with:
- Address: 1955 Monroe Dr NE, Atlanta, GA 30324
- Link to class finder: https://www.redcross.org/take-a-class
- Description of available certifications (CPR, First Aid, Lifeguard, etc.)
- No specific event instances

---

## Summary

Both sources have been **deactivated** in the database:
- IRC Atlanta: `is_active = False` (source ID: 930)
- Red Cross CPR Atlanta: `is_active = False` (source ID: 952)

### Key Learnings
1. **Email-based recruitment** (IRC) cannot be crawled - requires direct contact
2. **Interactive search tools** (Red Cross) require form submission - not suitable for BeautifulSoup crawlers
3. Both organizations serve valuable community functions but don't publish crawlable event calendars

### Crawler Files Updated
- `/crawlers/sources/irc_atlanta.py` - Updated with detailed notes on why inactive
- `/crawlers/sources/red_cross_cpr.py` - Updated with detailed notes on why inactive

Both crawler files now return `(0, 0, 0)` immediately with explanatory log messages.

---

## Recommendations for Similar Cases

When investigating volunteer sources that return 0 events:

1. **Check if they use external platforms**: Eventbrite, Mobilize, VolunteerMatch, etc.
2. **Look for API documentation**: Some orgs have public volunteer APIs
3. **Verify public calendar exists**: Many nonprofits use email-based recruitment
4. **Check for interactive tools**: Class finders, shift schedulers often can't be scraped
5. **Consider venue-only records**: Create permanent venue with contact info instead of events

### Red Flags for Unsuitable Sources
- "Contact us to schedule"
- "Email for orientation dates"
- Zip code search required
- Login required to view calendar
- Calendar behind form submission
- No upcoming events visible without interaction
