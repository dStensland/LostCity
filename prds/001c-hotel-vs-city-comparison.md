# Visual Design Comparison: City vs Hotel Portal

## Event Card Comparison

### City Portal Event Card (Current)
```tsx
<div className="group relative bg-[var(--twilight)]/40 backdrop-blur-sm rounded-xl border border-[var(--neon-magenta)]/20 overflow-hidden hover:border-[var(--neon-magenta)]/40 transition-all duration-200">
  {/* Neon glow effect */}
  <div className="absolute inset-0 bg-gradient-to-br from-[var(--neon-magenta)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
  
  {/* Image with neon overlay */}
  <div className="relative aspect-[4/3] overflow-hidden bg-[var(--void)]">
    <img 
      src={event.image_url} 
      className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
    />
    {/* Category badge - bright, glowing */}
    <div className="absolute top-3 right-3">
      <span className="px-2 py-1 bg-[var(--neon-magenta)]/80 backdrop-blur-sm text-[var(--cream)] text-2xs font-mono uppercase tracking-wider rounded shadow-[0_0_12px_var(--neon-magenta)]">
        Music
      </span>
    </div>
  </div>

  {/* Content - compact padding */}
  <div className="p-4 space-y-2">
    {/* Time - small, mono */}
    <p className="text-xs font-mono text-[var(--muted)] uppercase">
      Tonight 9PM
    </p>
    
    {/* Title - Outfit, medium weight */}
    <h3 className="font-outfit font-semibold text-lg text-[var(--cream)] line-clamp-2">
      {event.title}
    </h3>
    
    {/* Venue - with icon, tight spacing */}
    <p className="text-sm text-[var(--soft)] flex items-center gap-1">
      <MapPinIcon className="w-3 h-3" />
      Terminal West
    </p>
    
    {/* Price tag - neon accent */}
    <div className="pt-2">
      <span className="text-sm font-mono text-[var(--neon-green)]">
        $25
      </span>
    </div>
  </div>
</div>
```

**Visual characteristics:**
- Dark background (#18181F with blur)
- Neon magenta border that glows on hover
- Compact 16px padding
- Small mono font for metadata
- Outfit sans-serif for title
- 4:3 aspect ratio image
- Bright category badges with glow
- Dense information hierarchy

---

### Hotel Portal Event Card (New)
```tsx
<div className="group bg-[var(--cream)] rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08),_0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.06),_0_2px_4px_rgba(0,0,0,0.03)] transition-shadow duration-500">
  {/* Image - generous 16:9, soft */}
  <div className="relative aspect-[16/9] overflow-hidden bg-[var(--sand)]">
    <img 
      src={event.image_url} 
      alt={event.title}
      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-600 ease-out"
    />
    {/* Category badge - muted, minimal */}
    <div className="absolute top-4 left-4">
      <span className="px-3 py-1 bg-[var(--ivory)]/90 backdrop-blur-sm text-[var(--stone)] text-xs font-body uppercase tracking-[0.15em] rounded-full">
        Live Music
      </span>
    </div>
  </div>

  {/* Content - generous padding */}
  <div className="p-6 space-y-3">
    {/* Metadata - refined, spaced */}
    <p className="text-xs font-body text-[var(--stone)] uppercase tracking-[0.15em]">
      Tonight · 8:00 PM
    </p>
    
    {/* Title - Serif, elegant */}
    <h3 className="font-display font-medium text-xl text-[var(--charcoal)] tracking-tight leading-tight">
      {event.title}
    </h3>
    
    {/* Description - breathing room */}
    <p className="text-sm font-body text-[var(--stone)] line-clamp-2 leading-relaxed">
      {event.description}
    </p>
    
    {/* Venue - subtle, clean */}
    <p className="text-sm font-body text-[var(--stone)]">
      The Lobby Bar
    </p>
    
    {/* Price - understated */}
    <p className="text-sm font-body text-[var(--champagne)]">
      Complimentary for Guests
    </p>
  </div>
</div>
```

**Visual characteristics:**
- Light cream background (#F5F3EE)
- Soft shadow (no glow, no border)
- Generous 24px padding
- Refined sans-serif for metadata
- Elegant serif (Cormorant Garamond) for title
- 16:9 aspect ratio image (more cinematic)
- Muted category badges, no glow
- Spacious information hierarchy

---

## Header Comparison

### City Portal Header (Current)
```tsx
<header className="sticky top-0 z-50 bg-[var(--void)]/95 backdrop-blur-md border-b border-[var(--twilight)]">
  <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
    {/* Logo with gradient */}
    <Link href="/" className="gradient-text text-xl font-bold tracking-tight">
      Lost City
    </Link>
    
    {/* City name */}
    <h1 className="text-lg font-outfit font-semibold text-[var(--cream)]">
      Atlanta
    </h1>
    
    {/* User avatar - neon ring */}
    <button className="w-10 h-10 rounded-full bg-[var(--twilight)] ring-2 ring-[var(--neon-magenta)]/40">
      <UserIcon />
    </button>
  </div>
  
  {/* Tab navigation - neon underlines */}
  <nav className="border-t border-[var(--twilight)]">
    <div className="max-w-7xl mx-auto px-4 flex gap-6">
      <a className="py-3 text-sm font-mono uppercase text-[var(--cream)] border-b-2 border-[var(--neon-magenta)]">
        Feed
      </a>
      <a className="py-3 text-sm font-mono uppercase text-[var(--muted)]">
        Find
      </a>
      <a className="py-3 text-sm font-mono uppercase text-[var(--muted)]">
        Community
      </a>
    </div>
  </nav>
</header>
```

---

### Hotel Portal Header (New)
```tsx
<header className="sticky top-0 z-50 bg-[var(--ivory)]/95 backdrop-blur-md border-b border-[var(--sand)] shadow-sm">
  <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
    {/* Hotel branding - minimal */}
    <div className="flex items-center gap-3">
      <img src="/hotel-emblem.svg" alt="Hotel Name" className="h-8" />
      <span className="text-sm font-body text-[var(--stone)] uppercase tracking-[0.2em]">
        Concierge
      </span>
    </div>
    
    {/* Navigation - refined, minimal */}
    <nav className="hidden md:flex items-center gap-8">
      <a className="text-sm font-body text-[var(--charcoal)] hover:text-[var(--champagne)] uppercase tracking-wide transition-colors">
        Today
      </a>
      <a className="text-sm font-body text-[var(--stone)] hover:text-[var(--champagne)] uppercase tracking-wide transition-colors">
        This Week
      </a>
      <a className="text-sm font-body text-[var(--stone)] hover:text-[var(--champagne)] uppercase tracking-wide transition-colors">
        Wellness
      </a>
    </nav>
    
    {/* User avatar - champagne accent */}
    <button className="w-10 h-10 rounded-full bg-[var(--champagne)] text-[var(--ink)] text-sm font-medium">
      JD
    </button>
  </div>
</header>
```

---

## Typography Comparison

### City Portal Typography
```css
/* Outfit - rounded, friendly, tech */
font-family: 'Outfit', sans-serif;

/* Tight line heights */
--heading-line-height: 1.2;
--body-line-height: 1.5;

/* Compact scale */
--text-sm: 0.8125rem;   /* 13px */
--text-base: 0.9375rem; /* 15px */
--text-lg: 1.125rem;    /* 18px */
--text-2xl: 1.5rem;     /* 24px */
```

**Usage:**
- Event titles: `font-outfit font-semibold text-lg`
- Body text: `font-outfit text-base`
- Metadata: `font-mono text-xs uppercase`

---

### Hotel Portal Typography
```css
/* Cormorant Garamond - elegant serif */
font-family: 'Cormorant Garamond', serif;

/* Inter - refined sans */
font-family: 'Inter', sans-serif;

/* Generous line heights */
--heading-line-height: 1.2;
--body-line-height: 1.6;

/* Spacious scale */
--text-sm: 0.875rem;  /* 14px */
--text-base: 1rem;    /* 16px - larger! */
--text-xl: 1.5rem;    /* 24px */
--text-3xl: 2.5rem;   /* 40px */
```

**Usage:**
- Event titles: `font-display font-medium text-xl`
- Body text: `font-body text-base`
- Metadata: `font-body text-xs uppercase tracking-[0.15em]`

---

## Color Palette Comparison

### City Portal Colors
```css
/* Dark, electric, neon */
--void: #09090B;              /* Background */
--twilight: #252530;          /* Cards */
--neon-magenta: #E855A0;      /* Primary accent */
--neon-cyan: #00D4E8;         /* Secondary */
--neon-amber: #F5A623;        /* Warm */
--cream: #FAFAF9;             /* Text */

/* Category colors - bright, saturated */
--cat-music: #F9A8D4;         /* Bright pink */
--cat-comedy: #FCD34D;        /* Bright yellow */
--cat-nightlife: #E879F9;     /* Bright purple */
```

---

### Hotel Portal Colors
```css
/* Light, warm, sophisticated */
--ivory: #FDFBF7;             /* Background */
--cream: #F5F3EE;             /* Cards */
--champagne: #D4AF7A;         /* Primary accent */
--rose-gold: #C9A88A;         /* Secondary */
--charcoal: #2F2D2A;          /* Text */

/* Category colors - muted, earthy */
--cat-music: #B39B8A;         /* Muted taupe */
--cat-wellness: #8A9A8B;      /* Muted sage */
--cat-dining: #A8836B;        /* Muted terracotta */
```

---

## Spacing Comparison

### City Portal Spacing
```css
/* Compact, information-dense */
--card-padding: 1rem;         /* 16px */
--section-gap: 2rem;          /* 32px */
--grid-gap: 1rem;             /* 16px */
```

---

### Hotel Portal Spacing
```css
/* Generous, breathing room */
--card-padding: 1.5rem;       /* 24px */
--section-gap: 4rem;          /* 64px */
--grid-gap: 2.5rem;           /* 40px */
```

---

## Animation Comparison

### City Portal Animation
```css
/* Fast, energetic */
--transition-fast: 200ms;
--transition-base: 300ms;

/* Neon glow pulse */
@keyframes neon-pulse {
  0%, 100% { box-shadow: 0 0 8px var(--neon-magenta); }
  50% { box-shadow: 0 0 16px var(--neon-magenta); }
}
```

---

### Hotel Portal Animation
```css
/* Slow, refined */
--transition-base: 400ms;
--transition-slow: 600ms;
--ease-elegant: cubic-bezier(0.16, 1, 0.3, 1);

/* Subtle scale on hover */
.hover\:scale-105 {
  transition: transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## Summary: Design DNA

| Attribute | City Portal | Hotel Portal |
|-----------|------------|-------------|
| **Feel** | Electric, rebellious | Serene, refined |
| **Speed** | Fast, urgent | Slow, deliberate |
| **Density** | High (info-rich) | Low (curated) |
| **Contrast** | High (neon on dark) | Medium (warm neutrals) |
| **Personality** | Youthful, edgy | Timeless, sophisticated |
| **Metaphor** | Underground club | Sunlit lobby |

