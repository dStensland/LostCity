import { NextResponse } from "next/server";

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

// UUID v4 format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// Validate string with length constraints
export function isValidString(
  value: unknown,
  minLength = 1,
  maxLength = 1000
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minLength &&
    value.length <= maxLength
  );
}

// Validate positive integer
export function isValidPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// Parse and validate a numeric query parameter
// Returns the parsed number or null if invalid
export function parseIntParam(value: string | null, defaultValue?: number): number | null {
  if (value === null || value === "") {
    return defaultValue ?? null;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return null;
  }
  return parsed;
}

// Parse and validate a float query parameter
export function parseFloatParam(value: string | null, defaultValue?: number): number | null {
  if (value === null || value === "") {
    return defaultValue ?? null;
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return null;
  }
  return parsed;
}

// Validate enum value
export function isValidEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return typeof value === "string" && allowedValues.includes(value as T);
}

// Validate array of strings
export function isValidStringArray(
  value: unknown,
  maxItems = 100,
  maxItemLength = 100
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isValidString(item, 1, maxItemLength))
  );
}

// Sanitize string input (basic XSS prevention)
export function sanitizeString(value: string): string {
  return value
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

// Validation result type
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

// Create a validation error response
export function validationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

// Safe error response that logs details server-side but returns generic message to clients
export function errorResponse(
  error: unknown,
  context: string,
  statusCode = 500
): NextResponse {
  // Log the full error server-side for debugging
  console.error(`API Error [${context}]:`, error);

  // Return generic message to client (no internal details)
  const message = statusCode === 500
    ? "An internal error occurred"
    : statusCode === 404
    ? "Resource not found"
    : statusCode === 403
    ? "Access denied"
    : statusCode === 401
    ? "Authentication required"
    : statusCode === 400
    ? "Invalid request"
    : "An error occurred";

  return NextResponse.json({ error: message }, { status: statusCode });
}

// For admin routes, we can show more details since these are authenticated admin users
export function adminErrorResponse(
  error: unknown,
  context: string,
  statusCode = 500
): NextResponse {
  console.error(`Admin API Error [${context}]:`, error);

  // For admins, show the error type but not full SQL/system details
  const errorMessage = error instanceof Error
    ? error.message.replace(/\b(password|secret|key|token)\b/gi, "[REDACTED]")
    : "An error occurred";

  return NextResponse.json({ error: errorMessage }, { status: statusCode });
}
