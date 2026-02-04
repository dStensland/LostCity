import { describe, it, expect } from "vitest";

/**
 * Sanitize a CSS color value to prevent injection attacks.
 * Only allows valid hex colors, named colors, and rgb/hsl functions.
 *
 * This is duplicated from PortalTheme.tsx for testing purposes.
 */
function sanitizeCssColor(value: string): string | null {
  if (!value || typeof value !== "string") return null;

  // Allow hex colors: #RGB, #RRGGBB, #RRGGBBAA
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;

  // Allow named CSS colors (common ones, alphanumeric only)
  if (/^[a-zA-Z]{3,20}$/.test(value)) return value;

  // Allow rgb/rgba/hsl/hsla functions with numbers, commas, spaces, dots, percentages
  if (/^(rgb|hsl)a?\(\s*[0-9.,\s%]+\s*\)$/.test(value)) return value;

  return null;
}

/**
 * Sanitize a CSS font family value to prevent injection attacks.
 * Only allows alphanumeric characters, spaces, commas, quotes, underscores, and hyphens.
 *
 * This is duplicated from PortalTheme.tsx for testing purposes.
 */
function sanitizeFontFamily(value: string): string | null {
  if (!value || typeof value !== "string") return null;

  // Allow alphanumeric, spaces, commas, quotes (single/double), underscores, hyphens
  if (/^[a-zA-Z0-9\s,'"_-]+$/.test(value)) return value;

  return null;
}

describe("portal-sanitization", () => {
  describe("sanitizeCssColor", () => {
    describe("hex colors", () => {
      it("accepts valid 3-digit hex colors", () => {
        expect(sanitizeCssColor("#fff")).toBe("#fff");
        expect(sanitizeCssColor("#000")).toBe("#000");
        expect(sanitizeCssColor("#f0a")).toBe("#f0a");
      });

      it("accepts valid 6-digit hex colors", () => {
        expect(sanitizeCssColor("#ffffff")).toBe("#ffffff");
        expect(sanitizeCssColor("#000000")).toBe("#000000");
        expect(sanitizeCssColor("#ff00aa")).toBe("#ff00aa");
      });

      it("accepts 8-digit hex colors with alpha", () => {
        expect(sanitizeCssColor("#ffffff80")).toBe("#ffffff80");
        expect(sanitizeCssColor("#00000000")).toBe("#00000000");
      });

      it("accepts uppercase and lowercase hex", () => {
        expect(sanitizeCssColor("#FFFFFF")).toBe("#FFFFFF");
        expect(sanitizeCssColor("#AbCdEf")).toBe("#AbCdEf");
      });

      it("rejects invalid hex colors", () => {
        expect(sanitizeCssColor("#ff")).toBe(null); // Too short
        expect(sanitizeCssColor("#ffffffff0")).toBe(null); // Too long
        expect(sanitizeCssColor("#gggggg")).toBe(null); // Invalid hex characters
        expect(sanitizeCssColor("#xyz")).toBe(null); // Invalid hex characters
        // Note: "ffffff" and "gggggg" would match the named color pattern (all letters)
        // The sanitizer accepts any alphabetic string 3-20 chars as a potential CSS color name
        // This is intentional to support all CSS color keywords
      });
    });

    describe("named colors", () => {
      it("accepts common CSS color names", () => {
        expect(sanitizeCssColor("red")).toBe("red");
        expect(sanitizeCssColor("blue")).toBe("blue");
        expect(sanitizeCssColor("transparent")).toBe("transparent");
        expect(sanitizeCssColor("rebeccapurple")).toBe("rebeccapurple");
      });

      it("accepts colors of varying lengths", () => {
        expect(sanitizeCssColor("tan")).toBe("tan"); // 3 chars
        expect(sanitizeCssColor("coral")).toBe("coral"); // 5 chars
        expect(sanitizeCssColor("lightgoldenrodyellow")).toBe("lightgoldenrodyellow"); // 20 chars
      });

      it("rejects color names that are too short or long", () => {
        expect(sanitizeCssColor("ab")).toBe(null); // Too short
        expect(sanitizeCssColor("a".repeat(21))).toBe(null); // Too long
      });

      it("rejects color names with special characters", () => {
        expect(sanitizeCssColor("red-500")).toBe(null);
        expect(sanitizeCssColor("blue_light")).toBe(null);
      });
    });

    describe("rgb/rgba colors", () => {
      it("accepts valid rgb() values", () => {
        expect(sanitizeCssColor("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
        expect(sanitizeCssColor("rgb(0,0,0)")).toBe("rgb(0,0,0)");
        expect(sanitizeCssColor("rgb(128, 128, 128)")).toBe("rgb(128, 128, 128)");
      });

      it("accepts valid rgba() values", () => {
        expect(sanitizeCssColor("rgba(255, 0, 0, 0.5)")).toBe("rgba(255, 0, 0, 0.5)");
        expect(sanitizeCssColor("rgba(0,0,0,1)")).toBe("rgba(0,0,0,1)");
      });

      it("accepts rgb with varying whitespace", () => {
        expect(sanitizeCssColor("rgb( 255 , 0 , 0 )")).toBe("rgb( 255 , 0 , 0 )");
        expect(sanitizeCssColor("rgb(255,0,0)")).toBe("rgb(255,0,0)");
      });

      it("rejects rgb with invalid characters", () => {
        expect(sanitizeCssColor("rgb(255, 0, 0); color: red")).toBe(null);
        expect(sanitizeCssColor("rgb(calc(100 + 155), 0, 0)")).toBe(null);
      });
    });

    describe("hsl/hsla colors", () => {
      it("accepts valid hsl() values", () => {
        expect(sanitizeCssColor("hsl(0, 100%, 50%)")).toBe("hsl(0, 100%, 50%)");
        expect(sanitizeCssColor("hsl(120,50%,50%)")).toBe("hsl(120,50%,50%)");
      });

      it("accepts valid hsla() values", () => {
        expect(sanitizeCssColor("hsla(0, 100%, 50%, 0.5)")).toBe("hsla(0, 100%, 50%, 0.5)");
        expect(sanitizeCssColor("hsla(240,75%,60%,1)")).toBe("hsla(240,75%,60%,1)");
      });

      it("accepts hsl with varying whitespace", () => {
        expect(sanitizeCssColor("hsl( 120 , 50% , 50% )")).toBe("hsl( 120 , 50% , 50% )");
      });

      it("rejects hsl with invalid characters", () => {
        expect(sanitizeCssColor("hsl(0deg, 100%, 50%)")).toBe(null);
        expect(sanitizeCssColor("hsl(var(--hue), 50%, 50%)")).toBe(null);
      });
    });

    describe("injection prevention", () => {
      it("rejects CSS injection attempts", () => {
        expect(sanitizeCssColor("red; background: url(evil.com)")).toBe(null);
        expect(sanitizeCssColor("red' onload='alert(1)'")).toBe(null);
        expect(sanitizeCssColor("red}body{display:none")).toBe(null);
      });

      it("rejects JavaScript protocol", () => {
        expect(sanitizeCssColor("javascript:alert(1)")).toBe(null);
      });

      it("rejects expression() function", () => {
        expect(sanitizeCssColor("expression(alert(1))")).toBe(null);
      });

      it("rejects url() function", () => {
        expect(sanitizeCssColor("url(data:text/html,<script>alert(1)</script>)")).toBe(null);
      });
    });

    describe("edge cases", () => {
      it("rejects null and undefined", () => {
        expect(sanitizeCssColor(null as unknown as string)).toBe(null);
        expect(sanitizeCssColor(undefined as unknown as string)).toBe(null);
      });

      it("rejects empty string", () => {
        expect(sanitizeCssColor("")).toBe(null);
      });

      it("rejects non-string types", () => {
        expect(sanitizeCssColor(123 as unknown as string)).toBe(null);
        expect(sanitizeCssColor({} as unknown as string)).toBe(null);
      });
    });
  });

  describe("sanitizeFontFamily", () => {
    describe("valid fonts", () => {
      it("accepts single font names", () => {
        expect(sanitizeFontFamily("Arial")).toBe("Arial");
        expect(sanitizeFontFamily("Helvetica")).toBe("Helvetica");
        expect(sanitizeFontFamily("serif")).toBe("serif");
      });

      it("accepts font names with spaces", () => {
        expect(sanitizeFontFamily("Times New Roman")).toBe("Times New Roman");
        expect(sanitizeFontFamily("Comic Sans MS")).toBe("Comic Sans MS");
      });

      it("accepts font names with hyphens", () => {
        expect(sanitizeFontFamily("Helvetica-Neue")).toBe("Helvetica-Neue");
        expect(sanitizeFontFamily("SF-Pro-Display")).toBe("SF-Pro-Display");
      });

      it("accepts font names with underscores", () => {
        expect(sanitizeFontFamily("Font_Name")).toBe("Font_Name");
      });

      it("accepts font names with numbers", () => {
        expect(sanitizeFontFamily("Open Sans 3")).toBe("Open Sans 3");
        expect(sanitizeFontFamily("Roboto2")).toBe("Roboto2");
      });

      it("accepts quoted font names", () => {
        expect(sanitizeFontFamily('"Times New Roman"')).toBe('"Times New Roman"');
        expect(sanitizeFontFamily("'Arial'")).toBe("'Arial'");
      });

      it("accepts font stacks with commas", () => {
        expect(sanitizeFontFamily("Arial, Helvetica, sans-serif")).toBe(
          "Arial, Helvetica, sans-serif"
        );
        expect(sanitizeFontFamily('"Times New Roman", Times, serif')).toBe(
          '"Times New Roman", Times, serif'
        );
      });

      it("accepts complex font stacks", () => {
        expect(
          sanitizeFontFamily(
            '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'
          )
        ).toBe('"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto');
      });
    });

    describe("injection prevention", () => {
      it("rejects font names with semicolons", () => {
        expect(sanitizeFontFamily("Arial; color: red")).toBe(null);
        expect(sanitizeFontFamily("Arial;")).toBe(null);
      });

      it("rejects font names with braces", () => {
        expect(sanitizeFontFamily("Arial{color:red}")).toBe(null);
        expect(sanitizeFontFamily("Arial}body{display:none")).toBe(null);
      });

      it("rejects font names with backslashes", () => {
        expect(sanitizeFontFamily("Arial\\n")).toBe(null);
        expect(sanitizeFontFamily("Arial\\")).toBe(null);
      });

      it("rejects font names with special characters", () => {
        expect(sanitizeFontFamily("Arial!")).toBe(null);
        expect(sanitizeFontFamily("Arial@font-face")).toBe(null);
        expect(sanitizeFontFamily("Arial<script>")).toBe(null);
      });

      it("rejects url() function", () => {
        expect(sanitizeFontFamily("url(evil.com/font.woff)")).toBe(null);
      });

      it("rejects expression() function", () => {
        expect(sanitizeFontFamily("expression(alert(1))")).toBe(null);
      });
    });

    describe("edge cases", () => {
      it("rejects null and undefined", () => {
        expect(sanitizeFontFamily(null as unknown as string)).toBe(null);
        expect(sanitizeFontFamily(undefined as unknown as string)).toBe(null);
      });

      it("rejects empty string", () => {
        expect(sanitizeFontFamily("")).toBe(null);
      });

      it("rejects non-string types", () => {
        expect(sanitizeFontFamily(123 as unknown as string)).toBe(null);
        expect(sanitizeFontFamily({} as unknown as string)).toBe(null);
      });

      it("accepts very long font stacks", () => {
        const longStack = Array(10).fill("Arial").join(", ");
        expect(sanitizeFontFamily(longStack)).toBe(longStack);
      });
    });
  });
});
