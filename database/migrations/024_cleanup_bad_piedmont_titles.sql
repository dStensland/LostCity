-- ============================================
-- MIGRATION 024: Cleanup Bad Piedmont Event Titles
-- ============================================
-- Removes events with UI element titles that were incorrectly scraped

-- Delete events with known bad titles (UI elements picked up by crawler)
DELETE FROM events
WHERE title IN (
    'Click for More Dates',
    '(Class Name A-Z)',
    '(Class Name Z-A)',
    '(Date Ascending)',
    '(Date Descending)',
    '(Location A-Z)',
    '(Location Z-A)',
    '(Price Low-High)',
    '(Price High-Low)',
    'View Details',
    'Register Now',
    'Sign Up',
    'Add to Cart',
    'Add to Waitlist'
);

-- Also delete events where title starts with common UI patterns
DELETE FROM events
WHERE title ~ '^(Click for|View |Show |Hide |Select |Choose |More |See All|Get Started)'
   OR title ~ '^\([A-Za-z]+ [A-Z]-[A-Z]\)$'
   OR title ~ '^Showing \d+ results';

-- Log cleanup
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Cleaned up % bad event titles', deleted_count;
END $$;
