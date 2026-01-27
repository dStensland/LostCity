import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity_type, entity_id, message } = body;

    // Validate required fields
    if (!entity_type || !entity_id || !message) {
      return NextResponse.json(
        { error: "Missing required fields: entity_type, entity_id, message" },
        { status: 400 }
      );
    }

    // Validate entity_type
    if (!["event", "venue", "producer"].includes(entity_type)) {
      return NextResponse.json(
        { error: "Invalid entity_type. Must be: event, venue, or producer" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user (optional - flags can be anonymous)
    const { data: { user } } = await supabase.auth.getUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("flags")
      .insert({
        entity_type,
        entity_id: parseInt(entity_id, 10),
        message: message.trim(),
        user_id: user?.id || null,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error("Flag creation error:", error);
      return NextResponse.json(
        { error: "Failed to create flag" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, flag: data });
  } catch (error) {
    console.error("Flag API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check if an entity has been flagged (for showing indicator)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entity_type = searchParams.get("entity_type");
  const entity_id = searchParams.get("entity_id");

  if (!entity_type || !entity_id) {
    return NextResponse.json(
      { error: "Missing entity_type or entity_id" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("flags")
    .select("id, status")
    .eq("entity_type", entity_type)
    .eq("entity_id", parseInt(entity_id, 10))
    .eq("status", "pending");

  if (error) {
    console.error("Flag lookup error:", error);
    return NextResponse.json({ flagged: false, count: 0 });
  }

  return NextResponse.json({
    flagged: data.length > 0,
    count: data.length,
  });
}
