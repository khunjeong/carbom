import { carSearchParamsSchema } from "./schemas";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface SearchCarsOptions {
  signal?: AbortSignal;
}

export interface HttpJsonOptions {
  method?: "GET" | "POST";
  headers?: HeadersInit;
  searchParams?: URLSearchParams;
  body?: string;
  signal?: AbortSignal;
}

export async function fetchJson<T>(
  input: URL,
  options: HttpJsonOptions = {}
): Promise<T> {
  const { method = "GET", headers, searchParams, body, signal } = options;

  if (searchParams) {
    input.search = searchParams.toString();
  }

  const response = await fetch(input, {
    method,
    headers,
    body,
    signal,
  });

  if (!response.ok) {
    let details: unknown;

    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    throw new ApiClientError(
      "HTTP_ERROR",
      `Request failed with status ${response.status}`,
      details
    );
  }

  return (await response.json()) as T;
}

export function validateSearchParams(input: unknown) {
  return carSearchParamsSchema.parse(input);
}

export function createFutureIsoDate(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}
