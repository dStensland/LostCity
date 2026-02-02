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

// Validate URL format
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // Only allow http and https protocols
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

// Escape special characters for SQL ILIKE pattern matching
// Prevents SQL injection in Supabase .ilike() filters
export function escapeSQLPattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")  // Escape backslash first
    .replace(/%/g, "\\%")    // Escape wildcard %
    .replace(/_/g, "\\_");   // Escape single-char wildcard _
}

// Validation result type
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

// Safe error response that logs details server-side but returns generic message to clients
// Note: This is a legacy function. Consider using errorApiResponse() instead for new code.
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

// ============================================================================
// REQUEST BODY SIZE VALIDATION
// ============================================================================

/**
 * Check request body size to prevent DoS attacks via large payloads.
 * Should be called at the start of all POST/PATCH handlers.
 *
 * @param request - The incoming request
 * @param maxBytes - Maximum allowed body size in bytes (default: 10KB)
 * @returns NextResponse with 413 status if too large, null if OK
 */
export function checkBodySize(request: Request, maxBytes = 10240): NextResponse | null {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    // Note: Uses raw NextResponse since this is a pre-check before apiResponse is used
    // The actual API handler will add versioning headers to their response
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    );
  }
  return null;
}

// ============================================================================
// API VERSIONING & RESPONSE HELPERS
// ============================================================================

/**
 * Current API version
 * Increment when making breaking changes to API contracts
 */
export const API_VERSION = "1.0";

/**
 * Create a JSON response with API versioning headers
 *
 * @param data - Response data to send
 * @param init - Optional ResponseInit (status, headers, etc.)
 * @returns NextResponse with versioning headers
 *
 * @example
 * return apiResponse({ events: [] });
 * return apiResponse({ error: "Not found" }, { status: 404 });
 */
export function apiResponse<T = unknown>(
  data: T,
  init?: ResponseInit
): NextResponse<T> {
  const response = NextResponse.json(data, init);

  // Add API version header
  response.headers.set("X-API-Version", API_VERSION);

  // Add standard security headers for API responses
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}

/**
 * Create a successful API response with data
 *
 * @example
 * return successResponse({ events: [] });
 */
export function successResponse<T = unknown>(
  data: T,
  init?: Omit<ResponseInit, "status">
): NextResponse<T> {
  return apiResponse(data, { ...init, status: 200 });
}

/**
 * Create a created (201) API response
 *
 * @example
 * return createdResponse({ id: "123", name: "New Event" });
 */
export function createdResponse<T = unknown>(
  data: T,
  init?: Omit<ResponseInit, "status">
): NextResponse<T> {
  return apiResponse(data, { ...init, status: 201 });
}

/**
 * Create an error API response with versioning headers
 *
 * @example
 * return errorApiResponse("Not found", 404);
 * return errorApiResponse("Validation failed", 400);
 */
export function errorApiResponse(
  message: string,
  status: number = 500
): NextResponse<{ error: string }> {
  return apiResponse({ error: message }, { status });
}

/**
 * Create a validation error response (400 Bad Request)
 * This is a convenience wrapper around errorApiResponse for validation errors
 *
 * @example
 * if (!isValidEmail(email)) {
 *   return validationError("Invalid email address");
 * }
 */
export function validationError(message: string): NextResponse<{ error: string }> {
  return errorApiResponse(message, 400);
}
