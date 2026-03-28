import { QueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

function getApiBase() {
  // Always use relative URLs — works on localhost (same port), Vercel (same domain),
  // and any other deployment. The __PORT_5000__ placeholder was for Perplexity's
  // static hosting only and must NOT be used on Vercel.
  return API_BASE;
}

// Token store — persists to localStorage so sessions survive page refreshes.
// Falls back to in-memory only when localStorage is unavailable (sandboxed iframes).
const TOKEN_KEYS = { access: "sc_access_token", refresh: "sc_refresh_token" } as const;

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* sandboxed — ignore */ }
}
function safeRemoveItem(key: string) {
  try { localStorage.removeItem(key); } catch { /* sandboxed — ignore */ }
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

export async function apiRequest(method: string, url: string, body?: unknown) {
  const token = tokenStore.accessToken;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Try refresh
    const refreshToken = tokenStore.refreshToken;
    if (refreshToken) {
      const refreshRes = await fetch(`${getApiBase()}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const { accessToken } = await refreshRes.json();
        tokenStore.accessToken = accessToken;
        safeSetItem(TOKEN_KEYS.access, accessToken);
        headers["Authorization"] = `Bearer ${accessToken}`;
        return fetch(`${getApiBase()}${url}`, {
          method, headers, body: body ? JSON.stringify(body) : undefined
        });
      }
    }
    clearTokens();
    window.location.hash = "/login";
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
