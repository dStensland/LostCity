# Design Tester Panel

A developer/admin tool for testing portal branding and animations in real-time without modifying the database.

## Features

- **Real-time Preview**: Test branding changes instantly without page refresh
- **Background Animations**: Switch between 11 different ambient effects
- **Color Customization**: Adjust primary and secondary colors
- **Logo Testing**: Preview different logo URLs
- **Animation Controls**: Adjust intensity, speed, and toggle animations on/off
- **Export Config**: Copy current settings as JSON to apply to portals

## Accessing the Panel

### Development Mode

The panel is **automatically available** in development mode:

```bash
cd web
npm run dev
```

Visit any portal page (e.g., `http://localhost:3000/atlanta`) and:

- **Press `Ctrl+Shift+D`** to toggle the panel
- Or **click the floating button** in the bottom-right corner

### Production/Staging

The panel is **hidden in production** unless explicitly enabled. To enable for admin testing:

1. Update `DesignTesterPanel.tsx` line 42 to check for admin privileges:
   ```typescript
   const isDev = typeof window !== "undefined" &&
     (process.env.NODE_ENV === "development" ||
      window.location.hostname === "localhost" ||
      isAdmin); // Add admin check
   ```

## Using the Panel

### 1. Background Animation

Select from 11 ambient effects:

- **None**: No background animation
- **Subtle Glow**: Category-based ambient glow (default)
- **Gradient Wave**: Animated gradient waves
- **Particle Field**: Floating CSS particles
- **Aurora**: Northern lights effect
- **Mesh Gradient**: Animated mesh gradients
- **Noise Texture**: Subtle animated noise
- **Shifting Neighborhood**: Abstract cityscape with sliding buildings
- **Constellation**: Connected dots that fade in/out
- **Flowing Streets**: Organic flowing lines like winding streets
- **Growing Garden**: Botanical shapes that grow, bloom, and fade

### 2. Intensity

Adjust the visual intensity of the background effect:

- **Subtle**: Minimal, unobtrusive effect
- **Medium**: Balanced visibility (default)
- **Bold**: Maximum visual impact

### 3. Animation Speed

Control how fast animations move:

- **Slow**: Gentle, calming pace
- **Medium**: Standard speed (default)
- **Fast**: Energetic, dynamic movement

### 4. Toggle Animations

Use the switch to completely disable/enable all animations.

### 5. Color Customization

- **Primary Color**: Main brand color (affects buttons, links, accents)
- **Secondary Color**: Supporting color (affects borders, secondary elements)

Colors can be entered as:
- Hex codes: `#E855A0`
- Using the color picker

### 6. Logo Testing

Enter a logo URL to preview:
- Public image URLs (must be HTTPS)
- Data URIs for inline testing
- URLs from your own CDN or image host

**Supported formats**: PNG, JPG, SVG, WebP

### 7. Copy Config

Click **Copy Config JSON** to export current settings:

```json
{
  "ambient": {
    "effect": "aurora",
    "intensity": "bold",
    "animation_speed": "medium"
  },
  "branding": {
    "primary_color": "#7c3aed",
    "secondary_color": "#ec4899",
    "logo_url": "https://example.com/logo.png"
  }
}
```

This JSON can be applied to a portal via:
- The admin UI portal editor
- API PATCH request to `/api/admin/portals/{id}`
- Direct database update to `portals.branding` column

## How It Works

### Architecture

1. **Session Storage**: All overrides are stored in `sessionStorage.designTesterOverrides`
2. **Custom Events**: Changes trigger `designOverridesChanged` event
3. **Real-time Updates**: Components listen for events and re-render

### Affected Components

The following components automatically respond to design tester changes:

- **AmbientBackground**: Switches background effects
- **PortalTheme**: Updates CSS variables for colors
- **UnifiedHeader**: Replaces logo in real-time
- **All Header Templates**: StandardHeader, MinimalHeader, BrandedHeader, ImmersiveHeader

### Data Flow

```
DesignTesterPanel (user changes settings)
  ↓
sessionStorage.setItem("designTesterOverrides", JSON.stringify(overrides))
  ↓
window.dispatchEvent(new CustomEvent("designOverridesChanged"))
  ↓
Components listen via useDesignOverrides() hook
  ↓
Re-render with new settings
```

## Technical Details

### Files Created

- `/web/components/DesignTesterPanel.tsx` - Main panel component
- `/web/lib/hooks/useDesignOverrides.ts` - Hook for accessing overrides
- `/web/DESIGN_TESTER.md` - This documentation

### Files Modified

- `/web/app/[portal]/layout.tsx` - Added DesignTesterPanel to layout
- `/web/components/ambient/AmbientBackground.tsx` - Listen for ambient overrides
- `/web/components/UnifiedHeader.tsx` - Listen for logo overrides
- `/web/lib/visual-presets.ts` - Added new ambient effect types (already existed)

### Hook: useDesignOverrides()

Import and use in any component:

```typescript
import { useDesignOverrides } from "@/lib/hooks/useDesignOverrides";

function MyComponent() {
  const overrides = useDesignOverrides();

  const effectiveColor = overrides.primaryColor || defaultColor;

  // Component logic...
}
```

Or use the specialized hook for logos:

```typescript
import { useLogoUrl } from "@/lib/hooks/useDesignOverrides";

function MyHeader({ defaultLogo }: { defaultLogo?: string }) {
  const logoUrl = useLogoUrl(defaultLogo);

  return <img src={logoUrl} alt="Logo" />;
}
```

## Temporary vs Persistent Changes

### Temporary (Design Tester)

- Stored in `sessionStorage`
- Lost on page refresh
- Perfect for testing and experimentation
- No database changes

### Persistent (Production)

To make changes permanent:

1. Use the **Copy Config** button
2. Go to `/admin/portals/{id}`
3. Paste JSON into the branding editor
4. Save to database

Or via API:

```bash
curl -X PATCH https://lostcity.com/api/admin/portals/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "branding": {
      "ambient": {
        "effect": "aurora",
        "intensity": "bold"
      },
      "primary_color": "#7c3aed"
    }
  }'
```

## Keyboard Shortcuts

- **Ctrl+Shift+D**: Toggle panel open/close
- Works from anywhere on a portal page

## Tips

1. **Test on real content**: Navigate to different portal views (Feed, Find, Community) to see how animations work with actual content

2. **Check performance**: Some effects (particle_field, aurora) are more GPU-intensive

3. **Accessibility**: Test with animations disabled to ensure reduced-motion compliance

4. **Mobile testing**: Resize browser window to see how effects adapt to different screen sizes

5. **Color contrast**: Use the color picker to ensure WCAG AA compliance (check text contrast)

## Troubleshooting

### Panel doesn't appear

- Check that you're in development mode (`npm run dev`)
- Look for the floating button in bottom-right corner
- Try pressing `Ctrl+Shift+D`

### Changes don't apply

- Check browser console for errors
- Verify sessionStorage is enabled
- Try refreshing the page and reopening the panel

### Logo doesn't load

- Ensure the URL is publicly accessible
- Check for HTTPS (required for security)
- Verify CORS headers allow loading from your domain

### Animations lag

- Try reducing intensity to "subtle"
- Disable effects on lower-end devices
- Use simpler effects like "subtle_glow" or "gradient_wave"

## Future Enhancements

Potential additions to the Design Tester:

- [ ] Font family selector
- [ ] Border radius slider
- [ ] Shadow intensity controls
- [ ] Card style variants
- [ ] Button style variants
- [ ] Category color overrides
- [ ] Header template switcher
- [ ] Export as visual preset
- [ ] Save/load test configurations
- [ ] Screenshot/share test setup

## Related Documentation

- [Visual Presets Guide](/web/lib/visual-presets.ts) - All available presets
- [Portal Branding Schema](/database/migrations/091_custom_domains.sql) - Database structure
- [Admin Portal Editor](/web/app/admin/portals/[id]/page.tsx) - Production editor
