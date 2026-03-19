import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { errorResponse, parseFloatParam, parseIntParam } from "@/lib/api-utils";
import { wmoToCondition, conditionToEmoji, isRainyCondition } from "@/lib/wmo-weather-utils";

// Default coordinates: Atlanta, GA
const DEFAULT_LAT = 33.749;
const DEFAULT_LNG = -84.388;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 16;

// Server-side in-memory cache: 30-minute TTL
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  tempHigh: number;
  tempLow: number;
  condition: string;
  emoji: string;
  weatherCode: number;
  isRainy: boolean;
}

export interface ForecastResponse {
  days: ForecastDay[];
  updatedAt: string;
}

interface CacheEntry {
  data: ForecastResponse;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function buildOpenMeteoUrl(lat: number, lng: number, days: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&temperature_unit=fahrenheit&timezone=America%2FNew_York` +
    `&forecast_days=${days}`
  );
}

function cacheKey(lat: number, lng: number, days: number): string {
  return `${lat.toFixed(1)},${lng.toFixed(1)},${days}`;
}

export async function GET(request: Request): Promise<Response> {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);

    const lat = parseFloatParam(searchParams.get("lat"), DEFAULT_LAT) ?? DEFAULT_LAT;
    const lng = parseFloatParam(searchParams.get("lng"), DEFAULT_LNG) ?? DEFAULT_LNG;
    const rawDays = parseIntParam(searchParams.get("days"), DEFAULT_DAYS) ?? DEFAULT_DAYS;
    const days = Math.min(Math.max(1, rawDays), MAX_DAYS);

    const key = cacheKey(lat, lng, days);

    // Check in-memory cache first
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return Response.json(cached.data, {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          "X-Cache": "HIT",
        },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let json: {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        weather_code?: number[];
      };
    };

    try {
      const res = await fetch(buildOpenMeteoUrl(lat, lng, days), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
      json = (await res.json()) as typeof json;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }

    const dates: string[] = json.daily?.time ?? [];
    const highs: number[] = json.daily?.temperature_2m_max ?? [];
    const lows: number[] = json.daily?.temperature_2m_min ?? [];
    const codes: number[] = json.daily?.weather_code ?? [];

    const forecastDays: ForecastDay[] = dates.map((date, i) => {
      const condition = wmoToCondition(codes[i] ?? 0);
      return {
        date,
        tempHigh: Math.round(highs[i] ?? 0),
        tempLow: Math.round(lows[i] ?? 0),
        condition,
        emoji: conditionToEmoji(condition),
        weatherCode: codes[i] ?? 0,
        isRainy: isRainyCondition(condition),
      };
    });

    const data: ForecastResponse = {
      days: forecastDays,
      updatedAt: new Date().toISOString(),
    };

    cache.set(key, { data, fetchedAt: Date.now() });

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    return errorResponse(error, "GET /api/weather/forecast");
  }
}
