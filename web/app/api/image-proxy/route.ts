import { NextRequest, NextResponse } from "next/server";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const TIMEOUT_MS = 10_000;

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".lan") ||
    lower.endsWith(".home")
  ) {
    return true;
  }
  return false;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7
  if (lower.startsWith("fe80")) return true; // link-local
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(".")) {
    return isPrivateIpv4(ip);
  }
  return isPrivateIpv6(ip);
}

async function assertPublicHostname(hostname: string): Promise<void> {
  if (isBlockedHostname(hostname)) {
    throw new Error("Blocked hostname");
  }

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("Private IP");
    }
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) {
    throw new Error("Unresolvable hostname");
  }
  for (const addr of addresses) {
    if (isPrivateIp(addr.address)) {
      throw new Error("Private IP");
    }
  }
}

export async function GET(request: NextRequest) {
  const targetParam = request.nextUrl.searchParams.get("url");
  if (!targetParam) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }
  if (targetParam.length > 2048) {
    return NextResponse.json({ error: "URL too long" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(targetParam);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  let identifier = getClientIdentifier(request);
  if (identifier === "unknown") {
    identifier = `proxy:${target.hostname}`;
  }
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, identifier);
  if (rateLimitResult) return rateLimitResult;

  if (target.username || target.password) {
    return NextResponse.json({ error: "Credentials not allowed in URL" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Invalid URL protocol" }, { status: 400 });
  }

  try {
    await assertPublicHostname(target.hostname);
  } catch {
    return NextResponse.json({ error: "Blocked URL" }, { status: 403 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "LostCityImageProxy/1.0",
        Accept: "image/*",
      },
    });
  } catch {
    clearTimeout(timeout);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
  }

  const contentLength = upstream.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", "inline");
  headers.set(
    "Cache-Control",
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
  );

  const etag = upstream.headers.get("etag");
  if (etag) headers.set("ETag", etag);
  const lastModified = upstream.headers.get("last-modified");
  if (lastModified) headers.set("Last-Modified", lastModified);

  return new NextResponse(buffer, { status: 200, headers });
}
