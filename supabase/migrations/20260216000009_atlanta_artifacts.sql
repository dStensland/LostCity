-- Atlanta Artifacts: weird, obscure, and notable physical objects
-- Each artifact is a specific THING, not the place that houses it

-- ============================================================
-- STANDALONE ARTIFACTS (new venue entries)
-- ============================================================

-- 1. Crypt of Civilization
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Crypt of Civilization', 'crypt-of-civilization', 'artifact', 'Atlanta', 'GA', 'Brookhaven',
  33.8725, -84.3388,
  'The world''s first intentional time capsule — a room-sized sealed chamber built inside a former swimming pool in the basement of Phoebe Hearst Hall at Oglethorpe University. Sealed on May 28, 1940, it is not to be opened until the year 8113 AD. Inside: a typewriter, a Budweiser bottle, microfilm of the Sears catalog, and a machine that teaches English in case the language has disappeared. Recognized by the Guinness Book of Records as the first genuine attempt to permanently preserve a record of civilization.',
  'World''s first time capsule. Sealed 1940. Opens year 8113.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'crypt-of-civilization');

-- 2. Doll's Head Trail
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Doll''s Head Trail', 'dolls-head-trail', 'artifact', 'Atlanta', 'GA', 'South Atlanta',
  33.6947, -84.3534,
  'A folk art trail at Constitution Lakes Park made entirely of river trash. Artist Joel Slaton arranged hundreds of discarded doll heads, bricks, tiles, and debris washed from the South River into eerie and whimsical sculptures throughout the forest. The park sits on a demolished 19th-century brick company, and the old pits form the lakes. Visitors can contribute, but only using trash found within the park.',
  'Folk art trail made of doll heads and river trash.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'dolls-head-trail');

-- 3. The Big Chicken
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'The Big Chicken', 'the-big-chicken', 'artifact', 'Marietta', 'GA', 'Marietta',
  33.9526, -84.5201,
  'A 56-foot-tall steel-sided structure shaped like a chicken, sitting atop a KFC. Built in 1963 by Georgia Tech architecture student Hubert Puckett for a restaurant called Johnny Reb''s Chick-Chuck-''N''-Shake. Its beak and eyes mechanically move. Pilots approaching Dobbins Air Reserve Base use it as a navigational landmark, and locals give driving directions relative to it. Survived a 1993 storm that decapitated it — KFC rebuilt it after public outcry.',
  '56-foot steel chicken. Pilots navigate by it.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'the-big-chicken');

-- 4. Two-Headed Calf & Moon Rocks
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Two-Headed Calf & Moon Rocks', 'two-headed-calf-moon-rocks', 'artifact', 'Atlanta', 'GA', 'Downtown',
  33.7490, -84.3880,
  'On the fourth floor of the Georgia State Capitol, a taxidermied two-headed calf born in 1987 in Palmetto, Georgia sits in a curiosity cabinet alongside a two-headed snake and actual moon rocks brought back from the Apollo missions. The calves were so popular with visitors that when a natural resources display was removed, they were returned by popular demand. Free to visit during business hours.',
  'Taxidermied two-headed calf + Apollo moon rocks. 4th floor, State Capitol.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'two-headed-calf-moon-rocks');

-- 5. The Great Fish
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'The Great Fish', 'the-great-fish', 'artifact', 'Atlanta', 'GA', 'Buckhead',
  33.8148, -84.3618,
  'A 65-foot-long copper-coated steel sculpture of a leaping fish outside the Atlanta Fish Market — recognized by Guinness World Records as the largest fish statue in the world. Weighing 50 tons and anchored 90 feet into the ground to withstand 200mph winds, it was designed by Georgia artist Martin Dawe and installed in 1995. Originally bronze-colored, it has developed a blue-green patina like the Statue of Liberty.',
  'World''s largest fish statue. 65 feet, 50 tons, Guinness certified.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'the-great-fish');

-- 6. Autoeater
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Autoeater', 'autoeater', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7815, -84.3853,
  'A 32,000-pound Carrara marble sculpture of a giant worm-like creature swallowing a Fiat Panda. Created by German artists Julia Venske and Gregor Spanle, carved in Italy and shipped from a Tuscan quarry. Commentary on Atlanta''s relationship with the automobile, installed at the intersection of Peachtree and 10th Street.',
  '32,000-pound marble worm eating a Fiat. Peachtree & 10th.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'autoeater');

-- 7. Noguchi Playscape
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Noguchi Playscape', 'noguchi-playscape', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7866, -84.3727,
  'The only realized playground design in the United States by sculptor Isamu Noguchi. Completed in 1976 and commissioned by the High Museum of Art, it reimagines swings, slides, and jungle gyms as sculptural forms. Blue and green climbing blocks, a circular mound, a triple slide, and a spiraling tower blur the line between fine art and playground. Hidden in Piedmont Park near the Park Drive entrance.',
  'Only Isamu Noguchi playground in the US. Sculpture you can play on.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'noguchi-playscape');

-- 8. Giant Hands of Dr. Sid
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Giant Hands of Dr. Sid', 'giant-hands-of-dr-sid', 'artifact', 'Marietta', 'GA', 'Marietta',
  33.9375, -84.5319,
  'An 18-foot-tall, 12-foot-wide pair of bronze hands in front of Life University''s bell tower, modeled on the actual hands of founder Dr. Sid Williams. The hands are posed mid-chiropractic neck adjustment on an invisible giant patient. Complete with oversized replicas of Dr. Sid''s Georgia Tech football rings.',
  '18-foot bronze hands doing a chiropractic adjustment.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'giant-hands-of-dr-sid');

-- 9. Phoenix Rising (Atlanta from the Ashes)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Phoenix Rising', 'phoenix-rising-sculpture', 'artifact', 'Atlanta', 'GA', 'Downtown',
  33.7545, -84.3894,
  'A bronze sculpture in Woodruff Park depicting a woman being lifted skyward from flames by a phoenix. Commissioned in 1969 for the 100th anniversary of Rich''s department store, designed and cast in Italy. Symbolizes Atlanta''s rebirth after Sherman''s March to the Sea. The city''s seal features a phoenix for the same reason.',
  'Bronze woman lifted by a phoenix. Atlanta''s rebirth symbol.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'phoenix-rising-sculpture');

-- 10. Zero Mile Post
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Zero Mile Post', 'zero-mile-post', 'artifact', 'Atlanta', 'GA', 'Downtown',
  33.7517, -84.3904,
  'The stone marker that defined the terminus of the Western and Atlantic Railroad, around which the settlement that became Atlanta grew. Placed circa 1850, it is 7 feet 5 inches tall, weighs 800 pounds, and reads "W&A RR OO." The original was moved to the Atlanta History Center in 2018; a replica stands at the original location near Underground Atlanta. This rock is literally why Atlanta exists.',
  'The rock that started Atlanta. Railroad terminus marker, circa 1850.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'zero-mile-post');

-- 11. Sope Creek Paper Mill Ruins
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Sope Creek Paper Mill Ruins', 'sope-creek-paper-mill-ruins', 'artifact', 'Marietta', 'GA', 'East Cobb',
  33.9610, -84.4325,
  'Multi-story stone ruins of an 1855 paper mill that produced much of the Confederacy''s paper currency during the Civil War. Destroyed by Union troops, the ruins stand in the forest like a medieval fortress with massive stone walls still reaching several stories high. The mill operated off and on until 1902. Now part of the Chattahoochee River National Recreation Area, reached via a 3-mile hiking trail.',
  'Castle-like ruins. Printed Confederate money. Burned by Union troops.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'sope-creek-paper-mill-ruins');

-- 12. The Storyteller (Stag-Man)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'The Storyteller', 'the-storyteller-stag-man', 'artifact', 'Atlanta', 'GA', 'Buckhead',
  33.8394, -84.3647,
  'A bronze sculpture by Alabama artist Frank Fleming depicting a naked man with a full set of buck antlers, seated on a log, holding a staff with lanterns, surrounded by rabbits, turtles, and dogs. Originally installed in the Buckhead Triangle at the major Peachtree/Roswell/Paces Ferry intersection, later relocated to the Buckhead Library grounds.',
  'Naked antlered man with rabbits. Bronze. Buckhead Library.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'the-storyteller-stag-man');

-- 13. Hoo-Hoo Monument
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Hoo-Hoo Monument', 'hoo-hoo-monument', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7846, -84.3710,
  'A monument in Piedmont Park commemorating a 1926 tree-planting by the Atlanta chapter of the Concatenated Order of Hoo-Hoo — a fraternal organization of people in the forest products industry, founded in Gurdon, Arkansas in 1892. The name alone justifies a visit. Located just inside the Park Avenue entrance.',
  'Monument from the Concatenated Order of Hoo-Hoo. Lumber fraternity.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'hoo-hoo-monument');

-- 14. Millennium Gate
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Millennium Gate', 'millennium-gate', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7908, -84.3953,
  'A 100-foot-tall triumphal arch modeled after the Arch of Titus in Rome, originally intended for Washington D.C. but built in Atlanta instead. Opened July 4, 2008, cost $20 million, and features sculptural allegory by Scottish sculptor Alexander Stoddart. Houses a 12,000-square-foot Georgia history museum inside its seven levels. Atlanta''s answer to the Arc de Triomphe.',
  '100-foot Roman triumphal arch. Was meant for D.C. Atlanta got it.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'millennium-gate');

-- 15. Whittier Mill Tower
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Whittier Mill Tower', 'whittier-mill-tower', 'artifact', 'Atlanta', 'GA', 'Bolton',
  33.8100, -84.4490,
  'The lone surviving brick tower from a 65,000-square-foot textile mill that operated from 1896 to 1971, now standing as the centerpiece of a 22-acre park on the Chattahoochee River. The rest of the New England-owned cotton mill was demolished in 1988, but the tower and some weaving room foundations remain as haunting industrial relics.',
  'Last standing tower of an 1896 cotton mill on the Chattahoochee.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'whittier-mill-tower');

-- 16. World Athletes Monument
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'World Athletes Monument', 'world-athletes-monument', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7870, -84.3838,
  'A 55-foot-tall Indiana limestone and bronze monument gifted to Atlanta by the Prince of Wales for the 1996 Olympics. Five Doric columns represent five continents, topped by five bronze Atlas figures carrying a globe with an Olympic torch. Became a spontaneous memorial where 20,000+ people gathered to mourn Princess Diana in 1997.',
  'Prince Charles''s Olympic gift. 55 feet. Became a Diana memorial.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'world-athletes-monument');

-- 17. Cyclorama (Battle of Atlanta Painting)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'The Cyclorama', 'the-cyclorama', 'artifact', 'Atlanta', 'GA', 'Buckhead',
  33.8420, -84.3861,
  'One of the world''s largest oil paintings — 49 feet high by 358 feet in circumference, weighing 10,000 pounds. Created in 1886 by 17 German artists in Milwaukee, this panoramic painting depicts the Civil War Battle of Atlanta. Originally marketed as a Union victory; when it moved to Atlanta in 1892, it was re-spun as a Confederate one. Underwent a $35 million restoration and reopened at the Atlanta History Center in 2019.',
  'World''s largest oil painting. 358 feet around. 10,000 pounds.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'the-cyclorama');

-- 18. Pemberton Statue
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Pemberton Statue', 'pemberton-statue', 'artifact', 'Atlanta', 'GA', 'Downtown',
  33.7626, -84.3927,
  'A 6-foot-4-inch, 800-pound bronze statue of Dr. John Stith Pemberton — the Atlanta pharmacist who invented Coca-Cola in 1886 by mixing coca leaf extract and kola nut in a three-legged brass kettle. He stands holding up a glass of Coke. Located at Pemberton Place near the World of Coca-Cola.',
  'Bronze of the man who invented Coca-Cola. Holding a glass of Coke.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'pemberton-statue');

-- 19. Bobby Jones Grave
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Bobby Jones'' Grave', 'bobby-jones-grave', 'artifact', 'Atlanta', 'GA', 'Grant Park',
  33.7480, -84.3722,
  'The grave of golf legend Bobby Jones at Oakland Cemetery — the only person to ever win all four major championships in a single year (1930). Fans and golfers still leave golf balls on his headstone daily as tribute. Located in the historic section of Oakland Cemetery near the Confederate memorial.',
  'Golf legend''s grave. Fans leave golf balls on the headstone daily.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'bobby-jones-grave');

-- 20. Jack Smith Armchair Statue
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Jack Smith Armchair Statue', 'jack-smith-armchair-statue', 'artifact', 'Atlanta', 'GA', 'Grant Park',
  33.7482, -84.3718,
  'About 100 yards inside the Oakland Cemetery entrance, a life-size granite statue of a bald man with a bushy mustache sits in an armchair, holding his top hat, casually staring at the cemetery gates for eternity. One of the most distinctive funerary sculptures in the American Southeast.',
  'Life-size granite man in an armchair, watching the cemetery gates forever.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'jack-smith-armchair-statue');

-- 21. Folk Art Park
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Folk Art Park', 'folk-art-park', 'artifact', 'Atlanta', 'GA', 'Downtown',
  33.7630, -84.3810,
  'A public outdoor folk art installation built above the Downtown Connector (I-75/I-85) as part of the 1996 Olympic development program. Features works by twelve regional folk artists including Howard Finster, the visionary art legend, and Eddie Owens Martin (St. EOM), who created the Pasaquan compound after a fever vision of beings from the future. Surreal art floating above 16 lanes of highway.',
  'Howard Finster art floating above the interstate. Built for the Olympics.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'folk-art-park');

-- 22. Fountain of Rings
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Fountain of Rings', 'fountain-of-rings', 'artifact', 'Atlanta', 'GA', 'Downtown',
  33.7604, -84.3932,
  'The world''s largest interactive fountain — 251 computer-controlled water jets arranged in the shape of the five Olympic rings at Centennial Olympic Park. Water shoots 12 to 35 feet in the air, synchronized with music and lights. Built for the 1996 Olympics. The surrounding pavement contains over 430,000 commemorative engraved bricks arranged in quilt squares.',
  'World''s largest interactive fountain. 251 jets in Olympic ring formation.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'fountain-of-rings');

-- 23. The Varsity Neon Sign
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'The Varsity Neon Sign', 'the-varsity-neon-sign', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7713, -84.3907,
  'The iconic neon signage of The Varsity — the world''s largest drive-in restaurant, in continuous operation since 1928. The retro red-and-white sign is visible from the I-75/I-85 connector and has become synonymous with Atlanta''s identity. The restaurant occupies two city blocks near Georgia Tech.',
  'Neon sign of the world''s largest drive-in. Visible from the interstate since 1928.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'the-varsity-neon-sign');

-- 24. Vortex Laughing Skull Entrance
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Vortex Laughing Skull', 'vortex-laughing-skull', 'artifact', 'Atlanta', 'GA', 'Little Five Points',
  33.7645, -84.3490,
  'A 20-foot-tall psychedelic skull sculpture that serves as the entrance to The Vortex Bar & Grill in Little Five Points. You literally walk through the gaping mouth to enter the restaurant. Wild eyes, cartoonish proportions, and zero subtlety since 1996.',
  '20-foot psychedelic skull you walk through to enter a bar.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'vortex-laughing-skull');

-- ============================================================
-- HIGHLIGHTS on new artifacts
-- ============================================================

-- Crypt of Civilization
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'What''s Inside',
  'A typewriter, a Budweiser bottle, a set of Lincoln Logs, microfilm of the Sears Roebuck catalog, newsreels, recordings of Hitler and Mussolini, a toaster, and a machine designed to teach English to whoever opens it in 6,177 years.',
  0
FROM venues v WHERE v.slug = 'crypt-of-civilization'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'What''s Inside');

-- Doll's Head Trail
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Rules of the Trail',
  'You can add to the art, but only using trash found within the park. No outside materials allowed. The South River keeps supplying new debris after every storm.',
  0
FROM venues v WHERE v.slug = 'dolls-head-trail'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Rules of the Trail');

-- Big Chicken
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Survived a Decapitation',
  'A 1993 storm ripped the chicken''s head off and destroyed its eyes. KFC rebuilt the head after a massive public outcry. The new head kept the mechanical beak and eyes from the original 1963 design.',
  0
FROM venues v WHERE v.slug = 'the-big-chicken'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Survived a Decapitation');

-- Two-Headed Calf
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Returned by Popular Demand',
  'When a natural resources display was dismantled, the two-headed calf was removed. Visitors complained so loudly it was put back. Now shares a case with Apollo moon rocks and a two-headed snake.',
  0
FROM venues v WHERE v.slug = 'two-headed-calf-moon-rocks'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Returned by Popular Demand');

-- Cyclorama
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Changed Sides',
  'Originally marketed in the North as a Union victory painting. When it moved to Atlanta in 1892, the narrative was quietly reframed as a Confederate one. The $35 million restoration in 2019 returned it to its original orientation for the first time in 127 years.',
  0
FROM venues v WHERE v.slug = 'the-cyclorama'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Changed Sides');

-- Sope Creek
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The Castle Walls',
  'The multi-story stone walls look like a medieval fortress rising from the forest floor. Best photographed in late afternoon when light filters through the trees and the stone glows warm amber.',
  0
FROM venues v WHERE v.slug = 'sope-creek-paper-mill-ruins'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Castle Walls');

-- Zero Mile Post
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Why Atlanta Exists',
  'This stone marker defined the end of the Western and Atlantic Railroad line. A settlement grew around it called Terminus, then Marthasville, then Atlanta. Without this rock, Atlanta would be a forest.',
  0
FROM venues v WHERE v.slug = 'zero-mile-post'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Why Atlanta Exists');

-- Millennium Gate
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Rejected by Washington',
  'The arch was originally proposed for the National Mall in D.C. When Washington said no, Atlanta said yes and spent $20 million building a 100-foot Roman arch at Atlantic Station.',
  0
FROM venues v WHERE v.slug = 'millennium-gate'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Rejected by Washington');

-- Noguchi Playscape
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Fine Art You Can Climb',
  'Commissioned by the High Museum, designed by the sculptor behind the UNESCO gardens in Paris. Every element is a sculpture first and playground equipment second. The only one of its kind in the United States.',
  0
FROM venues v WHERE v.slug = 'noguchi-playscape'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Fine Art You Can Climb');

-- World Athletes Monument
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Became a Diana Memorial',
  'After Princess Diana''s death in August 1997, an estimated 20,000 to 30,000 people gathered at this monument — gifted by her ex-husband Prince Charles — creating one of the largest spontaneous memorials in the American South.',
  0
FROM venues v WHERE v.slug = 'world-athletes-monument'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Became a Diana Memorial');
