import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const portalIdParam = request.nextUrl.searchParams.get("portal_id");
  const portalId = portalIdParam && isValidUUID(portalIdParam) ? portalIdParam : null;

  if (!slug) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: festivalData, error } = await supabase
    .from("festivals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !festivalData) {
    return Response.json({ error: "Festival not found" }, { status: 404 });
  }

  const festival = festivalData as { id: string; [key: string]: unknown };

  const { data: programsData } = await supabase
    .from("series")
    .select("id, slug, title, description, image_url, series_type")
    .eq("festival_id", festival.id)
    .eq("series_type", "festival_program")
    .eq("is_active", true)
    .order("title", { ascending: true });

  const programs = (programsData || []) as {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    image_url: string | null;
    series_type: string;
  }[];

  if (programs.length === 0) {
    return Response.json({ festival: festivalData, programs: [] }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  }

  const programIds = programs.map((p) => p.id);
  const today = getLocalDateString();

  let eventsQuery = supabase
    .from("events")
    .select(`
      id,
      title,
      start_date,
      start_time,
      end_time,
      series_id,
      venue:venues(id, name, slug, neighborhood)
    `)
    .in("series_id", programIds)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (portalId) {
    eventsQuery = eventsQuery.or(`portal_id.eq.${portalId},portal_id.is.null`);
  }

  const { data: eventsData } = await eventsQuery;

  const sessions = (eventsData || []) as {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    series_id: string | null;
    venue: {
      id: number;
      name: string;
      slug: string;
      neighborhood: string | null;
    } | null;
  }[];

  const sessionsByProgram = new Map<string, typeof sessions>();
  sessions.forEach((session) => {
    if (!session.series_id) return;
    if (!sessionsByProgram.has(session.series_id)) {
      sessionsByProgram.set(session.series_id, []);
    }
    sessionsByProgram.get(session.series_id)!.push(session);
  });

  const programsWithSessions = programs.map((program) => ({
    ...program,
    sessions: sessionsByProgram.get(program.id) || [],
  }));

  return Response.json(
    {
      festival: festivalData,
      programs: programsWithSessions,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
