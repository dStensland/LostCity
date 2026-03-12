UPDATE sources
SET
  url = 'https://www.atlantamarket.com/Attend/Market-Dates-and-Hours',
  is_active = true,
  updated_at = now()
WHERE slug = 'americasmart';
