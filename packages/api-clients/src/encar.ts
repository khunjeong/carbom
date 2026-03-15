import type { CarSearchParams, NormalizedCar } from "@tripagent/types";
import { z } from "zod";
import {
  ApiClientError,
  createFutureIsoDate,
  fetchJson,
  type SearchCarsOptions,
  validateSearchParams,
} from "./shared";
import { normalizedCarSchema } from "./schemas";

const rawEncarCarSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    vehicleId: z.union([z.string(), z.number()]).optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    brand: z.string().optional(),
    maker: z.string().optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    modelName: z.string().optional(),
    trim: z.string().optional(),
    year: z.number().int().optional(),
    modelYear: z.number().int().optional(),
    mileage: z.number().int().optional(),
    distance: z.number().int().optional(),
    price: z.number().int().optional(),
    sellPrice: z.number().int().optional(),
    fuelType: z.string().optional(),
    fuel: z.string().optional(),
    transmission: z.string().optional(),
    gearbox: z.string().optional(),
    color: z.string().optional(),
    region: z.string().optional(),
    area: z.string().optional(),
    hasInspection: z.boolean().optional(),
    inspectionPassed: z.boolean().optional(),
    accidentCount: z.number().int().optional(),
    accidentHistoryCount: z.number().int().optional(),
    isLeaseReturn: z.boolean().optional(),
    leaseReturn: z.boolean().optional(),
    images: z.array(z.string().url()).optional(),
    imageUrls: z.array(z.string().url()).optional(),
    thumbnail: z.string().url().optional(),
    listingUrl: z.string().url().optional(),
    url: z.string().url().optional(),
    dealerName: z.string().optional(),
    sellerName: z.string().optional(),
    postedAt: z.string().datetime().optional(),
    createdAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .passthrough();

const encarSearchResponseSchema = z.union([
  z.array(rawEncarCarSchema),
  z.object({
    items: z.array(rawEncarCarSchema).optional(),
    data: z.array(rawEncarCarSchema).optional(),
    results: z.array(rawEncarCarSchema).optional(),
    listings: z.array(rawEncarCarSchema).optional(),
  }),
]);

export interface EncarClientConfig {
  baseUrl: string;
  apiKey?: string;
  defaultHeaders?: HeadersInit;
  searchPath?: string;
}

export interface EncarClient {
  searchCars(
    params: CarSearchParams,
    options?: SearchCarsOptions
  ): Promise<NormalizedCar[]>;
}

export function createEncarClient(config: EncarClientConfig): EncarClient {
  const baseUrl = new URL(config.baseUrl);

  return {
    async searchCars(params, options) {
      const validatedParams = validateSearchParams(params);
      const url = new URL(config.searchPath ?? "/cars", baseUrl);
      const rawResponse = await fetchJson<unknown>(url, {
        headers: {
          "content-type": "application/json",
          ...(config.apiKey ? { "x-api-key": config.apiKey } : {}),
          ...config.defaultHeaders,
        },
        searchParams: buildEncarSearchParams(validatedParams),
        signal: options?.signal,
      });

      const parsed = encarSearchResponseSchema.safeParse(rawResponse);

      if (!parsed.success) {
        throw new ApiClientError(
          "INVALID_ENCAR_RESPONSE",
          "Encar response shape did not match the expected structure",
          parsed.error.flatten()
        );
      }

      const items = Array.isArray(parsed.data)
        ? parsed.data
        : parsed.data.items ??
          parsed.data.data ??
          parsed.data.results ??
          parsed.data.listings ??
          [];

      return items.map(normalizeEncarCar);
    },
  };
}

export function buildEncarSearchParams(params: CarSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (params.brand) searchParams.set("maker", params.brand);
  if (params.model) searchParams.set("model", params.model);
  if (params.minYear) searchParams.set("minYear", String(params.minYear));
  if (params.maxYear) searchParams.set("maxYear", String(params.maxYear));
  if (params.minPrice) searchParams.set("minPrice", String(params.minPrice));
  if (params.maxPrice) searchParams.set("maxPrice", String(params.maxPrice));
  if (params.maxMileage) searchParams.set("maxMileage", String(params.maxMileage));
  if (params.fuelType) searchParams.set("fuelType", params.fuelType);
  if (params.transmission) searchParams.set("transmission", params.transmission);
  if (params.region) searchParams.set("region", params.region);
  if (params.noAccident) searchParams.set("noAccident", "true");
  searchParams.set("q", params.rawQuery);

  return searchParams;
}

export function normalizeEncarCar(raw: unknown): NormalizedCar {
  const car = rawEncarCarSchema.parse(raw);
  const postedAt = car.postedAt ?? car.createdAt ?? new Date().toISOString();
  const normalized: NormalizedCar = {
    id: String(car.id ?? car.vehicleId ?? ""),
    source: "encar",
    title: car.title ?? car.name ?? buildFallbackTitle(car),
    brand: car.brand ?? car.maker ?? car.manufacturer ?? "unknown",
    model: car.model ?? car.modelName ?? "unknown",
    trim: car.trim,
    year: car.year ?? car.modelYear ?? 0,
    mileage: car.mileage ?? car.distance ?? 0,
    price: car.price ?? car.sellPrice ?? 0,
    fuelType: mapFuelType(car.fuelType ?? car.fuel),
    transmission: mapTransmission(car.transmission ?? car.gearbox),
    color: car.color,
    region: car.region ?? car.area ?? "미상",
    hasInspection: car.hasInspection ?? car.inspectionPassed ?? false,
    accidentCount: car.accidentCount ?? car.accidentHistoryCount ?? 0,
    isLeaseReturn: car.isLeaseReturn ?? car.leaseReturn ?? false,
    images: car.images ?? car.imageUrls ?? (car.thumbnail ? [car.thumbnail] : []),
    listingUrl: car.listingUrl ?? car.url ?? "https://www.encar.com",
    dealerName: car.dealerName ?? car.sellerName ?? "엔카",
    postedAt,
    expiresAt: car.expiresAt ?? createFutureIsoDate(30),
  };

  return normalizedCarSchema.parse(normalized);
}

function buildFallbackTitle(car: z.infer<typeof rawEncarCarSchema>) {
  return [car.year ?? car.modelYear, car.brand ?? car.maker, car.model ?? car.modelName]
    .filter(Boolean)
    .join(" ");
}

function mapFuelType(value?: string): NormalizedCar["fuelType"] {
  if (!value) return "gasoline";

  const normalized = value.toLowerCase();

  if (normalized.includes("diesel") || normalized.includes("디젤")) return "diesel";
  if (normalized.includes("hybrid") || normalized.includes("하이브리드")) return "hybrid";
  if (normalized.includes("electric") || normalized.includes("전기")) return "electric";
  if (normalized.includes("lpg")) return "lpg";

  return "gasoline";
}

function mapTransmission(value?: string): NormalizedCar["transmission"] {
  if (!value) return "auto";

  const normalized = value.toLowerCase();
  return normalized.includes("manual") || normalized.includes("수동")
    ? "manual"
    : "auto";
}
