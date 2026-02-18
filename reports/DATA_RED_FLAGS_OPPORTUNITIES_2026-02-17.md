# Data Red Flags and Opportunities
Generated: 2026-02-17 18:40:42
Database target: production

## Executive Snapshot
- Total events: 19,512
- Future events (start_date >= 2026-02-17): 19,475
- Past events: 37
- Total venues: 4,050
- Total sources: 994

## Red Flags
1. Unassigned future events (portal_id NULL): 4,031 (20.7%)
2. Duplicate future event slots (title+venue+date+time): 27 groups
3. Invalid categories: 28 events
4. Null category: 0 events
5. Future events missing description: 998 (5.1%)
6. Future events missing image: 8,958 (46.0%)
7. Future events missing start_time: 1,272 (6.5%)
8. Future events missing venue_id: 237
9. Future events missing source_id: 0
10. Venue highlight duplicate groups: 170 (across 120 venues)
11. Future events with synthetic descriptions: 284

## Highest-Risk Sources (>=40 future events, low metadata quality)
- Georgia World Congress Center (gwcc): events=57, quality=0.17, desc_cov=31.6%, img_cov=5.3%, time_cov=5.3%
- Pulmonary Fibrosis Foundation (pulmonary-fibrosis-foundation): events=52, quality=0.32, desc_cov=46.2%, img_cov=0.0%, time_cov=53.8%
- Cancer Support Community Atlanta (cancer-support-community-atlanta): events=41, quality=0.57, desc_cov=100.0%, img_cov=0.0%, time_cov=61.0%
- Piedmont Healthcare (piedmont-healthcare): events=66, quality=0.61, desc_cov=93.9%, img_cov=10.6%, time_cov=72.7%
- Emory Healthcare Community Events (emory-healthcare-community): events=131, quality=0.61, desc_cov=90.8%, img_cov=0.0%, time_cov=100.0%
- Callanwolde Fine Arts Center (callanwolde-fine-arts-center): events=1096, quality=0.64, desc_cov=97.4%, img_cov=0.4%, time_cov=100.0%
- Narcotics Anonymous - Georgia (na-georgia): events=849, quality=0.65, desc_cov=100.0%, img_cov=0.0%, time_cov=100.0%
- Ridgeview Institute (ridgeview-institute): events=115, quality=0.65, desc_cov=100.0%, img_cov=0.0%, time_cov=100.0%
- GriefShare Atlanta (griefshare-atlanta): events=90, quality=0.65, desc_cov=100.0%, img_cov=0.0%, time_cov=100.0%
- Cook's Warehouse (cooks-warehouse): events=61, quality=0.65, desc_cov=100.0%, img_cov=0.0%, time_cov=100.0%
- MedShare (medshare): events=49, quality=0.65, desc_cov=100.0%, img_cov=0.0%, time_cov=100.0%
- DBSA Atlanta (dbsa-atlanta): events=48, quality=0.65, desc_cov=100.0%, img_cov=0.0%, time_cov=100.0%
- Atlanta Community Food Bank (atlanta-community-food-bank): events=44, quality=0.65, desc_cov=100.0%, img_cov=0.0%, time_cov=100.0%
- Northside Hospital Community Events (northside-hospital-community): events=40, quality=0.65, desc_cov=100.0%, img_cov=0.0%, time_cov=100.0%
- Alcoholics Anonymous - Atlanta (aa-atlanta): events=4169, quality=0.65, desc_cov=100.0%, img_cov=0.1%, time_cov=100.0%
- Meetup (meetup): events=78, quality=0.71, desc_cov=69.2%, img_cov=57.7%, time_cov=100.0%
- Tabernacle (tabernacle): events=47, quality=0.74, desc_cov=100.0%, img_cov=72.3%, time_cov=19.1%
- Marcus Jewish Community Center of Atlanta (mjcca): events=393, quality=0.76, desc_cov=100.0%, img_cov=31.0%, time_cov=100.0%
- Plaza Theatre (plaza-theatre): events=69, quality=0.78, desc_cov=88.4%, img_cov=72.5%, time_cov=65.2%
- Shepherd Center (shepherd-center): events=240, quality=0.79, desc_cov=100.0%, img_cov=42.9%, time_cov=92.9%

## Duplicate Highlight Hotspots
- Oakland Cemetery (oakland-cemetery): 4 duplicate highlight groups
- High Museum of Art (high-museum-of-art): 3 duplicate highlight groups
- Atlanta History Center (atlanta-history-center): 3 duplicate highlight groups
- The Earl (the-earl): 3 duplicate highlight groups
- Piedmont Park (piedmont-park): 3 duplicate highlight groups
- Atlanta Botanical Garden (atlanta-botanical-garden): 3 duplicate highlight groups
- Historic Fourth Ward Park (historic-fourth-ward-park): 3 duplicate highlight groups
- Ponce City Market (ponce-city-market): 3 duplicate highlight groups
- Krog Street Market (krog-street-market): 3 duplicate highlight groups
- Georgia Aquarium (georgia-aquarium): 3 duplicate highlight groups
- Michael C. Carlos Museum (michael-c-carlos-museum): 2 duplicate highlight groups
- MOCA GA (moca-ga): 2 duplicate highlight groups
- Hammonds House Museum (hammonds-house-museum): 2 duplicate highlight groups
- Margaret Mitchell House (margaret-mitchell-house): 2 duplicate highlight groups
- Eddie's Attic (eddies-attic): 2 duplicate highlight groups
- Plaza Theatre (plaza-theatre): 2 duplicate highlight groups
- Callanwolde Fine Arts Center (callanwolde-fine-arts-center): 2 duplicate highlight groups
- Centennial Olympic Park (centennial-olympic-park): 2 duplicate highlight groups
- Grant Park (grant-park): 2 duplicate highlight groups
- New Realm Brewing (new-realm-brewing): 2 duplicate highlight groups

## Top Venue Enrichment Opportunities (high event volume + missing metadata)
- Callanwolde Fine Arts Center (callanwolde-fine-arts-center): 1098 future events, missing=short_description
- MJCCA (mjcca): 394 future events, missing=short_description, neighborhood
- 8111 Club (aa-11th-83881): 248 future events, missing=short_description, image_url
- Shepherd Center (shepherd-center): 240 future events, missing=short_description, image_url
- The Springs Cinema & Taphouse (springs-cinema): 240 future events, missing=short_description
- Atlanta Marriott Northwest at Galleria (atlanta-marriott-northwest-at-galleria): 220 future events, missing=short_description, neighborhood
- Triangle Club (aa-tri-83915): 204 future events, missing=short_description, image_url
- The Masquerade (the-masquerade-test): 203 future events, missing=short_description
- H.O.W. Place (aa-it-83945): 192 future events, missing=short_description, image_url
- NA Meeting Location (na-atlanta-95-renaissance-pkwy-): 188 future events, missing=short_description, image_url, hours_or_site
- Painting With a Twist - Edgewood (painting-with-a-twist-edgewood): 179 future events, missing=short_description, image_url
- N.A.B.A. Club (aa-young-83909): 176 future events, missing=short_description, image_url
- Online / Virtual Event (online-virtual): 172 future events, missing=short_description, image_url, neighborhood, geo, hours_or_site
- Bridgestone Arena (bridgestone-arena): 166 future events, missing=short_description
- 3rd and Lindsley (3rd-and-lindsley): 148 future events, missing=short_description
- Emory University (emory-university): 147 future events, missing=short_description
- 3rd & Lindsley (third-and-lindsley): 143 future events, missing=short_description
- Gwinnett Room (aa-lets-83924): 128 future events, missing=short_description, image_url
- Ridgeview Institute (aa-finding-84572): 127 future events, missing=short_description, image_url
- Roswell Cultural Arts Center (roswell-cultural-arts-center): 126 future events, missing=short_description
- Atlanta City Hall (atlanta-city-hall): 125 future events, missing=short_description
- The Basement East (the-basement-east): 122 future events, missing=short_description
- Highland Club (na-forest-park-4035-jonesboro-rd.-s): 116 future events, missing=short_description, image_url, hours_or_site
- This event’s address is private. Sign up for more details (this-event-s-address-is-private-sign-up-for-more-d): 106 future events, missing=short_description, image_url, neighborhood, geo, hours_or_site
- Serenity House - Buford (aa-more-83893): 104 future events, missing=short_description, image_url
- Tara Club (aa-a-83996): 100 future events, missing=short_description, image_url
- Northeast Georgia Medical Center (northeast-georgia-medical-center): 100 future events, missing=short_description, image_url
- Schermerhorn Symphony Center (schermerhorn-symphony-center): 98 future events, missing=short_description, image_url
- Painting With a Twist - McDonough (painting-with-a-twist-mcdonough): 95 future events, missing=short_description, image_url
- 365 Center Inc (na-decatur-1472-richard-road): 94 future events, missing=short_description, image_url, hours_or_site

## Category Distribution (future events, top 20)
- support_group: 5,490
- community: 3,076
- music: 2,535
- learning: 1,849
- sports: 1,194
- art: 835
- family: 774
- film: 584
- nightlife: 542
- words: 437
- theater: 403
- fitness: 380
- outdoors: 343
- wellness: 236
- food_drink: 219
- comedy: 214
- gaming: 210
- other: 77
- meetup: 43
- museums: 28

## Opportunity Plays
1. Fix top 10 low-quality sources first; expected immediate gain in card quality and search trust.
2. Run daily dedupe checks for slot collisions on major aggregators and cinemas.
3. Backfill venue metadata for high-traffic venues (short_description, image, neighborhood, geo).
4. Keep highlight dedupe in API plus add DB-side uniqueness guardrails for venue_highlights.
5. Prioritize portal assignment cleanup for unassigned future events to reduce discovery leakage.
