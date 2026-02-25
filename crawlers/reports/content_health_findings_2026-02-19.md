# Content Health Findings - 2026-02-19

Overall launch gate: **FAIL**
Checks: PASS 4 | WARN 3 | FAIL 4

## Launch Gate
| Status | Check | Value | Threshold | Context |
| --- | --- | --- | --- | --- |
| WARN | Visible cross-source duplicate groups | 1 | warn_gt=0, fail_gt=5 | - |
| FAIL | Visible same-source duplicate groups | 53 | warn_gt=0, fail_gt=25 | - |
| FAIL | Visible events on registry-closed venues | 9 | warn_gt=0, fail_gt=0 | - |
| FAIL | Visible events on inactive venues | 155 | warn_gt=25, fail_gt=100 | - |
| WARN | 24h crawl error rate % | 10.5 | warn_gt=8.0, fail_gt=15.0 | - |
| WARN | Future events with genres % | 43.9 | warn_lt=50.0, fail_lt=40.0 | - |
| PASS | Active specials total | 337 | warn_lt=300, fail_lt=200 | - |
| FAIL | Plaza Theatre time coverage % | 58.3 | warn_lt=85.0, fail_lt=70.0 | 7/12 with time |
| PASS | Tara Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 79/79 with time |
| PASS | Landmark Midtown Art Cinema time coverage % | 95.1 | warn_lt=90.0, fail_lt=80.0 | 58/61 with time |
| PASS | Starlight Drive-In Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 35/35 with time |

## Regression
- Baseline date: **2026-02-18**
| Metric | Previous | Current | Delta |
| --- | --- | --- | --- |
| Visible future events | 17781 | 19634 | +1853.0 |
| Visible same-source duplicate groups | 108 | 53 | -55.0 |
| Plaza Theatre time coverage % | 75.0 | 58.3 | -16.7 |
| Closed venue leakage (inactive) | 141 | 155 | +14.0 |
| Landmark Midtown Art Cinema time coverage % | 81.2 | 95.1 | +13.9 |
| Visible cross-source duplicate groups | 7 | 1 | -6.0 |
| 24h crawl error rate % | 14.0 | 10.5 | -3.5 |
| Future genre coverage % | 47.2 | 43.9 | -3.3 |
| Closed venue leakage (registry) | 9 | 9 | +0.0 |
| Active specials | 337 | 337 | +0.0 |
| Venues with walkable neighbors | 1274 | 1274 | +0.0 |
| Tara Theatre time coverage % | 100.0 | 100.0 | +0.0 |
| Starlight Drive-In Theatre time coverage % | 100.0 | 100.0 | +0.0 |

## Critical Findings
- FAIL: Visible same-source duplicate groups (value=53)
- FAIL: Visible events on registry-closed venues (value=9)
- FAIL: Visible events on inactive venues (value=155)
- FAIL: Plaza Theatre time coverage % (value=58.3)
- WARN: Visible cross-source duplicate groups (value=1)
- WARN: 24h crawl error rate % (value=10.5)
- WARN: Future events with genres % (value=43.9)

## Duplicate Drilldown (Visible)
| Date | Venue | Rows | Sources | Source Slugs | Normalized Title |
| --- | --- | --- | --- | --- | --- |
| 2026-03-02 | 0 | 2 | 2 | atlanta-preservation-center, eventbrite | paid speaker shift  from free talks to paid keyn |
| 2026-02-21 | Laughing Skull Lounge | 3 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-28 | Laughing Skull Lounge | 3 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-19 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-02-19 | Tara Theatre | 2 | 1 | tara-theatre | natchez |
| 2026-02-19 | Tara Theatre | 2 | 1 | tara-theatre | no other choice 2026 |
| 2026-02-19 | Tara Theatre | 2 | 1 | tara-theatre | poet 2026 |
| 2026-02-19 | Tara Theatre | 2 | 1 | tara-theatre | scarlet 2026 |
| 2026-02-19 | Tara Theatre | 2 | 1 | tara-theatre | testament of ann lee digital |
| 2026-02-20 | Laughing Skull Lounge | 2 | 1 | laughing-skull | best of atlanta comedy showcase |
| 2026-02-20 | Serenity House - Covington | 2 | 1 | aa-atlanta | covington |
| 2026-02-20 | Tara Theatre | 2 | 1 | tara-theatre | love that remains 2026 |

## Crawl Error Sources (24h)
| Source | Errors | Source ID |
| --- | --- | --- |
| atlanta-ballet | 3 | 24 |
| atlanta-opera | 3 | 25 |
| southern-museum | 2 | 450 |
| silverspot-cinema-atlanta | 2 | 545 |
| ticketmaster | 2 | 11 |

## Time Quality
- Visible future events: timed=18378, all_day=670, date_only=586
| Category | Date-only Events |
| --- | --- |
| community | 211 |
| music | 198 |
| sports | 34 |
| film | 19 |
| fitness | 18 |
| food_drink | 17 |
| learning | 13 |
| theater | 13 |
| nightlife | 13 |
| words | 10 |

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
| Buckhead | 86 |
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
| Midtown | 28 |
| Downtown | 26 |
| Buckhead | 9 |
| West End | 9 |
| Decatur | 8 |
| Druid Hills | 8 |
| Grant Park | 8 |
| Poncey-Highland | 7 |
| Sweet Auburn | 7 |

