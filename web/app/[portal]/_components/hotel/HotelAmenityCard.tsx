interface HotelAmenityCardProps {
  amenity: {
    name: string;
    icon: string;
    hours: string;
    description: string;
  };
}

/**
 * Card for hotel amenities (pool, spa, restaurant, etc.)
 * Fixed width for carousel context, warm cream styling
 */
export default function HotelAmenityCard({ amenity }: HotelAmenityCardProps) {
  return (
    <div className="flex-shrink-0 snap-start w-[260px] bg-[var(--hotel-cream)] rounded-lg p-5 shadow-[var(--hotel-shadow-soft)] hover:shadow-[var(--hotel-shadow-medium)] transition-shadow duration-500">
      {/* Icon */}
      <div className="text-3xl mb-3">{amenity.icon}</div>

      {/* Name */}
      <h3 className="font-display font-semibold text-lg text-[var(--hotel-charcoal)] tracking-tight mb-1">
        {amenity.name}
      </h3>

      {/* Hours */}
      <p className="text-xs font-body text-[var(--hotel-champagne)] uppercase tracking-[0.1em] mb-2">
        {amenity.hours}
      </p>

      {/* Description */}
      <p className="text-sm font-body text-[var(--hotel-stone)] leading-relaxed">
        {amenity.description}
      </p>
    </div>
  );
}
