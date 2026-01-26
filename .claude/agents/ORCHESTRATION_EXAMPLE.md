# Agent Orchestration Example

This document shows how to orchestrate multiple specialized agents for a full-stack feature.

## Example Task: "Add a 'Save Event' feature with collections"

### Phase 1: Planning (Plan Agent)

```
Task: Plan agent
Prompt: "Design the implementation for a 'Save Event' feature where users can
        save events to collections. Consider the database schema, API routes,
        and frontend components needed."
```

**Output:** Detailed plan with:
- Database tables: `collections`, `collection_events`
- API routes: `/api/collections`, `/api/collections/[id]/events`
- Components: `SaveButton`, `CollectionPicker`, `CollectionsList`
- Hooks: `useCollections`, `useSaveEvent`

---

### Phase 2: Database Migration (db-migrator Agent)

```
Task: db-migrator agent
Prompt: "Create a migration for the collections feature:
        - collections table (id, user_id, name, description, is_public, created_at)
        - collection_events junction table (collection_id, event_id, added_at)
        - Indexes on user_id and collection_id
        - Foreign keys to profiles and events tables"
```

**Output:** `/database/migrations/015_add_collections.sql`

---

### Phase 3: API Routes (api-route-dev Agent)

```
Task: api-route-dev agent
Prompt: "Create API routes for collections:
        - GET/POST /api/collections - list/create collections
        - GET/PUT/DELETE /api/collections/[id] - manage single collection
        - POST/DELETE /api/collections/[id]/events - add/remove events
        Follow rate limiting and validation patterns in lib/."
```

**Output:**
- `/web/app/api/collections/route.ts`
- `/web/app/api/collections/[id]/route.ts`
- `/web/app/api/collections/[id]/events/route.ts`

---

### Phase 4: Frontend Components (full-stack-dev Agent)

```
Task: full-stack-dev agent
Prompt: "Build the frontend for collections:
        - SaveButton component with heart icon
        - CollectionPicker modal for selecting collection
        - useCollections hook with React Query
        - useSaveEvent mutation hook
        - Integrate SaveButton into EventCard"
```

**Output:**
- `/web/components/SaveButton.tsx`
- `/web/components/CollectionPicker.tsx`
- `/web/lib/hooks/useCollections.ts`
- `/web/lib/hooks/useSaveEvent.ts`
- Updated `EventCard.tsx`

---

### Phase 5: Linting (lint-fixer Agent)

```
Task: lint-fixer agent
Prompt: "Fix any linting errors in the new collections feature files"
```

**Output:** All ESLint errors resolved, unused imports removed

---

### Phase 6: Testing (test-runner Agent)

```
Task: test-runner agent
Prompt: "Run tests and verify the collections feature works:
        - Check TypeScript compilation
        - Run any relevant Python tests
        - Verify no runtime errors"
```

**Output:** All checks passing

---

## Parallel vs Sequential Execution

### Can Run in Parallel:
- Multiple API routes (if independent)
- Frontend components (if no shared dependencies)
- Lint + Type check

### Must Run Sequentially:
1. Plan → Must complete before implementation
2. DB Migration → Must complete before API routes (API needs schema)
3. API Routes → Must complete before hooks (hooks call APIs)
4. Components → After hooks exist
5. Lint/Test → After all code is written

---

## Orchestration Code Example

```typescript
// Pseudocode for how orchestration works

async function implementFeature(task: string) {
  // Phase 1: Plan
  const plan = await runAgent("Plan", {
    prompt: `Design implementation for: ${task}`
  });

  // Phase 2: Database (if needed)
  if (plan.requiresDbChanges) {
    await runAgent("db-migrator", {
      prompt: plan.dbMigrationSpec
    });
  }

  // Phase 3: API Routes (can parallelize multiple routes)
  await Promise.all(
    plan.apiRoutes.map(route =>
      runAgent("api-route-dev", { prompt: route.spec })
    )
  );

  // Phase 4: Frontend (can parallelize independent components)
  await Promise.all(
    plan.components.map(comp =>
      runAgent("full-stack-dev", { prompt: comp.spec })
    )
  );

  // Phase 5: Lint (after all code written)
  await runAgent("lint-fixer", {
    prompt: "Fix linting errors in new files"
  });

  // Phase 6: Test
  await runAgent("test-runner", {
    prompt: "Verify all new code works correctly"
  });
}
```

---

## Available Agents Summary

| Agent | Use For | Tools |
|-------|---------|-------|
| `Plan` | Architecture, design decisions | Read, Grep, Glob |
| `full-stack-dev` | Components, hooks, full features | Read, Edit, Write, Bash, Grep, Glob |
| `api-route-dev` | Next.js API routes | Read, Write, Edit, Grep, Glob |
| `db-migrator` | Database schema, migrations | Read, Write, Edit, Grep, Glob |
| `crawler-dev` | Python crawlers | Read, Write, Edit, Bash, Grep, Glob |
| `lint-fixer` | Linting, formatting | Read, Edit, Bash, Grep, Glob |
| `test-runner` | Testing, verification | Read, Edit, Bash, Grep, Glob |
| `search-optimizer` | Search/filter performance | Read, Edit, Grep, Glob |
| `product-designer` | UX/UI review | Read, Grep, Glob + Browser |
| `qa` | Browser testing | Read, Grep, Glob + Browser |
| `data-specialist` | Data quality analysis | Read, Edit, Bash, Grep, Glob |

---

## Tips for Effective Orchestration

1. **Start with Plan** - Always understand the full scope before coding
2. **Respect dependencies** - Don't parallelize dependent tasks
3. **Run lint early and often** - Catch style issues before they accumulate
4. **Test incrementally** - Verify each phase works before proceeding
5. **Use the right agent** - Match tasks to agent specialties
6. **Provide context** - Include file paths, patterns to follow, and constraints
