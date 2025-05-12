import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// For debugging
console.log("Firebase config:", {
  apiKey: typeof process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: typeof process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// User authentication state
let currentUser: User | null = null;

// Function to initialize Firebase authentication and handle auth state changes
export const initializeFirebase = (): Promise<User | null> => {
  return new Promise((resolve, reject) => {
    // Check if we already have a user
    if (currentUser) {
      resolve(currentUser);
      return;
    }

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // Only listen once
      
      if (user) {
        // User is already signed in
        currentUser = user;
        console.log("User is already signed in:", user.uid);
        
        // Make sure the user document exists
        try {
          const userDocRef = doc(db, "usuarios", user.uid);
          await setDoc(userDocRef, {
            lastLogin: serverTimestamp(),
            sales: [] // Initialize with empty array if it doesn't exist
          }, { merge: true });
          console.log("Updated user document in Firestore");
        } catch (error) {
          console.error("Error ensuring user document exists:", error);
          // Still resolve with user since auth was successful
        }
        
        resolve(user);
      } else {
        // Sign in anonymously
        try {
          const userCredential = await signInAnonymously(auth);
          currentUser = userCredential.user;
          console.log("Anonymous user signed in:", currentUser.uid);
          
          // Create a user document in Firestore
          try {
            const userDocRef = doc(db, "usuarios", currentUser.uid);
            await setDoc(userDocRef, {
              created: serverTimestamp(),
              lastLogin: serverTimestamp(),
              sales: [] // Initialize with empty array
            }, { merge: true });
            console.log("Created new user document in Firestore");
          } catch (firestoreError) {
            console.error("Error creating user document:", firestoreError);
            // Still resolve with user since auth was successful
          }
          
          resolve(currentUser);
        } catch (authError) {
          console.error("Error signing in anonymously:", authError);
          reject(authError);
        }
      }
    });
  });
};

// Get current user
export const getCurrentUser = (): User | null => {
  return currentUser;
};

// Save sales data to Firestore
export const saveSalesToFirestore = async (sales: any[]): Promise<void> => {
  if (!currentUser) {
    console.error("No authenticated user found");
    return;
  }
  
  try {
    // Normalize sales data to include all fields, even if empty
    const normalizedSales = sales.map(sale => ({
      id: sale.id || `sale-${Date.now()}`,
      product: sale.product || null,
      amount: sale.amount || null,
      price: sale.price || null,
      totalPrice: sale.totalPrice || null,
      paymentMethod: sale.paymentMethod || null,
      client: sale.client || null,
      date: sale.date || null
    }));
    
    console.log("Normalized sales before saving:", normalizedSales);
    
    const userDocRef = doc(db, "usuarios", currentUser.uid);
    await setDoc(userDocRef, {
      sales: normalizedSales,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    
    console.log("Sales data saved to Firestore");
  } catch (error) {
    console.error("Error saving sales data to Firestore:", error);
    throw error;
  }
};

// Load sales data from Firestore
export const loadSalesFromFirestore = async (): Promise<any[] | null> => {
  if (!currentUser) {
    console.error("No authenticated user found");
    return null;
  }
  
  try {
    const userDocRef = doc(db, "usuarios", currentUser.uid);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists() && docSnap.data().sales) {
      console.log("Sales data loaded from Firestore");
      return docSnap.data().sales;
    } else {
      console.log("No sales data found in Firestore");
      return null;
    }
  } catch (error) {
    console.error("Error loading sales data from Firestore:", error);
    throw error;
  }
};

// Update a specific sale in Firestore
export const updateSaleInFirestore = async (updatedSale: any): Promise<void> => {
  if (!currentUser) {
    console.error("No authenticated user found");
    return;
  }
  
  try {
    // Get current sales array
    const userDocRef = doc(db, "usuarios", currentUser.uid);
    const docSnap = await getDoc(userDocRef);
    
    if (!docSnap.exists() || !docSnap.data().sales) {
      console.error("No sales data found for update");
      return;
    }
    
    // Find and update the specific sale
    const currentSales = docSnap.data().sales;
    const updatedSales = currentSales.map((sale: any) => 
      sale.id === updatedSale.id ? { ...updatedSale } : sale
    );
    
    console.log(`Updating sale with ID: ${updatedSale.id}`);
    
    // Save the updated sales array
    await setDoc(userDocRef, {
      sales: updatedSales,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    
    console.log("Sale updated in Firestore");
  } catch (error) {
    console.error("Error updating sale in Firestore:", error);
    throw error;
  }
};

// Delete specific sales from Firestore by ID
export const deleteSalesFromFirestore = async (saleIds: string[]): Promise<void> => {
  if (!currentUser) {
    console.error("No authenticated user found");
    return;
  }
  
  try {
    // Get current sales array
    const userDocRef = doc(db, "usuarios", currentUser.uid);
    const docSnap = await getDoc(userDocRef);
    
    if (!docSnap.exists() || !docSnap.data().sales) {
      console.error("No sales data found for deletion");
      return;
    }
    
    // Filter out the sales to be deleted
    const currentSales = docSnap.data().sales;
    const updatedSales = currentSales.filter((sale: any) => !saleIds.includes(sale.id));
    
    console.log(`Deleting ${saleIds.length} sales with IDs: ${saleIds.join(', ')}`);
    
    // Save the updated sales array
    await setDoc(userDocRef, {
      sales: updatedSales,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    
    console.log("Sales deleted from Firestore");
  } catch (error) {
    console.error("Error deleting sales from Firestore:", error);
    throw error;
  }
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

export { db, auth }; 