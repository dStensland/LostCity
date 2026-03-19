-- Activate Candler Park Fall Fest now that the source also enriches the
-- year-round Candler Park destination and pool amenity for Family.

update sources
set
  is_active = true,
  owner_portal_id = (select id from portals where slug = 'atlanta'),
  integration_method = 'playwright',
  url = 'https://www.candlerparkfest.org'
where slug = 'candler-park-fest';
