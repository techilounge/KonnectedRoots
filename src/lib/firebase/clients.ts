import { firebaseBrowserOptions } from '@/lib/config/env.client';
// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { clientEnv } from '@/lib/config/env.client';

const firebaseConfig: FirebaseOptions = firebaseBrowserOptions();

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app);

type FirebaseEmulatorConnectionState = {
  auth?: boolean;
  firestore?: boolean;
  functions?: boolean;
  storage?: boolean;
};

const firebaseGlobal = globalThis as typeof globalThis & {
  __konnectedRootsFirebaseEmulators?: FirebaseEmulatorConnectionState;
};

if (typeof window !== 'undefined' && clientEnv.useFirebaseEmulators) {
  const state = firebaseGlobal.__konnectedRootsFirebaseEmulators ||= {};
  if (!state.auth) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    state.auth = true;
  }
  if (!state.firestore) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    state.firestore = true;
  }
  if (!state.functions) {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    state.functions = true;
  }
  if (!state.storage) {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    state.storage = true;
  }
}

export { app, db, auth, storage, functions };
