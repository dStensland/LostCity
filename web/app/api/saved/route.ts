import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/saved
 * Check if an item is saved
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ saved: false }, { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    const venueId = searchParams.get("venue_id");

    if (!eventId && !venueId) {
      return NextResponse.json({ error: "Missing event_id or venue_id" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    let query = serviceClient
      .from("saved_items")
      .select("id")
      .eq("user_id", user.id);

    if (eventId) {
      query = query.eq("event_id", parseInt(eventId));
    } else if (venueId) {
      query = query.eq("venue_id", parseInt(venueId));
    }

    const { data } = await query.maybeSingle();

    return NextResponse.json({ saved: !!data });
  } catch (error) {
    console.error("Saved check API error:", error);
    return NextResponse.json({ saved: false }, { status: 200 });
  }
}

/**
 * POST /api/saved
 * Save an item
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { event_id, venue_id } = body;

    if (!event_id && !venue_id) {
      return NextResponse.json({ error: "Missing event_id or venue_id" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Ensure profile exists
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      // Create profile
      const username =
        user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") ||
        `user_${user.id.substring(0, 8)}`;

      await serviceClient.from("profiles").insert({
        id: user.id,
        username: username.substring(0, 30),
      } as never);
    }

    // Insert saved item
    const insertData: { user_id: string; event_id?: number; venue_id?: number } = {
      user_id: user.id,
    };

    if (event_id) insertData.event_id = event_id;
    if (venue_id) insertData.venue_id = venue_id;

    const { error } = await serviceClient
      .from("saved_items")
      .insert(insertData as never);

    if (error) {
      // Might be duplicate - that's OK
      if (error.code === "23505") {
        return NextResponse.json({ success: true, alreadySaved: true });
      }
      console.error("Save error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save API error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

/**
 * DELETE /api/saved
 * Remove a saved item
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    const venueId = searchParams.get("venue_id");

    if (!eventId && !venueId) {
      return NextResponse.json({ error: "Missing event_id or venue_id" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    let query = serviceClient
      .from("saved_items")
      .delete()
      .eq("user_id", user.id);

    if (eventId) {
      query = query.eq("event_id", parseInt(eventId));
    } else if (venueId) {
      query = query.eq("venue_id", parseInt(venueId));
    }

    const { error } = await query;

    if (error) {
      console.error("Unsave error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsave API error:", error);
    return NextResponse.json({ error: "Failed to unsave" }, { status: 500 });
  }
}
