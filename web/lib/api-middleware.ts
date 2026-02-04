import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

type AuthenticatedHandler = (
  request: NextRequest,
  context: {
    user: User;
    serviceClient: AnySupabaseClient;
    supabase: AnySupabaseClient;
  }
) => Promise<NextResponse | Response>;

/**
 * Wrap an API route handler with authentication.
 * Automatically verifies the user and provides both the user object
 * and a service client for database operations.
 *
 * @example
 * export const POST = withAuth(async (request, { user, serviceClient }) => {
 *   const body = await request.json();
 *   // Use user.id and serviceClient...
 *   return NextResponse.json({ success: true });
 * });
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    return handler(request, { user, serviceClient, supabase });
  };
}

// For routes that also need route params
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
 *     // Use user.id, params, and serviceClient...
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
