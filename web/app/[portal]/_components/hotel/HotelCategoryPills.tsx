"use client";

interface HotelCategoryPillsProps {
  categories: { key: string; label: string; icon: string }[];
  active: string;
  onSelect: (key: string) => void;
}

/**
 * Horizontal pill navigation for filtering neighborhood venues
 * Champagne-gold active state, uppercase tracking
 */
export default function HotelCategoryPills({ categories, active, onSelect }: HotelCategoryPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
      {categories.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onSelect(cat.key)}
          className={`hotel-pill flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-body uppercase tracking-[0.1em] transition-all duration-300 ${
            active === cat.key
              ? "hotel-pill-active bg-[var(--hotel-charcoal)] text-[var(--hotel-champagne)]"
              : "bg-[var(--hotel-cream)] text-[var(--hotel-stone)] hover:bg-[var(--hotel-sand)]"
          }`}
        >
          <span>{cat.icon}</span>
          <span>{cat.label}</span>
        </button>
      ))}
    </div>
  );
}
