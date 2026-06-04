import axios from 'axios';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://transitya-backend-production.up.railway.app'
});

// Esperar a que Firebase inicialice antes de obtener el token
const getToken = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const user = auth.currentUser;
    if (user) {
      user.getIdToken().then(resolve).catch(() => resolve(null));
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      if (u) {
        u.getIdToken().then(resolve).catch(() => resolve(null));
      } else {
        resolve(null);
      }
    });
  });
};

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
