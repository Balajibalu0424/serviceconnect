import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  apiRequest,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/queryClient";

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "CUSTOMER" | "PROFESSIONAL" | "ADMIN" | "SUPPORT";
  status: string;
  creditBalance: number;
  onboardingCompleted: boolean;
  emailVerified: boolean;
  phoneVerified?: boolean;
  firstJobId?: string | null;
  avatarUrl?: string;
  bio?: string | null;
  notificationPreferences?: any;
  profile?: any;
  createdAt?: string | Date;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, turnstileToken?: string | null) => Promise<AuthUser>;
  register: (userData: any) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function readError(res: Response) {
  const payload = await res.json().catch(() => ({}));
  return payload.error || payload.message || "Request failed";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const res = await apiRequest("GET", "/api/auth/me");
      if (!res.ok) {
        setUser(null);
        return null;
      }

      const data = (await res.json()) as AuthUser;
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchUser();
  }, []);

  const login = async (email: string, password: string, turnstileToken?: string | null) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password, turnstileToken: turnstileToken ?? undefined });
    if (!res.ok) {
      throw new Error(await readError(res));
    }

    const data = await res.json();
    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
    }
    setUser(data.user);
    return data.user as AuthUser;
  };

  const register = async (userData: any) => {
    const res = await apiRequest("POST", "/api/auth/register", userData);
    if (!res.ok) {
      throw new Error(await readError(res));
    }

    const data = await res.json();
    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
    }
    setUser(data.user);
    return data.user as AuthUser;
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    await apiRequest("POST", "/api/auth/logout", { refreshToken }).catch(() => {});
    clearTokens();
    setUser(null);
    window.location.hash = "/";
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
