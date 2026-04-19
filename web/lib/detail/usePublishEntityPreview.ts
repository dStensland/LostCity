"use client";

import { useEffect, useMemo } from "react";
import {
  publishEntityPreview,
  type EntityRef,
  type SeedPayload,
} from "./entity-preview-store";

/**
 * Publish an overlay seed payload for this entity whenever the payload content
 * changes. Safe to call unconditionally — if `ref` or `payload` is null
 * (card rendered with partial data), the hook no-ops.
 *
 * Card components call this. The overlay router reads via `peekEntityPreview`.
 */
export function usePublishEntityPreview(
  ref: EntityRef | null,
  payload: SeedPayload | null,
): void {
  // Memoize a stable content-dependency key. JSON.stringify is cheap for these
  // small payloads (< 1KB), and re-publishing on identical content would be a
  // waste; we only want to refresh the TTL on genuinely-changed data.
  const depKey = useMemo(
    () => (ref && payload ? JSON.stringify(payload) : null),
    [ref, payload],
  );

  useEffect(() => {
    if (!ref || !payload) return;
    publishEntityPreview(ref, payload);
    // Intentionally depending on depKey + ref — not payload identity, which
    // changes on every parent render even when content is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, depKey]);
}
