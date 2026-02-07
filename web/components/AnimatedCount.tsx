"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCountProps {
  value: number;
  /** Format function (e.g. formatCompactCount). Defaults to String(). */
  format?: (n: number) => string;
  className?: string;
}

/**
 * Animated number counter with a slot-machine roll effect.
 * Old value rolls out, new value rolls in from the opposite side.
 */
export default function AnimatedCount({
  value,
  format = String,
  className = "",
}: AnimatedCountProps) {
  const prevRef = useRef(value);
  const [items, setItems] = useState([{ value, key: 0 }]);
  const keyRef = useRef(0);

  useEffect(() => {
    if (value === prevRef.current) return;
    prevRef.current = value;
    keyRef.current += 1;
    setItems((prev) => [...prev.slice(-1), { value, key: keyRef.current }]);
  }, [value]);

  // Determine if last transition was up or down
  const isUp = items.length > 1 && items[1].value > items[0].value;

  return (
    <span
      className={`inline-flex overflow-hidden relative align-baseline ${className}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map((item, i) => {
        const isOld = i === 0 && items.length > 1;
        const isNew = i === 1;

        let transform = "translateY(0)";
        let opacity = 1;

        if (isOld) {
          // Old value rolls out
          transform = isUp ? "translateY(-110%)" : "translateY(110%)";
          opacity = 0;
        } else if (isNew) {
          // New value is in place (entered from opposite side via initial CSS)
          transform = "translateY(0)";
          opacity = 1;
        }

        return (
          <span
            key={item.key}
            className={isOld ? "absolute inset-0" : ""}
            style={{
              display: "inline-block",
              transition: "transform 200ms ease-out, opacity 200ms ease-out",
              transform,
              opacity,
            }}
            onTransitionEnd={
              isOld
                ? () => setItems((prev) => prev.filter((p) => p.key !== item.key))
                : undefined
            }
          >
            {format(item.value)}
          </span>
        );
      })}
    </span>
  );
}
