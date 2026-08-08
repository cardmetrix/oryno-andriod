import { ApiError, api, apiFetch, type ApiFetchOptions } from '@/lib/api';
import {
  clearAdminSessionToken,
  getAdminSessionToken,
  setAdminSessionToken,
} from '@/lib/admin/session';
import type { AdminLoginResponse, AdminMeResponse } from '@/lib/admin/types';
import { endpoints } from '@/lib/endpoints';

export { ApiError };

/** Admin API call — Clerk Bearer + X-Oryno-Admin-Session. */
export async function adminFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const session = await getAdminSessionToken();
  const headers = new Headers(init?.headers ?? {});
  if (session) headers.set('X-Oryno-Admin-Session', session);
  return apiFetch<T>(path, { ...init, headers });
}

export const adminApi = {
  get: <T>(path: string, init?: ApiFetchOptions) => adminFetch<T>(path, init),
  post: <T>(path: string, body?: unknown, init?: ApiFetchOptions) =>
    adminFetch<T>(path, {
      ...init,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown, init?: ApiFetchOptions) =>
    adminFetch<T>(path, {
      ...init,
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, init?: ApiFetchOptions) =>
    adminFetch<T>(path, { ...init, method: 'DELETE' }),
};

export async function fetchAdminMe(): Promise<AdminMeResponse> {
  const attempt = async () => adminApi.get<AdminMeResponse>(endpoints.admin.me);

  try {
    return await attempt();
  } catch (error) {
    // One retry for flaky DB / hotspot timeouts (503/500).
    if (
      error instanceof ApiError &&
      (error.status === 500 || error.status === 503)
    ) {
      try {
        await new Promise((r) => setTimeout(r, 400));
        return await attempt();
      } catch (retryError) {
        error = retryError;
      }
    }

    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      const body = (error.body ?? {}) as AdminMeResponse;
      return {
        ok: false,
        signedIn: error.status !== 401,
        isAdmin: Boolean(body.isAdmin),
        canBootstrap: Boolean(body.canBootstrap),
        session: false,
        email: body.email,
        reason: body.reason,
        admin: body.admin,
        ...body,
      };
    }

    // Soft-fail so home/admin gate doesn't hard-crash on transient DB outages.
    if (error instanceof ApiError && (error.status >= 500 || error.status === 0)) {
      return {
        ok: false,
        signedIn: true,
        isAdmin: false,
        session: false,
        reason: 'unavailable',
        error: error.message,
      };
    }

    throw error;
  }
}

export async function adminLogin(passcode: string): Promise<AdminLoginResponse> {
  const data = await api.post<AdminLoginResponse>(endpoints.admin.login, { passcode });
  if (data.sessionToken) {
    await setAdminSessionToken(data.sessionToken);
  }
  return data;
}

export async function adminLogout(): Promise<void> {
  try {
    await adminApi.post(endpoints.admin.logout);
  } catch {
    // still clear local session
  } finally {
    await clearAdminSessionToken();
  }
}
