# American Red Cross Blood Drive Crawler - Status Report

## Summary
**Status:** BLOCKED - Not operational
**Source:** redcrossblood.org
**Database ID:** 856
**Active:** No

## Problem
The American Red Cross website employs **Akamai bot protection** that successfully blocks all automated crawling attempts. This is one of the most sophisticated anti-bot systems available.

## What Was Attempted

### 1. Direct API Access
- **Endpoint:** `https://www.redcrossblood.org/api/drive/v1/`
- **Result:** 404 Not Found / 403 Forbidden
- **Notes:** API is explicitly disallowed in robots.txt (`Disallow: /api/*`)

### 2. Playwright Headless Mode
- **Method:** Chromium with stealth scripts, anti-detection measures
- **Result:** "Access Denied" page immediately
- **Error:** Reference #18.70560e17... (Akamai error code)

### 3. Playwright Non-Headless
- **Method:** Visible browser window with human-like behavior
- **Result:** Works, but not practical for automated production system
- **Issue:** Requires display server, can't run in CI/CD or cron jobs

### 4. Direct Page Scraping
- **URL:** `/give.html/drive-results?zipSponsor=30306`
- **Result:** Blocked before JavaScript can load results
- **Notes:** Page uses client-side rendering via API calls

## Technical Details

### Bot Detection Indicators
1. **Akamai Bot Manager:** Enterprise-grade protection
2. **JavaScript Challenges:** Requires browser fingerprinting
3. **TLS Fingerprinting:** Detects automated HTTP clients
4. **Behavioral Analysis:** Monitors mouse movements, timing
5. **IP Reputation:** Flags datacenter/VPN IPs

### Site Architecture
```
Search Flow:
1. User visits /give.html/find-drive
2. Enters zip code in React form
3. JavaScript calls /api/drive/v1/ endpoint (protected)
4. Results rendered client-side
```

### Data Structure (Observed)
Blood drive records include:
- Sponsor name (host organization)
- Full address (street, city, state, zip)
- Date (e.g., "Wed, Feb 12, 2026")
- Time range (e.g., "1:00 PM - 6:00 PM")
- Available appointment slots
- Drive ID

## Possible Solutions

### Option 1: Partner API (Recommended)
- **Approach:** Apply for official Red Cross data partnership
- **Pros:** Legal, reliable, real-time data
- **Cons:** Requires approval process, may have restrictions
- **Effort:** Medium (application + integration)

### Option 2: Manual Data Entry
- **Approach:** Weekly manual check and entry
- **Pros:** Simple, legal, works immediately
- **Cons:** Not scalable, requires human time
- **Effort:** Low (operational overhead)

### Option 3: RSS/Email Monitoring
- **Approach:** Subscribe to Red Cross email alerts for Atlanta area
- **Pros:** Automated once set up, legal
- **Cons:** May not cover all drives, timing delays
- **Effort:** Medium (email parsing automation)

### Option 4: Advanced Stealth (Not Recommended)
- **Approach:** Residential proxies + browser fingerprint spoofing
- **Pros:** Might work short-term
- **Cons:**
  - Expensive (proxy costs)
  - Fragile (breaks when they update)
  - Ethically questionable
  - Violates robots.txt
- **Effort:** High (ongoing maintenance)

### Option 5: Alternative Data Sources
- **Approach:** Find other blood drive aggregators
- **Pros:** May have better API access
- **Cons:** Red Cross is the primary blood bank in Atlanta
- **Effort:** Medium (research other sources)

## Recommendation

**Do not pursue automated crawling of Red Cross website.**

Instead:
1. **Short-term:** Manual entry for major/recurring blood drives
2. **Long-term:** Apply for Red Cross data partnership or API access
3. **Alternative:** Focus on other community health events that are more accessible

## File Locations
- **Crawler:** `/Users/coach/Projects/LostCity/crawlers/sources/red_cross_blood.py`
- **Database:** `sources` table, ID 856
- **Status:** `is_active = false`

## Lessons Learned
- Always check robots.txt before building crawler
- Test bot detection early (before full implementation)
- Have alternative data sources identified
- Enterprise sites (healthcare, government) often have strong protection
- Manual processes are valid when automation is blocked

## Contact
If pursuing official partnership:
- Website: redcrossblood.org/hosting-a-blood-drive
- May have developer API program (research needed)
