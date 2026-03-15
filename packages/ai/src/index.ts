import type {
  CarSearchParams,
  NormalizedCar,
  RankedCar,
  SearchResult,
} from "@tripagent/types";
import { ApiClientError, type SearchCarsOptions } from "@tripagent/api-clients";

export interface QueryParser {
  parse(rawQuery: string): Promise<CarSearchParams> | CarSearchParams;
}

export interface CarSearchProvider {
  source: string;
  searchCars(
    params: CarSearchParams,
    options?: SearchCarsOptions
  ): Promise<NormalizedCar[]>;
}

export interface SearchOrchestratorOptions {
  parser?: QueryParser;
  topK?: number;
}

export interface SearchCarsWithAiInput {
  rawQuery: string;
  providers: CarSearchProvider[];
  signal?: AbortSignal;
}

export interface SearchCarsWithAiOutput {
  result: SearchResult;
  failures: Array<{ source: string; error: string }>;
}

export function createHeuristicQueryParser(): QueryParser {
  return {
    parse(rawQuery) {
      const normalized = rawQuery.trim();

      return {
        rawQuery: normalized,
        brand: findFirstMatch(normalized, BRAND_KEYWORDS),
        model: findFirstMatch(normalized, MODEL_KEYWORDS),
        minYear: extractSingleBound(normalized, /(20\d{2})년(?:식)?\s*(?:이상|부터)/),
        maxYear: extractSingleBound(normalized, /(20\d{2})년(?:식)?\s*(?:이하|까지)/),
        minPrice: extractPrice(normalized, /(\d{3,5})\s*(?:만원)?\s*(?:이상|부터)/),
        maxPrice: extractPrice(normalized, /(\d{3,5})\s*(?:만원)?\s*(?:이하|까지|미만)/),
        maxMileage: extractMileage(normalized),
        fuelType: inferFuelType(normalized),
        transmission: inferTransmission(normalized),
        region: findFirstMatch(normalized, REGION_KEYWORDS),
        noAccident: /무사고/.test(normalized) ? true : undefined,
      };
    },
  };
}

export function createSearchOrchestrator(
  options: SearchOrchestratorOptions = {}
) {
  const parser = options.parser ?? createHeuristicQueryParser();
  const topK = options.topK ?? 5;

  return {
    async search(input: SearchCarsWithAiInput): Promise<SearchCarsWithAiOutput> {
      const searchParams = await parser.parse(input.rawQuery);
      const settled = await Promise.allSettled(
        input.providers.map(async (provider) => {
          try {
            return {
              source: provider.source,
              cars: await provider.searchCars(searchParams, { signal: input.signal }),
            };
          } catch (error) {
            throw {
              source: provider.source,
              error,
            };
          }
        })
      );

      const failures: Array<{ source: string; error: string }> = [];
      const dedupedCars = new Map<string, NormalizedCar>();

      for (const item of settled) {
        if (item.status === "rejected") {
          failures.push(normalizeFailure(item.reason));
          continue;
        }

        for (const car of item.value.cars) {
          const dedupeKey = buildDedupeKey(car);
          const existing = dedupedCars.get(dedupeKey);

          if (!existing || car.price < existing.price) {
            dedupedCars.set(dedupeKey, car);
          }
        }
      }

      const rankedCars = rankCars([...dedupedCars.values()], searchParams).slice(0, topK);

      return {
        result: {
          id: createResultId(),
          searchParams,
          cars: rankedCars,
          generatedAt: new Date().toISOString(),
        },
        failures,
      };
    },
  };
}

export function rankCars(
  cars: NormalizedCar[],
  params: CarSearchParams
): RankedCar[] {
  const scored = cars
    .map((car) => ({
      car,
      score: scoreCar(car, params),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.map(({ car, score }, index) => ({
    rank: index + 1,
    car,
    score,
    summary: buildSummary(car, params, score),
    priceAnalysis: buildPriceAnalysis(car, cars),
  }));
}

function scoreCar(car: NormalizedCar, params: CarSearchParams) {
  let score = 50;

  if (params.maxPrice && car.price <= params.maxPrice) score += 15;
  if (params.minPrice && car.price >= params.minPrice) score += 5;
  if (params.maxMileage && car.mileage <= params.maxMileage) score += 10;
  if (params.minYear && car.year >= params.minYear) score += 10;
  if (params.maxYear && car.year <= params.maxYear) score += 5;
  if (params.noAccident && car.accidentCount === 0) score += 12;
  if (params.fuelType && car.fuelType === params.fuelType) score += 8;
  if (params.transmission && car.transmission === params.transmission) score += 4;
  if (params.region && car.region.includes(params.region)) score += 3;
  if (car.hasInspection) score += 5;
  if (!car.isLeaseReturn) score += 3;

  const agePenalty = Math.max(0, new Date().getFullYear() - car.year) * 0.6;
  const mileagePenalty = car.mileage / 10000;

  return Number((score - agePenalty - mileagePenalty).toFixed(1));
}

function buildSummary(car: NormalizedCar, params: CarSearchParams, score: number) {
  const reasons = [
    params.maxPrice && car.price <= params.maxPrice
      ? `예산 ${params.maxPrice}만원 이내`
      : null,
    params.maxMileage && car.mileage <= params.maxMileage
      ? `주행거리 ${car.mileage.toLocaleString()}km`
      : null,
    car.accidentCount === 0 ? "무사고" : `사고 ${car.accidentCount}건`,
    car.hasInspection ? "성능점검 완료" : null,
  ].filter(Boolean);

  return `${car.title}는 ${reasons.join(", ")} 조건으로 점수 ${score}점을 받은 매물입니다.`;
}

function buildPriceAnalysis(car: NormalizedCar, cars: NormalizedCar[]) {
  if (cars.length < 2) {
    return "비교 표본이 부족해 시세 분석은 보수적으로 해석해야 합니다.";
  }

  const averagePrice =
    cars.reduce((sum, candidate) => sum + candidate.price, 0) / cars.length;
  const delta = Math.round(((car.price - averagePrice) / averagePrice) * 100);

  if (delta <= -10) return `비교군 평균보다 약 ${Math.abs(delta)}% 저렴합니다.`;
  if (delta >= 10) return `비교군 평균보다 약 ${delta}% 높습니다.`;

  return "비교군 평균 시세와 비슷한 가격대입니다.";
}

function buildDedupeKey(car: NormalizedCar) {
  return [car.source, car.id, car.title, car.year, car.mileage].join(":");
}

function normalizeFailure(reason: unknown) {
  if (isProviderFailure(reason) && reason.error instanceof ApiClientError) {
    return {
      source: reason.source,
      error: `${reason.error.code}: ${reason.error.message}`,
    };
  }

  if (isProviderFailure(reason) && reason.error instanceof Error) {
    return {
      source: reason.source,
      error: reason.error.message,
    };
  }

  return {
    source: "unknown",
    error: "Unknown provider failure",
  };
}

function findFirstMatch(input: string, candidates: readonly string[]) {
  return candidates.find((candidate) => input.includes(candidate));
}

function extractSingleBound(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  return match ? Number(match[1]) : undefined;
}

function extractPrice(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  return match ? Number(match[1]) : undefined;
}

function extractMileage(input: string) {
  const match = input.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:km|킬로|만km|만 키로|만키로)/i);

  if (!match) return undefined;

  const normalized = Number(match[1].replaceAll(",", ""));
  if (Number.isNaN(normalized)) return undefined;

  if (match[0].includes("만")) {
    return normalized * 10000;
  }

  return normalized;
}

function inferFuelType(input: string): CarSearchParams["fuelType"] {
  if (/디젤|diesel/i.test(input)) return "diesel";
  if (/하이브리드|hybrid/i.test(input)) return "hybrid";
  if (/전기|electric|ev/i.test(input)) return "electric";
  if (/lpg/i.test(input)) return "lpg";
  if (/가솔린|휘발유|gasoline/i.test(input)) return "gasoline";
  return undefined;
}

function inferTransmission(input: string): CarSearchParams["transmission"] {
  if (/수동|manual/i.test(input)) return "manual";
  if (/오토|자동|auto/i.test(input)) return "auto";
  return undefined;
}

function createResultId() {
  return `search_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isProviderFailure(
  reason: unknown
): reason is { source: string; error: unknown } {
  return (
    typeof reason === "object" &&
    reason !== null &&
    "source" in reason &&
    "error" in reason
  );
}

const BRAND_KEYWORDS = [
  "현대",
  "기아",
  "제네시스",
  "쉐보레",
  "르노",
  "쌍용",
  "BMW",
  "벤츠",
  "아우디",
  "테슬라",
] as const;

const MODEL_KEYWORDS = [
  "아반떼",
  "쏘나타",
  "그랜저",
  "K3",
  "K5",
  "K8",
  "쏘렌토",
  "스포티지",
  "카니발",
  "GV80",
] as const;

const REGION_KEYWORDS = [
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "광주",
  "대전",
  "울산",
  "세종",
] as const;
