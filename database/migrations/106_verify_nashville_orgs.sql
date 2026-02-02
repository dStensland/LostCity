-- ============================================
-- Verification queries for Nashville Organizations Import
-- Run after applying migration 106
-- ============================================

-- 1. Count total Nashville metro organizations
SELECT COUNT(*) as total_nashville_orgs
FROM event_producers
WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro');

-- 2. Breakdown by city
SELECT city, COUNT(*) as org_count
FROM event_producers
WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro')
GROUP BY city
ORDER BY org_count DESC;

-- 3. Breakdown by organization type
SELECT org_type, COUNT(*) as count
FROM event_producers
WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro')
GROUP BY org_type
ORDER BY count DESC;

-- 4. Organizations by category (unnested)
SELECT unnest(categories) as category, COUNT(*) as org_count
FROM event_producers
WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro')
GROUP BY category
ORDER BY org_count DESC;

-- 5. Music-related organizations (direct or indirect)
SELECT name, org_type, city, neighborhood
FROM event_producers
WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro')
  AND ('music' = ANY(categories) OR org_type LIKE '%music%')
ORDER BY name;

-- 6. Organizations by neighborhood
SELECT neighborhood, COUNT(*) as org_count
FROM event_producers
WHERE city = 'Nashville' AND neighborhood IS NOT NULL
GROUP BY neighborhood
ORDER BY org_count DESC;

-- 7. Organizations with social media (completeness check)
SELECT 
  COUNT(*) as total,
  COUNT(instagram) as has_instagram,
  COUNT(facebook) as has_facebook,
  COUNT(twitter) as has_twitter,
  COUNT(website) as has_website
FROM event_producers
WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro');

-- 8. Sample of organizations for manual review
SELECT id, name, org_type, city, neighborhood, array_length(categories, 1) as category_count
FROM event_producers
WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro')
ORDER BY name
LIMIT 10;

-- 9. Organizations suitable for event crawling (have website)
SELECT name, org_type, website, city
FROM event_producers
WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro')
  AND website IS NOT NULL
  AND website != ''
ORDER BY org_type, name;

-- 10. Full list for review
SELECT 
  id,
  name,
  slug,
  org_type,
  city,
  neighborhood,
  categories,
  LEFT(description, 60) as description_preview
FROM event_producers
WHERE city IN ('Nashville', 'Franklin', 'Murfreesboro')
ORDER BY city, org_type, name;
