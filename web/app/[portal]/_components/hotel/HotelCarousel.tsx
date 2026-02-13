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
    <div className={`relative max-w-full overflow-x-clip ${className}`}>
      <div className="hotel-carousel flex w-full max-w-full gap-4 overflow-x-auto overflow-y-hidden snap-x snap-mandatory pb-2">
        {children}
      </div>
    </div>
  );
}
