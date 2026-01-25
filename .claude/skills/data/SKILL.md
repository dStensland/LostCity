---
description: Analyze data quality and create diagnostics for crawler improvements
---

# Data Quality Analysis

Analyze: $ARGUMENTS

## Instructions

Reference the data-specialist agent guidelines in `.claude/agents/data-specialist.md`.

### If "audit"
1. Run diagnostic queries for common issues across all sources
2. Identify top problem sources by error count
3. Create prioritized list of fixes needed

### If given a source name
1. Analyze recent crawl data from that source
2. Check for patterns in extraction errors
3. Compare with similar sources for consistency

### If given a specific issue
1. Quantify the scope of the problem
2. Trace back to source crawlers
3. Create detailed diagnostic report

## Output Format

Produce actionable diagnostics:
- Specific source/file to modify
- Example records showing the issue
- Recommended code or prompt changes
- Validation query to verify the fix

## Key Files
- `crawlers/dedupe.py` - Deduplication logic
- `crawlers/extract.py` - LLM extraction
- `crawlers/db.py` - Database operations
- `database/schema.sql` - Schema reference
