import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../../electron/firebaseConfig.json';

if (!firebaseConfig.apiKey) {
  console.error('❌ Firebase config missing – aborting initialisation');
}

export const app = getApps().length === 0 ? initializeApp(firebaseConfig as any) : getApps()[0]; 