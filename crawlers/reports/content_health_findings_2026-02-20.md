# Content Health Findings - 2026-02-20

Overall launch gate: **FAIL**
Checks: PASS 4 | WARN 4 | FAIL 3

## Launch Gate
| Status | Check | Value | Threshold | Context |
| --- | --- | --- | --- | --- |
| WARN | Visible cross-source duplicate groups | 4 | warn_gt=0, fail_gt=5 | - |
| FAIL | Visible same-source duplicate groups | 43 | warn_gt=0, fail_gt=25 | - |
| FAIL | Visible events on registry-closed venues | 8 | warn_gt=0, fail_gt=0 | - |
| FAIL | Visible events on inactive venues | 158 | warn_gt=25, fail_gt=100 | - |
| WARN | 24h crawl error rate % | 10.0 | warn_gt=8.0, fail_gt=15.0 | - |
| WARN | Future events with genres % | 43.8 | warn_lt=50.0, fail_lt=40.0 | - |
| PASS | Active specials total | 337 | warn_lt=300, fail_lt=200 | - |
| WARN | Plaza Theatre time coverage % | 80.8 | warn_lt=85.0, fail_lt=70.0 | 21/26 with time |
| PASS | Tara Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 27/27 with time |
| PASS | Landmark Midtown Art Cinema time coverage % | 95.0 | warn_lt=90.0, fail_lt=80.0 | 57/60 with time |
| PASS | Starlight Drive-In Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 35/35 with time |

## Regression
- Baseline date: **2026-02-19**
| Metric | Previous | Current | Delta |
| --- | --- | --- | --- |
| Visible future events | 19634 | 19481 | -153.0 |
| Plaza Theatre time coverage % | 58.3 | 80.8 | +22.5 |
| Visible same-source duplicate groups | 53 | 43 | -10.0 |
| Visible cross-source duplicate groups | 1 | 4 | +3.0 |
| Closed venue leakage (inactive) | 155 | 158 | +3.0 |
| Closed venue leakage (registry) | 9 | 8 | -1.0 |
| Venues with walkable neighbors | 1274 | 1273 | -1.0 |
| 24h crawl error rate % | 10.5 | 10.0 | -0.5 |
| Future genre coverage % | 43.9 | 43.8 | -0.1 |
| Landmark Midtown Art Cinema time coverage % | 95.1 | 95.0 | -0.1 |
| Active specials | 337 | 337 | +0.0 |
| Tara Theatre time coverage % | 100.0 | 100.0 | +0.0 |
| Starlight Drive-In Theatre time coverage % | 100.0 | 100.0 | +0.0 |

## Critical Findings
- FAIL: Visible same-source duplicate groups (value=43)
- FAIL: Visible events on registry-closed venues (value=8)
- FAIL: Visible events on inactive venues (value=158)
- WARN: Visible cross-source duplicate groups (value=4)
- WARN: 24h crawl error rate % (value=10.0)
- WARN: Future events with genres % (value=43.8)
- WARN: Plaza Theatre time coverage % (value=80.8)

## Duplicate Drilldown (Visible)
| Date | Venue | Rows | Sources | Source Slugs | Normalized Title |
| --- | --- | --- | --- | --- | --- |
| 2026-02-21 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | naked mole rat gets dressed the rock experience |
| 2026-03-02 | 0 | 2 | 2 | atlanta-preservation-center, eventbrite | paid speaker shift  from free talks to paid keyn |
| 2026-05-16 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | great ant sleepover |
| 2026-05-30 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | basura |
| 2026-02-21 | Laughing Skull Lounge | 3 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-28 | Laughing Skull Lounge | 3 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-20 | Laughing Skull Lounge | 2 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-20 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-02-21 | Painting With a Twist - Kennesaw | 2 | 1 | painting-with-a-twist | blacklight a luminous view add a candle |
| 2026-02-21 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-02-21 | This event’s address is private. Sign up for more details | 2 | 1 | mobilize-api | knock doors with gyjc in smyrna |
| 2026-02-22 | Painting With a Twist - McDonough | 2 | 1 | painting-with-a-twist | galactic turtles |

## Crawl Error Sources (24h)
| Source | Errors | Source ID |
| --- | --- | --- |
| atlanta-city-events | 2 | 781 |
| lifeline-animal-project | 2 | 791 |
| piedmont-womens-heart | 2 | 247 |
| piedmont-athens | 2 | 250 |
| morningside-civic | 2 | 425 |

## Time Quality
- Visible future events: timed=18299, all_day=596, date_only=586
| Category | Date-only Events |
| --- | --- |
| community | 231 |
| music | 192 |
| sports | 34 |
| film | 20 |
| fitness | 19 |
| food_drink | 16 |
| learning | 14 |
| nightlife | 13 |
| wellness | 8 |
| art | 8 |

## Initiative Coverage by Neighborhood
### Specials
| Neighborhood | Active Specials |
| --- | --- |
| Midtown | 54 |
| Virginia-Highland | 34 |
| Old Fourth Ward | 33 |
| Buckhead | 22 |
| Downtown | 18 |
| Unknown | 17 |
| Inman Park | 12 |
| SoBro | 11 |
| Poncey-Highland | 9 |
| Dunwoody | 9 |

### Walkability
| Neighborhood | Venues w/ Walkable Neighbors |
| --- | --- |
| Midtown | 136 |
| Downtown | 131 |
| Buckhead | 85 |
| Unknown | 49 |
| Old Fourth Ward | 42 |
| Decatur | 40 |
| Inman Park | 37 |
| Downtown Nashville | 37 |
| East Atlanta Village | 32 |
| Poncey-Highland | 28 |

### Historic
| Neighborhood | Venues w/ History Signal |
| --- | --- |
| Unknown | 35 |
| Midtown | 30 |
| Downtown | 27 |
| West End | 9 |
| Decatur | 8 |
| Buckhead | 8 |
| Druid Hills | 8 |
| Grant Park | 8 |
| Poncey-Highland | 7 |
| Sweet Auburn | 7 |

