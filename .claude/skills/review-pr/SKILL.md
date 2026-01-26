---
description: Comprehensive PR review with orchestrated specialized reviewers for code quality, security, architecture, and UX
---

# PR Review

$ARGUMENTS

## Usage

- `/review-pr` - Review current branch against main
- `/review-pr <number>` - Review GitHub PR #number
- `/review-pr --quick` - Quick check (lint + types only, no deep review)
- `/review-pr --full` - Maximum thoroughness (includes browser testing for UI)

## What Gets Reviewed

**Always (every PR):**
- TypeScript compilation
- ESLint errors and warnings
- Python lint (if crawler changes)
- Security checklist
- Pattern compliance
- Code quality

**For Frontend Changes:**
- Design system consistency
- Accessibility basics
- Component patterns (memo, interfaces, named exports)
- Loading and error states
- Mobile responsiveness (via design agent)

**For API Changes:**
- Rate limiting present
- Error handling with `errorResponse`
- Input validation (`sanitizeString`, `isValidUUID`)
- Cache headers configured

**For Database Changes:**
- Migration safety (can it be rolled back?)
- Index coverage on foreign keys and queried columns
- Schema conventions (snake_case)

**For Crawler Changes:**
- Source active check (`source.get("is_active")`)
- Error handling for network failures
- Date parsing validation
- Venue normalization

## Review Standards

This review is intentionally demanding. The bar is:

- **"It works" is the minimum** - Code should be correct AND clean
- **Patterns matter** - Follow established patterns unless there's explicit justification
- **Security is non-negotiable** - No secrets, no injection vectors, always validate input
- **Tests exist for complex logic** - If it's complicated, it needs tests

## Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| **Critical** | Security, data loss, broken build | Block merge |
| **Major** | Pattern violations, missing error handling | Strongly recommend fix |
| **Minor** | Style, types, performance | Should fix |
| **Nit** | Preferences, minor improvements | Optional |

## Instructions

1. Parse arguments to determine review scope and mode
2. Get PR diff and list of changed files
3. Run automated checks first (lint, types, tests)
4. **STOP if automated checks fail** - report immediately
5. Categorize changes by domain (frontend, API, database, crawler)
6. Perform thorough code review against patterns
7. Always perform security review
8. Spawn specialized agents only for significant UI changes
9. Synthesize findings into severity-prioritized report
10. Make clear merge recommendation

## When Sub-Agents Are Spawned

**product-designer** - New components, significant visual changes, new pages
**qa** - New features needing browser verification, critical user flows

Sub-agents are NOT spawned for minor changes, non-UI work, or PRs that fail basic checks.
