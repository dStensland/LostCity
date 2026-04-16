'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

interface HeroOverlayNavProps {
  onClose?: () => void;
  portalSlug?: string;
}

export function HeroOverlayNav({ onClose, portalSlug }: HeroOverlayNavProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else if (portalSlug) {
      router.push(`/${portalSlug}`);
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleBack}
      aria-label="Go back"
      className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white/70 transition-colors hover:bg-black/60 hover:text-white"
    >
      <ArrowLeft size={20} weight="bold" />
    </button>
  );
}
