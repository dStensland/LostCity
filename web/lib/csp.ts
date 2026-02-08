type CspOptions = {
  isDev?: boolean;
  allowInlineStyles?: boolean;
  reportUri?: string | null;
  includeUpgradeInsecureRequests?: boolean;
};

export function buildCsp(nonce: string, options: CspOptions = {}): string {
  const isDev = options.isDev ?? false;
  const allowInlineStyles = options.allowInlineStyles ?? true;
  const reportUri = options.reportUri ?? null;
  const includeUpgradeInsecureRequests = options.includeUpgradeInsecureRequests ?? true;

  const scriptSrcParts = [
    "'self'",
    `'nonce-${nonce}'`,
    "https://*.sentry.io",
    "https://*.supabase.co",
    "https://va.vercel-scripts.com",
    "https://sdk.canny.io",
  ];

  if (isDev) {
    scriptSrcParts.push("'unsafe-eval'");
  }

  const styleSrcParts = ["'self'", `'nonce-${nonce}'`, "https://fonts.googleapis.com"];
  if (allowInlineStyles) {
    styleSrcParts.push("'unsafe-inline'");
  }
  const styleSrcElemParts = ["'self'", "https://fonts.googleapis.com"];
  if (allowInlineStyles) {
    styleSrcElemParts.push("'unsafe-inline'");
  }
  const styleSrcAttrParts = allowInlineStyles ? ["'unsafe-inline'"] : ["'none'"];

  const fontSrcParts = ["'self'", "data:", "https://fonts.gstatic.com"];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrcParts.join(" ")}`,
    "script-src-attr 'none'",
    `style-src ${styleSrcParts.join(" ")}`,
    `style-src-elem ${styleSrcElemParts.join(" ")}`,
    `style-src-attr ${styleSrcAttrParts.join(" ")}`,
    "img-src 'self' data: blob: https:",
    `font-src ${fontSrcParts.join(" ")}`,
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.mapbox.com https://events.mapbox.com https://vitals.vercel-insights.com https://*.canny.io",
    "frame-ancestors 'none'",
    "frame-src https://*.canny.io",
    "object-src 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "worker-src 'self' blob:",
    includeUpgradeInsecureRequests ? "upgrade-insecure-requests" : null,
    reportUri ? `report-uri ${reportUri}` : null,
  ].filter(Boolean) as string[];

  return directives.join("; ");
}
