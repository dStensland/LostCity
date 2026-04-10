import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
  const { order } = body;

  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: "order array required" }, { status: 400 });
  }

  // Batch update all sort_orders in a single transaction-like call
  const updates = order.map((item: { id: number; sort_order: number }) =>
    serviceClient
      .from("goblin_watchlist_entries")
      .update({ sort_order: item.sort_order } as never)
      .eq("id", item.id)
      .eq("user_id", user.id)
  );

  await Promise.all(updates);

  return NextResponse.json({ success: true });
});
