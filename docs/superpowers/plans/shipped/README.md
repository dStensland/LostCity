# Shipped Plans Archive

This directory holds plans whose work has shipped to `main`. Plans are moved here, not deleted, so the historical record is preserved.

**Convention:**
- A plan is "shipped" when the work it describes has landed in the `main` branch (verifiable via git log).
- A plan is "in-flight" if work is ongoing on a branch — keep these in the parent `plans/` directory.
- A plan is "abandoned" if it was superseded by a later plan or the scope was dropped — these stay in the parent `plans/` directory with a note in the plan body explaining what happened, OR they get archived to `../../archive/` if the entire approach is dead.

**Triage criteria:** Verify against `git log --oneline --since=<plan_date>` before moving. If you can't point to commits that implement the plan, it's not shipped.

The initial archive batch was created 2026-04-14 as part of `docs/superpowers/plans/2026-04-14-doc-consolidation-pass.md` Phase 4.
