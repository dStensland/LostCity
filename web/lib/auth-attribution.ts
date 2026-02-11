import { createServiceClient } from "@/lib/supabase/service";
import { isValidPortalSlug } from "@/lib/auth-utils";

export async function attributeSignupToPortal(
  userId: string,
  portalSlug: string
): Promise<boolean> {
  if (!userId || !isValidPortalSlug(portalSlug)) {
    return false;
  }

  const serviceClient = createServiceClient();

  const { data: portal } = await serviceClient
    .from("portals")
    .select("id")
    .eq("slug", portalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!portal) {
    return false;
  }

  const portalId = (portal as { id: string }).id;

  const { error } = await (serviceClient as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => {
          is: (column: string, value: null) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  })
    .from("profiles")
    .update({
      signup_portal_id: portalId,
      signup_attributed_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .is("signup_portal_id", null);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
