#!/usr/bin/env bash
set -euo pipefail

OUT_FILE="crawl_assessment_$(date +%Y%m%d_%H%M%S).txt"
WINDOW_HOURS="${1:-6}"
DB_URL="${2:-${DATABASE_URL:-}}"

if [ -n "${DB_URL}" ]; then
  PSQL_CMD=(psql "${DB_URL}")
else
  PSQL_CMD=(psql)
fi

run_psql() {
  "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1 <<SQL
$1
SQL
}

{
  echo "Crawl Assessment Report"
  echo "Generated: $(date)"
  echo "Window: last ${WINDOW_HOURS} hours"
  echo "======================================="
  echo

  echo "1) Inserts by source"
  echo "---------------------------------------"
  run_psql "
select s.slug, count(*) as inserted
from events e
join sources s on s.id = e.source_id
where e.created_at >= now() - interval '${WINDOW_HOURS} hours'
group by s.slug
order by inserted desc;
"
  echo

  echo "2) Field completeness (hydration quality)"
  echo "---------------------------------------"
  run_psql "
select
  count(*) as total,
  count(*) filter (where description is not null and length(description) >= 120) as with_desc,
  count(*) filter (where image_url is not null) as with_image,
  count(*) filter (where ticket_url is not null) as with_ticket,
  count(*) filter (where tags is not null and array_length(tags,1) >= 2) as with_tags
from events
where created_at >= now() - interval '${WINDOW_HOURS} hours';
"
  echo

  echo "3) Dedupe sanity (duplicate content_hash)"
  echo "---------------------------------------"
  run_psql "
select content_hash, count(*) as n
from events
where created_at >= now() - interval '${WINDOW_HOURS} hours'
group by content_hash
having count(*) > 1
order by n desc;
"
  echo

  echo "4) Inserts by integration_method"
  echo "---------------------------------------"
  run_psql "
select s.integration_method, count(*) as inserted
from events e
join sources s on s.id = e.source_id
where e.created_at >= now() - interval '${WINDOW_HOURS} hours'
group by s.integration_method
order by inserted desc;
"
  echo

  echo "5) Top sources with missing ticket_url"
  echo "---------------------------------------"
  run_psql "
select s.slug, count(*) as missing_ticket
from events e
join sources s on s.id = e.source_id
where e.created_at >= now() - interval '${WINDOW_HOURS} hours'
  and e.ticket_url is null
group by s.slug
order by missing_ticket desc
limit 20;
"
  echo

  echo "6) Top sources with missing image_url"
  echo "---------------------------------------"
  run_psql "
select s.slug, count(*) as missing_image
from events e
join sources s on s.id = e.source_id
where e.created_at >= now() - interval '${WINDOW_HOURS} hours'
  and e.image_url is null
group by s.slug
order by missing_image desc
limit 20;
"
  echo

  echo "7) Low-quality description sample"
  echo "---------------------------------------"
  run_psql "
select e.id, s.slug, left(coalesce(e.description, ''), 120) as description_preview
from events e
join sources s on s.id = e.source_id
where e.created_at >= now() - interval '${WINDOW_HOURS} hours'
  and (e.description is null or length(e.description) < 120)
order by e.created_at desc
limit 20;
"
  echo

  echo "8) Sample of events missing critical fields"
  echo "---------------------------------------"
  run_psql "
select e.id, s.slug, e.title,
       (e.description is null) as missing_desc,
       (e.image_url is null) as missing_image,
       (e.ticket_url is null) as missing_ticket
from events e
join sources s on s.id = e.source_id
where e.created_at >= now() - interval '${WINDOW_HOURS} hours'
  and (e.description is null or e.image_url is null or e.ticket_url is null)
order by e.created_at desc
limit 20;
"
  echo
} | tee "$OUT_FILE"

echo "Wrote: $OUT_FILE"
