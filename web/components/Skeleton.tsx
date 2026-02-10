"use client";

import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForTime } from "@/lib/css-utils";

type Props = {
  className?: string;
  delay?: string;
};

export default function Skeleton({ className = "", delay }: Props) {
  const delayClass = delay
    ? createCssVarClassForTime("--skeleton-delay", delay, "skeleton-delay")
    : null;

  return (
    <>
      <ScopedStyles css={delayClass?.css} />
      <div
        className={`skeleton-shimmer-enhanced ${delay ? "skeleton-delay" : ""} ${delayClass?.className ?? ""} ${className}`}
      />
    </>
  );
}
