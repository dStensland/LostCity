---
description: Product design review, UX analysis, and visual consistency audits
---

# Product Design Review

$ARGUMENTS

## Usage

- `/design site` - Full design audit across the entire platform
- `/design portal <slug>` - Deep design review of a specific portal (e.g., `/design portal atlanta`)
- `/design component <name>` - Focused review of a specific component
- `/design review` - Review recent UI changes from git for design quality
- `/design` - Quick design health check of key pages

## What Gets Reviewed

**Visual Consistency:**
- Color usage and brand alignment
- Typography hierarchy
- Spacing and layout patterns
- Component styling consistency

**User Experience:**
- Information hierarchy
- Navigation clarity
- Interaction patterns
- Loading and error states
- Mobile responsiveness

**Polish & Delight:**
- Micro-interactions
- Transitions and animations
- Empty states
- Edge cases (long text, missing images)

**Accessibility:**
- Color contrast
- Focus indicators
- Touch target sizes
- Screen reader compatibility

## Design System Context

LostCity has a signature dark, moody aesthetic:
- Deep burgundy backgrounds with subtle texture
- Coral (#f97066) primary accent
- Gold/amber (#d4a574) secondary highlights
- Glassmorphism effects
- Category-specific color tints

## Instructions

1. Parse arguments to determine review scope
2. Use browser automation to navigate and capture screenshots
3. Analyze visual consistency and UX patterns
4. Compare against established design system
5. Identify issues with severity ratings
6. Provide specific, actionable recommendations
7. Include code snippets for CSS fixes when helpful
