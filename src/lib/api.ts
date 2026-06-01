import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://transitya-backend-production.up.railway.app'
});

api.interceptors.request.use(async (config) => {
  try {
    const { getAuth } = await import('firebase/auth');
    const currentAuth = getAuth();
    const user = currentAuth.currentUser;
    if (user) {
      const token = await user.getIdToken(true);
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[API] Token attached, user:', user.email);
    } else {
      console.log('[API] No current user');
    }
  } catch(e) {
    console.error('[API] Token error:', e);
  }
  return config;
});

export default api;
