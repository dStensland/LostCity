# Connector Playbook

Use this when a crawler platform family starts showing up often enough that
bespoke source modules are creating maintenance drag.

## Goal

Turn repeated crawl loops into a shared connector without flattening away the
source-specific logic that actually matters.

The connector should own:
- fetch / pagination
- common normalization
- dedupe / persistence flow
- routine runtime behavior

The source should keep:
- category / tag mapping
- venue or place resolution
- recurring-series hints
- platform-specific filtering
- any destination/program/exhibition dual-write logic

## When A Platform Is Ready

A platform is ready for connectorization when all of these are true:

1. At least `3` active or recently-used sources share the same crawl loop.
2. Most source differences are mapping logic, not fetch logic.
3. The shared behavior is stable enough to test once and reuse many times.
4. Migrating the family will reduce maintenance more than it increases abstraction.

If the family is still mostly mixed-surface edge cases, keep sources bespoke.

## Migration Order

Always move in this order:

1. Strict duplicates
2. A small shared base
3. `2-5` source migrations
4. Focused tests
5. Live dry-runs on active rows
6. Only then, add hooks for loose variants

Do not start from the weirdest source in the family. That produces a bad base.

## Design Rules

### 1. Keep the base small

Start with the minimum shared loop that removes the repetition. Add hooks only
when a real migrated source needs them.

### 2. Preserve compatibility with existing rows

During migration, do not casually change:
- content hash strategy
- crawl horizon
- venue resolution semantics
- stale-row cleanup behavior

If existing DB rows depend on old behavior, preserve it in the migration. A
connector that churns the whole source is not a successful migration.

### 3. Source-specific logic stays at the edge

Good connector hook types:
- `record_transform`
- `place_resolver`
- `series_hint_builder`
- `existing_record_lookup`
- `post_crawl_hook`
- for HTML families: `container_finder`, `container_parser`

Bad connector behavior:
- stuffing source-specific categories into the shared base
- adding bespoke one-off branches keyed by source slug
- forcing mixed-surface sources into one connector when only one lane is shared

### 4. Separate code validation from production validation

Mark sources as:
- `code-validated` if tests/compile pass
- `production-validated` only after a clean live dry-run on an active source row

Do not conflate the two.

## Validation Checklist

For each migration batch:

1. Focused tests pass for the connector and migrated sources.
2. Files compile cleanly.
3. Live dry-runs succeed for active migrated sources.
4. Results reconcile onto existing rows instead of churn.
5. No new runtime/report noise appears downstream.

## Stop Conditions

Stop expanding the connector family when:
- remaining sources are mostly edge cases
- most unmigrated sources are inactive
- new hooks would mostly exist for one source
- the next family offers better leverage

At that point, the family is effectively done.

## What Worked In The Tribe Family

- Start with pure REST API duplicates before mixed-surface sources.
- Use the shared base for fetch/persist, but keep per-source category logic.
- Preserve old hash and horizon behavior where needed.
- Add HTML support as a separate connector, not as a branch in the API base.
- Add loose-variant hooks only after the strict HTML copies are migrated.

## What To Do Next Time

When evaluating the next platform family, ask:

1. How many active sources use it?
2. How similar are the fetch loops?
3. How much of the source file is just boilerplate?
4. Can we validate multiple active sources quickly after migration?
5. Is this more leverage than another one-off crawler fix?

If the answers are strong, build the connector. If not, leave the sources alone.
