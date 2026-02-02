import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isRecommended: false });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const venueId = searchParams.get("venueId");
  const organizationId = searchParams.get("organizationId");

  if (!eventId && !venueId && !organizationId) {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  try {
    let query = supabase
      .from("recommendations")
      .select("*")
      .eq("user_id", user.id);

    if (eventId) {
      query = query.eq("event_id", parseInt(eventId));
    } else if (venueId) {
      query = query.eq("venue_id", parseInt(venueId));
    } else if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Recommendation check error:", error);
      return NextResponse.json({ isRecommended: false, error: error.message });
    }

    const rec = data as { note?: string | null; visibility?: string | null } | null;

    return NextResponse.json({
      isRecommended: !!rec,
      note: rec?.note || "",
      visibility: rec?.visibility || "public",
    });
  } catch (err) {
    console.error("Recommendation check exception:", err);
    return NextResponse.json({ isRecommended: false, error: "Server error" });
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { eventId, venueId, organizationId, action, note, visibility } = body;

  if (!eventId && !venueId && !organizationId) {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  try {
    if (action === "remove") {
      let query = supabase
        .from("recommendations")
        .delete()
        .eq("user_id", user.id);

      if (eventId) {
        query = query.eq("event_id", eventId);
      } else if (venueId) {
        query = query.eq("venue_id", venueId);
      } else if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { error } = await query;

      if (error) {
        console.error("Remove recommendation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, isRecommended: false });
    } else {
      // Check if already exists
      let checkQuery = supabase
        .from("recommendations")
        .select("id")
        .eq("user_id", user.id);

      if (eventId) {
        checkQuery = checkQuery.eq("event_id", eventId);
      } else if (venueId) {
        checkQuery = checkQuery.eq("venue_id", venueId);
      } else if (organizationId) {
        checkQuery = checkQuery.eq("organization_id", organizationId);
      }

      const { data: existing } = await checkQuery.maybeSingle();

      if (existing) {
        // Update existing
        let updateQuery = supabase
          .from("recommendations")
          .update({ note: note || null, visibility: visibility || "public" } as never)
          .eq("user_id", user.id);

        if (eventId) {
          updateQuery = updateQuery.eq("event_id", eventId);
        } else if (venueId) {
          updateQuery = updateQuery.eq("venue_id", venueId);
        } else if (organizationId) {
          updateQuery = updateQuery.eq("organization_id", organizationId);
        }

        const { error } = await updateQuery;

        if (error) {
          console.error("Update recommendation error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        // Create new
        const recData: Record<string, unknown> = {
          user_id: user.id,
          note: note || null,
          visibility: visibility || "public",
        };

        if (eventId) {
          recData.event_id = eventId;
        } else if (venueId) {
          recData.venue_id = venueId;
        } else if (organizationId) {
          recData.organization_id = organizationId;
        }

        const { error } = await supabase.from("recommendations").insert(recData as never);

        if (error) {
          console.error("Create recommendation error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, isRecommended: true });
    }
  } catch (err) {
    console.error("Recommendation action exception:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
