-- Categorize venues that are currently null or 'other'

-- Restaurants
UPDATE venues SET spot_type = 'restaurant' WHERE id IN (
  687, -- Antico Pizza Napoletana
  694, -- Aria
  695, -- Atlas
  683, -- Avize
  690, -- Bacchanalia
  676, -- BoccaLupo
  675, -- Busy Bee Cafe
  707, -- Communidad Taqueria
  691, -- Daily Chew
  678, -- Delbar
  692, -- Desta Ethiopian Kitchen
  671, -- Gunshow
  699, -- Heirloom Market BBQ
  686, -- Highland Tap
  672, -- La Semilla
  684, -- Lazy Betty
  669, -- Little Bear
  685, -- Miller Union
  688, -- Mujo
  709, -- Necessary Purveyor
  673, -- Poor Hendrix
  674, -- Staplehouse
  668, -- Talat Market
  670, -- Tassili's Raw Reality Cafe
  696, -- The Chastain
  677, -- Ticonderoga Club
  680, -- Tio Lucho's
  689  -- Twisted Soul Cookhouse & Pours
);

-- Bars
UPDATE venues SET spot_type = 'bar' WHERE id IN (
  711, -- Bar Avize
  758, -- Burle's Bar
  712, -- Elise
  727, -- Enzo Steakhouse & Bar
  731, -- Iconz Sports Bar & Lounge
  714, -- Ideal Sportsbar
  722, -- Industry Tavern
  721, -- Irby's Tavern
  718, -- Pour Taproom Midtown
  705, -- Redacted Basement Drink Parlor
  706, -- Sammy's After Hours
  737, -- Sauce Buckhead
  715, -- The Beverly
  733, -- The Fabled
  741, -- The Upton
  720  -- Whitehall Tavern
);

-- Sports Bars (subtype of bar but worth distinguishing)
UPDATE venues SET spot_type = 'sports_bar' WHERE id IN (
  731, -- Iconz Sports Bar & Lounge
  714  -- Ideal Sportsbar
);

-- Breweries
UPDATE venues SET spot_type = 'brewery' WHERE id IN (
  732, -- Monday Night Garage
  716  -- Skol Brewing Company
);

-- Bookstores
UPDATE venues SET spot_type = 'bookstore' WHERE id IN (
  693, -- Lucian Books and Wine
  738, -- Offbeat Books
  739  -- Two Best Friends Cafe & Books
);

-- Theaters
UPDATE venues SET spot_type = 'theater' WHERE id IN (
  725, -- John S. Burd Center For The Performing Arts
  750  -- Marietta Theatre Company
);

-- Museums/Galleries
UPDATE venues SET spot_type = 'museum' WHERE id IN (
  726  -- Moda (Museum Of Design Atlanta)
);

UPDATE venues SET spot_type = 'gallery' WHERE id IN (
  751  -- Lyndon House Arts Center
);

-- Parks
UPDATE venues SET spot_type = 'park' WHERE id IN (
  708, -- Madeira Park
  717  -- Painted Park
);

-- Fitness Centers
UPDATE venues SET spot_type = 'fitness_center' WHERE id IN (
  743  -- The Fitness Collective ATL
);

-- Community Centers / Nonprofits
UPDATE venues SET spot_type = 'community_center' WHERE id IN (
  752, -- Impact Community Food Pantry
  756, -- Latin American Association
  753, -- Milford Baptist Church C3 Ministries Inc.
  755, -- Overcomers House Incorporated
  757  -- Sickle Cell Foundation of Georgia, Inc.
);

-- Event Spaces
UPDATE venues SET spot_type = 'event_space' WHERE id IN (
  747, -- Laura Spelman Hall
  724, -- Robert W. Woodruff Library
  735, -- Science Square Labs
  740, -- Teller Productions
  734  -- Private Residence
);

-- Libraries
UPDATE venues SET spot_type = 'library' WHERE id IN (
  724  -- Robert W. Woodruff Library, Auc
);

-- Coworking / Office
UPDATE venues SET spot_type = 'coworking' WHERE id IN (
  736  -- The Clair Firm LLC
);

-- Banks / Generic locations - mark as venue (generic)
UPDATE venues SET spot_type = 'venue' WHERE id IN (
  27,  -- Cadence Bank
  742, -- 1401 Peachtree St NE ste a200
  745, -- 555 Whitehall St SW
  53,  -- Atlanta
  65,  -- Gates Circle Southeast
  754, -- City of Atlanta- Department Of Public Works
  651, -- Various Locations
  681  -- Southern Belle (appears to be a venue)
);
