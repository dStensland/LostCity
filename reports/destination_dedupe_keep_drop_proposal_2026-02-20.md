# Destination Dedupe Keep/Drop Proposal (No Writes)

- Generated: 2026-02-20
- Source: `/Users/coach/Projects/LostCity/reports/destination_same_address_similar_name_destinations_only_2026-02-20.md`
- Pairs analyzed: 22
- Decision policy: keep higher event count, then higher completeness, then lower id
- This is a proposal only; no merge/delete executed.

## Summary

- High confidence: 15
- Medium confidence: 2
- Low confidence: 5

## Proposed Pairs (Review Order: low -> high)

- Confidence: **low** | (blank), (blank) | 40 powers ferry rd, marietta, ga 30067, usa
  Keep: [2114] Studio Movie Grill Atlanta (`studio-movie-grill-atlanta`) | events=0 completeness=4
  Drop: [2136] Studio Movie Grill (`studio-movie-grill`) | events=0 completeness=4
  Why: tie-break on stable lower id

- Confidence: **low** | atlanta, ga | 1315 peachtree st ne, atlanta, ga 30309, usa
  Keep: [219] Museum of Design Atlanta (`moda-atlanta`) | events=0 completeness=8
  Drop: [726] Moda (Museum Of Design Atlanta) (`moda-museum-of-design-atlanta`) | events=0 completeness=8
  Why: tie-break on stable lower id

- Confidence: **low** | nashville, tn | 1200 forrest park dr, nashville, tn 37205, usa
  Keep: [1497] Cheekwood Botanical Gardens (`cheekwood-botanical-gardens`) | events=0 completeness=7
  Drop: [1535] Cheekwood Botanical Gardens & Estate (`cheekwood-botanical-gardens-estate`) | events=0 completeness=6
  Why: completeness 7>6
  Flags: different venue_type

- Confidence: **low** | nashville, tn | 2019 8th ave s, nashville, tn 37204, usa
  Keep: [1491] The Lab at Zanies Nashville (`the-lab-at-zanies-nashville`) | events=0 completeness=10
  Drop: [1513] The Lab at Zanies (`the-lab-at-zanies`) | events=0 completeness=10
  Why: tie-break on stable lower id

- Confidence: **low** | nashville, tn | 2500 west end ave, nashville, tn 37203, usa
  Keep: [1496] The Parthenon (`the-parthenon`) | events=0 completeness=6
  Drop: [1662] Parthenon (`parthenon`) | events=0 completeness=6
  Why: tie-break on stable lower id

- Confidence: **medium** | atlanta, ga | 659 peachtree st ne, atlanta, ga 30308, usa
  Keep: [835] The Georgian Terrace Hotel (`georgian-terrace-hotel`) | events=0 completeness=7
  Drop: [783] The Georgian Terrace (`georgian-terrace`) | events=0 completeness=6
  Why: completeness 7>6

- Confidence: **medium** | atlanta, ga | 866 w peachtree st nw, atlanta, ga 30308, usa
  Keep: [180] Renaissance Atlanta Midtown Hotel (`renaissance-atlanta-midtown-hotel`) | events=1 completeness=5
  Drop: [2192] Renaissance Midtown Hotel (`renaissance-midtown-hotel`) | events=1 completeness=4
  Why: completeness 5>4

- Confidence: **high** | (blank), (blank) | 2900 peachtree rd #310, atlanta, ga 30305, usa
  Keep: [2060] Barnes & Noble (`barnes-noble`) | events=2 completeness=8
  Drop: [2055] Barnes & Noble The Grove (`barnes-noble-the-grove`) | events=0 completeness=8
  Why: events 2>0

- Confidence: **high** | atlanta, ga | 120 perimeter center w , atlanta, ga 30346, usa
  Keep: [3367] Barnes & Noble (`barnes-noble-k4e_l4`) | events=1 completeness=7
  Drop: [283] Barnes & Noble - Perimeter (`barnes-noble-perimeter`) | events=0 completeness=8
  Why: events 1>0; completeness 7>8
  Flags: different venue_type

- Confidence: **high** | atlanta, ga | 1280 peachtree st ne, atlanta, ga 30309, usa
  Keep: [111] Symphony Hall (`symphony-hall`) | events=77 completeness=9
  Drop: [113] Atlanta Symphony Hall (`atlanta-symphony-hall`) | events=2 completeness=9
  Why: events 77>2

- Confidence: **high** | atlanta, ga | 1315 peachtree st ne, atlanta, ga 30309, usa
  Keep: [1105] Museum of Design Atlanta (MODA) (`moda`) | events=32 completeness=7
  Drop: [726] Moda (Museum Of Design Atlanta) (`moda-museum-of-design-atlanta`) | events=0 completeness=8
  Why: events 32>0; completeness 7>8

- Confidence: **high** | atlanta, ga | 1315 peachtree st ne, atlanta, ga 30309, usa
  Keep: [1105] Museum of Design Atlanta (MODA) (`moda`) | events=32 completeness=7
  Drop: [219] Museum of Design Atlanta (`moda-atlanta`) | events=0 completeness=8
  Why: events 32>0; completeness 7>8

- Confidence: **high** | atlanta, ga | 200 interstate n pkwy e se, atlanta, ga 30339, usa
  Keep: [171] Atlanta Marriott Northwest at Galleria (`atlanta-marriott-northwest-at-galleria`) | events=220 completeness=6
  Drop: [2565] Atlanta Marriott Northwest (`atlanta-marriott-northwest`) | events=1 completeness=5
  Why: events 220>1; completeness 6>5

- Confidence: **high** | atlanta, ga | 210 peachtree st nw, atlanta, ga 30303, usa
  Keep: [786] The Westin Peachtree Plaza (`westin-peachtree-plaza`) | events=0 completeness=6
  Drop: [3258] The Westin Peachtree Plaza, Atlanta (`the-westin-peachtree-plaza-atlanta`) | events=0 completeness=4
  Why: completeness 6>4

- Confidence: **high** | atlanta, ga | 265 peachtree center ave ne, atlanta, ga 30303, usa
  Keep: [2276] Hanover Marriott Hotel (`hanover-marriott-hotel`) | events=1 completeness=4
  Drop: [32] Marriott Hotel (`marriott-hotel`) | events=0 completeness=5
  Why: events 1>0; completeness 4>5

- Confidence: **high** | atlanta, ga | 550 somerset terrace ne #101, atlanta, ga 30306, usa
  Keep: [925] New Realm Brewing (`new-realm-brewing`) | events=7 completeness=8
  Drop: [1340] New Realm Brewing Co. (`new-realm-brewing-co`) | events=1 completeness=7
  Why: events 7>1; completeness 8>7

- Confidence: **high** | atlanta, ga | 572 stokeswood ave se
  Keep: [348] East Atlanta Village Farmers Market (`east-atlanta-village-farmers-market`) | events=22 completeness=5
  Drop: [3849] CFM East Atlanta Village Farmers Market (`cfm-east-atlanta-village-farmers-market`) | events=0 completeness=6
  Why: events 22>0; completeness 5>6

- Confidence: **high** | atlanta, ga | 777 memorial dr se, atlanta, ga 30316, usa
  Keep: [46] The Eastern (`the-eastern`) | events=39 completeness=10
  Drop: [131] The Eastern-GA (`the-eastern-ga`) | events=20 completeness=10
  Why: events 39>20

- Confidence: **high** | nashville, tn | 1200 clinton st #110, nashville, tn 37203, usa
  Keep: [1573] Corsair Distillery & Taproom (`corsair-distillery--taproom`) | events=1 completeness=9
  Drop: [1642] Corsair Distillery (`corsair-distillery`) | events=0 completeness=8
  Why: events 1>0; completeness 9>8

- Confidence: **high** | nashville, tn | 1245 glenwood ave se, atlanta, ga 30316, usa
  Keep: [1403] The Basement (`the-basement`) | events=41 completeness=6
  Drop: [1893] The Basement-TN (`the-basement-tn`) | events=0 completeness=3
  Why: events 41>0; completeness 6>3

- Confidence: **high** | nashville, tn | 222 rep. john lewis way s, nashville, tn 37203, usa
  Keep: [1658] Country Music Hall of Fame (`country-music-hall-of-fame`) | events=0 completeness=7
  Drop: [1534] Country Music Hall of Fame and Museum (`country-music-hall-of-fame-and-museum`) | events=0 completeness=5
  Why: completeness 7>5

- Confidence: **high** | nashville, tn | 800 44th ave n, nashville, tn 37209, usa
  Keep: [2306] Fat Bottom Brewing Co. (`fat-bottom-brewing-co`) | events=2 completeness=8
  Drop: [1637] Fat Bottom Brewing (`fat-bottom-brewing`) | events=0 completeness=11
  Why: events 2>0; completeness 8>11

