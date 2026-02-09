/**
 * Sanitize a CSS color value to prevent injection attacks.
 * Blocks dangerous CSS constructs like url(), @import, expression(), etc.
 * Only allows: hex colors, named colors, CSS variables, and rgb/hsl functions.
 */
export function sanitizeCssColor(value: string): string | null {
  if (!value || typeof value !== "string") return null;

  // Block dangerous CSS constructs (case-insensitive)
  const dangerousPatterns = [
    /url\(/i,           // Can load external resources
    /@import/i,         // Can load external stylesheets
    /expression\(/i,    // IE-specific JavaScript execution
    /-moz-binding/i,    // Firefox XBL binding
    /behavior:/i,       // IE-specific behavior
    /javascript:/i,     // JavaScript protocol
    /vbscript:/i,       // VBScript protocol
    /<script/i,         // Script tag injection
    /on\w+=/i,          // Event handler attributes
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(value)) {
      console.warn(`[CSS Sanitization] Blocked dangerous CSS value: ${value}`);
      return null;
    }
  }

  // Allow only safe CSS color formats
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  if (/^[a-zA-Z]{3,20}$/.test(value)) return value;
  if (/^var\(--[a-zA-Z0-9-_]+\)$/.test(value)) return value;
  if (/^(rgb|hsl)a?\(\s*[0-9.,\s%]+\s*\)$/.test(value)) return value;

  return null;
}

export function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createCssVarClass(
  varName: `--${string}`,
  value: string,
  prefix: string
): { className: string; css: string } | null {
  const safeValue = sanitizeCssColor(value);
  if (!safeValue) return null;

  const className = `${prefix}-${hashString(`${varName}:${safeValue}`)}`;
  return { className, css: `.${className}{${varName}:${safeValue};}` };
}

export function sanitizeCssTime(value: string): string | null {
  if (!value || typeof value !== "string") return null;
  if (/^-?\d+(?:\.\d+)?ms$/.test(value)) return value;
  if (/^-?\d+(?:\.\d+)?s$/.test(value)) return value;
  return null;
}

export function createCssVarClassForTime(
  varName: `--${string}`,
  value: string,
  prefix: string
): { className: string; css: string } | null {
  const safeValue = sanitizeCssTime(value);
  if (!safeValue) return null;

  const className = `${prefix}-${hashString(`${varName}:${safeValue}`)}`;
  return { className, css: `.${className}{${varName}:${safeValue};}` };
}

export function sanitizeCssLength(value: string): string | null {
  if (!value || typeof value !== "string") return null;
  if (value === "0") return value;
  if (/^-?\d+(?:\.\d+)?(px|%|rem|em|vh|vw)$/.test(value)) return value;
  return null;
}

export function createCssVarClassForLength(
  varName: `--${string}`,
  value: string,
  prefix: string
): { className: string; css: string } | null {
  const safeValue = sanitizeCssLength(value);
  if (!safeValue) return null;

  const className = `${prefix}-${hashString(`${varName}:${safeValue}`)}`;
  return { className, css: `.${className}{${varName}:${safeValue};}` };
}

export function sanitizeCssNumber(value: string): string | null {
  if (!value || typeof value !== "string") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  return null;
}

export function createCssVarClassForNumber(
  varName: `--${string}`,
  value: string,
  prefix: string
): { className: string; css: string } | null {
  const safeValue = sanitizeCssNumber(value);
  if (!safeValue) return null;

  const className = `${prefix}-${hashString(`${varName}:${safeValue}`)}`;
  return { className, css: `.${className}{${varName}:${safeValue};}` };
}

/**
 * Sanitize arbitrary CSS strings to prevent injection attacks.
 * This is a comprehensive filter that blocks all known dangerous CSS constructs.
 *
 * WARNING: This function strips dangerous content but does NOT guarantee the CSS
 * will be valid. Use this as a defense-in-depth layer when you must accept CSS
 * from untrusted sources (e.g., database content).
 *
 * RECOMMENDED: Always prefer constructing CSS server-side from validated,
 * type-safe values rather than accepting raw CSS strings from the database.
 *
 * @param css - Raw CSS string (potentially from database or user input)
 * @returns Sanitized CSS string with dangerous constructs removed, or null if empty
 */
export function sanitizeCssString(css: string): string | null {
  if (!css || typeof css !== "string") return null;

  // Remove dangerous CSS constructs that could execute code or load external resources
  let sanitized = css;

  // Remove url() - can load external resources or data URIs with scripts
  sanitized = sanitized.replace(/url\s*\([^)]*\)/gi, '');

  // Remove @import - loads external stylesheets
  sanitized = sanitized.replace(/@import[^;]+;/gi, '');

  // Remove expression() - IE-specific JS execution
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');

  // Remove -moz-binding - Firefox XBL binding (can execute JS)
  sanitized = sanitized.replace(/-moz-binding\s*:[^;]+;/gi, '');

  // Remove behavior - IE-specific behavior property
  sanitized = sanitized.replace(/behavior\s*:[^;]+;/gi, '');

  // Remove javascript: and vbscript: protocols
  sanitized = sanitized.replace(/(javascript|vbscript)\s*:/gi, '');

  // Remove any embedded HTML/script tags
  // Use [\s\S] instead of . with /s flag for ES5 compatibility
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  // Remove event handler attributes (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  // If everything was stripped, return null
  const trimmed = sanitized.trim();
  return trimmed.length > 0 ? trimmed : null;
}
