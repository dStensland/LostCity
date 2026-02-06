export function sanitizeCssColor(value: string): string | null {
  if (!value || typeof value !== "string") return null;

  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  if (/^[a-zA-Z]{3,20}$/.test(value)) return value;
  if (/^var\\(--[a-zA-Z0-9-_]+\\)$/.test(value)) return value;
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
