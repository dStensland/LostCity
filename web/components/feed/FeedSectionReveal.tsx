"use client";

import { ElementType, ReactNode, CSSProperties } from "react";
import { useInViewOnce } from "@/lib/hooks/useInViewOnce";

interface Props {
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export default function FeedSectionReveal({
  as: As = "section",
  className = "",
  style,
  children,
}: Props) {
  const { ref, inView } = useInViewOnce<HTMLElement>();
  const combined = `feed-section-enter${inView ? " is-visible" : ""}${
    className ? " " + className : ""
  }`;
  return (
    <As ref={ref} className={combined} style={style}>
      {children}
    </As>
  );
}
