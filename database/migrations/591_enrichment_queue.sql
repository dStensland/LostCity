-- Enrichment queue: async processing for external API calls
-- Decouples insert speed from enrichment completeness

create table if not exists enrichment_queue (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  task_type text not null,
  status text not null default 'pending',
  priority int not null default 5,
  attempts int not null default 0,
  max_attempts int not null default 3,
  next_retry_at timestamptz,
  locked_by text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create index idx_enrichment_queue_pending
  on enrichment_queue (priority, created_at)
  where status = 'pending' and (next_retry_at is null or next_retry_at <= now());

create index idx_enrichment_queue_entity
  on enrichment_queue (entity_type, entity_id);

-- Atomic task claiming with FOR UPDATE SKIP LOCKED
create or replace function claim_enrichment_tasks(p_worker_id text, p_limit int default 10)
returns setof enrichment_queue
language sql
as $$
  update enrichment_queue
  set status = 'processing',
      locked_by = p_worker_id,
      locked_at = now()
  where id in (
    select id from enrichment_queue
    where status = 'pending'
      and (next_retry_at is null or next_retry_at <= now())
    order by priority, created_at
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

-- Queue depth monitoring
create or replace function enrichment_queue_depth()
returns table(status text, count bigint)
language sql stable
as $$
  select status, count(*) from enrichment_queue group by status;
$$;

comment on table enrichment_queue is
  'Async enrichment tasks (TMDB, Spotify, blurhash, series linking) decoupled from insert path';
