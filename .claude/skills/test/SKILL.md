---
description: Run tests and fix any failures
---

# Run Tests

$ARGUMENTS

## Commands

**Python (all):**
```bash
cd crawlers && pytest
```

**Specific file:**
```bash
cd crawlers && pytest tests/test_dedupe.py
```

**By pattern:**
```bash
cd crawlers && pytest -k "pattern"
```

**TypeScript:**
```bash
cd web && npm run lint && npx tsc --noEmit
```

## Instructions

1. Run the specified tests (or all if not specified)
2. Report pass/fail counts
3. For failures, analyze the error and suggest fixes
4. Re-run after fixes to verify
