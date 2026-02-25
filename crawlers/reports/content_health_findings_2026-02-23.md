# Content Health Findings - 2026-02-23

Overall launch gate: **FAIL**
Checks: PASS 5 | WARN 2 | FAIL 4

## Launch Gate
| Status | Check | Value | Threshold | Context |
| --- | --- | --- | --- | --- |
| WARN | Visible cross-source duplicate groups | 3 | warn_gt=0, fail_gt=5 | - |
| FAIL | Visible same-source duplicate groups | 36 | warn_gt=0, fail_gt=25 | - |
| FAIL | Visible events on registry-closed venues | 7 | warn_gt=0, fail_gt=0 | - |
| FAIL | Visible events on inactive venues | 308 | warn_gt=25, fail_gt=100 | - |
| PASS | 24h crawl error rate % | 7.5 | warn_gt=8.0, fail_gt=15.0 | - |
| WARN | Future events with genres % | 44.1 | warn_lt=50.0, fail_lt=40.0 | - |
| PASS | Active specials total | 850 | warn_lt=300, fail_lt=200 | - |
| FAIL | Plaza Theatre time coverage % | 14.3 | warn_lt=85.0, fail_lt=70.0 | 1/7 with time |
| PASS | Tara Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 22/22 with time |
| PASS | Landmark Midtown Art Cinema time coverage % | 93.3 | warn_lt=90.0, fail_lt=80.0 | 42/45 with time |
| PASS | Starlight Drive-In Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 30/30 with time |

## Regression
- Baseline date: **2026-02-22**
| Metric | Previous | Current | Delta |
| --- | --- | --- | --- |
| Visible future events | 18811 | 18500 | -311.0 |
| Active specials | 560 | 850 | +290.0 |
| Plaza Theatre time coverage % | 62.5 | 14.3 | -48.2 |
| Closed venue leakage (inactive) | 301 | 308 | +7.0 |
| 24h crawl error rate % | 5.3 | 7.5 | +2.2 |
| Visible same-source duplicate groups | 38 | 36 | -2.0 |
| Landmark Midtown Art Cinema time coverage % | 94.4 | 93.3 | -1.1 |
| Future genre coverage % | 43.9 | 44.1 | +0.2 |
| Visible cross-source duplicate groups | 3 | 3 | +0.0 |
| Closed venue leakage (registry) | 7 | 7 | +0.0 |
| Venues with walkable neighbors | 1273 | 1273 | +0.0 |
| Tara Theatre time coverage % | 100.0 | 100.0 | +0.0 |
| Starlight Drive-In Theatre time coverage % | 100.0 | 100.0 | +0.0 |

## Critical Findings
- FAIL: Visible same-source duplicate groups (value=36)
- FAIL: Visible events on registry-closed venues (value=7)
- FAIL: Visible events on inactive venues (value=308)
- FAIL: Plaza Theatre time coverage % (value=14.3)
- WARN: Visible cross-source duplicate groups (value=3)
- WARN: Future events with genres % (value=44.1)

## Duplicate Drilldown (Visible)
| Date | Venue | Rows | Sources | Source Slugs | Normalized Title |
| --- | --- | --- | --- | --- | --- |
| 2026-03-02 | 0 | 2 | 2 | atlanta-preservation-center, eventbrite | paid speaker shift  from free talks to paid keyn |
| 2026-05-16 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | great ant sleepover |
| 2026-05-30 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | basura |
| 2026-02-28 | Laughing Skull Lounge | 3 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-27 | Laughing Skull Lounge | 2 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-28 | Painting With a Twist - Lawrenceville | 2 | 1 | painting-with-a-twist | saturday soirée date night galactic love tree |
| 2026-02-28 | Painting With a Twist - Kennesaw | 2 | 1 | painting-with-a-twist | sip  strokes saturday sassy in blue |
| 2026-03-03 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-03-05 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-03-06 | Laughing Skull Lounge | 2 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-03-06 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-03-07 | Parking lot behind McDonald's | 2 | 1 | mobilize-api | paulding democrats  knocking doors for the speci |

## Crawl Error Sources (24h)
| Source | Errors | Source ID |
| --- | --- | --- |
| atlanta-city-events | 2 | 781 |
| lifeline-animal-project | 2 | 791 |
| peach-state-roller-derby | 2 | 567 |
| hdsa-georgia | 2 | 972 |
| southern-fried-gaming | 2 | 188 |

## Time Quality
- Visible future events: timed=17232, all_day=641, date_only=627
| Category | Date-only Events |
| --- | --- |
| community | 275 |
| music | 178 |
| sports | 38 |
| film | 20 |
| fitness | 18 |
| learning | 17 |
| words | 16 |
| food_drink | 13 |
| nightlife | 9 |
| art | 9 |

## Initiative Coverage by Neighborhood
### Specials
| Neighborhood | Active Specials |
| --- | --- |
| Midtown | 90 |
| Sandy Springs | 62 |
| Old Fourth Ward | 48 |
| Buckhead | 46 |
| Unknown | 46 |
| Downtown | 43 |
| Virginia-Highland | 42 |
| West Midtown | 42 |
| Inman Park | 25 |
| Roswell | 20 |

### Walkability
| Neighborhood | Venues w/ Walkable Neighbors |
| --- | --- |
| Midtown | 136 |
| Downtown | 131 |
| Buckhead | 85 |
| Old Fourth Ward | 42 |
| Unknown | 40 |
| Decatur | 40 |
| Inman Park | 37 |
| Downtown Nashville | 37 |
| East Atlanta Village | 32 |
| Poncey-Highland | 28 |

### Historic
| Neighborhood | Venues w/ History Signal |
| --- | --- |
| Midtown | 46 |
| Downtown | 39 |
| Unknown | 30 |
| Buckhead | 20 |
| Downtown Nashville | 15 |
| Decatur | 13 |
| Druid Hills | 13 |
| West End | 13 |
| Roswell | 13 |
| Virginia-Highland | 12 |

