-- Fix signature venue coordinates (currently 1.85km north of actual hotel)
-- Correct location: 800 Rankin St NE, Atlanta, GA 30308
UPDATE venues SET lat = 33.76870, lng = -84.36380
WHERE slug IN ('il-premio', 'bar-premio', 'elektra-forth', 'moonlight-forth');

-- Deactivate duplicate hotel record (375 Ralph McGill is wrong address)
UPDATE venues SET active = false
WHERE slug = 'the-forth' AND id = 823;
