-- Cobb County Parks & Recreation HQ is a system-level fallback venue, not a
-- family destination. Keep it out of destination-first Family audits.

update venues
set
  venue_type = 'organization',
  spot_type = 'organization'
where slug = 'cobb-county-parks-recreation';
