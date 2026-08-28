"use client";

import Cookies from "js-cookie";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Token helpers ──────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return Cookies.get("access") ?? null;
}

export function getRefreshToken(): string | null {
  return Cookies.get("refresh") ?? null;
}

export function setTokens(access: string, refresh: string): void {
  // 1-hour access, 7-day refresh — matches SIMPLE_JWT settings
  Cookies.set("access", access, { expires: 1 / 24, sameSite: "strict" });
  Cookies.set("refresh", refresh, { expires: 7, sameSite: "strict" });
}

export function clearTokens(): void {
  Cookies.remove("access");
  Cookies.remove("refresh");
}

// ── Internal: attempt token refresh ───────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return null;

    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        clearTokens();
        return null;
      }

      const data = await res.json();
      // SimpleJWT returns new access + new refresh when ROTATE_REFRESH_TOKENS=True
      setTokens(data.access, data.refresh ?? refresh);
      return data.access as string;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);
  headers.set("Content-Type", "application/json");

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  // Auto-refresh on 401 then retry once
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(`${BASE_URL}${path}`, {
        ...fetchOptions,
        headers,
      });
    } else {
      // Refresh failed — redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!res.ok) {
    // Try to surface the backend's error message
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message =
        body?.detail ??
        body?.non_field_errors?.[0] ??
        Object.values(body as Record<string, string[]>)
          .flat()
          .join(". ") ??
        message;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Convenience methods ────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, opts?: ApiOptions) =>
    apiFetch<T>(path, { method: "GET", ...opts }),

  post: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    apiFetch<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      ...opts,
    }),

  patch: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    apiFetch<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...opts,
    }),

  put: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    apiFetch<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      ...opts,
    }),

  delete: <T>(path: string, opts?: ApiOptions) =>
    apiFetch<T>(path, { method: "DELETE", ...opts }),
};
