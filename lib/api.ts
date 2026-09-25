import { API_BASE_URL, API_PREFIX, PREFER_EXTERNAL_API } from '@/lib/config';

const LOG_PREFIX = '[ORYNO API]';
const MAX_CONCURRENT = 2;
const NETWORK_RETRIES = 2;
const TOKEN_CACHE_MS = 8_000;

function devLog(...args: unknown[]) {
  if (__DEV__) console.log(...args);
}

function devWarn(...args: unknown[]) {
  if (__DEV__) console.warn(...args);
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type TokenGetter = () => Promise<string | null | undefined>;

let tokenGetter: TokenGetter | null = null;
let authReady = false;
const authReadyWaiters: Array<() => void> = [];

let cachedToken: string | null = null;
let cachedTokenAt = 0;
let tokenInFlight: Promise<string | null> | null = null;

let activeRequests = 0;
const waitQueue: Array<() => void> = [];

export function setApiTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
  cachedToken = null;
  cachedTokenAt = 0;
}

export function setApiAuthReady(ready: boolean) {
  authReady = ready;
  if (ready) {
    devLog(`${LOG_PREFIX} auth ready`);
    while (authReadyWaiters.length) {
      authReadyWaiters.shift()?.();
    }
  }
}

export function isApiAuthReady() {
  return authReady;
}

/** Wait until Clerk has loaded and the token bridge is wired. */
export function waitForApiAuth(timeoutMs = 8000): Promise<void> {
  if (authReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ApiError('Auth not ready', 401, { error: 'Auth not ready' }));
    }, timeoutMs);
    authReadyWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function isNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === 'TypeError' ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  );
}

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
  }
  activeRequests += 1;
  try {
    return await fn();
  } finally {
    activeRequests -= 1;
    waitQueue.shift()?.();
  }
}

/** Strip to a path under /api/... */
export function toLegacyApiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  let p = path.startsWith('/') ? path : `/${path}`;

  if (p.startsWith('/api/external/v1')) {
    p = `/api${p.slice('/api/external/v1'.length)}` || '/api';
  } else if (p.startsWith('/api/external/')) {
    const rest = p.replace(/^\/api\/external\/[^/]+/, '');
    p = `/api${rest || ''}`;
  } else if (!p.startsWith('/api/')) {
    p = `/api${p.startsWith('/') ? p : `/${p}`}`;
  }

  return p;
}

/**
 * Resolve a logical API path for the configured prefix.
 * Accepts `/api/wallet`, `/wallet`, or full `/api/external/v1/wallet`.
 * Admin is always first-party `/api/admin` (not exposed on external API).
 */
export function resolveApiPath(path: string, prefix = API_PREFIX): string {
  if (/^https?:\/\//i.test(path)) return path;

  let p = path.startsWith('/') ? path : `/${path}`;

  // Admin console — never route through /api/external (blocked server-side).
  if (p.includes('/admin')) {
    return toLegacyApiPath(p.startsWith('/api') ? p : `/api${p}`);
  }

  // Already absolute for chosen prefix
  if (prefix.startsWith('/api/external') && p.startsWith('/api/external/')) {
    return p;
  }
  if (prefix === '/api' && p.startsWith('/api/') && !p.startsWith('/api/external/')) {
    return p;
  }

  // Normalize to remainder after /api or /api/external/v1
  if (p.startsWith('/api/external/v1')) {
    p = p.slice('/api/external/v1'.length) || '/';
  } else if (p.startsWith('/api/')) {
    p = p.slice('/api'.length);
  }

  if (!p.startsWith('/')) p = `/${p}`;
  return `${prefix}${p === '/' ? '' : p}`;
}

function safeBodyPreview(body: BodyInit | null | undefined): unknown {
  if (body == null) return undefined;
  if (typeof body !== 'string') return '[non-json body]';
  try {
    return JSON.parse(body);
  } catch {
    return body.length > 200 ? `${body.slice(0, 200)}…` : body;
  }
}

async function resolveToken(requireAuth: boolean): Promise<string | null> {
  if (!authReady) {
    devLog(`${LOG_PREFIX} waiting for auth bridge…`);
    await waitForApiAuth();
  }

  if (!tokenGetter) {
    if (requireAuth) {
      throw new ApiError('Not authenticated', 401, { error: 'Not authenticated' });
    }
    return null;
  }

  if (cachedToken && Date.now() - cachedTokenAt < TOKEN_CACHE_MS) {
    return cachedToken;
  }

  if (tokenInFlight) {
    const shared = await tokenInFlight;
    if (shared || !requireAuth) return shared;
  }

  tokenInFlight = (async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const token = (await tokenGetter!()) ?? null;
      if (token) {
        cachedToken = token;
        cachedTokenAt = Date.now();
        return token;
      }
      if (!requireAuth) return null;
      await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
    }
    return null;
  })();

  try {
    const token = await tokenInFlight;
    if (!token && requireAuth) {
      throw new ApiError('Missing session token', 401, { error: 'Missing session token' });
    }
    return token;
  } finally {
    tokenInFlight = null;
  }
}

export type ApiFetchOptions = RequestInit & {
  /** Default true — wait for Clerk and attach Bearer token. */
  auth?: boolean;
  /** Skip automatic fallback from external → /api */
  noFallback?: boolean;
};

async function rawFetchOnce<T>(
  url: string,
  method: string,
  headers: Headers,
  init: ApiFetchOptions | undefined,
  meta: { logicalPath: string; resolvedPath: string; hasToken: boolean },
): Promise<T> {
  const started = Date.now();
  devLog(`${LOG_PREFIX} → ${method} ${url}`, {
    ...meta,
    body: safeBodyPreview(init?.body ?? null),
  });

  try {
    const res = await fetch(url, {
      ...init,
      headers,
    });

    const json = await res.json().catch(() => ({}));
    const ms = Date.now() - started;

    if (!res.ok) {
      const message =
        typeof json === 'object' && json && 'error' in json
          ? String((json as { error?: string }).error ?? res.statusText)
          : res.statusText;
      devWarn(`${LOG_PREFIX} ← ${method} ${url} ${res.status} (${ms}ms)`, {
        error: message,
        body: json,
      });
      throw new ApiError(message || 'Request failed', res.status, json);
    }

    devLog(`${LOG_PREFIX} ← ${method} ${url} ${res.status} (${ms}ms)`, {
      body: json,
    });

    return json as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const ms = Date.now() - started;
    // Network blips are expected on mobile — warn, don't red-screen the console.
    devWarn(`${LOG_PREFIX} ✕ ${method} ${url} network error (${ms}ms)`, error);
    throw error;
  }
}

async function rawFetch<T>(
  url: string,
  method: string,
  headers: Headers,
  init: ApiFetchOptions | undefined,
  meta: { logicalPath: string; resolvedPath: string; hasToken: boolean },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      return await withConcurrencyLimit(() =>
        rawFetchOnce<T>(url, method, headers, init, meta),
      );
    } catch (error) {
      lastError = error;
      if (!isNetworkError(error) || attempt >= NETWORK_RETRIES) throw error;
      const delay = 400 * (attempt + 1);
      devWarn(`${LOG_PREFIX} retry ${attempt + 1}/${NETWORK_RETRIES} in ${delay}ms`, {
        path: meta.resolvedPath,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const requireAuth = init?.auth !== false;
  const headers = new Headers(init?.headers ?? {});
  headers.set('Accept', 'application/json');
  headers.set('X-Oryno-Client', 'oryno-africa');
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = await resolveToken(requireAuth);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    // Survives apex→www redirects that strip Authorization (RN fetch).
    headers.set('X-Oryno-Clerk-Token', token);
  }

  try {
    const { getTwoFactorToken } = await import('@/lib/two-factor');
    const twoFa = await getTwoFactorToken();
    if (twoFa) headers.set('X-Oryno-2FA', twoFa);
  } catch {
    // 2FA token is optional until the user completes authenticator challenge
  }

  const primaryPath = resolveApiPath(path);
  const primaryUrl = /^https?:\/\//i.test(primaryPath)
    ? primaryPath
    : `${API_BASE_URL}${primaryPath}`;

  try {
    return await rawFetch<T>(primaryUrl, method, headers, init, {
      logicalPath: path,
      resolvedPath: primaryPath,
      hasToken: Boolean(token),
    });
  } catch (error) {
    const canFallback =
      !init?.noFallback &&
      error instanceof ApiError &&
      (error.status === 401 || error.status === 404 || error.status === 503) &&
      // Prefer external → first-party, or first-party → external when enabled
      (PREFER_EXTERNAL_API || primaryPath.startsWith('/api/external'));

    if (!canFallback) throw error;

    // If primary was external, fall back to /api; if primary was /api, try external.
    const legacyPath = primaryPath.startsWith('/api/external')
      ? toLegacyApiPath(path)
      : resolveApiPath(path, '/api/external/v1');
    const legacyUrl = `${API_BASE_URL}${legacyPath}`;
    devWarn(`${LOG_PREFIX} falling back`, {
      from: primaryPath,
      to: legacyPath,
      reason: (error as ApiError).message,
      status: (error as ApiError).status,
    });

    return rawFetch<T>(legacyUrl, method, headers, { ...init, noFallback: true }, {
      logicalPath: path,
      resolvedPath: legacyPath,
      hasToken: Boolean(token),
    });
  }
}

/** Session token used by authenticated downloads (PDF, etc.). */
export async function getApiAccessToken() {
  return resolveToken(true);
}

export const api = {
  get: <T>(path: string, init?: ApiFetchOptions) => apiFetch<T>(path, init),
  post: <T>(path: string, body?: unknown, init?: ApiFetchOptions) =>
    apiFetch<T>(path, {
      ...init,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown, init?: ApiFetchOptions) =>
    apiFetch<T>(path, {
      ...init,
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: 'DELETE' }),
};
