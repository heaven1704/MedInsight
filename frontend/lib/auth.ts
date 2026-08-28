"use client";

import { useEffect, useState } from "react";
import { api, clearTokens, setTokens } from "./api";
import type { CurrentUser, LoginResponse } from "@/types";

// ── Login ──────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string
): Promise<CurrentUser> {
  const data = await api.post<LoginResponse>(
    "/api/auth/login/",
    { username, password },
    { skipAuth: true }
  );
  setTokens(data.access, data.refresh);
  // Cache the user profile in sessionStorage so we don't need an extra /me/ call
  sessionStorage.setItem("currentUser", JSON.stringify(data.user));
  return data.user;
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const { getRefreshToken } = await import("./api");
  const refresh = getRefreshToken();
  try {
    if (refresh) {
      await api.post("/api/auth/logout/", { refresh });
    }
  } catch {
    /* best-effort blacklist — clear locally regardless */
  } finally {
    clearTokens();
    sessionStorage.removeItem("currentUser");
  }
}

// ── Current user ───────────────────────────────────────────────────────────

function getCachedUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("currentUser");
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

/**
 * useCurrentUser — returns the authenticated user from session cache or
 * fetches /api/auth/me/ if the cache is empty (e.g. after a hard refresh).
 *
 * Returns { user, loading, error }.
 * `user` is null while loading or when unauthenticated.
 */
export function useCurrentUser(): {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
} {
  const [user, setUser] = useState<CurrentUser | null>(() => getCachedUser());
  const [loading, setLoading] = useState<boolean>(!getCachedUser());
  const [error, setError] = useState<string | null>(null);

  // Cached users finish the loading transition when the auth effect runs.
  useEffect(() => {
    if (user) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    let cancelled = false;

    api
      .get<CurrentUser>("/api/auth/me/")
      .then((u) => {
        if (!cancelled) {
          sessionStorage.setItem("currentUser", JSON.stringify(u));
          setUser(u);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { user, loading, error };
}
