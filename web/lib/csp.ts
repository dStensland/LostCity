type CspOptions = {
  isDev?: boolean;
  allowInlineStyles?: boolean;
  reportUri?: string | null;
  includeUpgradeInsecureRequests?: boolean;
};

// PERFORMANCE OPTIMIZATION: Pre-compute static CSP parts at module load time
// Only inject the nonce at request time to avoid rebuilding the entire policy

// Static parts that don't change per request
const STATIC_SCRIPT_SRC_BASE = [
  "'self'",
  "https://*.sentry.io",
  "https://*.supabase.co",
  "https://va.vercel-scripts.com",
  "https://sdk.canny.io",
].join(" ");

const STATIC_STYLE_SRC_BASE = ["'self'", "https://fonts.googleapis.com"].join(" ");
const STATIC_FONT_SRC = ["'self'", "data:", "https://fonts.gstatic.com"].join(" ");

// img-src: Allow any HTTPS image. We pull event/venue images from 500+ domains
// (venue websites, ticketing platforms, CDNs, Google Places, etc.) and maintaining
// an allowlist breaks images silently every time a new crawler is added.
// The security value of img-src restrictions is minimal — script-src and
// frame-ancestors are the directives that actually prevent XSS/clickjacking.
const STATIC_IMG_SRC = "'self' data: blob: https:";

const STATIC_CONNECT_SRC = "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://vitals.vercel-insights.com https://*.canny.io";

const STATIC_DIRECTIVES_BASE = [
  "default-src 'self'",
  "script-src-attr 'none'",
  STATIC_CONNECT_SRC,
  "frame-ancestors 'none'",
  "frame-src https://*.canny.io",
  "object-src 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "worker-src 'self' blob:",
].join("; ");

export function buildCsp(nonce: string, options: CspOptions = {}): string {
  const isDev = options.isDev ?? false;
  // Default to false in production for better security. Tailwind doesn't need unsafe-inline.
  // Nonce-based styles (via ScopedStyles/ScopedStylesServer) work without unsafe-inline.
  const allowInlineStyles = options.allowInlineStyles ?? false;
  const reportUri = options.reportUri ?? null;
  const includeUpgradeInsecureRequests = options.includeUpgradeInsecureRequests ?? true;

  // Build dynamic parts (only nonce and conditional flags)
  // Note: 'unsafe-inline' is needed because Next.js streaming injects inline <script>
  // tags ($RC, $RS, __next_f) without nonce attributes. 'unsafe-inline' is ignored by
  // browsers when a nonce is present, so we must omit the nonce from script-src.
  // Style nonces still work because Next.js does add nonces to <style> tags.
  const scriptSrc = `script-src ${STATIC_SCRIPT_SRC_BASE} 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;

  // In development, toolchains/devtools inject <style> tags without a nonce.
  // A nonce + 'unsafe-inline' still blocks them (unsafe-inline is ignored when nonce exists),
  // so we switch to an inline-friendly policy only in dev.
  const styleSrc = isDev
    ? `style-src ${STATIC_STYLE_SRC_BASE} 'unsafe-inline'`
    : `style-src ${STATIC_STYLE_SRC_BASE} 'nonce-${nonce}'${allowInlineStyles ? " 'unsafe-inline'" : ""}`;
  const styleSrcElem = isDev
    ? `style-src-elem ${STATIC_STYLE_SRC_BASE} 'unsafe-inline'`
    : `style-src-elem ${STATIC_STYLE_SRC_BASE} 'nonce-${nonce}'${allowInlineStyles ? " 'unsafe-inline'" : ""}`;
  // Always allow inline style attributes — React components use style={{ }} extensively
  // (Mapbox, skeletons, progress bars, dynamic layouts). style-src-attr doesn't enable
  // script execution, so 'unsafe-inline' here has minimal security impact.
  const styleSrcAttr = "style-src-attr 'unsafe-inline'";

  const imgSrc = `img-src ${STATIC_IMG_SRC}`;
  const fontSrc = `font-src ${STATIC_FONT_SRC}`;

  // Assemble final policy with dynamic parts
  const directives = [
    STATIC_DIRECTIVES_BASE,
    scriptSrc,
    styleSrc,
    styleSrcElem,
    styleSrcAttr,
    imgSrc,
    fontSrc,
    includeUpgradeInsecureRequests ? "upgrade-insecure-requests" : null,
    reportUri ? `report-uri ${reportUri}` : null,
  ].filter(Boolean) as string[];

  return directives.join("; ");
}
