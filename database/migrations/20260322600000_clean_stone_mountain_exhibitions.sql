-- MIGRATION: Clean Stone Mountain Park fake exhibitions
--
-- Stone Mountain Park (venue_id=992) generated 207 exhibition records titled
-- "Historic Square: A Collection Of Georgia Homes and Antiques" with different
-- dates but NULL closing_date. This is a permanent attraction, not an exhibition.
-- These records represent 45% of all exhibitions and pollute the exhibition corpus.
--
-- The Stone Mountain crawler (stone_mountain_park.py) does NOT use the exhibition
-- lane — it only produces events + destinations. These records were likely created
-- by an earlier crawler version or bulk import.
--
-- Action: Delete all exhibitions for venue_id=992.

DELETE FROM exhibitions WHERE venue_id = 992;
