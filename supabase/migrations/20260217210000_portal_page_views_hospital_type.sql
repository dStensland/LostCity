-- Allow hospital-specific page view classification.
ALTER TABLE portal_page_views
  DROP CONSTRAINT IF EXISTS portal_page_views_page_type_check;

ALTER TABLE portal_page_views
  ADD CONSTRAINT portal_page_views_page_type_check
  CHECK (page_type IN ('feed', 'find', 'event', 'spot', 'series', 'community', 'hospital'));
