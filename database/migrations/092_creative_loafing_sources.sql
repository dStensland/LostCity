-- Migration: Add sources discovered from Creative Loafing community calendar
-- These are Atlanta community organizations, nonprofits, and venues that post events

-- =============================================
-- ACTIVISM & COMMUNITY ORGANIZATIONS
-- =============================================

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'new-georgia-project',
    'New Georgia Project',
    'https://newgeorgiaproject.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'project-south',
    'Project South',
    'https://projectsouth.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'song',
    'Southerners on New Ground (SONG)',
    'https://southernersonnewground.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'urban-league-atlanta',
    'Urban League of Greater Atlanta',
    'https://ulgatl.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'hosea-helps',
    'Hosea Helps',
    'https://hoseahelps.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-mission',
    'Atlanta Mission',
    'https://atlantamission.org/get-involved/volunteer',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'c4-atlanta',
    'C4 Atlanta',
    'https://c4atlanta.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'cair-georgia',
    'CAIR Georgia',
    'https://cairgeorgia.com/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'dogwood-alliance',
    'Dogwood Alliance',
    'https://dogwoodalliance.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'georgia-peace',
    'Georgia Peace and Justice Coalition',
    'https://georgiapeace.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'faith-alliance',
    'Faith Alliance of Metro Atlanta',
    'https://faithallianceofmetroatlanta.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'south-river-forest',
    'South River Forest Coalition',
    'https://defendatlantaforest.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-freethought',
    'Atlanta Freethought Society',
    'https://atlantafreethought.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-beltline',
    'Atlanta BeltLine',
    'https://beltline.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'united-way-atlanta',
    'United Way of Greater Atlanta',
    'https://volunteer.unitedwayatlanta.org/calendar',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'meals-on-wheels-atlanta',
    'Meals On Wheels Atlanta',
    'https://mowama.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'big-brothers-big-sisters-atl',
    'Big Brothers Big Sisters of Metro Atlanta',
    'https://bbbsatl.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'everybody-wins-atlanta',
    'Everybody Wins Atlanta',
    'https://everybodywinsatlanta.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'freeside-atlanta',
    'Freeside Atlanta',
    'https://freesideatl.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- ARTS & CULTURE ORGANIZATIONS
-- =============================================

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'wonderroot',
    'WonderRoot',
    'https://wonderroot.org/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'carter-center',
    'The Carter Center',
    'https://cartercenter.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-preservation-center',
    'Atlanta Preservation Center',
    'https://atlantapreservationcenter.com/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'marietta-cobb-museum',
    'Marietta Cobb Museum of Art',
    'https://mariettacobbartmuseum.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'scad-fash',
    'SCAD FASH Museum of Fashion + Film',
    'https://scadfash.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'wrfg-radio',
    'WRFG Radio Free Georgia',
    'https://wrfg.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- FOOD & SUSTAINABILITY
-- =============================================

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'giving-kitchen',
    'Giving Kitchen',
    'https://givingkitchen.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'food-well-alliance',
    'Food Well Alliance',
    'https://foodwellalliance.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'georgia-organics',
    'Georgia Organics',
    'https://georgiaorganics.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- MUSIC & ENTERTAINMENT VENUES
-- =============================================

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'madlife-stage',
    'MadLife Stage & Studios',
    'https://madlifestage.com/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'out-front-theatre',
    'Out Front Theatre Company',
    'https://outfronttheatre.com/shows',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'spivey-hall',
    'Spivey Hall',
    'https://spiveyhall.org/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'perfect-note-atlanta',
    'Perfect Note Atlanta',
    'https://perfectnoteatlanta.com/events',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'schoolhouse-brewing',
    'Schoolhouse Brewing',
    'https://schoolhousebrewing.com/events',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;

-- Summary: 34 new sources added from Creative Loafing community calendar research
