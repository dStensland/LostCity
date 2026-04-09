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

export const portalSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Portal slug is required");

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
