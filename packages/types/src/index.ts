// ─── 연료 / 변속기 / 플랫폼 ────────────────────────────────────────────────────

export type FuelType = "gasoline" | "diesel" | "hybrid" | "electric" | "lpg";
export type Transmission = "auto" | "manual";
export type CarSource = "encar" | "kb" | "heydealer" | "bobaedream" | "joongna";

// ─── 검색 파라미터 ─────────────────────────────────────────────────────────────

export interface CarSearchParams {
  brand?: string;          // 브랜드 (현대, 기아, BMW 등)
  model?: string;          // 모델명 (아반떼, K5 등)
  minYear?: number;        // 최소 연식
  maxYear?: number;        // 최대 연식
  minPrice?: number;       // 최소 가격 (만원)
  maxPrice?: number;       // 최대 가격 (만원)
  maxMileage?: number;     // 최대 주행거리 (km)
  fuelType?: FuelType;
  transmission?: Transmission;
  region?: string;         // 지역 (서울, 경기 등)
  noAccident?: boolean;    // 무사고 여부
  rawQuery: string;        // 원본 자연어 입력
}

// ─── 중고차 매물 ────────────────────────────────────────────────────────────────

export interface NormalizedCar {
  id: string;
  source: CarSource;
  title: string;           // 매물명 (예: "2021 아반떼 CN7 1.6 가솔린")
  brand: string;           // 브랜드
  model: string;           // 모델명
  trim?: string;           // 트림
  year: number;            // 연식
  mileage: number;         // 주행거리 (km)
  price: number;           // 가격 (만원)
  fuelType: FuelType;
  transmission: Transmission;
  color?: string;          // 색상
  region: string;          // 지역
  hasInspection: boolean;  // 성능점검 여부
  accidentCount: number;   // 사고 횟수
  isLeaseReturn: boolean;  // 리스/렌트 반납 여부
  images: string[];        // 이미지 URLs
  listingUrl: string;      // 원본 매물 URL
  dealerName: string;      // 딜러/판매자명
  postedAt: string;        // ISO 8601
  expiresAt: string;       // ISO 8601 — 매물 유효 기한
}

// ─── 검색 결과 ─────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  searchParams: CarSearchParams;
  cars: RankedCar[];
  generatedAt: string;     // ISO 8601
}

export interface RankedCar {
  rank: number;            // 1~5
  car: NormalizedCar;
  score: number;           // AI 가중 점수 (가격 + 상태 + 연식)
  summary: string;         // AI 생성 추천 이유
  priceAnalysis: string;   // 시세 대비 분석 (예: "시세보다 15% 저렴")
}

// ─── 에러 ──────────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
