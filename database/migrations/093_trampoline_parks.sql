-- Add trampoline park sources
-- Migration: 093_trampoline_parks.sql
-- Description: Add Defy, Urban Air, and Sky Zone trampoline parks

INSERT INTO sources (slug, name, url, is_active, source_type, category, crawl_frequency_hours)
VALUES
  (
    'defy-atlanta',
    'Defy Atlanta',
    'https://www.defyatlanta.com',
    true,
    'venue',
    'entertainment',
    168  -- Weekly crawl
  ),
  (
    'urban-air-atlanta',
    'Urban Air Adventure Parks - Atlanta',
    'https://www.urbanairtrampolinepark.com',
    true,
    'venue',
    'entertainment',
    168  -- Weekly crawl
  ),
  (
    'sky-zone-atlanta',
    'Sky Zone Trampoline Parks - Atlanta',
    'https://www.skyzone.com',
    true,
    'venue',
    'entertainment',
    168  -- Weekly crawl
  )
ON CONFLICT (slug) DO NOTHING;
