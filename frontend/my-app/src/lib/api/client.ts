// ─── Backend API Client ───────────────────────────────────────────────────────
// Base URL reads from env; falls back to same-origin proxy (/backend).
// All fetches use Next.js cache revalidation so data stays fresh.
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/backend';

function resolveBaseUrl(): string {
  if (/^https?:\/\//i.test(BASE_URL)) return BASE_URL;

  // Browser can use same-origin relative paths (rewrites handle /backend).
  if (typeof window !== 'undefined') return BASE_URL;

  // Node/server fetch requires absolute URLs.
  const serverApi = process.env.API_BASE_URL ?? process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (serverApi && /^https?:\/\//i.test(serverApi)) return serverApi;

  // Safe local default for server-side rendering.
  return 'http://localhost:8000';
}

// Revalidation windows (seconds)
export const REVALIDATE = {
  LIVE:    15,   // quotes, stats     → 15s
  HISTORY: 60,   // OHLCV history     → 60s
  SLOW:   300,   // insights, alerts  → 5 min
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`[${status}] ${endpoint}: ${message}`);
  }
}

function errorMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(item => {
      const field = Array.isArray(item?.loc) ? item.loc.filter((part: unknown) => part !== 'body').join('.') : '';
      return `${field ? `${field}: ` : ''}${item?.msg ?? 'Invalid input'}`;
    }).join('; ');
  }
  return undefined;
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit & { revalidate?: number },
): Promise<T> {
  const { revalidate = REVALIDATE.LIVE, ...fetchOptions } = options ?? {};
  const url = `${resolveBaseUrl()}${endpoint}`;
  let res: Response;
  try {
    // `next.revalidate` is only meaningful on the server; browser fetch ignores it.
    res = await fetch(url, {
      ...fetchOptions,
      ...(typeof window === 'undefined' ? { next: { revalidate } } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    throw new ApiError(
      0,
      endpoint,
      `Failed to reach API at ${url}. ${message}. Check backend availability and NEXT_PUBLIC_API_URL.`,
    );
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = errorMessage(body?.error ?? body?.detail) ?? message;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, endpoint, message);
  }

  return res.json() as Promise<T>;
}

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const url = `${resolveBaseUrl()}${endpoint}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    throw new ApiError(
      0,
      endpoint,
      `Failed to reach API at ${url}. ${message}. Check backend availability and NEXT_PUBLIC_API_URL.`,
    );
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const b = await res.json();
      message = errorMessage(b?.error ?? b?.detail) ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, endpoint, message);
  }

  return res.json() as Promise<T>;
}
