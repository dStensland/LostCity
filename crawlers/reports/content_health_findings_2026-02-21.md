# Content Health Findings - 2026-02-21

Overall launch gate: **FAIL**
Checks: PASS 5 | WARN 3 | FAIL 3

## Launch Gate
| Status | Check | Value | Threshold | Context |
| --- | --- | --- | --- | --- |
| WARN | Visible cross-source duplicate groups | 5 | warn_gt=0, fail_gt=5 | - |
| FAIL | Visible same-source duplicate groups | 41 | warn_gt=0, fail_gt=25 | - |
| FAIL | Visible events on registry-closed venues | 8 | warn_gt=0, fail_gt=0 | - |
| FAIL | Visible events on inactive venues | 160 | warn_gt=25, fail_gt=100 | - |
| PASS | 24h crawl error rate % | 7.5 | warn_gt=8.0, fail_gt=15.0 | - |
| WARN | Future events with genres % | 43.7 | warn_lt=50.0, fail_lt=40.0 | - |
| PASS | Active specials total | 554 | warn_lt=300, fail_lt=200 | - |
| WARN | Plaza Theatre time coverage % | 84.2 | warn_lt=85.0, fail_lt=70.0 | 16/19 with time |
| PASS | Tara Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 34/34 with time |
| PASS | Landmark Midtown Art Cinema time coverage % | 94.2 | warn_lt=90.0, fail_lt=80.0 | 49/52 with time |
| PASS | Starlight Drive-In Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 35/35 with time |

## Regression
- Baseline date: **2026-02-20**
| Metric | Previous | Current | Delta |
| --- | --- | --- | --- |
| Active specials | 337 | 554 | +217.0 |
| Visible future events | 19481 | 19300 | -181.0 |
| Plaza Theatre time coverage % | 80.8 | 84.2 | +3.4 |
| 24h crawl error rate % | 10.0 | 7.5 | -2.5 |
| Visible same-source duplicate groups | 43 | 41 | -2.0 |
| Closed venue leakage (inactive) | 158 | 160 | +2.0 |
| Visible cross-source duplicate groups | 4 | 5 | +1.0 |
| Landmark Midtown Art Cinema time coverage % | 95.0 | 94.2 | -0.8 |
| Future genre coverage % | 43.8 | 43.7 | -0.1 |
| Closed venue leakage (registry) | 8 | 8 | +0.0 |
| Venues with walkable neighbors | 1273 | 1273 | +0.0 |
| Tara Theatre time coverage % | 100.0 | 100.0 | +0.0 |
| Starlight Drive-In Theatre time coverage % | 100.0 | 100.0 | +0.0 |

## Critical Findings
- FAIL: Visible same-source duplicate groups (value=41)
- FAIL: Visible events on registry-closed venues (value=8)
- FAIL: Visible events on inactive venues (value=160)
- WARN: Visible cross-source duplicate groups (value=5)
- WARN: Future events with genres % (value=43.7)
- WARN: Plaza Theatre time coverage % (value=84.2)

## Duplicate Drilldown (Visible)
| Date | Venue | Rows | Sources | Source Slugs | Normalized Title |
| --- | --- | --- | --- | --- | --- |
| 2026-02-21 | New Realm Brewing | 2 | 2 | eventbrite, new-realm-brewing | mardi gras party |
| 2026-02-21 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | naked mole rat gets dressed the rock experience |
| 2026-03-02 | 0 | 2 | 2 | atlanta-preservation-center, eventbrite | paid speaker shift  from free talks to paid keyn |
| 2026-05-16 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | great ant sleepover |
| 2026-05-30 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | basura |
| 2026-02-21 | Laughing Skull Lounge | 3 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-28 | Laughing Skull Lounge | 3 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-21 | Painting With a Twist - Kennesaw | 2 | 1 | painting-with-a-twist | blacklight a luminous view add a candle |
| 2026-02-21 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-02-21 | This event’s address is private. Sign up for more details | 2 | 1 | mobilize-api | knock doors with gyjc in smyrna |
| 2026-02-22 | Painting With a Twist - McDonough | 2 | 1 | painting-with-a-twist | galactic turtles |
| 2026-02-22 | This event’s address is private. Sign up for more details | 2 | 1 | mobilize-api | knock doors with gyjc in smyrna |

## Crawl Error Sources (24h)
| Source | Errors | Source ID |
| --- | --- | --- |
| atlanta-city-events | 4 | 781 |
| lifeline-animal-project | 4 | 791 |
| hdsa-georgia | 4 | 972 |
| peach-state-roller-derby | 3 | 567 |
| ticketmaster | 3 | 11 |

## Time Quality
- Visible future events: timed=18026, all_day=671, date_only=603
| Category | Date-only Events |
| --- | --- |
| community | 246 |
| music | 188 |
| sports | 40 |
| film | 19 |
| learning | 17 |
| fitness | 17 |
| food_drink | 14 |
| nightlife | 10 |
| art | 10 |
| words | 9 |

## Initiative Coverage by Neighborhood
### Specials
| Neighborhood | Active Specials |
| --- | --- |
| Midtown | 83 |
| Virginia-Highland | 36 |
| Buckhead | 36 |
| Old Fourth Ward | 35 |
| Unknown | 31 |
| Downtown | 29 |
| Sandy Springs | 25 |
| Inman Park | 16 |
| Poncey-Highland | 14 |
| SoBro | 13 |

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

