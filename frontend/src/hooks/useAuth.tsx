import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccountType, AuthTokens, User } from '../types/auth.types';
import { authApi } from '../lib/auth.api';

interface AuthState {
  isAuthenticated: boolean;
  accountType: AccountType | null;
  userId: string | null;
  user: User | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  setTokens: (tokens: AuthTokens) => void;
  clearAuth: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwt(token: string): { sub: string; email: string; account_type: AccountType; exp: number } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function getTokenExpiry(token: string): number {
  const payload = parseJwt(token);
  return payload ? payload.exp * 1000 : 0;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    accountType: null,
    userId: null,
    user: null,
    isLoading: true,
  });
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const fetchUser = useCallback(async (_userId: string) => {
    try {
      const res = await authApi.getProfile();
      if (res.data) {
        setState((s) => ({ ...s, user: res.data as User }));
      } else {
        throw new Error('No user data returned');
      }
    } catch (err: any) {
      setState((s) => ({ ...s, user: null }));
      throw err;
    }
  }, []);

  const scheduleRefresh = useCallback((accessToken: string) => {
    clearRefreshTimer();
    const expiry = getTokenExpiry(accessToken);
    const now = Date.now();
    const timeUntilExpiry = expiry - now;
    const delay = Math.max(timeUntilExpiry - 60 * 1000, 0);

    refreshTimerRef.current = setTimeout(async () => {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        clearAuth();
        return;
      }
      try {
        const res = await authApi.refreshToken(refreshToken);
        if (res.data) {
          setTokens(res.data);
        } else {
          clearAuth();
        }
      } catch {
        clearAuth();
      }
    }, delay);
  }, []);

  const setTokens = useCallback((tokens: AuthTokens) => {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    const payload = parseJwt(tokens.access_token);
    if (payload) {
      setState({
        isAuthenticated: true,
        accountType: payload.account_type,
        userId: payload.sub,
        user: null,
        isLoading: false,
      });
      fetchUser(payload.sub).catch(() => {});
      scheduleRefresh(tokens.access_token);
    }
  }, [scheduleRefresh, fetchUser]);

  const clearAuth = useCallback(() => {
    clearRefreshTimer();
    const rt = localStorage.getItem('refresh_token');
    if (rt) {
      authApi.logout(rt).catch(() => {});
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setState({ isAuthenticated: false, accountType: null, userId: null, user: null, isLoading: false });
  }, [clearRefreshTimer]);

  const refreshUser = useCallback(async () => {
    if (state.userId) {
      await fetchUser(state.userId);
    }
  }, [state.userId, fetchUser]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      const payload = parseJwt(token);
      if (payload && payload.exp * 1000 > Date.now()) {
        setState({
          isAuthenticated: true,
          accountType: payload.account_type,
          userId: payload.sub,
          user: null,
          isLoading: false,
        });
        fetchUser(payload.sub).catch(() => {});
        scheduleRefresh(token);
        return;
      }
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        authApi.refreshToken(refreshToken)
          .then((res) => {
            if (res.data) {
              setTokens(res.data);
            } else {
              clearAuth();
            }
          })
          .catch(() => clearAuth());
        return;
      }
    }
    setState((s) => ({ ...s, isLoading: false }));

    return () => clearRefreshTimer();
  }, [setTokens, clearAuth, clearRefreshTimer, scheduleRefresh, fetchUser]);

  return (
    <AuthContext.Provider value={{ ...state, setTokens, clearAuth, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}