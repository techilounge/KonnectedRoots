
// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
    apiKey: "AIzaSyA8l5UqfoiQMBAHiFjqlwCSBN-HAHaCpow",
    authDomain: "konnectedroots-u5xtb.firebaseapp.com",
    projectId: "konnectedroots-u5xtb",
    storageBucket: "konnectedroots-u5xtb.appspot.com",
    messagingSenderId: "685972123872",
    appId: "1:685972123872:web:e10402b976a906e5a3e085"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };

    