import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Access token lives in memory only (short-lived, ~15m) so a single XSS bug
// cannot hand out a week-long credential. The refresh token is an httpOnly cookie.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  try {
    const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
    const token: string | undefined = data?.token;
    setAccessToken(token || null);
    return token || null;
  } catch {
    setAccessToken(null);
    return null;
  }
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthPath = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retried && !isAuthPath) {
      original._retried = true;
      // Single-flight: concurrent 401s share one refresh call.
      refreshPromise = refreshPromise ?? performRefresh();
      const token = await refreshPromise;
      refreshPromise = null;

      if (token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }

      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;