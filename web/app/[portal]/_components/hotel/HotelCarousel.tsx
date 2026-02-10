import { ReactNode } from "react";

interface HotelCarouselProps {
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal scroll carousel with hotel styling
 * Snap scrolling, hidden scrollbar, edge fade
 */
export default function HotelCarousel({ children, className = "" }: HotelCarouselProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="hotel-carousel flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2">
        {children}
      </div>
    </div>
  );
}
