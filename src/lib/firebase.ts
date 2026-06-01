import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'gestion-transporte-ef756.firebaseapp.com',
  projectId: 'gestion-transporte-ef756',
  appId: '1:894144256196:web:86185acf9b5d1ae7cd5191'
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
