import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://transitya-backend-production.up.railway.app'
});

const waitForAuth = () => new Promise(resolve => {
  const { getAuth, onAuthStateChanged } = require('firebase/auth');
  const currentAuth = getAuth();
  if (currentAuth.currentUser) return resolve(currentAuth.currentUser);
  const unsub = onAuthStateChanged(currentAuth, user => {
    unsub();
    resolve(user);
  });
});

api.interceptors.request.use(async (config) => {
  try {
    const user = await waitForAuth();
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
