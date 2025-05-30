import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc, 
  deleteDoc,
  query,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User
} from 'firebase/auth';
import { v4 as uuid } from 'uuid';
import firebaseConfig from '../../electron/firebaseConfig.json';

// For debugging
console.log("Firebase config:", {
  apiKey: firebaseConfig.apiKey,
  hasApiKey: !!firebaseConfig.apiKey,
  projectId: firebaseConfig.projectId,
  hasProjectId: !!firebaseConfig.projectId
});

// Initialize Firebase
const app = initializeApp(firebaseConfig as any);
const db = getFirestore(app);
const auth = getAuth(app);

// Ensure auth state persists across reloads (browserLocalPersistence works in Electron's renderer)
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Error setting Firebase auth persistence:', err);
});

// Current authenticated user
let currentUser: User | null = null;

// Listen to auth state changes (reusable helper)
export const subscribeToAuthChanges = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
  });
};

// Sign up with email and password
export const signUpWithEmail = async (email: string, password: string): Promise<User> => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  currentUser = cred.user;

  // Ensure Firestore user doc exists
  try {
    const userDocRef = doc(db, 'usuarios', currentUser.uid);
    await setDoc(userDocRef, {
      email: currentUser.email,
      created: serverTimestamp(),
      lastLogin: serverTimestamp(),
      sales: []
    }, { merge: true });
  } catch (err) {
    console.error('Error creating user document:', err);
  }
  return currentUser;
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  currentUser = cred.user;

  // Update Firestore user doc (or create if missing)
  try {
    const userDocRef = doc(db, 'usuarios', currentUser.uid);
    await setDoc(userDocRef, {
      email: currentUser.email,
      lastLogin: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error('Error updating user document:', err);
  }
  return currentUser;
};

// Sign out
export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
  currentUser = null;
};

// Helper to get current user
export const getCurrentUser = (): User | null => currentUser;

// ========= NEW SALES HELPERS ========= //

// Add OR overwrite a batch of sales (used by legacy callers)
export const saveSalesToFirestore = async (sales: any[]): Promise<void> => {
  if (!currentUser) return console.error('No authenticated user found');

  const uid = currentUser.uid;
  const salesRef = collection(db, 'usuarios', uid, 'sales');

  const ops = sales.map(async (raw) => {
    const saleId = raw.id ?? uuid();
    const newSale = {
      ...raw,
      id: saleId,
      totalPrice: raw.totalPrice ?? raw.amount * raw.price,
      client: raw.client ?? 'Cliente',
      paymentMethod: raw.paymentMethod ?? 'Efectivo',
      date: raw.date ?? new Date().toISOString().slice(0, 10),
      createdAt: raw.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    return setDoc(doc(salesRef, saleId), newSale, { merge: true });
  });

  await Promise.all(ops);
};

// Read all sales documents
export const loadSalesFromFirestore = async (): Promise<any[] | null> => {
  if (!currentUser) {
    console.error('No authenticated user found');
    return null;
  }

  const uid = currentUser.uid;
  const q = query(collection(db, 'usuarios', uid, 'sales'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
};

// Update single sale
export const updateSaleInFirestore = async (updatedSale: any): Promise<void> => {
  if (!currentUser) return console.error('No authenticated user found');
  if (!updatedSale?.id) return console.error('updateSale requires id');

  const saleRef = doc(db, 'usuarios', currentUser.uid, 'sales', updatedSale.id);
  await updateDoc(saleRef, {
    ...updatedSale,
    updatedAt: serverTimestamp(),
  });
};

// Delete list of sales IDs
export const deleteSalesFromFirestore = async (saleIds: string[]): Promise<void> => {
  if (!currentUser) return console.error('No authenticated user found');
  const uid = currentUser.uid;
  const ops = saleIds.map((id) => deleteDoc(doc(db, 'usuarios', uid, 'sales', id)));
  await Promise.all(ops);
};

// Save user preferences to Firestore
export const savePreferencesToFirestore = async (
  preferences: {
    activeFields?: any,
    columnOrder?: any
  }
): Promise<void> => {
  if (!currentUser) {
    console.error("No authenticated user found");
    return;
  }
  
  try {
    const userDocRef = doc(db, "usuarios", currentUser.uid);
    
    // Use setDoc with merge option instead of updateDoc to create the document if it doesn't exist
    await setDoc(userDocRef, {
      ...preferences,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    
    console.log("User preferences saved to Firestore");
  } catch (error) {
    console.error("Error saving user preferences to Firestore:", error);
    throw error;
  }
};

// Load user preferences from Firestore
export const loadPreferencesFromFirestore = async (): Promise<{
  activeFields?: any,
  columnOrder?: any
} | null> => {
  if (!currentUser) {
    console.error("No authenticated user found");
    return null;
  }
  
  try {
    const userDocRef = doc(db, "usuarios", currentUser.uid);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const preferences: {
        activeFields?: any,
        columnOrder?: any
      } = {};
      
      if (data.activeFields) preferences.activeFields = data.activeFields;
      if (data.columnOrder) preferences.columnOrder = data.columnOrder;
      
      console.log("User preferences loaded from Firestore");
      return preferences;
    } else {
      console.log("No user preferences found in Firestore");
      return null;
    }
  } catch (error) {
    console.error("Error loading user preferences from Firestore:", error);
    throw error;
  }
};

// Save user suggestions to Firestore
export const saveSuggestionToFirestore = async (suggestion: string): Promise<void> => {
  if (!currentUser) {
    console.error("No authenticated user found");
    return;
  }
  
  try {
    // Create a new document in the sugerencias collection
    const suggestionsCollection = collection(db, "sugerencias");
    
    // Add the suggestion with user ID and timestamp
    await setDoc(doc(suggestionsCollection), {
      userId: currentUser.uid,
      suggestion,
      createdAt: serverTimestamp(),
      status: 'new' // Can be 'new', 'reviewed', 'implemented', etc.
    });
    
    console.log("User suggestion saved to Firestore");
  } catch (error) {
    console.error("Error saving suggestion to Firestore:", error);
    throw error;
  }
};

// Helper to maintain backward compatibility
export const initializeFirebase = async (): Promise<User | null> => {
  return new Promise((resolve) => {
    if (currentUser) {
      resolve(currentUser);
    } else {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        currentUser = user;
        unsubscribe();
        resolve(user);
      });
    }
  });
};

export { db, auth }; 