import { QueryClient } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_URL || "").trim();
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function getApiBase() {
  if (!API_BASE) {
    return "";
  }

  if (typeof window === "undefined") {
    return API_BASE;
  }

  try {
    const candidate = new URL(API_BASE, window.location.origin);
    if (LOCAL_API_HOSTS.has(candidate.hostname) && !LOCAL_API_HOSTS.has(window.location.hostname)) {
      return "";
    }

    return candidate.origin === window.location.origin ? "" : candidate.origin;
  } catch {
    return "";
  }
}

const TOKEN_KEYS = { access: "sc_access_token", refresh: "sc_refresh_token" } as const;
let clerkTokenResolver: null | (() => Promise<string | null>) = null;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // sandboxed - ignore
  }
}

function safeRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // sandboxed - ignore
  }
}

const tokenStore: { accessToken: string | null; refreshToken: string | null } = {
  accessToken: safeGetItem(TOKEN_KEYS.access),
  refreshToken: safeGetItem(TOKEN_KEYS.refresh),
};

export function setTokens(accessToken: string, refreshToken: string) {
  tokenStore.accessToken = accessToken;
  tokenStore.refreshToken = refreshToken;
  safeSetItem(TOKEN_KEYS.access, accessToken);
  safeSetItem(TOKEN_KEYS.refresh, refreshToken);
}

export function clearTokens() {
  tokenStore.accessToken = null;
  tokenStore.refreshToken = null;
  safeRemoveItem(TOKEN_KEYS.access);
  safeRemoveItem(TOKEN_KEYS.refresh);
}

export function getAccessToken() {
  return tokenStore.accessToken;
}

export function getRefreshToken() {
  return tokenStore.refreshToken;
}

export function registerClerkTokenResolver(resolver: (() => Promise<string | null>) | null) {
  clerkTokenResolver = resolver;
}

export async function getAuthHeaders(extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = tokenStore.accessToken || (clerkTokenResolver ? await clerkTokenResolver().catch(() => null) : null);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function apiRequest(method: string, url: string, body?: unknown) {
  const usingLegacyToken = Boolean(tokenStore.accessToken || tokenStore.refreshToken);
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });

  const res = await fetch(`${getApiBase()}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    const refreshToken = tokenStore.refreshToken;
    if (refreshToken) {
      const refreshRes = await fetch(`${getApiBase()}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        credentials: "include",
      });
      if (refreshRes.ok) {
        const { accessToken } = await refreshRes.json();
        tokenStore.accessToken = accessToken;
        safeSetItem(TOKEN_KEYS.access, accessToken);
        headers.Authorization = `Bearer ${accessToken}`;
        return fetch(`${getApiBase()}${url}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            credentials: "include",
          });
      }
    }
    if (usingLegacyToken) {
      clearTokens();
      window.location.hash = "/login";
    }
  }

  return res;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [url] = queryKey as [string, ...unknown[]];
        const res = await apiRequest("GET", url);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || "Request failed");
        }
        return res.json();
      },
      staleTime: 30000,
      retry: 1,
    },
  },
});
