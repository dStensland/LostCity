"use client";

import { useMemo } from "react";
import { getCspNonce } from "@/lib/csp-nonce";

type Props = {
  css?: string | null;
};

export default function ScopedStyles({ css }: Props) {
  const isClient = typeof document !== "undefined";
  const nonce = useMemo(() => (isClient ? getCspNonce() : undefined), [isClient]);

  if (!css || !isClient) return null;

  return (
    <style
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
