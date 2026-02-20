# Zero-Event Source Triage - Atlanta Wave 2 (Refined, 2026-02-19)

Input: source_data_goals_audit_atlanta_2026-02-19_post_nonzero_remediation.json
Zero-event failing sources: 37

## Split
- Seasonal expected: 26
- Likely broken/deactivated: 11

## Seasonal expected
- atlanta-beltline: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=9, error_runs=1
- atlanta-comedy-theater: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=9, error_runs=1
- atlanta-liberation-center: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=9, error_runs=1
- atlanta-tech-week: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=10, error_runs=0
- baps-mandir: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=10, error_runs=0
- big-brothers-big-sisters-atl: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=10, error_runs=0
- centennial-yards: reason=no_break_signals_currently, nonzero_runs=1, error_runs=0
- cheshire-bridge-district: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=10, error_runs=0
- dancing-dogs-yoga: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=9, error_runs=1
- decatur-book-festival: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=8, error_runs=2
- east-lake-neighborhood: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=8, error_runs=2
- eater-atlanta-openings: reason=historically_outside_window_and_crawler_healthy, nonzero_runs=7, error_runs=0
- ebenezer-church: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=10, error_runs=0
- everybody-wins-atlanta: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=8, error_runs=2
- fulton-county-meetings: reason=no_break_signals_currently, nonzero_runs=4, error_runs=0
- georgia-chess: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=9, error_runs=0
- halfway-crooks: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=8, error_runs=0
- johnnys-hideaway: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=7, error_runs=2
- little-shop-of-stories: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=9, error_runs=1
- mason-fine-art: reason=no_break_signals_currently, nonzero_runs=2, error_runs=1
- sandy-springs-pac: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=8, error_runs=1
- song: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=9, error_runs=1
- stage-door-players: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=9, error_runs=1
- sun-dial-restaurant: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=10, error_runs=0
- three-taverns: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=10, error_runs=0
- wewatchstuff: reason=crawler_healthy_no_upcoming_schedule, nonzero_runs=9, error_runs=1

## Ranked reactivation queue
1. home-depot-backyard (score=155, nonzero_runs=10, error_runs=0, last_year_window=23)
   signals: regressed_vs_last_year_window(23)
2. steady-hand-beer (score=95, nonzero_runs=9, error_runs=1, last_year_window=11)
   signals: regressed_vs_last_year_window(11)
3. silverspot-cinema-atlanta (score=35, nonzero_runs=0, error_runs=6, last_year_window=0)
   signals: no_recent_nonzero_crawls, high_recent_error_rate
4. clark-atlanta (score=20, nonzero_runs=0, error_runs=4, last_year_window=0)
   signals: no_recent_nonzero_crawls
5. community-foundation-atl (score=20, nonzero_runs=0, error_runs=2, last_year_window=0)
   signals: no_recent_nonzero_crawls
6. georgia-peace (score=20, nonzero_runs=0, error_runs=1, last_year_window=0)
   signals: no_recent_nonzero_crawls
7. l5p-community-center (score=20, nonzero_runs=0, error_runs=2, last_year_window=0)
   signals: no_recent_nonzero_crawls
8. moca-ga (score=20, nonzero_runs=0, error_runs=1, last_year_window=0)
   signals: no_recent_nonzero_crawls
9. monday-night-garage (score=20, nonzero_runs=0, error_runs=1, last_year_window=0)
   signals: no_recent_nonzero_crawls
10. theatrical-outfit (score=20, nonzero_runs=0, error_runs=2, last_year_window=0)
   signals: no_recent_nonzero_crawls
11. buried-alive (score=17, nonzero_runs=5, error_runs=5, last_year_window=0)
   signals: high_recent_error_rate
