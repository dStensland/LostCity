# Hotel Portal Implementation Guide
**Code-ready snippets for luxury hotel vertical**

---

## 1. Font Setup (Next.js)

Add to `web/app/layout.tsx` (or create separate hotel layout):

```tsx
import { Cormorant_Garamond, Inter } from "next/font/google";

// Luxury serif for headings
const cormorantGaramond = Cormorant_Garamond({
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// Refined sans-serif for body/UI
const inter = Inter({
  weight: ["400", "500", "600"],
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

// Update body className
<body className={`${cormorantGaramond.variable} ${inter.variable} antialiased`}>
```

---

## 2. CSS Variables (globals.css or hotel-portal.css)

```css
/* ============================================
   HOTEL PORTAL THEME
   Add to globals.css under a .hotel-portal class
   or create separate hotel-portal.css
   ============================================ */

.hotel-portal {
  /* Typography */
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  
  /* Neutrals */
  --ivory: #FDFBF7;
  --cream: #F5F3EE;
  --sand: #E8E4DD;
  --stone: #9B968C;
  --charcoal: #2F2D2A;
  --ink: #1A1816;
  
  /* Accents */
  --champagne: #D4AF7A;
  --rose-gold: #C9A88A;
  --brass: #B8956A;
  
  /* Semantic */
  --sage: #8A9A8B;
  --slate: #6B7C8C;
  --terracotta: #C18B73;
  --burgundy: #8B5A5A;
  
  /* Category - Muted */
  --cat-music: #B39B8A;
  --cat-wellness: #8A9A8B;
  --cat-dining: #A8836B;
  --cat-art: #7A7A8C;
  --cat-fitness: #6B8A7A;
  --cat-culture: #9B8A9B;
  
  /* Shadows */
  --shadow-soft: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-medium: 0 4px 8px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.03);
  --shadow-strong: 0 8px 16px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04);
  
  /* Overlays */
  --overlay-light: rgba(47, 45, 42, 0.04);
  --overlay-medium: rgba(47, 45, 42, 0.08);
  
  /* Timing */
  --ease-elegant: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-refined: cubic-bezier(0.33, 0, 0.2, 1);
  --duration-fast: 250ms;
  --duration-base: 400ms;
  --duration-slow: 600ms;
  --duration-lazy: 800ms;
  
  /* Spacing (generous) */
  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2.5rem;
  --space-2xl: 4rem;
  --space-3xl: 6rem;
  --space-4xl: 8rem;
  
  /* Type scale (larger, more generous) */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.5rem;       /* 24px */
  --text-2xl: 2rem;        /* 32px */
  --text-3xl: 2.5rem;      /* 40px */
  --text-4xl: 3rem;        /* 48px */
}

/* Override background for light mode */
.hotel-portal {
  background: var(--ivory);
  color: var(--charcoal);
}
```

---

## 3. Tailwind Config Extension

Add to `tailwind.config.ts`:

```typescript
export default {
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        hotel: {
          ivory: '#FDFBF7',
          cream: '#F5F3EE',
          sand: '#E8E4DD',
          stone: '#9B968C',
          charcoal: '#2F2D2A',
          ink: '#1A1816',
          champagne: '#D4AF7A',
          'rose-gold': '#C9A88A',
          brass: '#B8956A',
          sage: '#8A9A8B',
          slate: '#6B7C8C',
          terracotta: '#C18B73',
          burgundy: '#8B5A5A',
        },
      },
      boxShadow: {
        'hotel-soft': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'hotel-medium': '0 4px 8px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.03)',
        'hotel-strong': '0 8px 16px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04)',
      },
    },
  },
}
```

---

## 4. Hotel Event Card Component

`components/hotel/HotelEventCard.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { Event } from "@/lib/types";
import { format } from "date-fns";

interface HotelEventCardProps {
  event: Event;
  portal: string;
}

export default function HotelEventCard({ event, portal }: HotelEventCardProps) {
  const eventUrl = `/${portal}/events/${event.id}`;
  
  return (
    <Link 
      href={eventUrl}
      className="group block bg-hotel-cream rounded-lg overflow-hidden shadow-hotel-soft hover:shadow-hotel-medium transition-shadow duration-500"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden bg-hotel-sand">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-600 ease-out"
          />
        ) : (
          <div className="w-full h-full bg-hotel-sand" />
        )}
        
        {/* Category badge */}
        {event.category && (
          <div className="absolute top-4 left-4">
            <span className="px-3 py-1 bg-hotel-ivory/90 backdrop-blur-sm text-hotel-stone text-xs font-body uppercase tracking-[0.15em] rounded-full">
              {event.category.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-3">
        {/* Date & Time */}
        <p className="text-xs font-body text-hotel-stone uppercase tracking-[0.15em]">
          {format(new Date(event.start_date), "EEEE, MMM d")}
          {event.start_time && ` · ${event.start_time}`}
        </p>
        
        {/* Title */}
        <h3 className="font-display font-medium text-xl text-hotel-charcoal tracking-tight leading-tight line-clamp-2">
          {event.title}
        </h3>
        
        {/* Description */}
        {event.description && (
          <p className="text-sm font-body text-hotel-stone line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        )}
        
        {/* Venue */}
        {event.venue_name && (
          <p className="text-sm font-body text-hotel-stone">
            {event.venue_name}
          </p>
        )}
        
        {/* Price */}
        {event.price_min !== null && event.price_min !== undefined && (
          <p className="text-sm font-body text-hotel-champagne">
            {event.price_min === 0 
              ? "Complimentary for Guests" 
              : `From $${event.price_min}`
            }
          </p>
        )}
      </div>
    </Link>
  );
}
```

---

## 5. Hotel Header Component

`components/hotel/HotelHeader.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Portal } from "@/lib/types";

interface HotelHeaderProps {
  portal: Portal;
}

export default function HotelHeader({ portal }: HotelHeaderProps) {
  const pathname = usePathname();
  
  const navLinks = [
    { href: `/${portal.slug}`, label: "Today" },
    { href: `/${portal.slug}/week`, label: "This Week" },
    { href: `/${portal.slug}/wellness`, label: "Wellness" },
    { href: `/${portal.slug}/dining`, label: "Dining" },
  ];
  
  return (
    <header className="sticky top-0 z-50 bg-hotel-ivory/95 backdrop-blur-md border-b border-hotel-sand shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Hotel branding */}
        <div className="flex items-center gap-3">
          {portal.branding?.logo_url && (
            <img 
              src={portal.branding.logo_url} 
              alt={portal.name} 
              className="h-8"
            />
          )}
          <span className="text-sm font-body text-hotel-stone uppercase tracking-[0.2em]">
            Concierge
          </span>
        </div>
        
        {/* Navigation - desktop */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-body uppercase tracking-wide transition-colors ${
                  isActive 
                    ? "text-hotel-charcoal" 
                    : "text-hotel-stone hover:text-hotel-champagne"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        
        {/* User menu */}
        <div className="flex items-center gap-4">
          <button 
            className="text-hotel-stone hover:text-hotel-charcoal transition-colors"
            aria-label="Search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          
          <button className="w-10 h-10 rounded-full bg-hotel-champagne text-hotel-ink text-sm font-medium flex items-center justify-center">
            JD
          </button>
        </div>
      </div>
    </header>
  );
}
```

---

## 6. Hotel Button Components

`components/hotel/HotelButton.tsx`:

```tsx
import { ButtonHTMLAttributes, ReactNode } from "react";

interface HotelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "text";
  children: ReactNode;
}

export default function HotelButton({ 
  variant = "primary", 
  children, 
  className = "",
  ...props 
}: HotelButtonProps) {
  const baseStyles = "font-body font-medium text-sm uppercase tracking-widest transition-all duration-200";
  
  const variantStyles = {
    primary: "px-6 py-3 bg-hotel-champagne text-hotel-ink rounded hover:bg-hotel-brass",
    secondary: "px-6 py-3 border border-hotel-sand text-hotel-charcoal rounded hover:border-hotel-stone hover:bg-hotel-ivory/50",
    text: "text-hotel-champagne hover:text-hotel-brass tracking-wide",
  };
  
  return (
    <button 
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

---

## 7. Hotel Feed Layout

`app/[portal]/hotel-feed/page.tsx`:

```tsx
import { getCachedPortalBySlug } from "@/lib/portal";
import { getUpcomingEvents } from "@/lib/events";
import HotelHeader from "@/components/hotel/HotelHeader";
import HotelEventCard from "@/components/hotel/HotelEventCard";

export default async function HotelFeedPage({ 
  params 
}: { 
  params: Promise<{ portal: string }> 
}) {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);
  
  if (!portal) return null;
  
  // Get curated events
  const todayEvents = await getUpcomingEvents(portal.id, { limit: 3 });
  const featuredEvents = await getUpcomingEvents(portal.id, { 
    limit: 6, 
    offset: 3 
  });
  
  return (
    <div className="hotel-portal min-h-screen">
      <HotelHeader portal={portal} />
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="mb-16">
          <h1 className="font-display font-light text-4xl text-hotel-charcoal tracking-tight leading-tight mb-4">
            Curated for You
          </h1>
          <p className="font-body text-lg text-hotel-stone leading-relaxed max-w-2xl">
            Discover exceptional experiences during your stay.
          </p>
        </section>
        
        {/* Today's Events - Featured Grid */}
        <section className="mb-16">
          <h2 className="font-display font-medium text-2xl text-hotel-charcoal tracking-tight mb-8">
            Today
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {todayEvents.map((event) => (
              <HotelEventCard 
                key={event.id} 
                event={event} 
                portal={slug} 
              />
            ))}
          </div>
        </section>
        
        {/* This Week */}
        <section>
          <h2 className="font-display font-medium text-2xl text-hotel-charcoal tracking-tight mb-8">
            This Week
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {featuredEvents.map((event) => (
              <HotelEventCard 
                key={event.id} 
                event={event} 
                portal={slug} 
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
```

---

## 8. Mobile Bottom Navigation

`components/hotel/HotelMobileNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
}

export default function HotelMobileNav({ portal }: { portal: string }) {
  const pathname = usePathname();
  
  const navItems: NavItem[] = [
    {
      href: `/${portal}`,
      label: "Today",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: `/${portal}/week`,
      label: "Week",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      href: `/${portal}/wellness`,
      label: "Wellness",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      href: `/${portal}/dining`,
      label: "Dining",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];
  
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-hotel-ivory border-t border-hotel-sand z-50 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive 
                  ? "text-hotel-champagne" 
                  : "text-hotel-stone"
              }`}
            >
              {item.icon}
              <span className="text-2xs font-body uppercase tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

---

## 9. Category Badge Component

`components/hotel/CategoryBadge.tsx`:

```tsx
const CATEGORY_COLORS: Record<string, string> = {
  music: "text-[#B39B8A] bg-[#B39B8A]/10",
  wellness: "text-[#8A9A8B] bg-[#8A9A8B]/10",
  dining: "text-[#A8836B] bg-[#A8836B]/10",
  art: "text-[#7A7A8C] bg-[#7A7A8C]/10",
  fitness: "text-[#6B8A7A] bg-[#6B8A7A]/10",
  culture: "text-[#9B8A9B] bg-[#9B8A9B]/10",
};

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export default function CategoryBadge({ category, className = "" }: CategoryBadgeProps) {
  const colorClass = CATEGORY_COLORS[category] || "text-hotel-stone bg-hotel-sand";
  
  return (
    <span 
      className={`px-3 py-1 font-body text-xs uppercase tracking-[0.15em] rounded-full ${colorClass} ${className}`}
    >
      {category.replace('_', ' ')}
    </span>
  );
}
```

---

## 10. Animation Utilities

Add to `globals.css`:

```css
/* Hotel Portal Animations */
@keyframes hotel-fade-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes hotel-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.hotel-portal {
  animation: hotel-fade-in 800ms cubic-bezier(0.16, 1, 0.3, 1);
}

.hotel-card-enter {
  animation: hotel-fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Stagger children */
.hotel-grid > * {
  animation: hotel-fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1);
}

.hotel-grid > *:nth-child(1) { animation-delay: 0ms; }
.hotel-grid > *:nth-child(2) { animation-delay: 100ms; }
.hotel-grid > *:nth-child(3) { animation-delay: 200ms; }
.hotel-grid > *:nth-child(4) { animation-delay: 300ms; }
.hotel-grid > *:nth-child(5) { animation-delay: 400ms; }
.hotel-grid > *:nth-child(6) { animation-delay: 500ms; }
```

---

## 11. Portal Type Check

Add hotel detection to `lib/portal.ts`:

```typescript
export function isHotelPortal(portal: Portal): boolean {
  return portal.portal_type === "hotel";
}

// Usage in layout
export default async function PortalLayout({ children, params }: Props) {
  const portal = await getCachedPortalBySlug(slug);
  
  const layoutClass = isHotelPortal(portal) 
    ? "hotel-portal" 
    : "city-portal";
  
  return (
    <div className={layoutClass}>
      {isHotelPortal(portal) ? (
        <HotelHeader portal={portal} />
      ) : (
        <CityHeader portal={portal} />
      )}
      {children}
    </div>
  );
}
```

---

## 12. Image Placeholder Component

For elegant loading states:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";

interface HotelImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

export default function HotelImage({ src, alt, className = "" }: HotelImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  if (!src) {
    return (
      <div className="w-full h-full bg-hotel-sand flex items-center justify-center">
        <svg className="w-12 h-12 text-hotel-stone/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }
  
  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-hotel-sand animate-pulse" />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={`${className} transition-opacity duration-500 ${isLoading ? "opacity-0" : "opacity-100"}`}
        onLoadingComplete={() => setIsLoading(false)}
      />
    </>
  );
}
```

---

## Summary

This implementation guide provides:

1. **Font loading** (Cormorant Garamond + Inter)
2. **CSS variables** for hotel theme
3. **Tailwind config** extension
4. **Core components** (EventCard, Header, Button, etc.)
5. **Layout templates** for feed/detail pages
6. **Mobile navigation** with bottom tabs
7. **Animation utilities** for luxury feel
8. **Portal type detection** for conditional rendering

**Next Steps:**

1. Copy font imports to layout.tsx
2. Add hotel CSS variables to globals.css
3. Create `components/hotel/` directory
4. Build HotelEventCard, HotelHeader, HotelButton
5. Create hotel feed page
6. Test on mobile (bottom nav, spacing)
7. Add staggered animations to card grids
8. Refine typography hierarchy

**Design Validation Checklist:**

- [ ] Does it feel like a luxury hotel lobby, not a nightclub?
- [ ] Is there generous whitespace between elements?
- [ ] Are serifs used for headings, sans for UI?
- [ ] Are colors muted and earthy, not neon?
- [ ] Do animations feel slow and refined?
- [ ] Is information density low (6-8 events visible)?
- [ ] Are shadows soft, not glowing?
- [ ] Does mobile navigation use large touch targets?

