-- Explore tracks content fixes:
-- 1. Remove Busy Bee Cafe duplicate in The Itis (keep venue_id 675, remove venue_id 3210)
-- 2. Fill missing editorial blurbs on featured + remaining venues
-- 3. Trim bloated tracks to 20-25 max

-- ============================================================================
-- 1. FIX BUSY BEE DUPLICATE
-- venue_id 675 = real Busy Bee (Vine City, data_quality 92, has image)
-- venue_id 3210 = duplicate (wrong neighborhood, data_quality 53, no image)
-- Copy the good blurb from the duplicate to the real one, then delete duplicate
-- ============================================================================

UPDATE explore_track_venues
SET editorial_blurb = 'Soul food since 1947. MLK ate here, Obama ate here, and the fried chicken is still worth the wait.'
WHERE id = '5a1f298c-a0ce-4de9-8f5c-0b44f2a2b205';

DELETE FROM explore_track_venues
WHERE id = '9ea0bf09-5cb6-459b-acda-1e337cdaffb6';

-- ============================================================================
-- 2. FILL MISSING EDITORIAL BLURBS
-- Featured venues first, then non-featured
-- ============================================================================

-- === GOOD TROUBLE (Civil Rights Heritage) ===
UPDATE explore_track_venues SET editorial_blurb = 'Chronicles the African American experience in Atlanta from the civil rights era to present through powerful rotating exhibitions.'
WHERE id = '4a20008e-f763-480e-8bb3-e0d93493ea6b'; -- APEX Museum

UPDATE explore_track_venues SET editorial_blurb = 'The spiritual home of the civil rights movement. MLK Jr. was baptized and ordained here.'
WHERE id = '4baf8de3-e3bd-4b6c-be8b-be9e222d404f'; -- Ebenezer Baptist Church

UPDATE explore_track_venues SET editorial_blurb = 'West End gem housing one of the nation''s finest collections of African American and Haitian art.'
WHERE id = 'b89958c6-341d-495e-ada3-3fc55bc1a7e2'; -- Hammonds House Museum

UPDATE explore_track_venues SET editorial_blurb = 'Atlanta''s oldest cemetery and open-air museum, resting place of civil rights leaders, governors, and everyday Atlantans since 1850.'
WHERE id = 'f940cf32-7b4e-4f16-95d7-1c03c27c6fa4'; -- Oakland Cemetery (good-trouble)

UPDATE explore_track_venues SET editorial_blurb = 'Operating since 1924, this municipal market is a living intersection of Atlanta''s diverse food cultures.'
WHERE id = '0435a5f9-5fe0-4ef4-9171-d06d8bdc454e'; -- Sweet Auburn Curb Market (good-trouble)

-- === KEEP MOVING FORWARD (BeltLine) ===
UPDATE explore_track_venues SET editorial_blurb = 'The BeltLine''s crown jewel park, with a splash pad, skatepark, and direct trail access to Ponce City Market.'
WHERE id = '7dd7c817-ddd3-4dd3-ab83-32f4e447b3f8'; -- Historic Fourth Ward Park

UPDATE explore_track_venues SET editorial_blurb = 'BeltLine-adjacent brewpub with a huge rooftop patio overlooking the Eastside Trail and the skyline.'
WHERE id = '48a763c8-bb2e-4822-af37-8202a68111fb'; -- New Realm Brewing (keep-moving-forward)

-- === LIFE'S LIKE A MOVIE (Family & Kids) ===
UPDATE explore_track_venues SET editorial_blurb = 'Hands-on discovery for kids under 8, right next to the Aquarium and World of Coca-Cola in Centennial Park.'
WHERE id = '9cf14377-0b63-4dc8-bbaa-fc4ea1a18774'; -- Children's Museum of Atlanta

UPDATE explore_track_venues SET editorial_blurb = 'Planetarium shows, a 500-acre old-growth forest, and real Apollo-era space hardware tucked in Druid Hills.'
WHERE id = 'bdf0d367-6cb1-4816-a61e-ad0e26f9f7ad'; -- Fernbank Science Center

UPDATE explore_track_venues SET editorial_blurb = 'The world''s largest aquarium. Whale sharks, beluga whales, and manta rays in a 10-million-gallon oceanarium.'
WHERE id = '49d8ed05-2ed0-478d-bf7f-5e8eee54d555'; -- Georgia Aquarium (lifes-like-a-movie)

UPDATE explore_track_venues SET editorial_blurb = 'One of the oldest zoos in the country, home to giant pandas, gorillas, and a beloved train ride through Grant Park.'
WHERE id = '53aa1538-68c3-49f6-bd8f-a299da5e3910'; -- Zoo Atlanta (lifes-like-a-movie)

-- === THE ITIS (Food Scene) ===
UPDATE explore_track_venues SET editorial_blurb = 'The legendary Buford Highway international market. Entire aisles of ingredients you won''t find anywhere else in the Southeast.'
WHERE id = '23c576c5-c8aa-488c-864e-ce0dbdb64387'; -- Buford Highway Farmers Market

-- Busy Bee already handled above in dedup fix

UPDATE explore_track_venues SET editorial_blurb = 'Atlanta''s most beloved Southern restaurant since 1945. Get the fried chicken and pot likker, no exceptions.'
WHERE id = '21e303e0-b751-49d7-839d-4dde20fb6f53'; -- Mary Mac's Tea Room

UPDATE explore_track_venues SET editorial_blurb = 'Sweet Auburn''s multicultural food hall since 1924, where Southern staples sit beside West African stews and Korean bibimbap.'
WHERE id = '4c93ff04-f488-4a6c-a262-6d305f9beb2e'; -- Sweet Auburn Curb Market (the-itis)

UPDATE explore_track_venues SET editorial_blurb = 'Upper Westside food hall in a converted warehouse with rotating vendors and a beer garden.'
WHERE id = '63ced078-cafd-4822-b90c-e8720945bc6b'; -- The Works Atlanta

UPDATE explore_track_venues SET editorial_blurb = 'Midtown food hall with a curated lineup of local chefs and a rooftop bar.'
WHERE id = '62aee47e-fea1-45c7-a90e-e3e46babf4c0'; -- Politan Row

-- === THE MIDNIGHT TRAIN (Weird Spots for Freaks) ===
UPDATE explore_track_venues SET editorial_blurb = 'Atlanta''s most infamous dive. The dancers are legends, the vibe is unhinged, and the basement pulses till 4am.'
WHERE id = 'e53bb9f7-1e26-451d-8a6f-b51aec6ece4b'; -- Clermont Lounge

UPDATE explore_track_venues SET editorial_blurb = 'Victorian-era burial ground turned outdoor museum, with moonlit tours, jazz brunches, and some of Atlanta''s oldest oaks.'
WHERE id = '0664839a-0b00-4105-9f18-2ec649a85143'; -- Oakland Cemetery (midnight-train)

-- === TOO BUSY TO HATE (LGBTQ+ Culture) ===
UPDATE explore_track_venues SET editorial_blurb = 'Atlanta''s longest-running lesbian bar, with live music, drag shows, and a fiercely loyal community.'
WHERE id = 'c6c2e496-e51b-42e1-8a6a-4a23d9c69c47'; -- My Sister's Room

-- === WELCOME TO ATLANTA (Classic Atlanta) ===
UPDATE explore_track_venues SET editorial_blurb = 'The world''s largest aquarium, home to whale sharks, beluga whales, and 10 million gallons of wonder.'
WHERE id = '0205c630-3f5a-4e33-ab53-e8940ef0f1f5'; -- Georgia Aquarium (welcome)

UPDATE explore_track_venues SET editorial_blurb = 'Georgia''s most-visited attraction: a granite monadnock with laser shows, hiking trails, and a skyride to the summit.'
WHERE id = 'b572008a-647c-44f6-84e2-9497d3f70444'; -- Stone Mountain Park (welcome)

UPDATE explore_track_venues SET editorial_blurb = 'One of America''s oldest zoos, set in historic Grant Park with giant pandas, gorillas, and a beloved miniature train.'
WHERE id = '1336768e-e858-4894-a5fe-0a185e3bb891'; -- Zoo Atlanta (welcome)

-- ============================================================================
-- 3. TRIM BLOATED TRACKS
-- ============================================================================

-- === A BEAUTIFUL MOSAIC (33 -> 22): Remove 11 weakest ===
DELETE FROM explore_track_venues WHERE id IN (
  '9876dc81-03d1-4ef4-ae26-d2fce919c979',  -- Plaza Las Americas (data_quality 33, no image)
  '603ac459-6040-49ad-a8ae-f3a492c977bd',  -- IRC Atlanta (38, no image, org not destination)
  'f56a36d6-bd0b-4f2e-b335-ae36d3081866',  -- Jeju Sauna duplicate (38, no image)
  'ac5090a5-0a54-4851-a10d-6510b90ce39c',  -- CPACS (43, no image, org not destination)
  '72041981-3a32-41df-9519-19dd132beb1e',  -- Nam Phuong (43, no image)
  '163b7251-1683-41f9-b527-a48f0ccd0f58',  -- Latin American Assoc (61, no image, org)
  'c80d64aa-bd39-4d34-977f-c581323348fa',  -- Westside Cultural Arts Center (57)
  'abd002a8-d4b2-48b5-881c-75031579809b',  -- Shrine Cultural Center (58)
  '40164c48-46e5-4e0f-b6c3-a8599da08e1b',  -- Sweet Auburn Curb Market (66, no image, in other tracks)
  '6539a6d3-b397-49f9-8406-d9b22363a43c',  -- Northern China Eatery (65)
  'd49be204-02ee-4ab7-ac90-406890d31498'   -- Pho Dai Loi 2 (65)
);

-- === ARTEFACTS OF THE LOST CITY (42 -> 22): Remove 20 least compelling ===
DELETE FROM explore_track_venues WHERE id IN (
  'e3392ebf-1a88-4111-8d93-64557e686e27',  -- 1895 Exposition Steps
  '2fec86e2-3155-49a6-8e5e-9e17ef7d6754',  -- Stone Mountain Grist Mill
  '8c8e66b2-d8c6-490f-be7c-0bc01edfaabf',  -- Elvis Shrine Vault
  '897de192-e7b6-493f-9c6a-53172ebc588d',  -- One-Person Jail Cell (no image)
  '731ca4e9-498a-4eb9-b03c-d7a65c3967ed',  -- Asa Candler Mausoleum
  '9dfea87d-1682-424a-b3a3-1c33021b75d0',  -- 2 Chainz Pink Chevy (temporary/removed)
  '4309996e-153b-4ae6-aa8f-fa5f100155af',  -- Anti-Gravity Monument
  '4ddbd31e-1efc-4221-a220-5296c3f64738',  -- Covington Clock Tower (not Atlanta proper)
  '4b75bd48-015e-4976-8ce7-97a87b308e63',  -- Whittier Mill Tower
  'db1aa486-7584-4202-ba02-c1c9a859f0ac',  -- Sideways the Dog's Grave
  'b8103670-57fa-4fcf-ace9-54f1132d3820',  -- Lord Dooley Statue (niche Emory)
  'eba47d2e-b799-4967-ba6a-0d85776848c4',  -- Fiddlin' John Carson's Grave
  'fe533a8e-1196-41c0-a150-e9c4c027fe56',  -- Owl Rock
  '437d39f0-8387-4836-ac87-c278feec1065',  -- Jack Smith Armchair Statue
  '614343bb-c8bd-4613-96cc-f4c7d1745277',  -- Giant Hands of Dr. Sid
  '5008c1b5-47a4-4eec-84a1-4c952f74750a',  -- World Athletes Monument
  'c601d9b5-16c3-46c8-b33c-2ee5995fdeb1',  -- Riverview Carousel
  '647516c0-dd9e-4c6b-8d93-54582887358f',  -- FDR Railcar (in Duluth, far)
  'd3a7aa3d-4cc8-457d-b318-ee9b43b877c0',  -- Bridge Over Nothing
  '0d0fcfbd-40f3-4535-9fc9-a2dbcb1b4587'   -- Hank Aaron Statue (redundant with Wall)
);

-- === THE ITIS (25 -> 22): Remove 3 (1 duplicate already gone + 2 weakest) ===
-- Busy Bee duplicate already deleted above, bringing to 24
DELETE FROM explore_track_venues WHERE id IN (
  '8e2fc5d1-444c-4b8a-a120-0fb32a4965ce',  -- Atlanta Food Truck Park (55, no image, no blurb)
  'ecdc171f-29ad-47a3-b966-c42b7d6a32d1'   -- Stackhouse (55, no image, no blurb)
);

-- UP ON THE ROOF (22): At boundary, keeping as-is

-- ============================================================================
-- 4. FIX SPELHOUSE BUSY BEE — points to duplicate venue (3210, dq=53, no image)
-- Repoint to the real venue (675, dq=92, has image, Vine City)
-- ============================================================================

UPDATE explore_track_venues
SET venue_id = 675
WHERE id = 'cdeff067-34a4-44bf-9510-a71c3642375f';

-- ============================================================================
-- 5. QUOTE PORTRAIT URLs
-- Wikimedia Commons portraits for track quote attributions
-- ============================================================================

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Fort_Wainwright_hosts_first_summer_concert_in_two_years_%281%29_%28cropped%29.jpg/200px-Fort_Wainwright_hosts_first_summer_concert_in_two_years_%281%29_%28cropped%29.jpg' WHERE slug = 'welcome-to-atlanta'; -- Ludacris

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/John_Lewis_official_portrait_2003.jpg/200px-John_Lewis_official_portrait_2003.jpg' WHERE slug = 'good-trouble'; -- John Lewis

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Andre_3000_New_York_2014_by_Shankbone.jpg/200px-Andre_3000_New_York_2014_by_Shankbone.jpg' WHERE slug = 'the-south-got-something-to-say'; -- Andre 3000

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Martin_Luther_King%2C_Jr..jpg/200px-Martin_Luther_King%2C_Jr..jpg' WHERE slug = 'keep-moving-forward'; -- MLK Jr.

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Aaron_McGruder_2002_%28cropped%29.png/200px-Aaron_McGruder_2002_%28cropped%29.png' WHERE slug = 'the-itis'; -- Aaron McGruder

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Waka_Flocka_2016.png/200px-Waka_Flocka_2016.png' WHERE slug = 'hard-in-da-paint'; -- Waka Flocka Flame

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/JimmyCarterPortrait2.jpg/200px-JimmyCarterPortrait2.jpg' WHERE slug = 'a-beautiful-mosaic'; -- Jimmy Carter

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/William_B._Hartsfield_1961.jpg/200px-William_B._Hartsfield_1961.jpg' WHERE slug = 'too-busy-to-hate'; -- Mayor Hartsfield

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Gladys_Knight_%281969%29.jpg/200px-Gladys_Knight_%281969%29.jpg' WHERE slug = 'the-midnight-train'; -- Gladys Knight

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Hank_Aaron_%281954%29_%28cropped%29.jpg/200px-Hank_Aaron_%281954%29_%28cropped%29.jpg' WHERE slug = 'keep-swinging'; -- Hank Aaron

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Jim_Henson_%281989%29_headshot_%28cropped%29.jpg/200px-Jim_Henson_%281989%29_headshot_%28cropped%29.jpg' WHERE slug = 'lifes-like-a-movie'; -- Jim Henson

UPDATE explore_tracks SET quote_portrait_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/The_Drifters_1957.JPG/200px-The_Drifters_1957.JPG' WHERE slug = 'up-on-the-roof'; -- The Drifters
