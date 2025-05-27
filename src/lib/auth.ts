import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { app } from './firebaseClient';

const auth = getAuth(app);

// Common Firebase auth error codes we might want to surface in UI
export const AUTH_ERRORS = {
  InvalidCredential: 'auth/invalid-credential',
  UserNotFound: 'auth/user-not-found',
  WrongPassword: 'auth/wrong-password',
  EmailInUse: 'auth/email-already-in-use',
} as const;

export async function requireAuth(email: string, password: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err: any) {
    const code = err?.code as string;
    if (
      code === AUTH_ERRORS.InvalidCredential ||
      code === AUTH_ERRORS.UserNotFound
    ) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      return cred.user;
    }
    // Re-throw any other auth error so caller can decide what to do.
    throw err;
  }
}

export { auth };
