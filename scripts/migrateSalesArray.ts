import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteField,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { v4 as uuid } from 'uuid';

// TODO: replace with your env values or import config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

async function migrate() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const usersSnap = await getDocs(collection(db, 'usuarios'));
  console.log(`Found ${usersSnap.size} users`);

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data() as any;
    const uid = userDoc.id;
    if (!Array.isArray(data.sales) || data.sales.length === 0) continue;

    console.log(`Migrating ${data.sales.length} sales for user ${uid}`);
    const salesCol = collection(db, 'usuarios', uid, 'sales');

    for (const raw of data.sales) {
      const saleId = raw.id ?? uuid();
      const saleDoc = doc(salesCol, saleId);
      await setDoc(saleDoc, {
        ...raw,
        id: saleId,
        totalPrice: raw.totalPrice ?? raw.amount * raw.price,
        client: raw.client ?? 'Cliente',
        paymentMethod: raw.paymentMethod ?? 'Efectivo',
        date: raw.date ?? new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // remove old array
    await updateDoc(userDoc.ref, {
      sales: deleteField(),
      migratedAt: serverTimestamp(),
    });
  }

  console.log('Migration complete');
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
