-- Restrict direct client inserts to portal_page_views.
-- Tracking writes should flow through the API route, which uses service role.

DROP POLICY IF EXISTS portal_page_views_insert ON portal_page_views;
