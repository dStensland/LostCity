import { describe, it, expect } from "vitest";
import type { NextConfig } from "next";
import nextConfigExport from "../next.config";
import { buildCsp } from "./csp";

describe("security headers", () => {
  it("includes baseline security headers in next config", async () => {
    const resolvedConfig =
      typeof nextConfigExport === "function"
        ? (nextConfigExport as unknown as (phase: string, context: unknown) => NextConfig)(
            "phase-test",
            {}
          )
        : (nextConfigExport as NextConfig);

    expect(resolvedConfig.headers).toBeTypeOf("function");

    const headers = await resolvedConfig.headers?.();
    const flattened = (headers || []).flatMap((entry) => entry.headers);
    const keys = new Set(flattened.map((h) => h.key));

    expect(keys.has("X-Frame-Options")).toBe(true);
    expect(keys.has("X-Content-Type-Options")).toBe(true);
    expect(keys.has("Referrer-Policy")).toBe(true);
    expect(keys.has("Permissions-Policy")).toBe(true);
    expect(keys.has("Cross-Origin-Opener-Policy")).toBe(true);
    expect(keys.has("Cross-Origin-Resource-Policy")).toBe(true);
    expect(keys.has("Strict-Transport-Security")).toBe(true);
    expect(keys.has("Content-Security-Policy")).toBe(false);
  });

  it("builds a nonce-based CSP for scripts", () => {
    const nonce = "testnonce";
    const csp = buildCsp(nonce, { isDev: false });

    expect(csp).toContain("default-src 'self'");
    // script-src uses 'unsafe-inline' (not nonce) because Next.js streaming
    // injects inline scripts ($RC, $RS, __next_f) without nonce attributes
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("'unsafe-inline'");
    // Nonce is still used for style-src
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain(`style-src 'self'`);
    expect(csp).toContain(`style-src-elem 'self'`);
    expect(csp).toContain("style-src-attr 'none'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it("supports report-only CSP for inline style lockdown", () => {
    const nonce = "testnonce";
    const csp = buildCsp(nonce, {
      isDev: false,
      allowInlineStyles: false,
      reportUri: "/api/csp-report",
    });

    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain(`style-src-elem 'self'`);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("style-src-attr 'none'");
    expect(csp).toContain("report-uri /api/csp-report");
  });
});
