import { createContext, useContext, useEffect, useState } from "react";
import {
  useAuth as useClerkAuth,
  useSignIn,
} from "@clerk/clerk-react";
import {
  apiRequest,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  registerClerkTokenResolver,
  setTokens,
} from "@/lib/queryClient";
import { isClerkFrontendEnabled } from "@/lib/clerk";

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
  authSource?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (userData: any) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  completeSignInWithToken: (signInToken: string) => Promise<AuthUser>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function readError(res: Response) {
  const payload = await res.json().catch(() => ({}));
  return payload.error || payload.message || "Request failed";
}

function LegacyAuthProviderImpl({ children }: { children: React.ReactNode }) {
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

  const login = async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
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

  const completeSignInWithToken = async () => {
    throw new Error("Clerk sign-in is not configured in this environment.");
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
        completeSignInWithToken,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function ClerkAuthProviderImpl({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const clerkAuth = useClerkAuth();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();

  useEffect(() => {
    registerClerkTokenResolver(async () => {
      if (!clerkAuth.isLoaded || !clerkAuth.isSignedIn) {
        return null;
      }
      return clerkAuth.getToken();
    });

    return () => registerClerkTokenResolver(null);
  }, [clerkAuth]);

  const fetchUser = async () => {
    if (!clerkAuth.isLoaded) {
      return null;
    }

    const hasLegacySession = Boolean(getAccessToken());
    if (!clerkAuth.isSignedIn && !hasLegacySession) {
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
  }, [clerkAuth.isLoaded, clerkAuth.isSignedIn, clerkAuth.sessionId]);

  const completeSignInWithToken = async (signInToken: string) => {
    if (!signInLoaded || !signIn || !setActive) {
      throw new Error("Authentication is still loading. Please try again.");
    }

    const result = await signIn.create({ strategy: "ticket", ticket: signInToken } as any);
    if (!result.createdSessionId) {
      throw new Error("Clerk did not create a session.");
    }

    await setActive({ session: result.createdSessionId });
    const nextUser = await fetchUser();
    if (!nextUser) {
      throw new Error("Unable to load your account after sign-in.");
    }
    return nextUser;
  };

  const login = async (email: string, password: string) => {
    clearTokens();

    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    if (!res.ok) {
      throw new Error(await readError(res));
    }

    const data = await res.json();
    if (data.signInToken) {
      return completeSignInWithToken(data.signInToken);
    }

    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
      const nextUser = (await fetchUser()) || (data.user as AuthUser);
      setUser(nextUser);
      return nextUser;
    }

    throw new Error("Login did not return a usable session.");
  };

  const register = async (userData: any) => {
    const res = await apiRequest("POST", "/api/auth/register", userData);
    if (!res.ok) {
      throw new Error(await readError(res));
    }

    const data = await res.json();
    if (data.signInToken) {
      return completeSignInWithToken(data.signInToken);
    }

    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
      const nextUser = (await fetchUser()) || (data.user as AuthUser);
      setUser(nextUser);
      return nextUser;
    }

    setUser(data.user);
    return data.user as AuthUser;
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    await apiRequest("POST", "/api/auth/logout", { refreshToken }).catch(() => {});
    clearTokens();
    if (clerkAuth.isSignedIn) {
      await clerkAuth.signOut();
    }
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
        completeSignInWithToken,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (isClerkFrontendEnabled()) {
    return <ClerkAuthProviderImpl>{children}</ClerkAuthProviderImpl>;
  }

  return <LegacyAuthProviderImpl>{children}</LegacyAuthProviderImpl>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
