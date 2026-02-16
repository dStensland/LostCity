-- University venue highlights: curated insider details for Atlanta's universities and their museums
-- Each highlight contains specific facts, dates, dimensions, or insider knowledge

-- ============================================================
-- EMORY UNIVERSITY & CARLOS MUSEUM
-- ============================================================

-- Michael C. Carlos Museum (already has 2 highlights, adding more specific ones)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', '4,000-Year-Old Middle Kingdom Mummy',
  'The Southeast''s oldest Egyptian mummy dates to c. 2000 BCE. Recent CT scans revealed the priest was buried with amulets still wrapped inside — visible in the museum''s imaging display.',
  2
FROM venues v WHERE v.slug = 'michael-c-carlos-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '4,000-Year-Old Middle Kingdom Mummy');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Michael Graves Postmodern Rotunda',
  'The 1993 renovation by Michael Graves added a two-story rotunda with limestone columns, coffered dome, and signature pastel palette. It''s pure 1980s postmodernism meets ancient Greece.',
  3
FROM venues v WHERE v.slug = 'michael-c-carlos-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Michael Graves Postmodern Rotunda');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Underground Storage: 17,000 Objects',
  'The visible galleries display only 2% of the collection. The climate-controlled basement houses 17,000 objects including the South''s largest collection of ancient Near Eastern cylinder seals.',
  4
FROM venues v WHERE v.slug = 'michael-c-carlos-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Underground Storage: 17,000 Objects');

-- Emory University (already has 1 highlight, adding specific campus features)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Italian Marble Quad Colonnade',
  'The 1920s main quad uses Georgia marble from a single Tate quarry vein. Candler Library''s 32 columns and slate roofs were modeled after Italian Renaissance villas.',
  1
FROM venues v WHERE v.slug = 'emory-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Italian Marble Quad Colonnade');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Coca-Cola Founder''s $1M Gift',
  'Asa Candler (Coca-Cola founder) donated $1 million and 75 acres in 1914 to move Emory from Oxford, GA to Atlanta. His brother Warren designed the original Italian Renaissance buildings.',
  2
FROM venues v WHERE v.slug = 'emory-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Coca-Cola Founder''s $1M Gift');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Lullwater Preserve 154-Acre Forest',
  '2.5 miles of trails through 154 acres of forest, a 1920s Tudor revival mansion, and a 1.5-acre lake. Great blue herons nest here February through July.',
  3
FROM venues v WHERE v.slug = 'emory-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Lullwater Preserve 154-Acre Forest');

-- Try alternate Emory slugs
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Italian Marble Quad Colonnade',
  'The 1920s main quad uses Georgia marble from a single Tate quarry vein. Candler Library''s 32 columns and slate roofs were modeled after Italian Renaissance villas.',
  1
FROM venues v WHERE v.slug = 'emory-events'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Italian Marble Quad Colonnade');

-- ============================================================
-- GEORGIA TECH
-- ============================================================

-- Georgia Tech campus
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Kessler Campanile 10,500-Bell Carillon',
  'The 1968 Campanile plays Westminster Chimes every 15 minutes using a 10,500-bell carillon system. Stand at the base at noon for the full concert audible across campus.',
  1
FROM venues v WHERE v.slug = 'georgia-tech'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Kessler Campanile 10,500-Bell Carillon');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Tech Tower Navy Steam Whistle',
  'The 1888 Tech Tower''s original steam whistle was salvaged from a Navy ship. It still sounds for home football victories — one of the last functioning steam whistles on a U.S. campus.',
  2
FROM venues v WHERE v.slug = 'georgia-tech'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Tech Tower Navy Steam Whistle');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Tech Tower 360-Degree Skyline',
  'The 7-story tower offers 360-degree views of Midtown when open for tours. The "T" on top is illuminated gold after home football victories.',
  3
FROM venues v WHERE v.slug = 'georgia-tech'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Tech Tower 360-Degree Skyline');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Grant Field: 1913 Football Stadium',
  'Built in 1913, Grant Field inside Bobby Dodd Stadium is the oldest continuously used on-campus NCAA football stadium. East stands offer Downtown skyline views.',
  4
FROM venues v WHERE v.slug = 'georgia-tech'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Grant Field: 1913 Football Stadium');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Clough Commons Inverted Ziggurat',
  'The 2011 LEED Gold building features an inverted ziggurat cantilevering 82 feet, creating a covered amphitheater. The terracotta rainscreen has 600 uniquely angled panels.',
  5
FROM venues v WHERE v.slug = 'georgia-tech'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Clough Commons Inverted Ziggurat');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Paper Museum 2,000-Year Timeline',
  'The Robert C. Williams Museum of Papermaking holds actual samples from 105 BCE Chinese hemp paper to modern nanocellulose. The 1850 Hollander beater still demonstrates pulp prep.',
  6
FROM venues v WHERE v.slug = 'georgia-tech'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Paper Museum 2,000-Year Timeline');

-- ============================================================
-- HBCU CAMPUSES
-- ============================================================

-- Spelman College (already has 1 highlight, adding more)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Founded in Church Basement, 1881',
  'Started in Friendship Baptist Church''s basement with 11 students in 1881. Spelman is the oldest HBCU for Black women. The campus was built on former Civil War drill grounds.',
  1
FROM venues v WHERE v.slug = 'spelman-college'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Founded in Church Basement, 1881');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Sisters Chapel 90-Foot Gothic Tower',
  'The 1927 Sisters Chapel features a 90-foot Gothic Revival tower visible across Atlanta. Interior oak pews and stained glass were funded by John D. Rockefeller''s $250,000 donation.',
  2
FROM venues v WHERE v.slug = 'spelman-college'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Sisters Chapel 90-Foot Gothic Tower');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'Leonard Street Entrance Arch',
  'The iconic campus entrance arch on Leonard Street NW frames a tree-lined view of the main quad. Best photographed at sunrise when light hits the Georgian brick buildings.',
  3
FROM venues v WHERE v.slug = 'spelman-college'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Leonard Street Entrance Arch');

-- Morehouse College
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'MLK''s Alma Mater, Class of 1948',
  'Martin Luther King Jr. enrolled at age 15 and graduated in 1948 with a sociology degree. His father, Martin Luther King Sr., also graduated from Morehouse in 1926.',
  0
FROM venues v WHERE v.slug = 'morehouse-college'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'MLK''s Alma Mater, Class of 1948');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'King Chapel Memorial Stained Glass',
  'The Martin Luther King Jr. International Chapel (1978) features 10 stained glass windows depicting King''s life and the civil rights movement. The crown-shaped sanctuary seats 2,500.',
  1
FROM venues v WHERE v.slug = 'morehouse-college'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'King Chapel Memorial Stained Glass');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Morehouse Mystique Tradition',
  'The undefined "Morehouse Mystique" emphasizes scholarship, leadership, and service in the "Morehouse Man" ideal. Alumni include Spike Lee, Samuel L. Jackson, and Maynard Jackson.',
  2
FROM venues v WHERE v.slug = 'morehouse-college'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Morehouse Mystique Tradition');

-- Clark Atlanta University (history on the university)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', '1988 Merger: Two Historic Institutions',
  'Clark Atlanta formed in 1988 from merging Clark College (1869) and Atlanta University (1865). Atlanta University was the nation''s first graduate institution for African Americans.',
  0
FROM venues v WHERE v.slug = 'clark-atlanta-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '1988 Merger: Two Historic Institutions');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', '1988 Merger: Two Historic Institutions',
  'Clark Atlanta formed in 1988 from merging Clark College (1869) and Atlanta University (1865). Atlanta University was the nation''s first graduate institution for African Americans.',
  0
FROM venues v WHERE v.slug = 'clark-atlanta'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '1988 Merger: Two Historic Institutions');

-- Clark Atlanta University Art Museum (art on the actual museum venue)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Largest HBCU Art Collection',
  'Over 1,000 works — the largest collection of African American art at any HBCU. Hale Woodruff''s six-panel "The Art of the Negro" murals (1950-51) in Trevor Arnett Hall are the crown jewels.',
  0
FROM venues v WHERE v.slug = 'clark-atlanta-university-art-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Largest HBCU Art Collection');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Woodruff''s Hidden Self-Portrait',
  'In "The Art of the Negro" murals, Hale Woodruff painted himself into the "Interchange" panel — a tradition borrowed from Renaissance masters. Look for the man in a suit among the African figures.',
  1
FROM venues v WHERE v.slug = 'clark-atlanta-university-art-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Woodruff''s Hidden Self-Portrait');

-- ============================================================
-- GEORGIA STATE UNIVERSITY
-- ============================================================

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', '1996 Olympic Village Reborn',
  'Georgia State converted the 1996 Olympic Village dormitories into student housing. The Olympic Cauldron moved to Turner Field (now Georgia State Stadium), which hosted Olympic baseball.',
  0
FROM venues v WHERE v.slug = 'georgia-state-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '1996 Olympic Village Reborn');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Rialto Center 1916 Vaudeville Theater',
  'The Rialto opened in 1916 as a vaudeville and silent film theater. The restored 833-seat venue features original terracotta facade, ornate plasterwork, and a 1,000-pound chandelier.',
  1
FROM venues v WHERE v.slug = 'georgia-state-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Rialto Center 1916 Vaudeville Theater');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Library South Roof Deck',
  'The 8th floor roof terrace of Library South offers 360-degree Downtown views. Best at sunset when the gold State Capitol dome glows against the skyline.',
  2
FROM venues v WHERE v.slug = 'georgia-state-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Library South Roof Deck');

-- Try alternate slug variations
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', '1996 Olympic Village Reborn',
  'Georgia State converted the 1996 Olympic Village dormitories into student housing. The Olympic Cauldron moved to Turner Field (now Georgia State Stadium), which hosted Olympic baseball.',
  0
FROM venues v WHERE v.slug = 'gsu-athletics'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '1996 Olympic Village Reborn');

-- ============================================================
-- OGLETHORPE UNIVERSITY
-- ============================================================

-- Oglethorpe (already has 1 highlight, adding specifics)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Sealed Until 8113 CE',
  'Dr. Thornwell Jacobs sealed the crypt in 1940 after learning the pyramids'' contents were lost to time. Guinness calls it the "first successful attempt to preserve a cultural record for future inhabitants."',
  1
FROM venues v WHERE v.slug = 'oglethorpe-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Sealed Until 8113 CE');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Donald Duck and 800,000 Pages Inside',
  'Contents include a Donald Duck doll, newsreels, a cash register, a plastic toy, and 800,000 pages of microfilm documenting 1940s civilization. A swimming pool stores the sealed chamber.',
  2
FROM venues v WHERE v.slug = 'oglethorpe-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Donald Duck and 800,000 Pages Inside');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Gothic Revival Quadrangle Design',
  'The 1916 campus was designed as a symmetrical Gothic Revival quadrangle modeled after Oxford and Cambridge. Lupton Hall features limestone facades and leaded glass windows.',
  3
FROM venues v WHERE v.slug = 'oglethorpe-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Gothic Revival Quadrangle Design');

-- ============================================================
-- KENNESAW STATE UNIVERSITY
-- ============================================================

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Civil War Earthworks on Campus',
  'Confederate fortifications from the 1864 Battle of Kennesaw Mountain cross the campus. The Fort at Kennesaw State preserves a star-shaped redoubt with interpretive signage.',
  0
FROM venues v WHERE v.slug = 'kennesaw-state-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Civil War Earthworks on Campus');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Zuckerman Museum Art Collection',
  'The Bernard A. Zuckerman Museum of Art houses over 1,000 works including significant 19th-century American landscape paintings and contemporary Southern photography.',
  1
FROM venues v WHERE v.slug = 'kennesaw-state-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Zuckerman Museum Art Collection');

-- Try alternate slug
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Civil War Earthworks on Campus',
  'Confederate fortifications from the 1864 Battle of Kennesaw Mountain cross the campus. The Fort at Kennesaw State preserves a star-shaped redoubt with interpretive signage.',
  0
FROM venues v WHERE v.slug = 'kennesaw-state'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Civil War Earthworks on Campus');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Zuckerman Museum Art Collection',
  'The Bernard A. Zuckerman Museum of Art houses over 1,000 works including significant 19th-century American landscape paintings and contemporary Southern photography.',
  1
FROM venues v WHERE v.slug = 'kennesaw-state'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Zuckerman Museum Art Collection');

-- ============================================================
-- AGNES SCOTT COLLEGE
-- ============================================================

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Scottish Baronial Revival Campus',
  'The 1889 women''s college features Scottish Baronial Revival architecture with turrets, stone facades, and leaded glass. Main Hall''s clock tower has been a Decatur landmark for 130+ years.',
  0
FROM venues v WHERE v.slug = 'agnes-scott-college'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Scottish Baronial Revival Campus');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'Main Hall Four-Story Tower',
  'The 1891 Main Hall tower offers panoramic views of Decatur Square and the campus quad. The Romanesque Revival red brick and limestone building is on the National Register.',
  1
FROM venues v WHERE v.slug = 'agnes-scott-college'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Main Hall Four-Story Tower');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Women''s STEM Powerhouse Legacy',
  'Founded as Decatur Female Seminary in 1889. Agnes Scott produces more women PhD scientists per capita than any U.S. college except Caltech. Physics department graduated its first student in 1908.',
  2
FROM venues v WHERE v.slug = 'agnes-scott-college'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Women''s STEM Powerhouse Legacy');

-- ============================================================
-- BOBBY DODD STADIUM (exists as separate venue)
-- ============================================================

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Oldest On-Campus NCAA Stadium',
  'Grant Field, built in 1913, is the oldest continuously used on-campus stadium in Division I FBS. The original concrete east stands predate the Rose Bowl by nine years.',
  0
FROM venues v WHERE v.slug = 'bobby-dodd-stadium'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Oldest On-Campus NCAA Stadium');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Downtown Skyline Over the End Zone',
  'The east stands frame a postcard view of the Downtown and Midtown skyline beyond the north end zone. One of the only college stadiums where a major city skyline is part of the backdrop.',
  1
FROM venues v WHERE v.slug = 'bobby-dodd-stadium'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Downtown Skyline Over the End Zone');

-- ============================================================
-- RIALTO CENTER (exists as separate venue from GSU)
-- ============================================================

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', '1916 Beaux-Arts Movie Palace',
  'Originally the Rialto Theatre, built for vaudeville and silent film. The restored terracotta facade, ornate plasterwork ceiling, and proscenium arch survived decades of neglect before Georgia State''s restoration.',
  0
FROM venues v WHERE v.slug = 'rialto-center'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '1916 Beaux-Arts Movie Palace');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The 1,000-Pound Crystal Chandelier',
  'The original 1916 chandelier was found dismantled in the building''s basement during renovation. Restored and reinstalled, it weighs over 1,000 pounds and hangs from the original ceiling hook.',
  1
FROM venues v WHERE v.slug = 'rialto-center'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The 1,000-Pound Crystal Chandelier');
