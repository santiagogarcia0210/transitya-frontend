import axios from 'axios';
import { getAuth, type User } from 'firebase/auth';

// Usar URL relativa para que todas las llamadas pasen por Next.js.
// En producción, los fallback rewrites en next.config.ts proxean
// los endpoints que Next.js no maneja directamente a Railway.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
});

api.interceptors.request.use(async (config) => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Wait for auth state
      await new Promise<void>((resolve) => {
        const unsubscribe = auth.onAuthStateChanged(() => {
          unsubscribe();
          resolve();
        });
      });
      const freshUser = auth.currentUser as User | null;
      if (freshUser) {
        const token = await freshUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch (e) {
    console.error('[API] interceptor error:', e);
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.data?.error === 'prueba_vencida' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('prueba-vencida'));
    }
    return Promise.reject(err);
  }
);

export default api;
