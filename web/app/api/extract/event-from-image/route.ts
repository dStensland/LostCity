import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { applyDailyQuota, applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import { getLocalDateString } from "@/lib/formats";

const EXTRACTION_PROMPT = `Extract event information from this poster/flyer image.
Today's date is {today}. Use this to resolve relative dates like "this Saturday" or "next Friday".

Return a JSON object with these fields:
- title: string (the event name)
- start_date: string (YYYY-MM-DD format)
- start_time: string or null (HH:MM 24-hour format, null if not shown)
- venue_name: string or null (venue/location name if visible)
- venue_address: string or null (address if visible)
- category: string (one of: music, comedy, art, theater, film, food_drink, nightlife, community, fitness, family, sports, dance, learning, outdoors, markets, other)
- description: string or null (brief description of the event)
- price_note: string or null (pricing info if visible, e.g. "$20", "Free", "$15-$30")
- is_free: boolean (true if the event appears to be free)

If this image is NOT an event poster or flyer, return: {"error": "not_an_event_poster"}

Return valid JSON only, no markdown formatting or code fences.`;

// POST /api/extract/event-from-image — Extract event data from a poster image
export async function POST(request: NextRequest) {
  if (process.env.ENABLE_EVENT_IMAGE_EXTRACTION === "false") {
    return NextResponse.json({ error: "Feature temporarily disabled" }, { status: 503 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.aiExtract, user.id, {
    bucket: "extract:event-from-image",
    logContext: "extract:event-from-image",
  });
  if (rateLimitResult) return rateLimitResult;

  const dailyLimit = Number.parseInt(
    process.env.RATE_LIMIT_EXTRACT_DAILY_LIMIT || "40",
    10
  );
  const dailyQuotaResult = await applyDailyQuota(request, dailyLimit, user.id, {
    bucket: "extract:event-from-image",
    logContext: "extract:event-from-image",
  });
  if (dailyQuotaResult) return dailyQuotaResult;

  let body: { image_url: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { image_url } = body;
  if (!image_url || typeof image_url !== "string") {
    return NextResponse.json({ error: "image_url is required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error("OPENAI_API_KEY not configured", null, { component: "extract/event-from-image" });
    return NextResponse.json(
      { error: "Vision extraction is not configured" },
      { status: 503 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const today = getLocalDateString();
    const prompt = EXTRACTION_PROMPT.replace("{today}", today);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract event information from this poster image.",
            },
            {
              type: "image_url",
              image_url: { url: image_url, detail: "high" },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";

    // Strip markdown fences if present
    let jsonStr = raw;
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.split("\n").slice(1).join("\n");
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const extracted = JSON.parse(jsonStr);

    if (extracted.error) {
      return NextResponse.json({ error: extracted.error }, { status: 422 });
    }

    return NextResponse.json({ extracted });
  } catch (err) {
    logger.error("Vision extraction failed", err, {
      userId: user.id,
      component: "extract/event-from-image",
    });

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Failed to parse extraction result" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Vision extraction failed" },
      { status: 500 }
    );
  }
}
