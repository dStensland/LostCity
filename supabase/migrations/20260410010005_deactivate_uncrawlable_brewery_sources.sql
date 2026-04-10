-- Deactivate brewery sources with no crawlable event calendar.
-- Scofflaw: /events is a private-hire inquiry page
-- Bold Monk: /events returns 404
-- Three Taverns: calendar is archived 2015 data
-- Pontoon: events are Facebook-only embed
-- Reformation stays active — fixable (The Events Calendar plugin)

UPDATE sources SET is_active = false
WHERE slug IN ('scofflaw-brewing', 'bold-monk-brewing', 'three-taverns', 'pontoon-brewing')
  AND is_active = true;
