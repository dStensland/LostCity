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

const STATIC_IMG_SRC = [
  "'self'",
  "data:",
  "blob:",
  // Supabase storage
  "https://*.supabase.co",
  // Event platforms
  "https://img.evbuc.com",
  "https://cdn.evbuc.com",
  "https://s1.ticketm.net",
  "https://s1.ticketmaster.com",
  // Image CDNs
  "https://images.unsplash.com",
  "https://res.cloudinary.com",
  "https://i.imgur.com",
  "https://static.imgix.net",
  "https://indy-systems.imgix.net",
  // Media databases
  "https://image.tmdb.org",
  "https://upload.wikimedia.org",
  "https://user-images.githubusercontent.com",
  // Venue sites
  "https://529atlanta.com",
  "https://www.bigpeachrunningco.com",
  "https://static.wixstatic.com",
  "https://www.spelman.edu",
  "https://www.aso.org",
  "https://admin.paintingwithatwist.com",
  "https://14d14a1b70be1f7f7d4a-0863ae42a3340022d3e557e78745c047.ssl.cf5.rackcdn.com",
  "https://images.squarespace-cdn.com",
  "https://static1.squarespace.com",
  "https://*.squarespace.com",
  "https://www.foxtheatre.org",
  "https://www.dadsgaragetheatre.com",
  "https://alliancetheatre.org",
  "https://high.org",
  "https://atlantahistorycenter.com",
  "https://www.atlantabg.org",
  "https://centerstage.net",
  // Mapbox
  "https://*.tiles.mapbox.com",
  // Google Places photos
  "https://maps.googleapis.com",
  "https://lh3.googleusercontent.com",
].join(" ");

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

  const styleSrc = `style-src ${STATIC_STYLE_SRC_BASE} 'nonce-${nonce}'${allowInlineStyles ? " 'unsafe-inline'" : ""}`;
  const styleSrcElem = `style-src-elem ${STATIC_STYLE_SRC_BASE} 'nonce-${nonce}'${allowInlineStyles ? " 'unsafe-inline'" : ""}`;
  const styleSrcAttr = `style-src-attr ${allowInlineStyles ? "'unsafe-inline'" : "'none'"}`;

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
