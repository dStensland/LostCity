# Content Health Findings - 2026-02-22

Overall launch gate: **FAIL**
Checks: PASS 5 | WARN 2 | FAIL 4

## Launch Gate
| Status | Check | Value | Threshold | Context |
| --- | --- | --- | --- | --- |
| WARN | Visible cross-source duplicate groups | 3 | warn_gt=0, fail_gt=5 | - |
| FAIL | Visible same-source duplicate groups | 38 | warn_gt=0, fail_gt=25 | - |
| FAIL | Visible events on registry-closed venues | 7 | warn_gt=0, fail_gt=0 | - |
| FAIL | Visible events on inactive venues | 301 | warn_gt=25, fail_gt=100 | - |
| PASS | 24h crawl error rate % | 5.3 | warn_gt=8.0, fail_gt=15.0 | - |
| WARN | Future events with genres % | 43.9 | warn_lt=50.0, fail_lt=40.0 | - |
| PASS | Active specials total | 560 | warn_lt=300, fail_lt=200 | - |
| FAIL | Plaza Theatre time coverage % | 62.5 | warn_lt=85.0, fail_lt=70.0 | 10/16 with time |
| PASS | Tara Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 28/28 with time |
| PASS | Landmark Midtown Art Cinema time coverage % | 94.4 | warn_lt=90.0, fail_lt=80.0 | 51/54 with time |
| PASS | Starlight Drive-In Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 35/35 with time |

## Regression
- Baseline date: **2026-02-21**
| Metric | Previous | Current | Delta |
| --- | --- | --- | --- |
| Visible future events | 19300 | 18811 | -489.0 |
| Closed venue leakage (inactive) | 160 | 301 | +141.0 |
| Plaza Theatre time coverage % | 84.2 | 62.5 | -21.7 |
| Active specials | 554 | 560 | +6.0 |
| Visible same-source duplicate groups | 41 | 38 | -3.0 |
| 24h crawl error rate % | 7.5 | 5.3 | -2.2 |
| Visible cross-source duplicate groups | 5 | 3 | -2.0 |
| Closed venue leakage (registry) | 8 | 7 | -1.0 |
| Future genre coverage % | 43.7 | 43.9 | +0.2 |
| Landmark Midtown Art Cinema time coverage % | 94.2 | 94.4 | +0.2 |
| Venues with walkable neighbors | 1273 | 1273 | +0.0 |
| Tara Theatre time coverage % | 100.0 | 100.0 | +0.0 |
| Starlight Drive-In Theatre time coverage % | 100.0 | 100.0 | +0.0 |

## Critical Findings
- FAIL: Visible same-source duplicate groups (value=38)
- FAIL: Visible events on registry-closed venues (value=7)
- FAIL: Visible events on inactive venues (value=301)
- FAIL: Plaza Theatre time coverage % (value=62.5)
- WARN: Visible cross-source duplicate groups (value=3)
- WARN: Future events with genres % (value=43.9)

## Duplicate Drilldown (Visible)
| Date | Venue | Rows | Sources | Source Slugs | Normalized Title |
| --- | --- | --- | --- | --- | --- |
| 2026-03-02 | 0 | 2 | 2 | atlanta-preservation-center, eventbrite | paid speaker shift  from free talks to paid keyn |
| 2026-05-16 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | great ant sleepover |
| 2026-05-30 | Alliance Theatre | 2 | 2 | alliance-theatre, theatre-for-young-audiences | basura |
| 2026-02-28 | Laughing Skull Lounge | 3 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-22 | Painting With a Twist - McDonough | 2 | 1 | painting-with-a-twist | galactic turtles |
| 2026-02-22 | This event’s address is private. Sign up for more details | 2 | 1 | mobilize-api | knock doors with gyjc in smyrna |
| 2026-02-27 | Laughing Skull Lounge | 2 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-28 | Painting With a Twist - Lawrenceville | 2 | 1 | painting-with-a-twist | saturday soirée date night galactic love tree |
| 2026-02-28 | Painting With a Twist - Kennesaw | 2 | 1 | painting-with-a-twist | sip  strokes saturday sassy in blue |
| 2026-03-03 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-03-05 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-03-06 | Laughing Skull Lounge | 2 | 1 | laughing-skull | best of atlanta comedy showcase |

## Crawl Error Sources (24h)
| Source | Errors | Source ID |
| --- | --- | --- |
| atlanta-city-events | 2 | 781 |
| lifeline-animal-project | 2 | 791 |
| atlanta-dogwood | 2 | 128 |
| hdsa-georgia | 2 | 972 |
| moca-ga | 2 | 158 |

## Time Quality
- Visible future events: timed=17560, all_day=648, date_only=603
| Category | Date-only Events |
| --- | --- |
| community | 259 |
| music | 182 |
| sports | 38 |
| film | 19 |
| fitness | 18 |
| learning | 17 |
| food_drink | 13 |
| art | 10 |
| nightlife | 9 |
| theater | 8 |

## Initiative Coverage by Neighborhood
### Specials
| Neighborhood | Active Specials |
| --- | --- |
| Midtown | 83 |
| Virginia-Highland | 36 |
| Buckhead | 36 |
| Old Fourth Ward | 35 |
| Downtown | 29 |
| Sandy Springs | 25 |
| Unknown | 19 |
| Inman Park | 16 |
| Poncey-Highland | 14 |
| West Midtown | 14 |

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
| Downtown | 31 |
| Midtown | 30 |
| Unknown | 23 |
| West End | 9 |
| Decatur | 8 |
| Buckhead | 8 |
| Druid Hills | 8 |
| Grant Park | 8 |
| Downtown Nashville | 8 |
| Poncey-Highland | 7 |

