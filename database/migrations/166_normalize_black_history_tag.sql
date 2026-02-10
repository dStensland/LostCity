-- Normalize 'black-history' tag to 'black-history-month' across all events
-- This fixes an inconsistency where some code used the shorter form

UPDATE events
SET tags = array_replace(tags, 'black-history', 'black-history-month')
WHERE 'black-history' = ANY(tags);
