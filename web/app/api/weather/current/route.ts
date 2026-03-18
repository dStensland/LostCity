import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-utils";
import { parseFloatParam } from "@/lib/api-utils";
import { wmoToCondition, conditionToEmoji, isRainyCondition } from "@/lib/wmo-weather-utils";

// Default coordinates: Atlanta, GA
const DEFAULT_LAT = 33.749;
const DEFAULT_LNG = -84.388;

// Server-side in-memory cache: 10-minute TTL
// Cache key = rounded lat/lng to 1 decimal place
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  data: CurrentWeatherResponse;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export interface CurrentWeatherResponse {
  temperature: number;
  condition: string;
  emoji: string;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isRainy: boolean;
  updatedAt: string;
}

function buildOpenMeteoUrl(lat: number, lng: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph`
  );
}

function cacheKey(lat: number, lng: number): string {
  // Round to 1 decimal place so nearby requests share the same cache entry
  return `${lat.toFixed(1)},${lng.toFixed(1)}`;
}

export async function GET(request: Request): Promise<Response> {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);

    const lat = parseFloatParam(searchParams.get("lat"), DEFAULT_LAT) ?? DEFAULT_LAT;
    const lng = parseFloatParam(searchParams.get("lng"), DEFAULT_LNG) ?? DEFAULT_LNG;

    const key = cacheKey(lat, lng);

    // Check in-memory cache first
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return Response.json(cached.data, {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
          "X-Cache": "HIT",
        },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let json: {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        relative_humidity_2m?: number;
      };
    };

    try {
      const res = await fetch(buildOpenMeteoUrl(lat, lng), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
      json = (await res.json()) as typeof json;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }

    const code = json.current?.weather_code ?? 0;
    const condition = wmoToCondition(code);
    const data: CurrentWeatherResponse = {
      temperature: Math.round(json.current?.temperature_2m ?? 0),
      condition,
      emoji: conditionToEmoji(condition),
      humidity: Math.round(json.current?.relative_humidity_2m ?? 0),
      windSpeed: Math.round(json.current?.wind_speed_10m ?? 0),
      weatherCode: code,
      isRainy: isRainyCondition(condition),
      updatedAt: new Date().toISOString(),
    };

    cache.set(key, { data, fetchedAt: Date.now() });

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    return errorResponse(error, "GET /api/weather/current");
  }
}
