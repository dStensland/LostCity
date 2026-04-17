-- ============================================================
-- MIGRATION: Deactivate dead exhibition sources + mark destination-only
-- ============================================================
-- Recon confirmed these venues have no crawlable content:
--   - get-this-gallery: domain parked
--   - atlanta-center-photography: domain for sale
--   - besharat-contemporary: WordPress dormant since 2015
--   - mint-gallery: Webflow "Coming Soon"
--   - one-contemporary: Shopify store, no exhibitions page
--   - zucot-gallery: Squarespace event page stale since 2019, no current content
--   - hathaway-contemporary: domain DNS failure (NXDOMAIN)
--
-- Destination-only venues (permanent installations, no events):
--   - atlanta-monetary-museum: permanent Fed exhibits
--   - trap-music-museum: permanent installation
--
-- Also deactivate sources with confirmed dead sites:
--   - mason-fine-art: Wix 404
--   - goat-farm: DNS failure

-- Deactivate sources with dead websites
UPDATE sources SET is_active = false
WHERE slug IN (
  'get-this-gallery',
  'atlanta-center-photography',
  'besharat-contemporary',
  'mint-gallery',
  'one-contemporary',
  'zucot-gallery',
  'hathaway-contemporary',
  'mason-fine-art',
  'goat-farm'
);

-- Mark destination-only sources as inactive (venues stay active as destinations)
UPDATE sources SET is_active = false
WHERE slug IN (
  'atlanta-monetary-museum',
  'trap-music-museum'
);

-- Note: venues table does not have health_tag/health_note columns.
-- Destination-only venues remain active as destinations but their sources
-- are deactivated above to prevent crawl attempts.
