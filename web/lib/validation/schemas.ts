import { z } from "zod";

export const paginationSchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseInt(v, 10) : v))
    .pipe(z.number().int().min(1))
    .transform((v) => Math.min(v, 100))
    .default(20),
  offset: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseInt(v, 10) : v))
    .pipe(z.number().int().min(0))
    .default(0),
});

export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID"
  );

/** Portal slug — lowercased, trimmed, alphanumeric + hyphens, max 50 chars. */
export const portalSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Portal slug is required")
  .max(50, "Portal slug too long")
  .regex(/^[a-z0-9-]+$/, "Portal slug must contain only lowercase letters, numbers, and hyphens");

export function sortSchema<T extends string>(allowedFields: readonly [T, ...T[]]) {
  return z.object({
    sort_by: z.enum(allowedFields),
    sort_order: z.enum(["asc", "desc"]).default("asc"),
  });
}

export const positiveIntSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" ? parseInt(v, 10) : v))
  .pipe(z.number().int().min(1, "Must be a positive integer"));

/** RSVP creation schema. */
export const rsvpBodySchema = z.object({
  event_id: z.number().int().positive("Invalid event_id"),
  status: z.enum(["going", "interested", "went"], {
    error: "Invalid status. Must be: going, interested, or went",
  }),
  visibility: z
    .enum(["friends", "public", "private"], {
      error: "Invalid visibility. Must be: friends, public, or private",
    })
    .default("friends"),
  notify_friends: z.boolean().optional(),
});
