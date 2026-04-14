# Architecture Decision Records

Lightweight records of architectural decisions and their reasoning.

## Template

Each ADR follows this structure:

- **Date:** When the decision was made
- **Status:** Accepted, Deprecated, or Superseded by [link]
- **Context:** What forced this decision (1-3 sentences)
- **Decision:** What we decided (1 sentence)
- **Consequences:** What gets easier, harder, or constrained
- **Supersedes:** Link to prior decision, or None

## How Agents Use ADRs

- MEMORY.md index has one-line entries linking here
- Before proposing a feature, check if a prior decision covers it
- To overturn a decision, argue with the reasoning — don't just re-propose
- New ADRs: copy the template, fill it in, add an index entry to MEMORY.md

## Superseding a Decision

When a decision is overturned, **do not delete or move the old ADR**. The numbered date sequence is the provenance record. Instead:

1. **Create a new dated ADR** with today's date and the new decision. Fill in `Supersedes:` with a link to the prior ADR.
2. **Update the prior ADR's status** from `Accepted` to `Superseded by [YYYY-MM-DD-new-decision.md](./YYYY-MM-DD-new-decision.md)`.
3. **Prepend a banner** to the top of the superseded ADR, immediately after the title:
   ```markdown
   > **SUPERSEDED YYYY-MM-DD** by [new-decision-name](./YYYY-MM-DD-new-decision.md). The decision below is kept for historical context; do not apply it as current guidance.
   ```
4. **Leave the superseded ADR in place.** Do not move to `archive/`. The numbered sequence must remain contiguous so agents walking the directory see the full decision history.
5. **Update `MEMORY.md`** — add the new ADR's index entry and append "(superseded)" to the old entry's one-liner.

Rationale: ADRs are history, not instructions. An agent reading a superseded ADR should immediately see the banner and the status line and understand that the decision below is no longer current, but can still see what was decided and why. Archiving destroys that traceability; deleting destroys the reasoning trail.

**What about "deprecated" status?** Use `Deprecated` (without a superseding ADR) when a decision no longer applies but nothing has replaced it — e.g., the feature was dropped. Still prepend a banner, but it reads "DEPRECATED" and points to the reason. Same rule: keep in place, don't archive.
