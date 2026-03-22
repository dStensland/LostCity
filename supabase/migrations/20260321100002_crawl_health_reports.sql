-- Post-crawl health reports and system alerts
create table if not exists crawl_health_reports (
  id bigint generated always as identity primary key,
  run_id text not null,
  created_at timestamptz not null default now(),
  total_sources int not null default 0,
  sources_succeeded int not null default 0,
  sources_failed int not null default 0,
  sources_zero_events int not null default 0,
  sources_yield_drop jsonb default '[]',
  sources_newly_broken jsonb default '[]',
  fleet_event_yield int not null default 0,
  enrichment_queue_depth jsonb default '{}',
  summary text
);

create table if not exists system_alerts (
  id bigint generated always as identity primary key,
  alert_type text not null,
  severity text not null default 'warning',
  message text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index idx_system_alerts_unacked
  on system_alerts (created_at desc)
  where acknowledged_at is null;

comment on table crawl_health_reports is
  'Per-run health summaries: source counts, yield, newly broken sources, enrichment queue depth.';

comment on table system_alerts is
  'Fleet-wide alerts raised during post-crawl analysis (e.g. >5 broken sources). Acknowledged when resolved.';
