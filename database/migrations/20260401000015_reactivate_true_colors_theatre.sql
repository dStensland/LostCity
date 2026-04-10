-- Reactivate True Colors Theatre (source id=152)
-- Site is live at truecolorstheatre.org, currently showing Cinderella (Jun 9 – Jul 5, 2026)
-- Crawler verified working: extracts title, dates, og:image correctly
-- Image extraction updated to use og:image as primary source (more reliable than CSS selectors)
UPDATE sources
SET is_active = true
WHERE slug = 'true-colors-theatre';
