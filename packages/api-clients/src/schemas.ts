import { z } from "zod";

export const fuelTypeSchema = z.enum([
  "gasoline",
  "diesel",
  "hybrid",
  "electric",
  "lpg",
]);

export const transmissionSchema = z.enum(["auto", "manual"]);

export const carSourceSchema = z.enum([
  "encar",
  "kb",
  "heydealer",
  "bobaedream",
  "joongna",
]);

export const carSearchParamsSchema = z.object({
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  minYear: z.number().int().optional(),
  maxYear: z.number().int().optional(),
  minPrice: z.number().int().optional(),
  maxPrice: z.number().int().optional(),
  maxMileage: z.number().int().optional(),
  fuelType: fuelTypeSchema.optional(),
  transmission: transmissionSchema.optional(),
  region: z.string().min(1).optional(),
  noAccident: z.boolean().optional(),
  rawQuery: z.string().min(1),
});

export const normalizedCarSchema = z.object({
  id: z.string().min(1),
  source: carSourceSchema,
  title: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().min(1).optional(),
  year: z.number().int(),
  mileage: z.number().int().nonnegative(),
  price: z.number().int().nonnegative(),
  fuelType: fuelTypeSchema,
  transmission: transmissionSchema,
  color: z.string().min(1).optional(),
  region: z.string().min(1),
  hasInspection: z.boolean(),
  accidentCount: z.number().int().nonnegative(),
  isLeaseReturn: z.boolean(),
  images: z.array(z.string().url()),
  listingUrl: z.string().url(),
  dealerName: z.string().min(1),
  postedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export type CarSearchParamsInput = z.infer<typeof carSearchParamsSchema>;
export type NormalizedCarInput = z.infer<typeof normalizedCarSchema>;
