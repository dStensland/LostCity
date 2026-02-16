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
      {/* Right fade to indicate more content */}
      <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-[var(--hotel-ivory)] to-transparent pointer-events-none z-10" />
      <div className="hotel-carousel flex w-full max-w-full gap-4 overflow-x-auto overflow-y-hidden snap-x snap-mandatory pb-2 pr-4">
        {children}
      </div>
    </div>
  );
}
