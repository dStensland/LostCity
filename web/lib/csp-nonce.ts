export function getCspNonce(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const meta = document.querySelector('meta[name="csp-nonce"]');
  const nonce = meta?.getAttribute("content") || "";
  return nonce || undefined;
}
