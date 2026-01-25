---
description: Fix linting errors and code formatting issues
---

# Lint Fix

$ARGUMENTS

## Commands

**Python:**
```bash
cd crawlers && ruff check . --fix && black .
```

**TypeScript:**
```bash
cd web && npm run lint -- --fix
```

## Instructions

1. Run lint checks on the specified path (or all)
2. Auto-fix what's possible
3. Manually fix remaining issues
4. Re-run to verify clean
