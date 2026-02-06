# Pipeline V2 (Config-Driven Crawlers)

This document describes the new config-driven pipeline that complements existing source-specific crawlers. The goal is to standardize detail extraction (ticket links, images, descriptions, tags) while keeping custom logic only where necessary.

## Structure

- `crawlers/pipeline/` — orchestration utilities (fetch, discovery, detail enrichment, profile loading)
- `crawlers/extractors/` — extraction stack (structured data, selectors, heuristic, LLM fallback)
- `crawlers/sources/profiles/` — YAML profiles that describe source behavior
- `crawlers/pipeline_main.py` — CLI runner for the new pipeline

## Profile Schema (YAML or JSON)

Profiles describe discovery and detail extraction behavior.

```
version: 1
slug: example-venue
name: Example Venue
defaults:
  venue_name: Example Venue
  category: music
  subcategory: concert
  tags:
    - music
discovery:
  enabled: true
  type: list
  urls:
    - https://example.com/events
  event_card: ".event-card"
  fields:
    title: ".event-title"
    date: ".event-date"
    time: ".event-time"
    detail_url: "a.event-link@href"
    image_url: "img@src"
detail:
  enabled: true
  selectors:
    description: ".event-description"
    ticket_url: "a:has-text('Tickets')@href"
    image_url: ".event-hero img@src"
  use_jsonld: true
  use_open_graph: true
  use_heuristic: true
  use_llm: false
```

Selector syntax:
- `".selector"` -> text content
- `".selector@href"` -> attribute

Discovery types:
- `list`: CSS selectors on list/calendar pages
- `html`: LLM discovery on a single HTML page (good for unstructured sites)
- `api`: adapter-driven (use existing API integrations)

API discovery example:
```
version: 1
slug: ticketmaster
name: Ticketmaster
discovery:
  enabled: true
  type: api
  api:
    adapter: ticketmaster
detail:
  enabled: false
```

## Extraction Stack Priority

The detail enrichment pipeline merges results in this order:
1. Open Graph / meta
2. JSON-LD (schema.org Event)
3. Explicit selectors
4. Heuristic fallback
5. LLM fallback (optional)

Merge logic keeps the “best available” field (e.g., longer descriptions, more specific ticket URLs).

## Running the Pipeline

Dry run (no DB writes):
```
python pipeline_main.py --source example-venue
```

Insert into DB:
```
python pipeline_main.py --source example-venue --insert --limit 25
```

## Migration Checklist

1. Create a profile in `crawlers/sources/profiles/<slug>.yaml`
2. Identify list-page selectors (event cards, title, date, detail URL)
3. Identify detail selectors (description, ticket link, image)
4. Run pipeline in `--dry-run` and validate output
5. Enable `--insert` and compare quality metrics
6. Retire or slim the legacy crawler once coverage is stable

## Pilot Profiles (Initial Migration)

- `the-earl` (LLM discovery, homepage)
- `dads-garage` (list selectors + detail enrichment)
- `ticketmaster` (API adapter)
