-- Fix venue city attribution drift for out-of-scope venues.
-- Database-side parity copy of Supabase migration 20260315120000.

BEGIN;

UPDATE sources
SET owner_portal_id = NULL
WHERE id = 753;

UPDATE events
SET portal_id = NULL
WHERE source_id = 753;

UPDATE venues SET city = 'Grand Rapids' WHERE id = 136;
UPDATE venues SET city = 'Gainesville' WHERE id = 725;
UPDATE venues SET city = 'Tallapoosa' WHERE id = 968;
UPDATE venues SET city = 'Del Mar' WHERE id = 2167;
UPDATE venues SET city = 'Portland' WHERE id = 2169;
UPDATE venues SET city = 'Blue Ridge' WHERE id = 2174;
UPDATE venues SET city = 'Blue Ridge' WHERE id = 2176;
UPDATE venues SET city = 'Macon' WHERE id = 2182;
UPDATE venues SET city = 'Dahlonega' WHERE id = 2193;
UPDATE venues SET city = 'La Crosse' WHERE id = 2208;
UPDATE venues SET city = 'San Diego' WHERE id = 2223;
UPDATE venues SET city = 'Houston' WHERE id = 2224;
UPDATE venues SET city = 'Daytona Beach' WHERE id = 2228;
UPDATE venues SET city = 'Indianapolis' WHERE id = 2229;
UPDATE venues SET city = 'Birmingham' WHERE id = 2230;
UPDATE venues SET city = 'Philadelphia' WHERE id = 2234;
UPDATE venues SET city = 'Denver' WHERE id = 2235;
UPDATE venues SET city = 'Salt Lake City' WHERE id = 2236;
UPDATE venues SET city = 'Nashville' WHERE id = 2273;
UPDATE venues SET city = 'Waycross' WHERE id = 2338;
UPDATE venues SET city = 'Knoxville' WHERE id = 2340;
UPDATE venues SET city = 'Sedalia' WHERE id = 2342;
UPDATE venues SET city = 'West Liberty' WHERE id = 2343;
UPDATE venues SET city = 'Joplin' WHERE id = 2344;
UPDATE venues SET city = 'Gurdon' WHERE id = 4061;

UPDATE venues SET city = 'Toccoa' WHERE id = 5397;
UPDATE venues SET city = 'Suches' WHERE id = 5410;
UPDATE venues SET city = 'Hiawassee' WHERE id = 5411;
UPDATE venues SET city = 'Hiawassee' WHERE id = 5413;
UPDATE venues SET city = 'Cleveland' WHERE id = 5422;
UPDATE venues SET city = 'Jasper' WHERE id = 5433;
UPDATE venues SET city = 'Blairsville' WHERE id = 5437;
UPDATE venues SET city = 'Hiawassee' WHERE id = 5441;
UPDATE venues SET city = 'Dawsonville' WHERE id = 5444;
UPDATE venues SET city = 'Hiawassee' WHERE id = 5446;
UPDATE venues SET city = 'Suches' WHERE id = 5448;
UPDATE venues SET city = 'Clayton' WHERE id = 5451;
UPDATE venues SET city = 'Twin City' WHERE id = 5452;
UPDATE venues SET city = 'Suches' WHERE id = 5454;
UPDATE venues SET city = 'Blairsville' WHERE id = 5457;
UPDATE venues SET city = 'Jackson' WHERE id = 5462;
UPDATE venues SET city = 'Jackson' WHERE id = 5463;
UPDATE venues SET city = 'Forsyth' WHERE id = 5464;
UPDATE venues SET city = 'Hiawassee' WHERE id = 5466;
UPDATE venues SET city = 'Dawsonville' WHERE id = 5470;
UPDATE venues SET city = 'Suches' WHERE id = 6065;
UPDATE venues SET city = 'Hiawassee' WHERE id = 6067;

UPDATE venues SET city = 'Dawsonville' WHERE id = 5549;
UPDATE venues SET city = 'Ellijay' WHERE id = 5550;
UPDATE venues SET city = 'Suches' WHERE id = 5551;
UPDATE venues SET city = 'Suches' WHERE id = 5552;
UPDATE venues SET city = 'Suches' WHERE id = 5553;
UPDATE venues SET city = 'Suches' WHERE id = 5554;
UPDATE venues SET city = 'LaFayette' WHERE id = 5555;
UPDATE venues SET city = 'Tallulah Falls' WHERE id = 5558;
UPDATE venues SET city = 'Blue Ridge' WHERE id = 5570;
UPDATE venues SET city = 'Blue Ridge' WHERE id = 5571;
UPDATE venues SET city = 'Blue Ridge' WHERE id = 5572;
UPDATE venues SET city = 'Dahlonega' WHERE id = 5580;
UPDATE venues SET city = 'Chatsworth' WHERE id = 5581;
UPDATE venues SET city = 'Chatsworth' WHERE id = 5584;
UPDATE venues SET city = 'Chatsworth' WHERE id = 5585;
UPDATE venues SET city = 'Dahlonega' WHERE id = 5587;
UPDATE venues SET city = 'Dahlonega' WHERE id = 5588;
UPDATE venues SET city = 'Dahlonega' WHERE id = 5589;

UPDATE venues SET city = 'St. Marys' WHERE id = 5573;
UPDATE venues SET city = 'Folkston' WHERE id = 5574;
UPDATE venues SET city = 'Blakely' WHERE id = 5575;
UPDATE venues SET city = 'Brunswick' WHERE id = 5582;
UPDATE venues SET city = 'Zebulon' WHERE id = 5583;

UPDATE venues SET city = 'Chattanooga' WHERE id = 5423;
UPDATE venues SET city = 'Franklin' WHERE id = 5427;
UPDATE venues SET city = 'Townsend' WHERE id = 5443;
UPDATE venues SET city = 'Townsend' WHERE id = 5447;
UPDATE venues SET city = 'Bryson City' WHERE id = 5449;
UPDATE venues SET city = 'Townsend' WHERE id = 5467;
UPDATE venues SET city = 'Townsend' WHERE id = 5468;
UPDATE venues SET city = 'Franklin' WHERE id = 5469;
UPDATE venues SET city = 'Cashiers' WHERE id = 5465;
UPDATE venues SET city = 'Scaly Mountain' WHERE id = 5412;
UPDATE venues SET city = 'Walhalla' WHERE id = 5458;
UPDATE venues SET city = 'Greer' WHERE id = 5455;
UPDATE venues SET city = 'Gruetli-Laager' WHERE id = 6066;

UPDATE venues SET city = 'Bowness-on-Solway' WHERE id = 5456;
UPDATE venues SET city = 'Concrete' WHERE id = 5471;
UPDATE venues SET city = 'Silverton' WHERE id = 5472;
UPDATE venues SET city = 'Marrakech' WHERE id = 5473;
UPDATE venues SET city = 'Yerevan' WHERE id = 5474;
UPDATE venues SET city = 'Lincoln' WHERE id = 5475;
UPDATE venues SET city = 'Te Anau' WHERE id = 5476;
UPDATE venues SET city = 'Tanabe' WHERE id = 5477;
UPDATE venues SET city = 'Arusha' WHERE id = 5461;

UPDATE venues
SET description = NULL
WHERE id = 2182
  AND description LIKE '%termostati digitali%';

COMMIT;
