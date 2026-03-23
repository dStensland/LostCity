# Family Content Plan C: New Patterns + Unique Sources

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build new crawler patterns that unlock categories at scale (dance, gymnastics, youth sports) and add unique long-tail sources no competitor has (FIRST Robotics, 4-H, Scouts).

**Architecture:** Tasks 1-3 build reusable platform patterns (one scraper → many sources). Tasks 4-10 are independent one-off crawlers for high-value unique sources. All tasks create new files — fully parallelizable.

**Tech Stack:** Python 3, requests, BeautifulSoup, Playwright (where needed)

---

### Task 1: AYSO Youth Soccer (regional pattern)

**Files:**
- Create: `crawlers/sources/ayso_atlanta.py`

- [ ] **Step 1: Research AYSO Atlanta regions**

Find AYSO regional pages for metro Atlanta:
- Region 60 (North Fulton)
- Region 75 (Cobb)
- Region 112 (DeKalb)

Check their websites for registration events, tryout dates, season schedules. Determine if they use BlueStar software or custom sites.

- [ ] **Step 2: Build the crawler**

Create a multi-region crawler with a REGIONS config array. For each region, crawl:
- Registration opening/closing dates
- Tryout events
- Season start/end dates
- Age divisions (U6, U8, U10, U12, U14, U19)

Map AYSO age divisions to age_min/age_max (U8 = ages 6-8, etc.).

- [ ] **Step 3: Register source, subscribe to family portal**

- [ ] **Step 4: Dry-run and commit**

Expected: 50-100 registration/tryout events across 3 regions.

---

### Task 2: i9 Sports Atlanta (franchise pattern)

**Files:**
- Create: `crawlers/sources/i9_sports_atlanta.py`

- [ ] **Step 1: Research i9 Sports Atlanta locations**

i9sports.com — find Atlanta-area franchise locations. Check registration pages for:
- Flag football programs
- Youth basketball
- Soccer
- T-ball

- [ ] **Step 2: Build the crawler**

Franchise pattern: LOCATIONS array, parse registration/enrollment pages. Extract season dates, age ranges, costs, registration URLs.

- [ ] **Step 3: Register, dry-run, commit**

Expected: 30-60 season registration events.

---

### Task 3: Georgia FIRST Robotics

**Files:**
- Create: `crawlers/sources/georgia_first_robotics.py`

**Context:** FIRST Robotics Competition (FRC) and FIRST Tech Challenge (FTC) have Georgia state pages with competition event calendars. Unique content no other calendar service covers.

- [ ] **Step 1: Research firstgeorgia.org or firstinspires.org/Georgia**

Find the event calendar for Georgia FIRST competitions, qualifiers, and workshops. Check data format (HTML table, API, iCal).

- [ ] **Step 2: Build the crawler**

Parse competition events with:
- Event name, date, location
- Competition level (qualifier, state championship, etc.)
- Age range (FRC = 14-18, FTC = 12-18, FLL = 9-14, FLL Explore = 4-8)
- Registration URL

- [ ] **Step 3: Register, dry-run, commit**

Expected: 30-50 competition events per season.

---

### Task 4: Georgia 4-H (UGA Extension)

**Files:**
- Create: `crawlers/sources/georgia_4h.py`

- [ ] **Step 1: Research georgia4h.org**

Check the state events calendar and county extension office pages (Fulton, Cobb, Gwinnett, DeKalb). Programs include:
- Cloverbud (ages 5-8)
- Junior (ages 9-13)
- Senior (ages 14-18)
- County day camps, state events, competitive judging

- [ ] **Step 2: Build the crawler**

Parse events from the state calendar + county extension pages. Map 4-H age divisions to age_min/age_max.

- [ ] **Step 3: Register, dry-run, commit**

Expected: 50-80 events across state and county programs.

---

### Task 5: BSA Atlanta Area Council

**Files:**
- Create: `crawlers/sources/bsa_atlanta.py`

- [ ] **Step 1: Research atlantabsa.org**

Check the council event calendar for:
- Camporees, campouts
- Eagle Scout courts of honor
- Recruitment events ("Join Scouting" nights)
- Day camps, summer camps
- Merit badge events

- [ ] **Step 2: Build the crawler**

Parse the council-wide calendar. Age ranges: Cub Scouts (5-10), Scouts BSA (11-17), Venturing (14-20).

- [ ] **Step 3: Register, dry-run, commit**

Expected: 40-80 public events per year.

---

### Task 6: Play-Well TEKnologies (LEGO STEM)

**Files:**
- Create: `crawlers/sources/play_well_teknologies.py`

- [ ] **Step 1: Research play-well.org/programs/camps/georgia**

Check the Georgia camp finder. Static HTML camp tables with location, dates, ages, prices.

- [ ] **Step 2: Build the crawler**

Parse camp listings from the Georgia page. Each camp session becomes a program record with:
- Host school/venue name and address
- Session dates
- Age range
- Cost
- Registration URL

- [ ] **Step 3: Register, dry-run, commit**

Expected: 20-40 camp sessions.

---

### Task 7: Mad Science of Atlanta

**Files:**
- Create: `crawlers/sources/mad_science_atlanta.py`

- [ ] **Step 1: Research madscience.org/atlanta**

Check camp calendar and birthday party/event listings.

- [ ] **Step 2: Build the crawler**

Parse camp sessions and workshop events. Typical age range: 5-12.

- [ ] **Step 3: Register, dry-run, commit**

Expected: 15-30 camp sessions.

---

### Task 8: First Tee of Atlanta

**Files:**
- Create: `crawlers/sources/first_tee_atlanta.py`

- [ ] **Step 1: Research firstteeatl.org**

Check the public calendar for clinics, tournaments, registration days.

- [ ] **Step 2: Build the crawler**

Parse events with dates, ages (typically 5-18), locations (multiple Atlanta golf courses).

- [ ] **Step 3: Register, dry-run, commit**

Expected: 20-40 events per year.

---

### Task 9: Sandy Springs Parks & Rec

**Files:**
- Create: `crawlers/sources/sandy_springs_parks_rec.py`

- [ ] **Step 1: Audit the registration platform**

Visit sandyspringsga.gov recreation/parks pages. Determine which platform they use (CivicRec, ActiveNet, Rec1, or custom). This determines the crawler approach.

- [ ] **Step 2: Build the crawler based on platform**

If Rec1 → copy Milton pattern (30 min).
If ActiveNet → copy Atlanta DPR pattern.
If custom → build a new scraper.

- [ ] **Step 3: Register, dry-run, commit**

Expected: 80-150 programs (large, affluent suburb with active parks department).

---

### Task 10: Henry County Parks & Rec

**Files:**
- Create: `crawlers/sources/henry_county_parks_rec.py`

Same approach as Task 9 — audit platform, build appropriate crawler.

Expected: 60-100 programs (south metro, growing family population).
