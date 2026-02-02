-- Migration: Category Cleanup
-- Date: 2026-01-30
-- Fixes:
-- 1. Invalid categories (arts->art, play->family, yoga->fitness)
-- 2. Recategorize "other" events based on patterns
-- 3. Add subcategory inference for common patterns

-- ============================================
-- 1. FIX INVALID CATEGORIES (35 events)
-- ============================================

-- Fix plural typo: arts -> art (20 events)
UPDATE events SET category = 'art' WHERE category = 'arts';

-- Fix play -> family (14 events - children's activities)
UPDATE events SET category = 'family' WHERE category = 'play';

-- Fix yoga -> fitness (1 event)
UPDATE events SET category = 'fitness' WHERE category = 'yoga';

-- ============================================
-- 2. RECATEGORIZE "OTHER" EVENTS
-- ============================================

-- SPORTS: Hawks, Braves, Gladiators, basketball, racing
UPDATE events SET category = 'sports'
WHERE category = 'other' AND (
  title ILIKE '%Hawks vs%' OR
  title ILIKE '%Hawks Suite%' OR
  title ILIKE '%Gladiators vs%' OR
  title ILIKE '%Braves%' OR
  title ILIKE '%Basketball%' OR
  title ILIKE '%Softball%' OR
  title ILIKE '%Baseball%' OR
  title ILIKE '%NASCAR%' OR
  title ILIKE '%TRACKSIDE%' OR
  title ILIKE '%Sun Belt%' OR
  title ILIKE '%Georgia State vs%' OR
  title ILIKE '%POST GAME ACCESS%'
);

-- THEATER: Known theater productions
UPDATE events SET category = 'theater'
WHERE category = 'other' AND (
  title ILIKE '%Harry Potter and the Cursed Child%' OR
  title ILIKE '%Duel Reality%' OR
  title ILIKE '%Fires, Ohio%' OR
  title ILIKE '%Riverdance%' OR
  title ILIKE '%Dinosaur!%' OR
  title ILIKE '%Rhythm & Thread%' OR
  title ILIKE '%Seared%' OR
  title ILIKE 'MJ' OR
  title ILIKE '%Dirty Dancing%' OR
  title ILIKE '%Shen Yun%'
);

-- MUSIC: Concerts, symphony, musicians
UPDATE events SET category = 'music'
WHERE category = 'other' AND (
  title ILIKE '%Symphony%' OR
  title ILIKE '%LADY GAGA%' OR
  title ILIKE '%CONAN GRAY%' OR
  title ILIKE '%Eric Church%' OR
  title ILIKE '%VOCES8%' OR
  title ILIKE '%Ruby Velle%' OR
  title ILIKE '%R&B LIVE%' OR
  title ILIKE '%B2K%' OR
  title ILIKE '%TWICE%' OR
  title ILIKE '%Elevation Rhythm%' OR
  title ILIKE '%Rascal Flatts%' OR
  title ILIKE '%Eddie 9V%' OR
  title ILIKE '%Clay Street Unit%' OR
  title ILIKE '%Los Angeles Azules%' OR
  title ILIKE '%HEART%' OR
  title ILIKE '%Trap Karaoke%' OR
  title ILIKE '% Band%' OR
  venue_id IN (SELECT id FROM venues WHERE name ILIKE '%Terminal West%' OR name ILIKE '%Variety Playhouse%')
);

-- COMEDY: Katt Williams, comedy shows
UPDATE events SET category = 'comedy'
WHERE category = 'other' AND (
  title ILIKE '%KATT WILLIAMS%' OR
  title ILIKE '%Kathleen Madigan%' OR
  title ILIKE '%Jimmy O. Yang%' OR
  title ILIKE '%Bert Kreischer%'
);

-- NIGHTLIFE: Club nights, DJ events, parties
UPDATE events SET category = 'nightlife'
WHERE category = 'other' AND (
  title ILIKE '%FRIDAYS%' OR
  title ILIKE '%SATURDAYS%' OR
  title ILIKE '%PARTY%' OR
  title ILIKE '%Ages 21+%' OR
  title ILIKE '%DJ %' OR
  title ILIKE '%Club Night%' OR
  title ILIKE '%DOMAINE ATL%' OR
  title ILIKE '%LYFE ATL%' OR
  title ILIKE '%FLIRT%' OR
  title ILIKE '%HOUSE PARTY%' OR
  title ILIKE '%ROOFTOP%' OR
  title ILIKE '%REVEL%' OR
  title ILIKE '%REGGAE ON THE ROOF%' OR
  title ILIKE '%Social Currency%' OR
  title ILIKE '%Rhythm Room%' OR
  title ILIKE '%RNB at 9AM%' OR
  title ILIKE '%YDG%' OR
  title ILIKE '%LAVERN%' OR
  title ILIKE '%BOLO%' OR
  title ILIKE '%OPPIDAN%'
);

-- FAMILY: Selfie museum, dinosaur shows, kid events
UPDATE events SET category = 'family'
WHERE category = 'other' AND (
  title ILIKE '%Selfie Paradise%' OR
  title ILIKE '%Dinosaur World Live%' OR
  title ILIKE '%HOT WHEELS%' OR
  title ILIKE '%Carnival of the Animal%' OR
  title ILIKE '%Teen Night%' OR
  title ILIKE '%Family Fun%' OR
  title ILIKE '%Love Carnival%'
);

-- COMMUNITY: Volunteers, career fairs, workshops, networking
UPDATE events SET category = 'community'
WHERE category = 'other' AND (
  title ILIKE '%Volunteer%' OR
  title ILIKE '%Career Fair%' OR
  title ILIKE '%Job Fair%' OR
  title ILIKE '%Hiring Event%' OR
  title ILIKE '%Networking%' OR
  title ILIKE '%Workshop%' OR
  title ILIKE '%Symposium%' OR
  title ILIKE '%Stroll Off%' OR
  title ILIKE '%Homecoming%' OR
  title ILIKE '%HOCO%' OR
  title ILIKE '%Alumni%' OR
  title ILIKE '%Mastermind%' OR
  title ILIKE '%Mixer%' OR
  title ILIKE '%Rebrand%' OR
  title ILIKE '%Pub Crawl%'
);

-- WORDS: Book events, author talks
UPDATE events SET category = 'words'
WHERE category = 'other' AND (
  title ILIKE '%B&N %' OR
  title ILIKE '%Book%' OR
  title ILIKE '%Author%' OR
  title ILIKE '%in conversation%' OR
  title ILIKE '%Clay Cane%'
);

-- LEARNING: Educational workshops, conferences
UPDATE events SET category = 'learning'
WHERE category = 'other' AND (
  title ILIKE '%Student Loan%' OR
  title ILIKE '%Prenatal%' OR
  title ILIKE '%Speakpreneur%' OR
  title ILIKE '%Venture Capital%' OR
  title ILIKE '%Hydroponics%' OR
  title ILIKE '%Business%' OR
  title ILIKE '%Fortbildung%' OR
  title ILIKE '%LEGO%'
);

-- ART: Exhibitions, galleries
UPDATE events SET category = 'art'
WHERE category = 'other' AND (
  title ILIKE '%Exhibition%' OR
  title ILIKE '%Gallery%' OR
  title ILIKE '%Paint and Sip%' OR
  title ILIKE '%Needle Felting%' OR
  title ILIKE '%Bonsai%'
);

-- GAMING: Magic The Gathering, conventions
UPDATE events SET category = 'gaming'
WHERE category = 'other' AND (
  title ILIKE '%Magic The Gathering%' OR
  title ILIKE '%Collect-A-Con%'
);

-- FOOD_DRINK: Wine, food festivals, tastings
UPDATE events SET category = 'food_drink'
WHERE category = 'other' AND (
  title ILIKE '%Wine%' OR
  title ILIKE '%Oysterfest%' OR
  title ILIKE '%Restaurant Week%' OR
  title ILIKE '%Dinner Club%' OR
  title ILIKE '%Tequila%' OR
  title ILIKE '%Ina Garten%'
);

-- FITNESS: Dance fitness, workouts
UPDATE events SET category = 'fitness'
WHERE category = 'other' AND (
  title ILIKE '%Dance Fitness%' OR
  title ILIKE '%Sweat Check%' OR
  title ILIKE '%Candle%'
);

-- RELIGIOUS: Church events, spiritual
UPDATE events SET category = 'religious'
WHERE category = 'other' AND (
  title ILIKE '%God%s Not Dead%' OR
  title ILIKE '%Médiumnité%' OR
  title ILIKE '%Voyance%'
);

-- MARKETS: Fairs, festivals, markets
UPDATE events SET category = 'markets'
WHERE category = 'other' AND (
  title ILIKE '%Atlanta Fair%' OR
  title ILIKE '%Dogwood Festival%' OR
  title ILIKE '%420 Fest%' OR
  title ILIKE '%404 Day%'
);

-- TOURS: Stadium tours, moonlight tours
UPDATE events SET category = 'tours'
WHERE category = 'other' AND (
  title ILIKE '%Tour %' AND (
    title ILIKE '%Truist Park%' OR
    title ILIKE '%Moonlight%' OR
    title ILIKE '%Chamber Performance & Tour%'
  )
);

-- ============================================
-- 3. ADD SUBCATEGORIES WHERE MISSING
-- ============================================

-- Sports subcategories
UPDATE events SET subcategory = 'basketball'
WHERE category = 'sports' AND subcategory IS NULL AND (
  title ILIKE '%Hawks%' OR
  title ILIKE '%Basketball%'
);

UPDATE events SET subcategory = 'baseball'
WHERE category = 'sports' AND subcategory IS NULL AND (
  title ILIKE '%Braves%' OR
  title ILIKE '%Baseball%'
);

UPDATE events SET subcategory = 'hockey'
WHERE category = 'sports' AND subcategory IS NULL AND (
  title ILIKE '%Gladiators%'
);

UPDATE events SET subcategory = 'racing'
WHERE category = 'sports' AND subcategory IS NULL AND (
  title ILIKE '%NASCAR%' OR
  title ILIKE '%Speedway%'
);

-- Theater subcategories
UPDATE events SET subcategory = 'theater.musical'
WHERE category = 'theater' AND subcategory IS NULL AND (
  title ILIKE '%Harry Potter%' OR
  title ILIKE '%MJ%' OR
  title ILIKE '%Riverdance%' OR
  title ILIKE '%Rhythm & Thread%'
);

UPDATE events SET subcategory = 'theater.play'
WHERE category = 'theater' AND subcategory IS NULL AND (
  title ILIKE '%Fires, Ohio%' OR
  title ILIKE '%Duel Reality%' OR
  title ILIKE '%Seared%'
);

UPDATE events SET subcategory = 'theater.dance'
WHERE category = 'theater' AND subcategory IS NULL AND (
  title ILIKE '%Shen Yun%' OR
  title ILIKE '%Dirty Dancing%'
);

-- Music subcategories
UPDATE events SET subcategory = 'music.classical'
WHERE category = 'music' AND subcategory IS NULL AND (
  title ILIKE '%Symphony%' OR
  title ILIKE '%Chamber%' OR
  title ILIKE '%Orchestra%'
);

UPDATE events SET subcategory = 'music.live'
WHERE category = 'music' AND subcategory IS NULL AND (
  title ILIKE '%LADY GAGA%' OR
  title ILIKE '%CONAN GRAY%' OR
  title ILIKE '%Eric Church%' OR
  title ILIKE '%TWICE%'
);

-- Nightlife subcategories
UPDATE events SET subcategory = 'nightlife.dj'
WHERE category = 'nightlife' AND subcategory IS NULL AND (
  title ILIKE '%DJ%' OR
  title ILIKE '%YDG%' OR
  title ILIKE '%BOLO%' OR
  title ILIKE '%LAVERN%' OR
  title ILIKE '%OPPIDAN%'
);

-- Comedy subcategories
UPDATE events SET subcategory = 'comedy.standup'
WHERE category = 'comedy' AND subcategory IS NULL AND (
  title ILIKE '%KATT WILLIAMS%' OR
  title ILIKE '%Kathleen Madigan%' OR
  title ILIKE '%Jimmy O. Yang%' OR
  title ILIKE '%Bert Kreischer%'
);

-- Words subcategories
UPDATE events SET subcategory = 'words.lecture'
WHERE category = 'words' AND subcategory IS NULL AND (
  title ILIKE '%in conversation%' OR
  title ILIKE '%B&N%'
);

-- ============================================
-- 4. VERIFICATION QUERIES
-- ============================================

-- Run these after migration to verify:
-- SELECT category, COUNT(*) FROM events WHERE start_date >= CURRENT_DATE GROUP BY category ORDER BY COUNT(*) DESC;
-- SELECT COUNT(*) FROM events WHERE category = 'other' AND start_date >= CURRENT_DATE;
-- SELECT category, subcategory, COUNT(*) FROM events WHERE start_date >= CURRENT_DATE GROUP BY category, subcategory ORDER BY category, COUNT(*) DESC;
