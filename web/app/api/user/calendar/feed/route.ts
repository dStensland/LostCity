import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createHmac } from "crypto";
import { format, addMonths } from "date-fns";

// Generate a secure token for calendar feed URL
// Token = HMAC-SHA256(userId, secret)
// IMPORTANT: CALENDAR_FEED_SECRET must be set in environment for security
function generateFeedToken(userId: string): string {
  const secret = process.env.CALENDAR_FEED_SECRET;
  if (!secret) {
    // In development, use a fallback but log a warning
    if (process.env.NODE_ENV === "development") {
      console.warn("CALENDAR_FEED_SECRET not set - using development fallback. Set this in production!");
      return createHmac("sha256", "dev-calendar-secret-do-not-use-in-prod").update(userId).digest("hex").slice(0, 32);
    }
    // In production, this should fail - calendar feeds won't work without proper secret
    throw new Error("CALENDAR_FEED_SECRET environment variable is required");
  }
  return createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32);
}

// Verify token and extract userId
function verifyFeedToken(token: string, userId: string): boolean {
  const expectedToken = generateFeedToken(userId);
  return token === expectedToken;
}

// Format date for iCal (YYYYMMDDTHHMMSSZ)
function formatICalDate(date: string, time: string | null, isAllDay: boolean): string {
  const d = new Date(date);
  if (isAllDay || !time) {
    // All-day events use date only format
    return format(d, "yyyyMMdd");
  }
  const [hours, minutes] = time.split(":");
  d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
  return format(d, "yyyyMMdd'T'HHmmss");
}

// Escape special characters for iCal text fields
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const userId = searchParams.get("uid");

  let authenticatedUserId: string | null = null;

  // Try token-based auth first (for calendar subscriptions)
  if (token && userId) {
    if (verifyFeedToken(token, userId)) {
      authenticatedUserId = userId;
    } else {
      return new Response("Invalid token", { status: 401 });
    }
  } else {
    // Fall back to session auth (for testing/direct access)
    const user = await getUser();
    if (user) {
      authenticatedUserId = user.id;
    }
  }

  if (!authenticatedUserId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Use service client to bypass RLS for token-based auth
    const supabase = token ? createServiceClient() : await createClient();

    // Get events for the next 6 months
    const startDate = format(new Date(), "yyyy-MM-dd");
    const endDate = format(addMonths(new Date(), 6), "yyyy-MM-dd");

    // Type for RSVP query result
    type FeedRsvpRow = {
      status: string;
      event: {
        id: number;
        title: string;
        start_date: string;
        start_time: string | null;
        end_date: string | null;
        end_time: string | null;
        is_all_day: boolean;
        description: string | null;
        source_url: string | null;
        venue: {
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
        } | null;
      };
    };

    // Fetch user's "going" RSVPs
    const { data: rsvps, error } = await supabase
      .from("event_rsvps")
      .select(`
        status,
        event:events!inner(
          id,
          title,
          start_date,
          start_time,
          end_date,
          end_time,
          is_all_day,
          description,
          source_url,
          venue:venues!left(
            name,
            address,
            city,
            state
          )
        )
      `)
      .eq("user_id", authenticatedUserId)
      .eq("status", "going")
      .gte("event.start_date", startDate)
      .lte("event.start_date", endDate) as { data: FeedRsvpRow[] | null; error: Error | null };

    if (error) {
      console.error("Error fetching calendar feed events:", error);
      return new Response("Failed to fetch events", { status: 500 });
    }

    // Generate iCal content
    const events = (rsvps || []).map((rsvp) => {
      const event = rsvp.event;

      const location = event.venue
        ? [event.venue.name, event.venue.address, event.venue.city && event.venue.state ? `${event.venue.city}, ${event.venue.state}` : event.venue.city || event.venue.state]
            .filter(Boolean)
            .join(", ")
        : "";

      const startDt = formatICalDate(event.start_date, event.start_time, event.is_all_day);

      // Calculate end time (default 2 hours after start, or next day for all-day)
      let endDt: string;
      if (event.is_all_day || !event.start_time) {
        // All-day: end is next day
        const endDate = new Date(event.end_date || event.start_date);
        endDate.setDate(endDate.getDate() + 1);
        endDt = format(endDate, "yyyyMMdd");
      } else if (event.end_time) {
        endDt = formatICalDate(event.start_date, event.end_time, false);
      } else {
        // Default 2 hours
        const d = new Date(event.start_date);
        const [hours, minutes] = event.start_time.split(":");
        d.setHours(parseInt(hours, 10) + 2, parseInt(minutes, 10), 0);
        endDt = format(d, "yyyyMMdd'T'HHmmss");
      }

      const dtType = event.is_all_day || !event.start_time ? "DATE" : "DATE-TIME";

      const description = [
        event.description ? event.description.slice(0, 500) : "",
        event.source_url ? `More info: ${event.source_url}` : "",
        "Via Lost City - lostcity.ai",
      ]
        .filter(Boolean)
        .join("\\n\\n");

      return `BEGIN:VEVENT
UID:lostcity-event-${event.id}@lostcity.ai
DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}
DTSTART;VALUE=${dtType}:${startDt}
DTEND;VALUE=${dtType}:${endDt}
SUMMARY:${escapeICalText(event.title)}
${location ? `LOCATION:${escapeICalText(location)}` : ""}
DESCRIPTION:${escapeICalText(description)}
STATUS:CONFIRMED
END:VEVENT`;
    });

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Lost City//Event Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:My Lost City Events
X-WR-CALDESC:Events you're attending from Lost City
${events.join("\n")}
END:VCALENDAR`;

    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="lostcity-calendar.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("Calendar feed error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

// Export token generation for use in calendar page
export { generateFeedToken };
