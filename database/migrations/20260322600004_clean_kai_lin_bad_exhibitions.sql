-- MIGRATION: Clean up Kai Lin Art exhibition records
--
-- Old crawler had broken year inference: exhibitions from 2016-2025 without
-- explicit years in their dates were parsed as 2026/2027. Also produced 44
-- records with 0 closing dates (43 without, 1 with).
--
-- Rewritten crawler uses structural markers ("EXHIBITION OPENING" / "EXHIBITION
-- RUNS THROUGH") and properly infers years from opening dates. Will repopulate
-- with ~2 clean records (current + recently closed).
--
-- Venue ID 235 = Kai Lin Art, Source ID 236 = kai-lin-art

DELETE FROM exhibitions
WHERE venue_id = 235;
