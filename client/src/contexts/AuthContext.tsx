import { createContext, useContext, useState, useEffect } from "react";
import { apiRequest, setTokens, clearTokens, getAccessToken, getRefreshToken } from "@/lib/queryClient";

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "CUSTOMER" | "PROFESSIONAL" | "ADMIN" | "SUPPORT";
  status: string;
  creditBalance: number;
  onboardingCompleted: boolean;
  avatarUrl?: string;
  profile?: any;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    const token = getAccessToken();
    if (!token) { setIsLoading(false); return; }
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
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
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
