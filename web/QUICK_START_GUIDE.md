# Hybrid Portal Design System - Quick Start Guide

This guide helps you quickly implement the new design system features for LostCity portals.

## For Developers

### Using Design Tokens in Components

**Option 1: Direct CSS Variables (Recommended)**
```tsx
<button className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)]">
  Submit
</button>
```

**Option 2: Token Constants**
```tsx
import { DESIGN_TOKENS } from "@/lib/design-tokens";

<button style={{ backgroundColor: DESIGN_TOKENS.button.primaryBg }}>
  Submit
</button>
```

**Option 3: Helper Functions**
```tsx
import { token, cssVar } from "@/lib/design-tokens";

<div className={token("bg", "surface-raised")}>
  <p style={{ color: cssVar("text-primary") }}>Content</p>
</div>
```

### Creating a Custom Feed Layout

```tsx
import { FeedRenderer } from "@/components/feed/FeedRenderer";
import { EventCard } from "@/components/EventCard";

export function MyFeed({ portal, events }) {
  return (
    <FeedRenderer portal={portal}>
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </FeedRenderer>
  );
}
```

### Using Specific Layout Components

```tsx
import { GridFeed, VerticalFeed } from "@/components/feed/layouts";
import { getPortalFeedConfig } from "@/lib/feed-config";

export function MyCustomFeed({ portal, events }) {
  const config = getPortalFeedConfig(portal);

  return (
    <GridFeed config={config}>
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </GridFeed>
  );
}
```

## For Portal Administrators

### Configuring Feed Layout

**Database Configuration:**
```sql
UPDATE portals
SET settings = jsonb_set(
  settings,
  '{feed_config}',
  '{
    "layout": "grid",
    "card_variant": "poster",
    "sections": ["featured", "trending"],
    "hero_style": "carousel",
    "show_filters": true,
    "group_by": "category"
  }'::jsonb
)
WHERE slug = 'your-portal-slug';
```

**Available Options:**

**Layouts:**
- `vertical` - Traditional scrolling (default)
- `horizontal` - Scrollable rows
- `grid` - Responsive grid
- `masonry` - Pinterest-style (coming soon)
- `timeline` - Chronological (coming soon)

**Card Variants:**
- `standard` - Balanced info and imagery (default)
- `compact` - Minimal, high density
- `hero` - Large images, cinematic
- `poster` - Image-focused
- `minimal` - Text-only

**Sections:**
- `featured` - Curated featured events
- `for_you` - Personalized recommendations
- `trending` - Popular events
- `by_category` - Grouped by category
- `friends_activity` - Friend activity

**Hero Styles:**
- `none` - No hero section (default)
- `single` - Single featured event
- `carousel` - Rotating featured events

### Setting Page Template

**Use Gallery Template (image-heavy):**
```sql
UPDATE portals
SET page_template = 'gallery'
WHERE slug = 'your-portal-slug';
```

**Use Timeline Template (chronological):**
```sql
UPDATE portals
SET page_template = 'timeline'
WHERE slug = 'your-portal-slug';
```

**Reset to Default:**
```sql
UPDATE portals
SET page_template = 'default'
-- OR
SET page_template = NULL
WHERE slug = 'your-portal-slug';
```

### Customizing Brand Colors

**Set Primary, Secondary, and Accent Colors:**
```sql
UPDATE portals
SET branding = jsonb_set(
  jsonb_set(
    jsonb_set(
      branding,
      '{primary_color}', '"#FF6B7A"'
    ),
    '{secondary_color}', '"#00D4E8"'
  ),
  '{accent_color}', '"#FFD93D"'
)
WHERE slug = 'your-portal-slug';
```

These colors automatically flow through the design token system:
- Primary → `--brand-primary`, `--btn-primary-bg`, etc.
- Secondary → `--brand-secondary`, `--focus-ring-color`, etc.
- Accent → `--brand-accent`, `--badge-accent-bg`, etc.

## Common Use Cases

### Case 1: Image-Heavy Visual Portal

```sql
-- Set gallery template + grid layout + poster cards
UPDATE portals
SET
  page_template = 'gallery',
  settings = jsonb_set(
    settings,
    '{feed_config}',
    '{"layout": "grid", "card_variant": "poster"}'::jsonb
  )
WHERE slug = 'visual-portal';
```

### Case 2: Conference/Schedule Portal

```sql
-- Set timeline template + date grouping
UPDATE portals
SET
  page_template = 'timeline',
  settings = jsonb_set(
    settings,
    '{feed_config}',
    '{"layout": "vertical", "group_by": "date"}'::jsonb
  )
WHERE slug = 'conference-portal';
```

### Case 3: Curated Discovery Portal

```sql
-- Horizontal layout with sections
UPDATE portals
SET settings = jsonb_set(
  settings,
  '{feed_config}',
  '{
    "layout": "horizontal",
    "sections": ["featured", "trending", "by_category"],
    "hero_style": "carousel"
  }'::jsonb
)
WHERE slug = 'discover-portal';
```

### Case 4: Minimal Text-Based Portal

```sql
-- Vertical layout with compact cards
UPDATE portals
SET settings = jsonb_set(
  settings,
  '{feed_config}',
  '{
    "layout": "vertical",
    "card_variant": "minimal",
    "show_filters": true
  }'::jsonb
)
WHERE slug = 'minimal-portal';
```

## Testing Your Configuration

### 1. Check Design Tokens

Visit your portal and open browser DevTools:
```javascript
// In browser console
getComputedStyle(document.documentElement).getPropertyValue('--brand-primary')
getComputedStyle(document.documentElement).getPropertyValue('--btn-primary-bg')
```

### 2. Verify Feed Layout

Navigate to `/{portal-slug}?view=feed` and check:
- Layout matches your configuration
- Cards render in the correct variant
- Sections appear in the right order

### 3. Test Responsive Behavior

- Desktop: Full layout with all features
- Tablet: Grid adjusts to 2 columns
- Mobile: Single column, optimized spacing

## Troubleshooting

### Colors Not Showing

**Problem:** Portal uses default colors instead of custom branding.

**Solution:** Check that colors are set in `branding` JSONB column:
```sql
SELECT slug, branding->'primary_color' as primary
FROM portals
WHERE slug = 'your-portal-slug';
```

### Layout Not Applying

**Problem:** Portal shows vertical layout despite grid configuration.

**Solution:** Check feed_config is properly nested:
```sql
SELECT slug, settings->'feed_config' as feed_config
FROM portals
WHERE slug = 'your-portal-slug';
```

Should return:
```json
{"layout": "grid", "card_variant": "poster"}
```

### Template Not Working

**Problem:** Gallery/timeline template not rendering.

**Solution:** Verify page_template is set:
```sql
SELECT slug, page_template
FROM portals
WHERE slug = 'your-portal-slug';
```

Should return `gallery` or `timeline`, not `null`.

## Performance Tips

1. **Use appropriate card variants**
   - `minimal` for text-heavy content
   - `poster` only for high-quality images

2. **Limit hero carousels**
   - Set `hero_style: "single"` instead of `"carousel"` for better LCP

3. **Optimize section count**
   - 2-3 sections recommended
   - Too many sections increase initial load time

4. **Consider lazy loading**
   - Grid/masonry layouts benefit from image lazy loading
   - Horizontal layouts should lazy-load off-screen sections

## Next Steps

1. **Explore Examples**: Check `/components/examples/DesignTokenExample.tsx`
2. **Read Full Docs**: See `DESIGN_TOKENS.md` for complete system documentation
3. **Review Implementation**: See `IMPLEMENTATION_SUMMARY.md` for technical details
4. **Test Locally**: Run `npm run dev` and test your portal configuration

## Support

- **Bugs**: Create an issue with portal slug and configuration
- **Questions**: Check `DESIGN_TOKENS.md` for detailed documentation
- **Feature Requests**: Describe your use case and desired behavior

---

**Remember:** All existing portals continue to work without any changes. New features are 100% opt-in via database configuration.
