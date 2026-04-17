-- Curated image audit for Mission: Impossible ranking items
-- Each stunt/sequence now has a scene-accurate image selected via visual review
-- Mix of TMDB backdrops and external URLs for scenes without good TMDB coverage

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Remove items where no good image exists
-- ═══════════════════════════════════════════════════════════════════════════════

-- Delete entries first (FK), then items
DELETE FROM goblin_ranking_entries WHERE item_id IN (
  SELECT id FROM goblin_ranking_items
  WHERE (name = 'NOC list theft (embassy)' AND subtitle = 'MI')
     OR (name = 'Lane interrogation (The Syndicate reveal)' AND subtitle = 'Rogue Nation')
);
DELETE FROM goblin_ranking_items
WHERE (name = 'NOC list theft (embassy)' AND subtitle = 'MI')
   OR (name = 'Lane interrogation (The Syndicate reveal)' AND subtitle = 'Rogue Nation');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. MI (1996) — stunts & sequences
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/pbaAkR1FDvgndTVFgGRIzf9o49r.jpg'
WHERE name = 'Langley ceiling hang' AND subtitle = 'MI';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/8jGDLAr3ZaWEidlk0EcJhzm4wrc.jpg'
WHERE name = 'Aquarium restaurant explosion' AND subtitle = 'MI';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/41hN0vfWNXVnvbTY2MYJnPfIHSp.jpg'
WHERE name = 'Channel Tunnel helicopter chase' AND subtitle = 'MI';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/3ZfJcWicmh9vLGQ89CrExqpWMll.jpg'
WHERE name = 'Bible reveal / mole hunt' AND subtitle = 'MI';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/3nJ9I1PZwVPKuoogwJdqIxTJx3N.jpg'
WHERE name = 'Prague restaurant hit / team wipeout' AND subtitle = 'MI';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. MI:2 (2000) — stunts & sequences
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/377UVEkngNDHInMmFImjBtFEFCD.jpg'
WHERE name = 'Rock climbing free solo' AND subtitle = 'MI:2';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/5vccIwvGcw1loUM3Ui1y7WZfMvM.jpg'
WHERE name = 'Motorcycle joust' AND subtitle = 'MI:2';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/rmrh0SCVCPKWCufls5qBnhOT5xo.jpg'
WHERE name = 'Seville nightclub infiltration' AND subtitle = 'MI:2';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/botBxvTsFV6HS4M8dYXgjqdoT6J.jpg'
WHERE name = 'Chimera lab break-in' AND subtitle = 'MI:2';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. MI:III (2006) — stunts & sequences
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items SET image_url = 'https://i.insider.com/64aed96394be880019f3a007?width=800&format=jpeg&auto=webp'
WHERE name = 'Vatican infiltration' AND subtitle = 'MI:III';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/fCXdOiQUXiEFLf46qDiU4dsDpow.jpg'
WHERE name = 'Shanghai factory swing' AND subtitle = 'MI:III';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/hpLWyXPIhxt8GNNtUkKeMa3Ahl9.jpg'
WHERE name = 'Bridge ambush / Davian capture' AND subtitle = 'MI:III';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/hp9x4sgMyHzcdJrKX57as5xdb4U.jpg'
WHERE name = 'Shanghai rooftop run' AND subtitle = 'MI:III';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Ghost Protocol (2011) — stunts & sequences
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/8nBx9T56GzARmHqAZ7yPfZ3X3oW.jpg'
WHERE name = 'Burj Khalifa climb' AND subtitle = 'Ghost Protocol';

UPDATE goblin_ranking_items SET image_url = 'https://i.ytimg.com/vi/gJ3aXgH_-aU/maxresdefault.jpg'
WHERE name = 'Mumbai parking garage chase' AND subtitle = 'Ghost Protocol';

UPDATE goblin_ranking_items SET image_url = 'https://i.ytimg.com/vi/7DkV8WE7DFA/maxresdefault.jpg'
WHERE name = 'Kremlin infiltration' AND subtitle = 'Ghost Protocol';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/eXgnsItOTWNHOpqqZahMM3qDut0.jpg'
WHERE name = 'Sandstorm pursuit' AND subtitle = 'Ghost Protocol';

UPDATE goblin_ranking_items SET image_url = 'https://hardinthecity.wordpress.com/wp-content/uploads/2011/12/jeremy-renner-in-mission-impossible-ghost-protocol.jpg'
WHERE name = 'Mumbai server room / dual-bluff' AND subtitle = 'Ghost Protocol';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Rogue Nation (2015) — stunts & sequences
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/ki5RnA0xNOEd3R0RohXqJt9R6Om.jpg'
WHERE name = 'Plane door hang (takeoff)' AND subtitle = 'Rogue Nation';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/39gQ0wzN2N2VPLgwpzr3ebbh0jl.jpg'
WHERE name = 'Morocco motorcycle chase' AND subtitle = 'Rogue Nation';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/8FYIS9fxzv4N567n79UBoolw28.jpg'
WHERE name = 'Underwater Torus breach' AND subtitle = 'Rogue Nation';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/eR20N1flPCQyp9HzpxlTcxgDAO7.jpg'
WHERE name = 'Vienna opera house' AND subtitle = 'Rogue Nation';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/m1R3fIO9QRwxS0N1GHqcjnIz1VX.jpg'
WHERE name = 'London pursuit / glass box' AND subtitle = 'Rogue Nation';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Fallout (2018) — stunts & sequences
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/nv3iKVxsRiQDO8IGo5H7mhvgg6r.jpg'
WHERE name = 'HALO jump' AND subtitle = 'Fallout';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/jDnhdNm7XVwl0GisIV77o64EcDa.jpg'
WHERE name = 'Helicopter canyon chase' AND subtitle = 'Fallout';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/dZKPybFgLuBIJZyjIYYug327zQs.jpg'
WHERE name = 'Paris motorcycle chase' AND subtitle = 'Fallout';

UPDATE goblin_ranking_items SET image_url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjxv-1rLMXkSI4FfoIH1qZyM2tIIc4qDobC_kLBEXI51QzzNeBtlB7f9C4UEIM_aQtYpCl22OyJbh-oAPp6vq7vi0BdGDpdiOEORiP1ilkT9mSwdExf3yUaTkL2sfXsrbjiS5t6/s640/MI+Fallout.jpg'
WHERE name = 'Kashmir cliff fight' AND subtitle = 'Fallout';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/mm1TvGpyHelChF9WxDa3gX6RbjP.jpg'
WHERE name = 'London rooftop chase / building jump' AND subtitle = 'Fallout';

UPDATE goblin_ranking_items SET image_url = 'https://www.slashfilm.com/img/gallery/henry-cavill-explains-that-incredible-arm-cocking-moment-from-mission-impossible-fallout/i-cant-believe-i-did-that-1666913132.jpg'
WHERE name = 'Belfast bathroom fight' AND subtitle = 'Fallout';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/kGGSBAUiLD5xQSls6OIb7Jf6IYD.jpg'
WHERE name = 'Kashmir nuclear deactivation' AND subtitle = 'Fallout';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. Dead Reckoning (2023) — stunts & sequences
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/dGu4WJDANvvI5XtZhcq7E5CPjwy.jpg'
WHERE name = 'Motorcycle cliff jump' AND subtitle = 'Dead Reckoning';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/9mZDDQ43I2QZOsYDlGZ6S8fFSTf.jpg'
WHERE name = 'Orient Express train roof fight' AND subtitle = 'Dead Reckoning';

UPDATE goblin_ranking_items SET image_url = 'https://assets-prd.ignimgs.com/2023/09/11/missionimpossible-thumb-1694473945110.jpg'
WHERE name = 'Airport runway standoff' AND subtitle = 'Dead Reckoning';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/f2zw2OVrGdnHLNYxiQJ2jiNFCLN.jpg'
WHERE name = 'Venice chase' AND subtitle = 'Dead Reckoning';

UPDATE goblin_ranking_items SET image_url = 'https://media.hagerty.com/media/wp-content/uploads/2023/08/MI-Dead-Reckoning-Fiat-Lead.jpg'
WHERE name = 'Rome car chase (Fiat)' AND subtitle = 'Dead Reckoning';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. The Final Reckoning (2025) — stunts & sequences
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/13NEYlkwcuq7UJvGhEIIqhapIyZ.jpg'
WHERE name = 'Sevastopol submarine dive' AND subtitle = 'The Final Reckoning'
  AND category_id = (SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible'));

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/zjRGMFGm7yP4vLnTGRjrmO28hW4.jpg'
WHERE name = 'Biplane wing walk' AND subtitle = 'The Final Reckoning';

UPDATE goblin_ranking_items SET image_url = 'https://i.ytimg.com/vi/K5PP7igejMU/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCEfWW8F717K5BB4t086Oc1DcsA0A'
WHERE name = 'Burning parachute freefall' AND subtitle = 'The Final Reckoning';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/9ABoeKAJGJGdgitTc6XaTJZGc1U.jpg'
WHERE name = 'Sevastopol submarine dive' AND subtitle = 'The Final Reckoning'
  AND category_id = (SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible'));

UPDATE goblin_ranking_items SET image_url = 'https://www.slashfilm.com/img/gallery/final-reckoning-gives-the-most-tragic-character-from-the-first-mission-impossible-the-ending-he-deserves/intro-1747940270.jpg'
WHERE name = 'St. Matthew''s Island battle' AND subtitle = 'The Final Reckoning';

UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/pcw4m5WjuQvZZDvVG8UDIp2uWeR.jpg'
WHERE name = 'Biplane dogfight over Drakensberg' AND subtitle = 'The Final Reckoning';

UPDATE goblin_ranking_items SET image_url = 'https://butwhytho.net/wp-content/uploads/2025/05/Mission-Impossible-The-Final-Reckoning-But-Why-Tho-7.jpg'
WHERE name = 'Doomsday vault gunfight' AND subtitle = 'The Final Reckoning';
