import axios from 'axios';
import { getAuth, type User } from 'firebase/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://transitya-backend-production.up.railway.app'
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

export default api;
