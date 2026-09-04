'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { apiClient } from './api';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  mfaEnabled?: boolean;
}

interface LoginResult {
  accessToken?: string;
  refreshToken?: string;
  user: AuthUser;
  mfaRequired?: boolean;
  mfaTicket?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfa: (ticket: string, code: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'ts_token';
const USER_KEY = 'ts_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  /**
   * Attempt a password login. When the account has MFA enabled the server
   * responds with mfaRequired + a ticket instead of tokens; the caller must
   * then complete the flow via verifyMfa().
   */
  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await apiClient.post<LoginResult>('/auth/login', { email, password });
    if (res.mfaRequired) {
      return res; // do NOT persist session yet
    }
    localStorage.setItem(TOKEN_KEY, res.accessToken!);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setToken(res.accessToken!);
    setUser(res.user);
    return res;
  }, []);

  const verifyMfa = useCallback(async (ticket: string, code: string) => {
    const res = await apiClient.post<LoginResult>('/auth/mfa/verify', { ticket, code });
    if (res.mfaRequired || !res.accessToken) {
      throw new Error('MFA verification failed');
    }
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await apiClient.get<AuthUser>('/auth/me', token);
      localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      setUser(fresh);
    } catch {
      /* token may be expired; ignore */
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, verifyMfa, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
