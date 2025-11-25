import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuração do Firebase
// Valores padrão das credenciais fornecidas
// Você pode sobrescrever via variáveis de ambiente no arquivo .env
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDmnxXzkIiwkN2oS6lvMRshNZ9Oa705K6w',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'ion-app-385dc.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'ion-app-385dc',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'ion-app-385dc.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '980123785790',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:980123785790:web:f6034cf3c0d4cbb9a68f6f',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-22ZC23CC6G',
};

// Inicializar Firebase App
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Inicializar Auth com persistência para React Native
let auth: Auth;
try {
  // Para React Native, usar initializeAuth com AsyncStorage
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // Se já foi inicializado, apenas pegar a instância
  auth = getAuth(app);
}

// Inicializar Firestore
const db: Firestore = getFirestore(app);

// Validar configuração
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('⚠️ Firebase não configurado. Adicione as variáveis de ambiente no arquivo .env');
}

export { app, auth, db };
export default app;

