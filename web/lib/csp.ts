type CspOptions = {
  isDev?: boolean;
  allowInlineStyles?: boolean;
  reportUri?: string | null;
  includeUpgradeInsecureRequests?: boolean;
};

export function buildCsp(nonce: string, options: CspOptions = {}): string {
  const isDev = options.isDev ?? false;
  // Default to false in production for better security. Tailwind doesn't need unsafe-inline.
  // Nonce-based styles (via ScopedStyles/ScopedStylesServer) work without unsafe-inline.
  const allowInlineStyles = options.allowInlineStyles ?? false;
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
  // Add nonce to style-src-elem for <style> tags with nonces
  const styleSrcElemParts = ["'self'", `'nonce-${nonce}'`, "https://fonts.googleapis.com"];
  if (allowInlineStyles) {
    styleSrcElemParts.push("'unsafe-inline'");
  }
  const styleSrcAttrParts = allowInlineStyles ? ["'unsafe-inline'"] : ["'none'"];

  const fontSrcParts = ["'self'", "data:", "https://fonts.gstatic.com"];

  // Restrict img-src to specific known domains instead of https: wildcard
  // Based on Next.js image remotePatterns configuration
  const imgSrcParts = [
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
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrcParts.join(" ")}`,
    "script-src-attr 'none'",
    `style-src ${styleSrcParts.join(" ")}`,
    `style-src-elem ${styleSrcElemParts.join(" ")}`,
    `style-src-attr ${styleSrcAttrParts.join(" ")}`,
    `img-src ${imgSrcParts.join(" ")}`,
    `font-src ${fontSrcParts.join(" ")}`,
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://vitals.vercel-insights.com https://*.canny.io",
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
