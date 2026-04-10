-- Activate Reformation Brewery (rewritten crawler covers 3 locations via TEC API)
-- Deactivate venues with no crawlable event calendar

-- Reformation: crawler rewritten to hit woodstock/canton/smyrna TEC APIs
UPDATE sources SET is_active = true
WHERE slug = 'reformation-brewery' AND is_active = false;

-- Deactivate sources with no crawlable calendar:
-- Venkman's: TEC calendar empty since Nov 2022, events are Instagram-only
-- Blind Willie's: new Squarespace site with zero calendar content
-- Sound Table: frozen 2017 site, likely permanently closed
UPDATE sources SET is_active = false
WHERE slug IN ('venkmans', 'blind-willies', 'sound-table')
  AND is_active = true;
