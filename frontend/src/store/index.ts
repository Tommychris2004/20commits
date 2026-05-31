// Lightweight reactive store — no external dependency
import { useState, useEffect, useCallback } from 'react';

// ---- Auth Store ----
interface AuthState {
  accessToken: string | null;
  user: { id: string; email: string; name: string; role: string; estate_id: string | null } | null;
}

let authState: AuthState = {
  accessToken: localStorage.getItem('gn_token'),
  user: (() => {
    try {
      const u = localStorage.getItem('gn_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })(),
};

const authListeners = new Set<() => void>();

export function getAuth(): AuthState {
  return authState;
}

export function setAuth(token: string, user: AuthState['user']): void {
  authState = { accessToken: token, user };
  localStorage.setItem('gn_token', token);
  localStorage.setItem('gn_user', JSON.stringify(user));
  authListeners.forEach((l) => l());
}

export function clearAuth(): void {
  authState = { accessToken: null, user: null };
  localStorage.removeItem('gn_token');
  localStorage.removeItem('gn_user');
  authListeners.forEach((l) => l());
}

export function useAuth(): AuthState {
  const [, forceUpdate] = useState(0);
  const update = useCallback(() => forceUpdate((n) => n + 1), []);

  useEffect(() => {
    authListeners.add(update);
    return () => { authListeners.delete(update); };
  }, [update]);

  return authState;
}
