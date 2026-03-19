-- Flagship cleanup round 3: demote suburban/niche flagships to major.
-- These events are worth including in the horizon but aren't city-defining.

-- Brookhaven Cherry Blossom — suburban neighborhood event
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%brookhaven cherry blossom%';

-- "Celebrating 90 Years: Save the Date!" — Dogwood Festival dupe/teaser
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%celebrating 90 years%';

-- Cobb International Film Festival — small niche film fest
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%cobb international film%';

-- Pigs & Peaches BBQ Festival — Kennesaw neighborhood event
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%pigs%peaches%';

-- Dragon Con Kick-Off — pre-event, not the main convention
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%dragon con kick%';

-- Duluth Fall Festival — suburban
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%duluth fall festival%';

-- Atlanta Fashion Week — niche, few thousand attendees
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%atlanta fashion week%';

-- Wire & Wood Alpharetta Music Festival — suburban
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%wire%wood%alpharetta%';

-- Stone Mountain Highland Games — niche cultural
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%stone mountain highland%';

-- Native American Festival and Pow-Wow — niche cultural
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%native american festival%';

-- Buried Alive Film Festival — niche horror film fest
UPDATE events SET importance = 'major'
WHERE importance = 'flagship' AND title ILIKE '%buried alive%';
