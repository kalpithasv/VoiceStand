import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAccessToken, setAccessToken, clearAccessToken } from "./token";

type AuthContextValue = {
  token: string | null;
  loading: boolean;
  refreshToken: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshToken() {
    const t = await getAccessToken();
    setToken(t);
  }

  useEffect(() => {
    refreshToken().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      loading,
      refreshToken,
      login: async (newToken) => {
        await setAccessToken(newToken);
        setToken(newToken);
      },
      logout: async () => {
        await clearAccessToken();
        setToken(null);
      },
    }),
    [token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

