import { isAdmin, canManagePortal } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getPortalSubscriptions,
  getAvailableSourcesToSubscribe,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  refreshPortalSourceAccess,
} from "@/lib/federation";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// GET /api/admin/portals/[id]/subscriptions - Get portal subscriptions
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  // Verify user can manage this portal
  if (!(await canManagePortal(id)) && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createServiceClient();

  // Verify portal exists
  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select("id, slug, name")
    .eq("id", id)
    .maybeSingle();

  if (portalError || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Get current subscriptions
  const subscriptions = await getPortalSubscriptions(id);

  // Get available sources to subscribe to
  const availableSources = await getAvailableSourcesToSubscribe(id);

  return NextResponse.json({
    portal,
    subscriptions,
    availableSources,
  });
}

// POST /api/admin/portals/[id]/subscriptions - Create a subscription
export async function POST(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  // Verify user can manage this portal
  if (!(await canManagePortal(id)) && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createServiceClient();

  // Verify portal exists
  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (portalError || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const body = await request.json();
  const { source_id, subscription_scope, subscribed_categories } = body;

  // Validate source_id
  if (typeof source_id !== "number") {
    return NextResponse.json({ error: "Invalid source_id" }, { status: 400 });
  }

  // Verify source exists and is shared
  const { data: sharingRuleData, error: sharingError } = await supabase
    .from("source_sharing_rules")
    .select("share_scope, allowed_categories, owner_portal_id")
    .eq("source_id", source_id)
    .maybeSingle();

  const sharingRule = sharingRuleData as {
    share_scope: string;
    allowed_categories: string[] | null;
    owner_portal_id: string;
  } | null;

  if (sharingError || !sharingRule || sharingRule.share_scope === "none") {
    return NextResponse.json({ error: "Source is not available for subscription" }, { status: 400 });
  }

  // Cannot subscribe to your own source
  if (sharingRule.owner_portal_id === id) {
    return NextResponse.json({ error: "Cannot subscribe to your own source" }, { status: 400 });
  }

  // Validate subscription_scope
  const scope = subscription_scope || "all";
  if (!["all", "selected"].includes(scope)) {
    return NextResponse.json({ error: "Invalid subscription_scope" }, { status: 400 });
  }

  // Validate subscribed_categories when scope is 'selected'
  if (scope === "selected") {
    if (!Array.isArray(subscribed_categories) || subscribed_categories.length === 0) {
      return NextResponse.json(
        { error: "subscribed_categories required when scope is 'selected'" },
        { status: 400 }
      );
    }

    // Verify categories are within allowed categories
    if (sharingRule.share_scope === "selected") {
      const allowedCats = sharingRule.allowed_categories || [];
      const invalidCategories = subscribed_categories.filter(
        (cat: string) => !allowedCats.includes(cat)
      );
      if (invalidCategories.length > 0) {
        return NextResponse.json(
          { error: `Categories not available: ${invalidCategories.join(", ")}` },
          { status: 400 }
        );
      }
    }
  }

  const result = await createSubscription(
    id,
    source_id,
    scope,
    scope === "selected" ? subscribed_categories : null
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Refresh the materialized view
  await refreshPortalSourceAccess();

  return NextResponse.json({ success: true });
}

// PATCH /api/admin/portals/[id]/subscriptions - Update a subscription
export async function PATCH(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  // Verify user can manage this portal
  if (!(await canManagePortal(id)) && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { subscription_id, subscription_scope, subscribed_categories, is_active } = body;

  if (!subscription_id || typeof subscription_id !== "string") {
    return NextResponse.json({ error: "subscription_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify subscription belongs to this portal
  const { data: subscriptionData, error: subError } = await supabase
    .from("source_subscriptions")
    .select("id, subscriber_portal_id")
    .eq("id", subscription_id)
    .maybeSingle();

  const subscription = subscriptionData as {
    id: string;
    subscriber_portal_id: string;
  } | null;

  if (subError || !subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  if (subscription.subscriber_portal_id !== id) {
    return NextResponse.json({ error: "Subscription does not belong to this portal" }, { status: 403 });
  }

  const updates: {
    subscriptionScope?: "all" | "selected";
    subscribedCategories?: string[] | null;
    isActive?: boolean;
  } = {};

  if (subscription_scope !== undefined) {
    if (!["all", "selected"].includes(subscription_scope)) {
      return NextResponse.json({ error: "Invalid subscription_scope" }, { status: 400 });
    }
    updates.subscriptionScope = subscription_scope;
  }

  if (subscribed_categories !== undefined) {
    updates.subscribedCategories = subscribed_categories;
  }

  if (is_active !== undefined) {
    updates.isActive = is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const result = await updateSubscription(subscription_id, updates);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Refresh the materialized view
  await refreshPortalSourceAccess();

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/portals/[id]/subscriptions - Delete a subscription
export async function DELETE(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  // Verify user can manage this portal
  if (!(await canManagePortal(id)) && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const subscriptionId = searchParams.get("subscription_id");

  if (!subscriptionId) {
    return NextResponse.json({ error: "subscription_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify subscription belongs to this portal
  const { data: subscriptionData2, error: subError2 } = await supabase
    .from("source_subscriptions")
    .select("id, subscriber_portal_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  const subscription2 = subscriptionData2 as {
    id: string;
    subscriber_portal_id: string;
  } | null;

  if (subError2 || !subscription2) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  if (subscription2.subscriber_portal_id !== id) {
    return NextResponse.json({ error: "Subscription does not belong to this portal" }, { status: 403 });
  }

  const result = await deleteSubscription(subscriptionId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Refresh the materialized view
  await refreshPortalSourceAccess();

  return NextResponse.json({ success: true });
}
