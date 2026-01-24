-- ============================================
-- MIGRATION 036: Festival Sources
-- ============================================
-- Adds major Atlanta festivals as event sources:
--
-- Music Festivals:
--   1. Shaky Knees Festival
--   2. SweetWater 420 Fest
--   3. Atlanta Jazz Festival
--   4. ONE Musicfest
--   5. Juneteenth Atlanta Festival
--   6. Porchfest Virginia-Highland
--   7. Breakaway Music Festival
--
-- Gaming/Nerd Conventions:
--   8. DragonCon
--   9. MomoCon
--   10. Anime Weekend Atlanta
--   11. DreamHack Atlanta
--   12. Southern Fried Gaming Expo
--
-- Film Festivals:
--   13. Atlanta Underground Film Festival
--   14. Atlanta Shortsfest
--   15. Atlanta Horror Film Festival
--   16. ATL DOC (Documentary Festival)
--   17. BronzeLens Film Festival
--   18. Buried Alive Film Festival
--   19. Atlanta Spotlight Film Festival
-- ============================================

-- ============================================
-- MUSIC FESTIVAL SOURCES
-- ============================================

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'shaky-knees',
    'Shaky Knees Festival',
    'https://www.shakykneesfestival.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'sweetwater-420-fest',
    'SweetWater 420 Fest',
    'https://sweetwater420fest.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-jazz-festival',
    'Atlanta Jazz Festival',
    'https://atljazzfest.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'one-musicfest',
    'ONE Musicfest',
    'https://onemusicfest.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'juneteenth-atlanta',
    'Juneteenth Atlanta Parade & Music Festival',
    'https://juneteenthatl.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'porchfest-vahi',
    'Porchfest Virginia-Highland',
    'https://www.vahi.org/porchfest',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'breakaway-atlanta',
    'Breakaway Music Festival Atlanta',
    'https://www.breakawayfestival.com/festival/atlanta-2025',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- GAMING/NERD CONVENTION SOURCES
-- ============================================

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'dragoncon',
    'DragonCon',
    'https://www.dragoncon.org',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'momocon',
    'MomoCon',
    'https://www.momocon.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'anime-weekend-atlanta',
    'Anime Weekend Atlanta',
    'https://awa-con.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'dreamhack-atlanta',
    'DreamHack Atlanta',
    'https://dreamhack.com/atlanta',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'southern-fried-gaming-expo',
    'Southern Fried Gaming Expo',
    'https://gameatl.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- FILM FESTIVAL SOURCES
-- ============================================

-- Note: Atlanta Film Festival already exists in migration 006

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-underground-film-festival',
    'Atlanta Underground Film Festival',
    'https://auff.org',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-shortsfest',
    'Atlanta Shortsfest',
    'https://atlantashortsfest.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-horror-film-festival',
    'Atlanta Horror Film Festival',
    'https://atlantafilmseries.com/atl-horror-film-festival',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atl-doc',
    'ATL DOC - Atlanta Documentary Film Festival',
    'https://atlantafilmseries.com/atl-documentary-film-fest',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'bronzelens',
    'BronzeLens Film Festival',
    'https://bronzelens.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'buried-alive-film-festival',
    'Buried Alive Film Festival',
    'https://buriedalivefilmfest.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-spotlight-film-festival',
    'Atlanta Spotlight Film Festival',
    'https://atlantafilmseries.com/atl-spotlight-film-fest',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- FESTIVAL VENUES
-- ============================================

-- Piedmont Park (music festivals)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'piedmont-park',
    'Piedmont Park',
    '1320 Monroe Drive NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30306',
    'park',
    'https://piedmontpark.org'
)
ON CONFLICT (slug) DO NOTHING;

-- Westside Park (420 Fest 2026)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'westside-park',
    'Westside Park at Bellwood Quarry',
    '1660 Johnson Rd NW',
    'Westside',
    'Atlanta',
    'GA',
    '30318',
    'park',
    NULL
)
ON CONFLICT (slug) DO NOTHING;

-- Georgia World Congress Center (conventions)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'gwcc',
    'Georgia World Congress Center',
    '285 Andrew Young International Blvd NW',
    'Downtown',
    'Atlanta',
    'GA',
    '30313',
    'convention_center',
    'https://www.gwcca.org'
)
ON CONFLICT (slug) DO NOTHING;

-- Cobb Galleria (SFGE)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'cobb-galleria',
    'Cobb Galleria Centre',
    '2 Galleria Pkwy SE',
    'Cumberland',
    'Smyrna',
    'GA',
    '30339',
    'convention_center',
    'https://www.cobbgalleria.com'
)
ON CONFLICT (slug) DO NOTHING;

-- Limelight Theater (film festivals)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'limelight-theater',
    'Limelight Theater',
    '349 Decatur St SE',
    'Downtown',
    'Atlanta',
    'GA',
    '30312',
    'theater',
    NULL
)
ON CONFLICT (slug) DO NOTHING;

-- Virginia-Highland (Porchfest area)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'virginia-highland',
    'Virginia-Highland Neighborhood',
    'Virginia Ave NE & N Highland Ave NE',
    'Virginia-Highland',
    'Atlanta',
    'GA',
    '30306',
    'neighborhood',
    'https://www.vahi.org'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- FESTIVAL PRODUCERS (Organizations)
-- ============================================

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'shaky-knees',
    'Shaky Knees Festival',
    'https://www.shakykneesfestival.com',
    'Annual rock music festival in Atlanta featuring 60+ bands across multiple stages at Piedmont Park.',
    'festival'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'sweetwater-brewing',
    'SweetWater Brewing Company',
    'https://sweetwaterbrew.com',
    'Atlanta-based craft brewery that produces the annual SweetWater 420 Fest music festival.',
    'festival'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'atlanta-jazz-festival',
    'Atlanta Jazz Festival',
    'https://atljazzfest.com',
    'Free annual jazz festival held Memorial Day weekend at Piedmont Park, one of the largest free jazz festivals in the country.',
    'festival'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'one-musicfest',
    'ONE Musicfest',
    'https://onemusicfest.com',
    'Annual multi-genre music festival celebrating hip-hop, R&B, soul, and more at Piedmont Park.',
    'festival'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'dragoncon',
    'Dragon Con',
    'https://www.dragoncon.org',
    'One of the largest multi-media pop culture conventions in the world, held Labor Day weekend in downtown Atlanta.',
    'convention'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'momocon',
    'MomoCon',
    'https://www.momocon.com',
    'Fan convention celebrating anime, gaming, animation, and comics, held Memorial Day weekend at the Georgia World Congress Center.',
    'convention'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'anime-weekend-atlanta',
    'Anime Weekend Atlanta',
    'https://awa-con.com',
    '24-hour anime convention held annually in Atlanta, featuring panels, concerts, and late-night programming.',
    'convention'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'dreamhack',
    'DreamHack',
    'https://dreamhack.com',
    'International gaming lifestyle festival featuring esports, LAN parties, and gaming culture.',
    'convention'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'southern-fried-gaming-expo',
    'Southern-Fried Gaming Expo',
    'https://gameatl.com',
    'Retro gaming convention featuring 400+ arcade and pinball machines, console gaming, and tabletop games.',
    'convention'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'atlanta-film-series',
    'Atlanta Film Series',
    'https://atlantafilmseries.com',
    'Organization producing multiple Atlanta film festivals including Underground, Horror, Documentary, and Shortsfest.',
    'festival'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'bronzelens',
    'BronzeLens Film Festival',
    'https://bronzelens.com',
    'Film festival dedicated to showcasing films by and about people of color.',
    'festival'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO event_producers (slug, name, website, description, producer_type)
VALUES (
    'buried-alive-film-fest',
    'Buried Alive Film Festival',
    'https://buriedalivefilmfest.com',
    'Horror and genre film festival presented by the Atlanta Horror Society at the Plaza Theatre.',
    'festival'
)
ON CONFLICT (slug) DO NOTHING;
