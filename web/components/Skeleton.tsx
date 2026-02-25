"use client";

import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForTime } from "@/lib/css-utils";

type Props = {
  className?: string;
  delay?: string;
  light?: boolean;
};

export default function Skeleton({ className = "", delay, light }: Props) {
  const delayClass = delay
    ? createCssVarClassForTime("--skeleton-delay", delay, "skeleton-delay")
    : null;

  const shimmerClass = light ? "skeleton-shimmer-light" : "skeleton-shimmer-enhanced";

  return (
    <>
      <ScopedStyles css={delayClass?.css} />
      <div
        className={`${shimmerClass} ${delay ? "skeleton-delay" : ""} ${delayClass?.className ?? ""} ${className}`}
      />
    </>
  );
}
