-- MIGRATION: Clean up misrouted exhibition records
--
-- Three crawlers were incorrectly routing timed events to the exhibitions table
-- based on keyword matching (e.g. "Exhibition Tour", "Sensory Morning" descriptions
-- mentioning "exhibit"). These are single-occurrence programs, not exhibitions.
--
-- High Museum: 21 misrouted records from events page (keep 4 real from /exhibition/)
-- Fernbank: 18 misrouted records (all timed programs, not exhibitions)
-- Roswell365: 13 misrouted records (aggregator events, not exhibitions)
--
-- Crawler code has been fixed to prevent re-ingestion.

-- High Museum: delete exhibitions NOT sourced from the exhibitions page
-- Keep records where source_url contains '/exhibition/' (real exhibitions)
DELETE FROM exhibitions
WHERE source_id = 7
  AND (source_url NOT LIKE '%/exhibition/%' OR source_url IS NULL);

-- Fernbank: all exhibition records are misrouted timed programs
DELETE FROM exhibitions
WHERE source_id = 104;

-- Roswell365: all exhibition records are misrouted aggregator events
DELETE FROM exhibitions
WHERE source_id = 1067;
