# Content Health Findings - 2026-02-18

Overall launch gate: **FAIL**
Checks: PASS 3 | WARN 4 | FAIL 4

## Launch Gate
| Status | Check | Value | Threshold | Context |
| --- | --- | --- | --- | --- |
| FAIL | Visible cross-source duplicate groups | 7 | warn_gt=0, fail_gt=5 | - |
| FAIL | Visible same-source duplicate groups | 108 | warn_gt=0, fail_gt=25 | - |
| FAIL | Visible events on registry-closed venues | 9 | warn_gt=0, fail_gt=0 | - |
| FAIL | Visible events on inactive venues | 141 | warn_gt=25, fail_gt=100 | - |
| WARN | 24h crawl error rate % | 14.0 | warn_gt=8.0, fail_gt=15.0 | - |
| WARN | Future events with genres % | 47.2 | warn_lt=50.0, fail_lt=40.0 | - |
| PASS | Active specials total | 337 | warn_lt=300, fail_lt=200 | - |
| WARN | Plaza Theatre time coverage % | 75.0 | warn_lt=85.0, fail_lt=70.0 | 45/60 with time |
| PASS | Tara Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 61/61 with time |
| WARN | Landmark Midtown Art Cinema time coverage % | 81.2 | warn_lt=90.0, fail_lt=80.0 | 13/16 with time |
| PASS | Starlight Drive-In Theatre time coverage % | 100.0 | warn_lt=90.0, fail_lt=80.0 | 24/24 with time |

## Regression
- Baseline date: **2026-02-17**
| Metric | Previous | Current | Delta |
| --- | --- | --- | --- |
| Visible future events | 18409 | 17781 | -628.0 |
| Visible same-source duplicate groups | 131 | 108 | -23.0 |
| Closed venue leakage (inactive) | 164 | 141 | -23.0 |
| Plaza Theatre time coverage % | 78.8 | 75.0 | -3.8 |
| Future genre coverage % | 46.9 | 47.2 | +0.3 |
| Visible cross-source duplicate groups | 7 | 7 | +0.0 |
| Closed venue leakage (registry) | 9 | 9 | +0.0 |
| Active specials | 337 | 337 | +0.0 |
| Venues with walkable neighbors | 1274 | 1274 | +0.0 |
| Tara Theatre time coverage % | 100.0 | 100.0 | +0.0 |

## Critical Findings
- FAIL: Visible cross-source duplicate groups (value=7)
- FAIL: Visible same-source duplicate groups (value=108)
- FAIL: Visible events on registry-closed venues (value=9)
- FAIL: Visible events on inactive venues (value=141)
- WARN: 24h crawl error rate % (value=14.0)
- WARN: Future events with genres % (value=47.2)
- WARN: Plaza Theatre time coverage % (value=75.0)
- WARN: Landmark Midtown Art Cinema time coverage % (value=81.2)

## Duplicate Drilldown (Visible)
| Date | Venue | Rows | Sources | Source Slugs | Normalized Title |
| --- | --- | --- | --- | --- | --- |
| 2026-02-18 | Boggs Social & Supply | 2 | 2 | atlanta-recurring-social, boggs-social | karaoke night w music mike |
| 2026-02-25 | Boggs Social & Supply | 2 | 2 | atlanta-recurring-social, boggs-social | karaoke night w music mike |
| 2026-03-02 | 0 | 2 | 2 | atlanta-preservation-center, eventbrite | paid speaker shift  from free talks to paid keyn |
| 2026-03-04 | Boggs Social & Supply | 2 | 2 | atlanta-recurring-social, boggs-social | karaoke night w music mike |
| 2026-03-11 | Boggs Social & Supply | 2 | 2 | atlanta-recurring-social, boggs-social | karaoke night w music mike |
| 2026-03-18 | Boggs Social & Supply | 2 | 2 | atlanta-recurring-social, boggs-social | karaoke night w music mike |
| 2026-03-20 | Tabernacle | 2 | 2 | tabernacle, ticketmaster | dvsn  sept 5th  10 year anniversary shows |
| 2026-02-18 | The Springs Cinema & Taphouse | 9 | 1 | springs-cinema | wuthering heights |
| 2026-02-19 | The Springs Cinema & Taphouse | 9 | 1 | springs-cinema | wuthering heights |
| 2026-02-18 | The Springs Cinema & Taphouse | 8 | 1 | springs-cinema | goat |
| 2026-02-20 | The Springs Cinema & Taphouse | 8 | 1 | springs-cinema | goat |
| 2026-02-20 | The Springs Cinema & Taphouse | 8 | 1 | springs-cinema | wuthering heights |

## Crawl Error Sources (24h)
| Source | Errors | Source ID |
| --- | --- | --- |
| atlanta-city-events | 6 | 781 |
| lifeline-animal-project | 6 | 791 |
| home-depot-kids-workshops | 3 | 414 |
| piedmont-athens | 3 | 250 |
| morningside-civic | 3 | 425 |

## Time Quality
- Visible future events: timed=16590, all_day=651, date_only=540
| Category | Date-only Events |
| --- | --- |
| music | 196 |
| community | 168 |
| sports | 34 |
| film | 30 |
| fitness | 18 |
| food_drink | 16 |
| learning | 15 |
| nightlife | 13 |
| theater | 12 |
| support_group | 10 |

## Initiative Coverage by Neighborhood
### Specials
| Neighborhood | Active Specials |
| --- | --- |
| Midtown | 67 |
| Old Fourth Ward | 54 |
| Buckhead | 22 |
| Downtown | 22 |
| Unknown | 17 |
| Virginia-Highland | 12 |
| SoBro | 11 |
| Dunwoody | 9 |
| West Midtown | 8 |
| Peachtree City | 7 |

### Walkability
| Neighborhood | Venues w/ Walkable Neighbors |
| --- | --- |
| Downtown | 157 |
| Midtown | 130 |
| Buckhead | 101 |
| Unknown | 72 |
| Old Fourth Ward | 63 |
| West Midtown | 49 |
| Downtown Nashville | 36 |
| West End | 29 |
| East Nashville | 26 |
| Westside | 24 |

### Historic
| Neighborhood | Venues w/ History Signal |
| --- | --- |
| Unknown | 38 |
| Downtown | 33 |
| Midtown | 30 |
| West End | 15 |
| Old Fourth Ward | 13 |
| Buckhead | 11 |
| Druid Hills | 8 |
| Decatur | 6 |
| Little Five Points | 6 |
| Downtown Nashville | 6 |

