
"use client";
import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { 
    getAuth, 
    onAuthStateChanged, 
    User as FirebaseUser,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword,
    deleteUser,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { app, db } from '@/lib/firebase/clients';
import type { UserProfile } from '@/types';

type AuthContextType = {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateUserProfile: (displayName: string, photoFile?: File | null) => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  deleteUserAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const auth = getAuth(app);
const storage = getStorage(app);

// Helper to create the user profile document
const createUserProfileDocument = async (user: FirebaseUser, displayNameOverride?: string) => {
    const userRef = doc(db, `users/${user.uid}`);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        const { email, photoURL, uid } = user;
        const displayName = displayNameOverride || user.displayName;
        const createdAt = serverTimestamp();

        const defaultEntitlements = {
            maxTrees: 1,
            maxPeoplePerTree: 50,
            aiCreditsMonthly: 0,
            exports: { pdf: false, png: false, gedcom: false }
        };

        try {
            await setDoc(userRef, {
                uid,
                displayName: displayName ?? '',
                email: email ?? '',
                photoURL: photoURL ?? '',
                plan: "free",
                entitlements: defaultEntitlements,
                createdAt: createdAt,
                updatedAt: createdAt,
            });
        } catch (error) {
            console.error("Error creating user profile document: ", error);
        }
    }
    return getDoc(userRef);
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true); // Start loading whenever auth state changes
      if (user) {
        // User is signed in, fetch profile before setting state
        const userProfileDoc = await getDoc(doc(db, `users/${user.uid}`));
        if (userProfileDoc.exists()) {
            setUserProfile(userProfileDoc.data() as UserProfile);
            setUser(user);
        } else {
            // This case might happen if profile creation fails.
            // For now, we'll treat them as not fully logged in.
            setUser(null);
            setUserProfile(null);
        }
      } else {
        // User is signed out
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false); // Stop loading after all async operations are done
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    router.push('/dashboard');
  };

  const signup = async (email: string, password: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName: name });
      await createUserProfileDocument(userCredential.user, name);
    }
    router.push('/dashboard');
  };

  const logout = async () => {
    await signOut(auth);
    router.push('/');
  };
  
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    if (userCredential.user) {
        await createUserProfileDocument(userCredential.user);
    }
    router.push('/dashboard');
  };

  const updateUserProfile = async (displayName: string, photoFile?: File | null) => {
    if (!auth.currentUser) throw new Error("Not authenticated");

    let photoURL = auth.currentUser.photoURL;

    if (photoFile) {
      const storageRef = ref(storage, `users/${auth.currentUser.uid}/profile/${photoFile.name}`);
      const snapshot = await uploadBytes(storageRef, photoFile);
      photoURL = await getDownloadURL(snapshot.ref);
    }
    
    await updateProfile(auth.currentUser, { displayName, photoURL });
    
    const userRef = doc(db, `users/${auth.currentUser.uid}`);
    await setDoc(userRef, { 
        displayName, 
        photoURL,
        updatedAt: serverTimestamp()
    }, { merge: true });

    // Force a reload of the user object and profile to reflect changes immediately
    await auth.currentUser.reload(); 
    const updatedUser = auth.currentUser;
    const userProfileDoc = await getDoc(userRef);
    
    setUser(updatedUser);
    if (userProfileDoc.exists()) {
        setUserProfile(userProfileDoc.data() as UserProfile);
    }
  };
  
  const reauthenticate = async (password: string) => {
    if (!auth.currentUser || !auth.currentUser.email) throw new Error("User not found.");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const updateUserPassword = async (password: string) => {
     if (!auth.currentUser) throw new Error("Not authenticated");
     await updatePassword(auth.currentUser, password);
  };

  const deleteUserAccount = async () => {
     if (!auth.currentUser) throw new Error("Not authenticated");
     await deleteUser(auth.currentUser);
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, signup, logout, signInWithGoogle, updateUserProfile, reauthenticate, updateUserPassword, deleteUserAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
