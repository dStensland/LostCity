# PRD 048: Atlanta Third-Space Wave 1 Dry-Run Validation

**Portal:** `atlanta`
**Surface:** `consumer`
**Status:** Validation note
**Last Updated:** 2026-04-01
**Depends on:** `prds/042-atlanta-third-space-wave1-execution-checklist.md`, `prds/046-atlanta-third-space-wave1-blocker-audit.md`

---

## Purpose

This note captures what happened when the existing Wave 1 sources were run in
dry-run mode on **April 1, 2026**.

It answers a simple question:

- are these sources broken at runtime, or is the next problem source quality and
  canonicalization?

---

## Commands Run

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source charis-books --dry-run
python3 main.py --source fulton-library --dry-run
python3 main.py --source atlanta-beltline --dry-run
```

All three commands started against the production DB target with writes
disabled.

---

## High-Level Result

All three existing Wave 1 sources are operational enough to run.

That changes the implementation picture:

- the next blocker is **not** "these crawlers do not execute"
- the next blocker **is** source quality, canonicalization, and registration /
  metadata cleanup

---

## Source-by-Source Read

## 1. `charis-books`

### Runtime status

Healthy enough to run.

Observed:

- source row lookup succeeded for slug `charis-books`
- crawler started normally
- venue lookup succeeded for place `charis-books`
- event extraction was active and producing many future events

### Important findings

- `charis-books` is already live in the current DB target
- earlier planning assumption that it might be unregistered was incorrect
- the source is usable now, but classification quality is noisy

### Quality signals observed

Repeated `classify_v2 disagrees` logs appeared for events such as:

- `Qigong For Burnout Recovery & Emotional Healing`
- `Syria's Transnational Rebellion...`
- youth/adult trans support group events
- `Raising Change Agents...`
- `Cliterati Open Mic...`

### Strategic implication

Charis does **not** need a first-pass runtime rescue.

It needs:

- canonical slug cleanup
- metadata cleanup
- event-type / recurring-format hardening
- likely series treatment for recurring book clubs and group formats

---

## 2. `fulton-library`

### Runtime status

Healthy enough to run.

Observed:

- source row lookup succeeded for slug `fulton-library`
- BiblioCommons API fetch worked
- branch lookup worked across many branches
- destination detail / venue feature upserts were being attempted in dry-run
- event updates and inserts were being processed at scale

### Important findings

- `fulton-library` is already live in the current DB target
- the source is operationally API-backed, exactly as the code suggests

### Quality / logic issues observed

1. classification disagreement is common

Examples from logs:

- `Learn How to Play Mah Jong` old=`games`, new=`workshops`
- `Preschool Storytime!` old=`family`, new=`words`
- `Friday Yoga with Lakshmi` old=`education`, new=`fitness`
- `Teen Advisory Board (TAB) at NESO` old=`education`, new=`volunteer`
- `Creative Writing Workshop` old=`words`, new=`workshops`

2. at least one date-validation failure occurred

Observed log:

- `Event rejected: Date >270 days in future (likely parsing bug): 2026-12-30 - The Writer Support Network`

### Strategic implication

Fulton Library does **not** need source activation.

It needs:

- profile metadata correction
- Central-specific destination enrichment
- date / future-window validation review
- category/taxonomy review for library event types

---

## 3. `atlanta-beltline`

### Runtime status

Healthy enough to run.

Observed:

- source row lookup succeeded for slug `atlanta-beltline`
- place lookup succeeded for venue `atlanta-beltline`
- destination detail / feature upserts were being attempted in dry-run
- crawler found event links and followed detail pages

### Important findings

- `atlanta-beltline` is already live in the current DB target
- the typed-envelope crawler path is operational

### Quality signals observed

- some event detail URLs resolved successfully after 308 redirects
- at least one event detail URL returned `404 Not Found`
- crawler continued processing despite partial detail-page issues

### Strategic implication

BeltLine does **not** need source registration.

It needs:

- canonical source cleanup versus legacy `beltline`
- recurring-program strategy for Run Club and related activity
- review of partial detail-page failures

---

## Updated Conclusions

### What is already true

- `charis-books` exists in the current DB target
- `fulton-library` exists in the current DB target
- `atlanta-beltline` exists in the current DB target

### What remains unvalidated

- `community-grounds` source row existence
- `community-grounds` crawler implementation

### What should move up in priority

1. canonicalization patches
2. Charis hardening
3. Fulton taxonomy/date review
4. BeltLine consolidation

### What should move down in priority

- speculative source-registration work for `charis-books`

unless migration parity or provenance repair becomes the goal

---

## Recommendation

The next implementation step should not be "activate all Wave 1 sources."

It should be:

1. apply the canonicalization patch slate
2. implement `community-grounds`
3. harden `charis-books`
4. then do Central / BeltLine quality passes

That order now reflects actual runtime reality.
