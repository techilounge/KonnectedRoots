
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
import { app } from '@/lib/firebase/clients';

type AuthContextType = {
  user: FirebaseUser | null;
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (!user) {
        // You might want to control redirection more granularly
        // For now, we let protected layouts handle redirection.
      }
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
      await updateProfile(userCredential.user, {
        displayName: name,
      });
      // Force a reload of the user to get the new display name
      await userCredential.user.reload();
      setUser(auth.currentUser);
    }
    router.push('/dashboard');
  };

  const logout = async () => {
    await signOut(auth);
    router.push('/');
  };
  
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    router.push('/dashboard');
  };

  const updateUserProfile = async (displayName: string, photoFile?: File | null) => {
    if (!auth.currentUser) throw new Error("Not authenticated");

    let photoURL = auth.currentUser.photoURL;

    if (photoFile) {
      const storageRef = ref(storage, `avatars/${auth.currentUser.uid}`);
      const snapshot = await uploadBytes(storageRef, photoFile);
      photoURL = await getDownloadURL(snapshot.ref);
    }
    
    await updateProfile(auth.currentUser, { displayName, photoURL });
    await auth.currentUser.reload(); // Reload user to get updated info
    setUser(auth.currentUser);
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
     // onAuthStateChanged will handle the rest
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, signInWithGoogle, updateUserProfile, reauthenticate, updateUserPassword, deleteUserAccount }}>
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
