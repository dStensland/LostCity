---
description: Holistic page/feature audit and rebuild. Multi-lens analysis (design, architecture, data, performance) → gap diagnosis → rebuild plan → execution. Don't iterate — elevate.
---

# Elevate

$ARGUMENTS

## Usage

- `/elevate [page-or-feature]` — Full audit and rebuild of a specific page or feature
- `/elevate [page] --audit-only` — Audit without rebuilding (just produce the diagnosis)
- `/elevate [page] --execute` — Skip to execution if a plan was already approved

### Examples
```
/elevate event detail page
/elevate feed view
/elevate /atlanta
/elevate search experience
/elevate venue detail
/elevate mobile navigation
/elevate the tonight section on the feed
```

## Philosophy

**Don't iterate. Audit, decide, rebuild.**

Incremental tweaks on a fundamentally weak page produce a polished version of the wrong thing. With AI-led development, rebuilding a component or page section costs roughly the same as tweaking it. So the rational move is: diagnose honestly, identify what's structurally wrong, rebuild the weak parts from scratch, verify.

The bottleneck is the quality of the diagnosis, not the cost of implementation.

**Production-ready, not demo-ready.** The bar for every elevate pass is: would a real user recommend this to a friend? No walkthrough scripts, no "ignore that part," no empty sections masked by pretty loading states. If it doesn't work unsupervised with real data at real viewport sizes, it's not done. A live product with real users IS the best sales demo — we never optimize for a guided walkthrough.

## Workflow

### Phase 1: Multi-Lens Audit (parallel)

Run these analyses simultaneously against the target page/feature:

**Design Lens** (spawn product-designer agent):
- Screenshot the page at desktop and mobile
- Would a real user recommend this page to a friend? Not "is it pretty" but "does it work, feel polished, and help me do the thing?"
- Information hierarchy — is the most important content most prominent?
- Consistency with the design system (colors, spacing, typography)
- Loading states, empty states, error states — all must be production-grade, not placeholder
- Mobile experience at 375px — this is where most real users are
- Accessibility (contrast, touch targets, focus indicators)

**Architecture Lens** (read the code directly):
- What components make up this page? Read them.
- Are the right abstractions in place, or is this held together with hacks?
- Client/server split correct? Any server imports in client components?
- API calls efficient? N+1 patterns? Unnecessary re-fetches?
- Does the component structure support the portal platform (works across verticals)?
- Would you be comfortable adding a new vertical-specific layout on top of this code?

**Data Lens** (check the data powering the page):
- What data is this page showing? Is it comprehensive and accurate?
- Are there empty sections because data is missing? A section with no data should render nothing, not a skeleton forever.
- Are images present and loading? Or placeholder/broken?
- Does the data quality match what a real user would expect? Not "good enough for a demo" — good enough for daily use.
- Any hardcoded content that should come from the data layer? Hardcoded data is smoke and mirrors.

**Performance Lens** (check via browser and code):
- Console errors or warnings?
- Slow API calls visible in network tab?
- Large bundle imports that could be lazy-loaded?
- Unnecessary client-side computation?
- Images optimized (next/image, proper sizing)?

### Phase 2: Gap Analysis

Synthesize the audit into an honest assessment:

```markdown
## Elevate Audit: [Page/Feature]

### What This Page Should Accomplish
[For whom? What's the job-to-be-done? How does this serve the platform?]

### Current State — Honest Assessment
[Is this production-ready? Would a real user have a good experience with zero hand-holding? Be brutal. Score 1-10 on: visual quality, UX clarity, data completeness, code quality, performance]

### Structural Issues (not cosmetic — these can't be fixed with CSS)
1. [Issue]: [Why it's structural, not cosmetic]
2. [Issue]: [Why it's structural, not cosmetic]

### Cosmetic Issues (fixable with polish)
1. [Issue]
2. [Issue]

### Data Gaps
1. [What's missing or broken in the data layer]

### What Would You Build If Starting Fresh?
[Describe the ideal version of this page given everything we know about the product, the platform, and the user]

### Rebuild Recommendation
| Section/Component | Action | Rationale |
|-------------------|--------|-----------|
| [Component A] | **Rebuild** | [fundamental approach is wrong because...] |
| [Component B] | **Keep + polish** | [good foundation, needs refinement] |
| [Component C] | **Remove** | [doesn't serve the page's job-to-be-done] |
| [New component] | **Create** | [missing capability that the page needs] |
```

**Present this to the user for approval before proceeding to Phase 3.**

The user makes the strategic call: which rebuilds to prioritize, what the page should feel like, any direction on approach. Then agents execute.

### Phase 3: Execute the Rebuild

For each section marked "rebuild" or "create":

1. **full-stack-dev** implements the changes following existing patterns
2. New components should be built fresh — don't try to incrementally modify broken code
3. Preserve working pieces (keep + polish items get targeted fixes, not rewrites)
4. Run lint + type check after each significant change
5. If the rebuild touches API routes or data fetching, verify with real data

### Phase 4: Verify (Production-Ready Gate)

1. **qa agent** tests the rebuilt page as a real user would — no walkthrough, no context:
   - Visual check at desktop and mobile (screenshot comparison)
   - Functional test of all interactions — every link, button, and state
   - Console error check — zero errors, zero warnings that indicate broken functionality
   - Portal attribution check (if portal-scoped page)
   - Empty states: what happens with 0 results? Does it degrade gracefully or break?
   - Error states: what happens when the API is slow or fails?
2. Compare against the Phase 2 "what would you build fresh" description
3. Score the same 1-10 dimensions from the audit
4. Report: "Before was X, after is Y"
5. **The question is not "does this demo well?" — it's "would a stranger have a good experience using this unsupervised?"**

## Key Principles

- **Production-ready is the only bar.** Not "good enough for a demo," not "works if you know where to click." Would a stranger have a good experience using this with zero guidance? That's the bar.
- **The audit is the most valuable part.** A thorough, honest diagnosis prevents wasted rebuild effort. Don't rush it.
- **Rebuild > iterate.** If a component is fundamentally wrong, don't patch it. Build the right thing.
- **User approves the plan.** Phase 2 output goes to the user. They decide what to rebuild. Agents don't unilaterally rewrite pages.
- **Keep what works.** Not everything needs rebuilding. Good components get polish, not replacement.
- **Think platform.** Every rebuild should produce components that work across verticals and cities, not just for the current page in the current portal.
- **One page at a time.** Don't let an elevate session scope-creep into adjacent pages. Note issues elsewhere, but stay focused.

## Instructions

1. Parse the arguments to identify the target page/feature
2. If the target is a URL path, map it to the relevant route in `web/app/`
3. If the target is a feature name, identify the relevant components and pages
4. Run Phase 1 audit (spawn product-designer for visual review, read code for architecture, check data layer)
5. Produce Phase 2 gap analysis and present to user
6. Wait for user approval and direction
7. Execute Phase 3 rebuilds
8. Run Phase 4 verification
9. Present before/after summary
