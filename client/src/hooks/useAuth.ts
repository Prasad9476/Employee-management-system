import { create } from 'zustand';
import api, { setAccessToken } from '../api/axios';

export interface User {
  id: string;
  email: string;
  role: string;
  name: string;
  tenantId: string;
  mustChangePassword?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isChecking: boolean;
  login: (email: string, password: string, organizationName: string) => Promise<void>;
  register: (email: string, password: string, name: string, organizationName: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearMustChangePassword: () => void;
}

function errorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { error?: { message?: string } } } };
  return anyError.response?.data?.error?.message || fallback;
}

function toError(error: unknown, fallback: string) {
  return new Error(errorMessage(error, fallback), { cause: error });
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isChecking: true,

  login: async (email: string, password: string, organizationName: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password, organizationName });
      setAccessToken(data.token);
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw toError(error, 'Login failed');
    }
  },

  register: async (email: string, password: string, name: string, organizationName: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/register', { email, password, name, organizationName });
      setAccessToken(data.token);
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw toError(error, 'Registration failed');
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort server-side revocation; the client session ends regardless.
    }
    setAccessToken(null);
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const { data } = await api.post('/auth/refresh', {});
      setAccessToken(data.token);
      set({ user: data.user, isAuthenticated: true, isChecking: false });
    } catch {
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, isChecking: false });
    }
  },

  clearMustChangePassword: () => {
    const user = get().user;
    if (user) set({ user: { ...user, mustChangePassword: false } });
  },
}));