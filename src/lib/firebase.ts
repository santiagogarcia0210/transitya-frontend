import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBuqkcta6tj5i9KDDRvxss5NSgX3ctnO0c',
  authDomain: 'gestion-transporte-ef756.firebaseapp.com',
  projectId: 'gestion-transporte-ef756',
  storageBucket: 'gestion-transporte-ef756.firebasestorage.app',
  messagingSenderId: '894144256196',
  appId: '1:894144256196:web:86185acf9b5d1ae7cd5191'
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);