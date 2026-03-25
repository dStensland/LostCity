"use client";

import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForTime } from "@/lib/css-utils";

type SkeletonVariant = "text" | "circle" | "rect" | "card";

type Props = {
  variant?: SkeletonVariant;
  className?: string;
  delay?: string;
  width?: string | number;
  height?: string | number;
};

const variantClasses: Record<SkeletonVariant, string> = {
  text: "rounded h-4",
  circle: "rounded-full",
  rect: "rounded-lg",
  card: "rounded-card",
};

export default function Skeleton({
  variant = "rect",
  className = "",
  delay,
  width,
  height,
}: Props) {
  const delayClass = delay
    ? createCssVarClassForTime("--skeleton-delay", delay, "skeleton-delay")
    : null;

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <>
      <ScopedStyles css={delayClass?.css} />
      <div
        className={`skeleton-shimmer ${variantClasses[variant]} ${delay ? "skeleton-delay" : ""} ${delayClass?.className ?? ""} ${className}`}
        style={Object.keys(style).length > 0 ? style : undefined}
      />
    </>
  );
}
