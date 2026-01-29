-- Disable Mobilize aggregator sources
-- Moving to discovery-only approach: use Mobilize to find orgs, then source them directly
-- See crawlers/scripts/private/mobilize_discovery.py for discovery script

UPDATE sources
SET is_active = false,
    updated_at = NOW()
WHERE slug LIKE 'mobilize-%';

-- Log the change
DO $$
DECLARE
    disabled_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO disabled_count
    FROM sources
    WHERE slug LIKE 'mobilize-%' AND is_active = false;

    RAISE NOTICE 'Disabled % Mobilize sources', disabled_count;
END $$;
