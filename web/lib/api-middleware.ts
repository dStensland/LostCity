import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodType, ZodError } from "zod";
import { validationError } from "@/lib/api-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export type ValidationSchemas = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: ZodType<any, any, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: ZodType<any, any, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: ZodType<any, any, any>;
};

// Maps schema keys to their inferred output types
type InferValidated<S extends ValidationSchemas> = {
  [K in keyof S]: S[K] extends ZodType ? import("zod").infer<S[K]> : never;
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

type ParseResult<S extends ValidationSchemas> =
  | { validated: InferValidated<S>; error: null }
  | { validated: null; error: NextResponse };

async function parseAndValidate<S extends ValidationSchemas>(
  request: NextRequest,
  schemas: S
): Promise<ParseResult<S>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validated: Record<string, any> = {};

  // Validate query params
  if (schemas.query) {
    const { searchParams } = new URL(request.url);
    const queryObj: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryObj[key] = value;
    });

    const result = schemas.query.safeParse(queryObj);
    if (!result.success) {
      return {
        validated: null,
        error: validationError(formatZodError(result.error)),
      };
    }
    validated.query = result.data;
  }

  // Validate request body
  if (schemas.body) {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return {
        validated: null,
        error: validationError("Invalid JSON body"),
      };
    }

    const result = schemas.body.safeParse(rawBody);
    if (!result.success) {
      return {
        validated: null,
        error: validationError(formatZodError(result.error)),
      };
    }
    validated.body = result.data;
  }

  // params are handled via withAuthAndParams — no-op here
  // (route params come through the Next.js params Promise, not the request)

  return { validated: validated as InferValidated<S>, error: null };
}

// ============================================================================
// AUTH CONTEXT TYPES
// ============================================================================

type AuthContext = {
  user: User;
  serviceClient: AnySupabaseClient;
  supabase: AnySupabaseClient;
};

type AuthContextWithValidation<S extends ValidationSchemas> = AuthContext & {
  validated: InferValidated<S>;
};

// ============================================================================
// withAuth — overloaded: with schemas or without (backward compat)
// ============================================================================

type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse | Response>;

type AuthenticatedHandlerWithValidation<S extends ValidationSchemas> = (
  request: NextRequest,
  context: AuthContextWithValidation<S>
) => Promise<NextResponse | Response>;

/**
 * Wrap an API route handler with authentication.
 * Automatically verifies the user and provides both the user object
 * and a service client for database operations.
 *
 * Overload 1 — backward compat (no schemas):
 * @example
 * export const POST = withAuth(async (request, { user, serviceClient }) => {
 *   const body = await request.json();
 *   return NextResponse.json({ success: true });
 * });
 *
 * Overload 2 — with Zod validation (auth runs first, validation second):
 * @example
 * const BodySchema = z.object({ event_id: z.number(), status: z.enum(["going"]) });
 * export const POST = withAuth({ body: BodySchema }, async (request, { user, validated }) => {
 *   const { event_id, status } = validated.body;
 *   return NextResponse.json({ success: true });
 * });
 */
export function withAuth(handler: AuthenticatedHandler): (request: NextRequest) => Promise<NextResponse | Response>;
export function withAuth<S extends ValidationSchemas>(
  schemas: S,
  handler: AuthenticatedHandlerWithValidation<S>
): (request: NextRequest) => Promise<NextResponse | Response>;
export function withAuth<S extends ValidationSchemas>(
  schemasOrHandler: S | AuthenticatedHandler,
  maybeHandler?: AuthenticatedHandlerWithValidation<S>
): (request: NextRequest) => Promise<NextResponse | Response> {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    // Auth runs first — always returns 401 before any validation
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Overload dispatch
    if (typeof schemasOrHandler === "function") {
      // No-schema path — backward compat
      return schemasOrHandler(request, { user, serviceClient, supabase });
    }

    // Schema path — validate after auth
    const schemas = schemasOrHandler;
    const handler = maybeHandler!;

    const parseResult = await parseAndValidate(request, schemas);
    if (parseResult.error) {
      return parseResult.error;
    }

    return handler(request, {
      user,
      serviceClient,
      supabase,
      validated: parseResult.validated,
    });
  };
}

// ============================================================================
// withAuthAndParams — unchanged
// ============================================================================

type AuthenticatedHandlerWithParams<T> = (
  request: NextRequest,
  context: {
    user: User;
    serviceClient: AnySupabaseClient;
    supabase: AnySupabaseClient;
    params: T;
  }
) => Promise<NextResponse | Response>;

/**
 * Wrap an API route handler with authentication and dynamic params.
 * Automatically verifies the user, resolves params, and provides both
 * the user object and a service client for database operations.
 *
 * @example
 * export const GET = withAuthAndParams<{ id: string }>(
 *   async (request, { user, serviceClient, params }) => {
 *     const itemId = params.id;
 *     return NextResponse.json({ success: true });
 *   }
 * );
 */
export function withAuthAndParams<T>(handler: AuthenticatedHandlerWithParams<T>) {
  return async (request: NextRequest, { params }: { params: Promise<T> }): Promise<NextResponse | Response> => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const resolvedParams = await params;

    return handler(request, { user, serviceClient, supabase, params: resolvedParams });
  };
}

// ============================================================================
// withOptionalAuth — unchanged
// ============================================================================

/**
 * Optional auth wrapper - returns user if authenticated, null otherwise.
 * Does not return 401 - useful for routes that have different behavior
 * for authenticated vs anonymous users.
 *
 * @example
 * export const GET = withOptionalAuth(async (request, { user, serviceClient }) => {
 *   if (user) {
 *     // Show personalized data
 *   } else {
 *     // Show public data
 *   }
 *   return NextResponse.json({ data });
 * });
 */
export function withOptionalAuth(
  handler: (
    request: NextRequest,
    context: {
      user: User | null;
      serviceClient: AnySupabaseClient | null;
      supabase: AnySupabaseClient;
    }
  ) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Only create serviceClient when user is authenticated
    const serviceClient = !authError && user ? createServiceClient() : null;

    return handler(request, {
      user: authError || !user ? null : user,
      serviceClient,
      supabase,
    });
  };
}

// ============================================================================
// withValidation — public (unauthenticated) routes with Zod validation
// ============================================================================

type PublicValidatedHandler<S extends ValidationSchemas> = (
  request: NextRequest,
  context: { validated: InferValidated<S> }
) => Promise<NextResponse | Response>;

/**
 * Wrap a public (unauthenticated) API route handler with Zod validation.
 * No auth check — 400 on invalid input, handler receives typed `validated` context.
 *
 * @example
 * const QuerySchema = z.object({ q: z.string().min(1) });
 * export const GET = withValidation({ query: QuerySchema }, async (request, { validated }) => {
 *   const { q } = validated.query;
 *   return NextResponse.json({ results: [] });
 * });
 */
export function withValidation<S extends ValidationSchemas>(
  schemas: S,
  handler: PublicValidatedHandler<S>
): (request: NextRequest) => Promise<NextResponse | Response> {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    const parseResult = await parseAndValidate(request, schemas);
    if (parseResult.error) {
      return parseResult.error;
    }

    return handler(request, { validated: parseResult.validated });
  };
}
