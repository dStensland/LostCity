"use client";

import { useState, useCallback } from "react";

interface UseGalleryOptions {
  imageUrl: string | null;
  galleryEnabled?: boolean;
  galleryUrls?: string[];
}

interface UseGalleryResult {
  images: string[];
  currentImage: string | undefined;
  galleryIndex: number;
  imgLoaded: boolean;
  setImgLoaded: (loaded: boolean) => void;
  setImgError: (error: boolean) => void;
  handlePrev: () => void;
  handleNext: () => void;
  setGalleryIndex: (index: number) => void;
}

export function useGallery({
  imageUrl,
  galleryEnabled,
  galleryUrls,
}: UseGalleryOptions): UseGalleryResult {
  const [imgError, setImgError] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  const images =
    galleryEnabled && galleryUrls?.length
      ? galleryUrls
      : imageUrl && !imgError
        ? [imageUrl]
        : [];

  const currentImage = images[galleryIndex];

  const handlePrev = useCallback(() => {
    setGalleryIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setGalleryIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  return {
    images,
    currentImage,
    galleryIndex,
    imgLoaded,
    setImgLoaded,
    setImgError,
    handlePrev,
    handleNext,
    setGalleryIndex,
  };
}
