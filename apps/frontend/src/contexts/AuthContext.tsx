import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthUserDto } from '@football-gm/contracts';
import { TOKEN_KEY, API } from '../constants';

interface AuthState {
  token: string | null;
  user: AuthUserDto | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchMe(token: string): Promise<AuthUserDto | null> {
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json() as Promise<AuthUserDto>;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount (or token change), validate and fetch the user
  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchMe(token).then((u) => {
      if (!u) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } else {
        setUser(u);
      }
      setIsLoading(false);
    });
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { message?: string }).message ?? 'Error al iniciar sesión';
      throw new Error(msg);
    }
    const data = await res.json() as { accessToken: string; user: AuthUserDto };
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const u = await fetchMe(token);
    if (u) setUser(u);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading,
        isAdmin: user?.role === 'admin',
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
