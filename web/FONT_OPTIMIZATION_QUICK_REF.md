# Font Optimization Quick Reference

## Summary: 8 fonts → 3 fonts (62.5% reduction)

### Before
```typescript
// app/layout.tsx
import {
  Outfit,           // ✓ Keep
  Instrument_Serif, // ✗ Remove
  JetBrains_Mono,   // ✓ Keep
  Space_Grotesk,    // ✗ Remove
  Bebas_Neue,       // ✗ Remove
  Nunito,           // ✓ Keep
  Baloo_2,          // ✗ Remove
  Caveat            // ✗ Remove (unused!)
} from "next/font/google";
```

### After
```typescript
// app/layout.tsx
import {
  Outfit,         // Primary UI font
  JetBrains_Mono, // Code/badges
  Nunito          // Family portals
} from "next/font/google";
```

---

## Font Usage Guide

### Outfit (Primary)
**Use for:** All general UI, headings, body text, buttons
```css
font-family: var(--font-outfit);
font-family: var(--font-sans);     /* alias */
font-family: var(--font-display);  /* alias */
font-family: var(--font-bebas);    /* alias for logo */
```

**Available weights:** 100-900 (variable font)
**Common weights:**
- 400 - Body text
- 600 - Headings
- 700-800 - Logo, emphasis

### JetBrains Mono (Monospace)
**Use for:** Code, badges, technical indicators, timestamps
```css
font-family: var(--font-mono);
```

**Available weights:** 100-800 (variable font)

### Nunito (Friendly/Rounded)
**Use for:** Family-friendly portals (ATLittle), playful UI
```css
font-family: var(--font-nunito);
font-family: var(--font-baloo);    /* alias */
```

**Available weights:** 400, 600, 700

---

## Replacement Guide

| Old Font | New Font | Notes |
|----------|----------|-------|
| Bebas Neue | Outfit (700-800) | Logo uses bold Outfit with letter-spacing |
| Baloo 2 | Nunito | CSS alias maintains compatibility |
| Space Grotesk | Outfit (600) | Display headings use semi-bold Outfit |
| Instrument Serif | Outfit | Rarely used, removed for simplicity |
| Caveat | - | Was completely unused |

---

## Component Updates

### Logo Component
**Before:** Bebas Neue (condensed display font)
**After:** Outfit 700-800 with `letter-spacing: 0.05em`

```tsx
// Old
fontFamily: "var(--font-bebas), sans-serif"
fontWeight: 400

// New
fontFamily: "var(--font-outfit), sans-serif"
fontWeight: 700-800
letterSpacing: "0.05em"
```

### ATLittle Portal
**Before:** Baloo 2 + Nunito
**After:** Nunito only (Baloo aliased to Nunito)

No component changes needed - CSS aliases handle backward compatibility.

---

## Performance Gains

### Network
- **5 fewer font files** to download
- **~150-200KB savings** in font assets
- **Faster FCP** with `display: swap`

### Parsing
- **Fewer font-face declarations**
- **Simpler font stack** reduces layout shift
- **Variable fonts** provide all weights in one file

---

## Browser DevTools Check

Open DevTools → Network → Filter: Font

**Before:** 8-10 font files
**After:** 3-4 font files

Expected files:
1. `outfit-latin-[hash].woff2` (variable)
2. `jetbrains-mono-latin-[hash].woff2` (variable)
3. `nunito-latin-[hash].woff2` (subset)

---

## Testing Checklist

- [ ] Logo looks good (check weight and spacing)
- [ ] ATLittle portal feels playful (Nunito loads)
- [ ] Code/badges use monospace (JetBrains Mono)
- [ ] All text renders with Outfit by default
- [ ] No FOUT (flash of unstyled text)
- [ ] DevTools shows only 3 font families loading

---

## Rollback Plan

If issues arise, restore fonts in this order:

1. **Nunito** - Needed for ATLittle portal
2. **JetBrains Mono** - Needed for badges/code
3. **Outfit** - Primary font

Worst case: Restore old `layout.tsx` from git:
```bash
git checkout HEAD~1 app/layout.tsx
```
