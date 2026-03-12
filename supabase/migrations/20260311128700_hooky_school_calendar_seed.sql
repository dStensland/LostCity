-- ============================================
-- MIGRATION 323: Hooky School Calendar Seed
-- ============================================
-- Seed data for school_calendar_events table powering the Hooky family portal.
-- Covers the 2025-26 school year for all 4 major metro Atlanta school systems:
--   - APS (Atlanta Public Schools)
--   - DeKalb County School District
--   - Cobb County School District
--   - Gwinnett County Public Schools
--
-- Data sourced from official district calendars (March 2026).
-- Event types: no_school, half_day, break, holiday, early_release
--
-- This data powers the "Heads Up" alerts in the Hooky feed — missing a
-- teacher workday defeats the purpose.

-- ============================================
-- APS — Atlanta Public Schools
-- atlantapublicschools.us
-- First day: Aug 4, 2025 | Last day: May 28, 2026
-- ============================================
INSERT INTO school_calendar_events (id, school_system, event_type, name, start_date, end_date, school_year) VALUES

-- First / Last day
(gen_random_uuid(), 'aps', 'no_school', 'First Day of School',                    '2025-08-04', '2025-08-04', '2025-26'),

-- September
(gen_random_uuid(), 'aps', 'holiday',   'Labor Day',                               '2025-09-01', '2025-09-01', '2025-26'),
(gen_random_uuid(), 'aps', 'early_release', 'Early Release Day',                   '2025-09-22', '2025-09-22', '2025-26'),

-- October
(gen_random_uuid(), 'aps', 'no_school', 'Indigenous Peoples'' Day / Professional Learning', '2025-10-13', '2025-10-14', '2025-26'),
(gen_random_uuid(), 'aps', 'break',     'Fall Break',                              '2025-10-15', '2025-10-17', '2025-26'),

-- November
(gen_random_uuid(), 'aps', 'no_school', 'Election Day / Professional Learning',    '2025-11-04', '2025-11-04', '2025-26'),
(gen_random_uuid(), 'aps', 'break',     'Thanksgiving Break',                      '2025-11-24', '2025-11-28', '2025-26'),

-- December / January
(gen_random_uuid(), 'aps', 'break',     'Winter Break',                            '2025-12-22', '2026-01-02', '2025-26'),
(gen_random_uuid(), 'aps', 'holiday',   'Martin Luther King Jr. Day',              '2026-01-19', '2026-01-19', '2025-26'),

-- February
(gen_random_uuid(), 'aps', 'no_school', 'Presidents'' Day / Independent Learner Days', '2026-02-16', '2026-02-17', '2025-26'),
(gen_random_uuid(), 'aps', 'break',     'Mid-Winter Break',                        '2026-02-18', '2026-02-20', '2025-26'),

-- March
(gen_random_uuid(), 'aps', 'early_release', 'Early Release Day',                   '2026-03-16', '2026-03-16', '2025-26'),

-- April
(gen_random_uuid(), 'aps', 'break',     'Spring Break',                            '2026-04-06', '2026-04-10', '2025-26'),

-- May
(gen_random_uuid(), 'aps', 'holiday',   'Memorial Day',                            '2026-05-25', '2026-05-25', '2025-26'),
(gen_random_uuid(), 'aps', 'no_school', 'Last Day of School',                      '2026-05-28', '2026-05-28', '2025-26'),


-- ============================================
-- DEKALB — DeKalb County School District
-- dekalbschoolsga.org
-- First day: Aug 4, 2025 | Last day: May 28, 2026
-- ============================================

-- First / Last day
(gen_random_uuid(), 'dekalb', 'no_school', 'First Day of School',                  '2025-08-04', '2025-08-04', '2025-26'),

-- September
(gen_random_uuid(), 'dekalb', 'holiday',   'Labor Day',                            '2025-09-01', '2025-09-01', '2025-26'),

-- October
(gen_random_uuid(), 'dekalb', 'no_school', 'Virtual Teachers'' Workday',           '2025-10-13', '2025-10-13', '2025-26'),
(gen_random_uuid(), 'dekalb', 'break',     'Fall Break',                           '2025-10-14', '2025-10-17', '2025-26'),

-- November
(gen_random_uuid(), 'dekalb', 'no_school', 'Independent Learner Day / Professional Development', '2025-11-04', '2025-11-04', '2025-26'),
(gen_random_uuid(), 'dekalb', 'break',     'Thanksgiving Break',                   '2025-11-24', '2025-11-28', '2025-26'),

-- December / January
(gen_random_uuid(), 'dekalb', 'break',     'Winter Break',                         '2025-12-22', '2026-01-02', '2025-26'),
(gen_random_uuid(), 'dekalb', 'holiday',   'Martin Luther King Jr. Day',           '2026-01-19', '2026-01-19', '2025-26'),

-- February
(gen_random_uuid(), 'dekalb', 'no_school', 'Virtual Teachers'' Workday',           '2026-02-16', '2026-02-16', '2025-26'),
(gen_random_uuid(), 'dekalb', 'break',     'Mid-Winter Break',                     '2026-02-17', '2026-02-20', '2025-26'),

-- March
(gen_random_uuid(), 'dekalb', 'no_school', 'Independent Learner Day / Professional Development', '2026-03-13', '2026-03-13', '2025-26'),

-- April
(gen_random_uuid(), 'dekalb', 'break',     'Spring Break',                         '2026-04-06', '2026-04-10', '2025-26'),

-- May
(gen_random_uuid(), 'dekalb', 'holiday',   'Memorial Day',                         '2026-05-25', '2026-05-25', '2025-26'),
(gen_random_uuid(), 'dekalb', 'no_school', 'Last Day of School',                   '2026-05-28', '2026-05-28', '2025-26'),


-- ============================================
-- COBB — Cobb County School District
-- cobbk12.org
-- First day: Aug 4, 2025 | Last day: May 20, 2026
-- ============================================

-- First / Last day
(gen_random_uuid(), 'cobb', 'no_school', 'First Day of School',                    '2025-08-04', '2025-08-04', '2025-26'),

-- August
(gen_random_uuid(), 'cobb', 'no_school', 'Digital Learning Day',                   '2025-08-18', '2025-08-18', '2025-26'),

-- September
(gen_random_uuid(), 'cobb', 'holiday',   'Labor Day',                              '2025-09-01', '2025-09-01', '2025-26'),
(gen_random_uuid(), 'cobb', 'break',     'Fall Break',                             '2025-09-22', '2025-09-26', '2025-26'),

-- October
(gen_random_uuid(), 'cobb', 'no_school', 'Digital Learning Day',                   '2025-10-13', '2025-10-13', '2025-26'),
(gen_random_uuid(), 'cobb', 'early_release', 'Conference Week Early Release (Elem/Middle)', '2025-10-14', '2025-10-17', '2025-26'),

-- November
(gen_random_uuid(), 'cobb', 'no_school', 'Election Day — Student Holiday',         '2025-11-04', '2025-11-04', '2025-26'),
(gen_random_uuid(), 'cobb', 'break',     'Thanksgiving Break',                     '2025-11-24', '2025-11-28', '2025-26'),

-- December
(gen_random_uuid(), 'cobb', 'no_school', 'Digital Learning Day',                   '2025-12-02', '2025-12-02', '2025-26'),
(gen_random_uuid(), 'cobb', 'early_release', 'End-of-Semester Early Release',      '2025-12-18', '2025-12-19', '2025-26'),
(gen_random_uuid(), 'cobb', 'break',     'Winter Break',                           '2025-12-22', '2026-01-05', '2025-26'),

-- January
(gen_random_uuid(), 'cobb', 'holiday',   'Martin Luther King Jr. Day',             '2026-01-19', '2026-01-19', '2025-26'),

-- February
(gen_random_uuid(), 'cobb', 'break',     'Presidents'' Week Break',               '2026-02-16', '2026-02-20', '2025-26'),

-- March
(gen_random_uuid(), 'cobb', 'no_school', 'Digital Learning Day',                   '2026-03-02', '2026-03-02', '2025-26'),

-- April
(gen_random_uuid(), 'cobb', 'break',     'Spring Break',                           '2026-04-06', '2026-04-10', '2025-26'),

-- May
(gen_random_uuid(), 'cobb', 'early_release', 'End-of-Year Early Release / Finals', '2026-05-18', '2026-05-20', '2025-26'),
(gen_random_uuid(), 'cobb', 'holiday',   'Memorial Day',                           '2026-05-25', '2026-05-25', '2025-26'),


-- ============================================
-- GWINNETT — Gwinnett County Public Schools
-- gcpsk12.org
-- First day: Aug 4, 2025 | Last day: May 21, 2026
-- ============================================

-- First / Last day
(gen_random_uuid(), 'gwinnett', 'no_school', 'First Day of School',               '2025-08-04', '2025-08-04', '2025-26'),

-- September
(gen_random_uuid(), 'gwinnett', 'holiday',   'Labor Day',                          '2025-09-01', '2025-09-01', '2025-26'),
(gen_random_uuid(), 'gwinnett', 'no_school', 'Digital Learning Day',               '2025-09-19', '2025-09-19', '2025-26'),

-- October
(gen_random_uuid(), 'gwinnett', 'break',     'Fall Break',                         '2025-10-09', '2025-10-13', '2025-26'),

-- November
(gen_random_uuid(), 'gwinnett', 'no_school', 'Digital Learning Day',               '2025-11-04', '2025-11-04', '2025-26'),
(gen_random_uuid(), 'gwinnett', 'break',     'Thanksgiving Break',                 '2025-11-24', '2025-11-28', '2025-26'),

-- December / January
(gen_random_uuid(), 'gwinnett', 'early_release', 'High School Semester Exams — Early Release', '2025-12-17', '2025-12-19', '2025-26'),
(gen_random_uuid(), 'gwinnett', 'break',     'Winter Break',                       '2025-12-22', '2026-01-02', '2025-26'),
(gen_random_uuid(), 'gwinnett', 'holiday',   'Martin Luther King Jr. Day',         '2026-01-19', '2026-01-19', '2025-26'),

-- February
(gen_random_uuid(), 'gwinnett', 'no_school', 'Digital Learning Day',               '2026-02-06', '2026-02-06', '2025-26'),
(gen_random_uuid(), 'gwinnett', 'break',     'Mid-Winter Break',                   '2026-02-12', '2026-02-16', '2025-26'),

-- March
(gen_random_uuid(), 'gwinnett', 'no_school', 'Digital Learning Day',               '2026-03-13', '2026-03-13', '2025-26'),

-- April
(gen_random_uuid(), 'gwinnett', 'break',     'Spring Break',                       '2026-04-06', '2026-04-10', '2025-26'),

-- May
(gen_random_uuid(), 'gwinnett', 'early_release', 'High School Final Exams — Early Release', '2026-05-18', '2026-05-20', '2025-26'),
(gen_random_uuid(), 'gwinnett', 'no_school', 'Last Day of School',                 '2026-05-21', '2026-05-21', '2025-26'),
(gen_random_uuid(), 'gwinnett', 'holiday',   'Memorial Day',                       '2026-05-25', '2026-05-25', '2025-26');

-- ============================================
-- Summary: 62 calendar events across 4 systems
-- ============================================
-- APS:      15 events (2 early_release, 5 break, 3 holiday, 5 no_school)
-- DeKalb:   14 events (5 break, 3 holiday, 6 no_school)
-- Cobb:     17 events (3 early_release, 5 break, 3 holiday, 6 no_school)
-- Gwinnett: 16 events (2 early_release, 5 break, 3 holiday, 6 no_school)
--
-- Key cross-system alignment:
--   All 4 share: Labor Day (Sep 1), MLK Day (Jan 19), Spring Break (Apr 6-10), Memorial Day (May 25)
--   APS + DeKalb share: Winter Break dates, Mid-Winter Break week, Last Day (May 28)
--   Cobb is earliest Fall Break (Sep 22-26) — 3 weeks before others
--   Gwinnett is earliest Mid-Winter Break (Feb 12-16) — starts Thursday before Presidents' Day
--
-- NOTE: "First Day of School" and "Last Day of School" are typed as no_school
-- for feed awareness (parents need to know these dates) even though school IS
-- in session. The Hooky feed uses these for "school starts tomorrow!" alerts,
-- not "no school today" alerts. The alert copy layer handles the distinction.
