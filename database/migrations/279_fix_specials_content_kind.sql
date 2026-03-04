-- Fix content_kind='special' misuse: events from bar sources that are
-- actually regular events (trivia, karaoke, live music) should be 'event',
-- not 'special'. Real specials (happy hour pricing, daily deals) belong
-- in the venue_specials table, not as events.

UPDATE events
SET content_kind = 'event'
WHERE content_kind = 'special'
  AND id IN (
    SELECT e.id
    FROM events e
    JOIN sources s ON e.source_id = s.id
    WHERE e.content_kind = 'special'
      AND s.slug IN (
        'battle-and-brew',
        'our-bar-atl',
        'bold-monk-brewing',
        'scofflaw-brewing',
        'sweetwater',
        'wrecking-bar'
      )
  );
