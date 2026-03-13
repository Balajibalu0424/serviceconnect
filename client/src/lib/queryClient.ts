import { QueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

function getApiBase() {
  // Always use relative URLs — works on localhost (same port), Vercel (same domain),
  // and any other deployment. The __PORT_5000__ placeholder was for Perplexity's
  // static hosting only and must NOT be used on Vercel.
  return API_BASE;
}

// In-memory token store — replaces localStorage (blocked in sandboxed iframes)
const tokenStore: { accessToken: string | null; refreshToken: string | null } = {
  accessToken: null,
  refreshToken: null,
};

export function setTokens(accessToken: string, refreshToken: string) {
  tokenStore.accessToken = accessToken;
  tokenStore.refreshToken = refreshToken;
}

export function clearTokens() {
  tokenStore.accessToken = null;
  tokenStore.refreshToken = null;
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
