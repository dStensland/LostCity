# Ambient Effects Testing Guide

## Quick Test via DesignTesterPanel

The easiest way to test all ambient effects is using the built-in DesignTesterPanel:

1. **Open the panel:** Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac)
2. **Navigate to Ambient tab**
3. **Select each effect** from the dropdown
4. **Adjust settings:**
   - Intensity: subtle, medium, bold
   - Animation Speed: slow, medium, fast
   - Toggle animations on/off

## Testing Each Effect

### 1. Shifting Neighborhood

**What to look for:**
- 18 geometric shapes (rectangles and triangles)
- Shapes should slide horizontally at different speeds
- Pastel colors (yellows, greens, blues)
- Very low opacity (subtle, almost ghostly)
- Smooth, independent movements

**Test cases:**
- [ ] Shapes are visible but subtle
- [ ] Different shapes move at different speeds
- [ ] Triangles and rectangles both present
- [ ] No jerky animations
- [ ] Respects reduced-motion preference

### 2. Constellation

**What to look for:**
- ~35 dots scattered across the screen
- Lines connecting nearby dots
- Lines fade in and out smoothly
- Dots pulse gently
- Warm amber dots, soft green lines

**Test cases:**
- [ ] Dots are evenly distributed
- [ ] Lines only connect nearby dots (not everything)
- [ ] Fading is smooth, not abrupt
- [ ] Dots pulse at different rates
- [ ] Glow effect is visible but subtle
- [ ] No performance issues

### 3. Flowing Streets

**What to look for:**
- 6 flowing curved lines
- Organic, hand-drawn quality
- Gradient colors along each line
- Gentle wave motion
- Lines at different positions/orientations

**Test cases:**
- [ ] Lines are smooth bezier curves (not straight)
- [ ] Each line has visible gradient
- [ ] Wave animation is subtle and slow
- [ ] Lines don't overlap too much
- [ ] Looks organic, not geometric
- [ ] Multiple color transitions per line

### 4. Growing Garden

**What to look for:**
- ~14 botanical shapes
- 4 different shape types: circles, blobs, leaves, petals
- Shapes grow from 0 to full size
- Each shape blooms for ~50s then fades
- Staggered timing (always some shapes visible)

**Test cases:**
- [ ] Different shape types are recognizable
- [ ] Growth animation is smooth
- [ ] Shapes fade out gracefully
- [ ] Always 3-5 shapes visible at once (staggered)
- [ ] Petal shapes have 5 petals in a flower pattern
- [ ] Blob shapes are organic (not perfect circles)
- [ ] Slight rotation during growth

## Performance Testing

### FPS Check
1. Open Chrome DevTools
2. Go to Performance tab
3. Enable "Show FPS meter"
4. Should maintain 60 FPS with any effect

### Paint/Composite Check
1. Open Chrome DevTools
2. Go to Rendering tab
3. Enable "Paint flashing"
4. Should see minimal/no repaints (transforms only)

### GPU Acceleration
1. Open Chrome DevTools
2. Go to Layers tab
3. Ambient effect should be on its own layer
4. Should use GPU for transforms

## Accessibility Testing

### Reduced Motion
1. Enable reduced-motion in OS settings
2. Reload page
3. All effects should either:
   - Stop animating entirely, OR
   - Fallback to subtle_glow (static version)

### Screen Reader
1. Enable screen reader (NVDA, JAWS, VoiceOver)
2. Navigate page
3. Ambient effects should not be announced (aria-hidden)

### Keyboard Navigation
1. Tab through page
2. Focus should never land on ambient elements
3. Animations should not distract from focused elements

## Color Testing

### Custom Colors
Test each effect with custom colors:

```typescript
{
  colors: {
    primary: "#FF0000",
    secondary: "#0000FF"
  }
}
```

- [ ] shifting_neighborhood: Buildings use custom colors
- [ ] constellation: Dots/lines use custom colors
- [ ] flowing_streets: Gradients incorporate custom colors
- [ ] growing_garden: Plants use custom colors

### Intensity Levels

Test each effect at all 3 intensity levels:

**Subtle (should be barely visible):**
- shifting_neighborhood: ~0.03 opacity
- constellation: dots 0.3, lines 0.1
- flowing_streets: ~0.15 opacity
- growing_garden: ~0.12 opacity

**Medium (default, noticeable but not distracting):**
- shifting_neighborhood: ~0.05 opacity
- constellation: dots 0.5, lines 0.2
- flowing_streets: ~0.25 opacity
- growing_garden: ~0.2 opacity

**Bold (visible but still background):**
- shifting_neighborhood: ~0.08 opacity
- constellation: dots 0.8, lines 0.3
- flowing_streets: ~0.35 opacity
- growing_garden: ~0.3 opacity

## Animation Speed Testing

### Slow
- Animations should be noticeably slower
- More meditative/calming feel
- Good for long reading sessions

### Medium (default)
- Balanced animation speed
- Noticeable but not distracting

### Fast
- Quicker animations
- More energetic feel
- Good for active/event-focused portals

## Cross-Browser Testing

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Mobile-Specific Testing

- [ ] Animations run smoothly on mobile
- [ ] No performance degradation on scroll
- [ ] Effects don't block touch interactions
- [ ] Battery impact is minimal
- [ ] Works on both portrait and landscape

## Integration Testing

### With Portal Branding
1. Create test portal with each effect
2. Verify effect appears on all portal pages
3. Verify effect respects portal color scheme
4. Verify effect persists on navigation

### With Dark/Light Modes
1. Test each effect in dark mode
2. Test each effect in light mode
3. Verify opacity/colors work in both modes
4. No jarring transitions when switching modes

## Common Issues to Watch For

- [ ] **Hydration mismatch:** Console errors about server/client mismatch
- [ ] **Jank:** Animation stuttering or dropping frames
- [ ] **Overlap:** Shapes overlapping content or blocking interactions
- [ ] **Flash:** Effect appearing suddenly instead of smoothly
- [ ] **Memory leak:** Memory usage increasing over time
- [ ] **CPU spike:** High CPU usage while animating
- [ ] **Z-index issues:** Effect appearing in front of content

## Regression Testing Checklist

After any changes to ambient effects:

- [ ] All 4 new effects still render
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Effects switch correctly via DesignTesterPanel
- [ ] Reduced-motion fallback works
- [ ] Colors can be customized
- [ ] Intensity settings work
- [ ] Speed settings work
- [ ] No performance regression
- [ ] Works on mobile
- [ ] Works in all browsers

## Visual Regression

Take screenshots of each effect and compare:
1. shifting_neighborhood (subtle, medium, bold)
2. constellation (subtle, medium, bold)
3. flowing_streets (subtle, medium, bold)
4. growing_garden (subtle, medium, bold)

Store in `/web/public/test-screenshots/ambient/` for comparison.
