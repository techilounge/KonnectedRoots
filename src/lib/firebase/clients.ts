// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // If you plan to use Firebase Auth

const firebaseConfig = {
    apiKey: "AIzaSyA8l5UqfoiQMBAHiFjqlwCSBN-HAHaCpow",
    authDomain: "konnectedroots-u5xtb.firebaseapp.com",
    projectId: "konnectedroots-u5xtb",
    storageBucket: "konnectedroots-u5xtb.firebasestorage.app",
    messagingSenderId: "685972123872",
    appId: "1:685972123872:web:e10402b976a906e5a3e085"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app); // If using Firebase Auth

export { app, db, auth };