"use client";

import { useLayoutEffect } from "react";

/** Scrolls to top synchronously before paint. No flash, no animation. */
export default function ScrollToTop() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}
