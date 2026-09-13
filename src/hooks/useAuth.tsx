
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
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, setDoc, serverTimestamp, getDoc, runTransaction } from "firebase/firestore";
import { app, db } from '@/lib/firebase/clients';
import { prepareStorageUpload } from '@/lib/billing/storage';
import { sanitizeAuthRedirect } from '@/lib/auth/redirect';
import { saveAccountPhoto } from '@/lib/photos/save';
import { deleteOwnedPhoto } from '@/lib/photos/storage';
import { photoPrefix, uniquePhotoName, validatePhoto } from '@/lib/photos/ownership';
import type { UserProfile } from '@/types';

type AuthContextType = {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string, redirect?: string) => Promise<void>;
  signup: (email: string, password: string, name: string, redirect?: string) => Promise<void>;
  logout: (redirect?: string) => Promise<void>;
  signInWithGoogle: (redirect?: string) => Promise<void>;
  updateUserProfile: (displayName: string, photoFile?: File | null, removePhoto?: boolean) => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  deleteUserAccount: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
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

    try {
      await runTransaction(db, async transaction => {
        // Auth observer and signup/Google initialization can run concurrently.
        // Never overwrite a profile that Functions already initialized.
        if ((await transaction.get(userRef)).exists()) return;
        transaction.set(userRef, {
        uid,
        displayName: displayName ?? '',
        email: email ?? '',
        photoURL: photoURL ?? '',
        createdAt: createdAt,
        updatedAt: createdAt,
        lastActivityAt: createdAt,
        });
      });
    } catch (error) {
      console.error("Error creating user profile document: ", error);
      throw new Error('Your account profile could not be initialized. Please try signing in again.');
    }
  }
  return getDoc(userRef);
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdminClaim, setIsAdminClaim] = useState(false);
  const [isSuperAdminClaim, setIsSuperAdminClaim] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true); // Start loading whenever auth state changes
      if (user) {
        // Inspect token claims for platform admin privileges
        try {
          const tokenResult = await user.getIdTokenResult();
          const claims = tokenResult.claims || {};
          setIsAdminClaim(Boolean(claims.admin || claims.role === 'admin' || claims.role === 'super_admin'));
          setIsSuperAdminClaim(Boolean(claims.role === 'super_admin'));
        } catch (claimErr) {
          console.warn('Could not inspect token claims:', claimErr);
        }

        // User is signed in, fetch or create profile before setting state
        try {
          const userDocRef = doc(db, `users/${user.uid}`);
          let userProfileDoc = await getDoc(userDocRef);

          // If profile doesn't exist, create it (handles edge cases like failed initial creation)
          if (!userProfileDoc.exists()) {
            console.log('User profile not found, creating one...');
            await createUserProfileDocument(user);
            userProfileDoc = await getDoc(userDocRef);
          }

          if (userProfileDoc.exists()) {
            const profileData = userProfileDoc.data() as UserProfile;
            setUserProfile(profileData);
            setUser(user);

            // Throttle lastActivityAt updates to at most once every 6 hours
            const lastActivity = profileData.lastActivityAt?.toDate?.() || (profileData.lastActivityAt ? new Date(profileData.lastActivityAt) : null);
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
            if (!lastActivity || lastActivity < sixHoursAgo) {
              setDoc(userDocRef, { lastActivityAt: serverTimestamp() }, { merge: true }).catch((err) => {
                console.warn('Could not update lastActivityAt:', err);
              });
            }
          } else {
            // Profile still doesn't exist after creation attempt - log error but keep user signed in
            console.error('Failed to create user profile document');
            setUser(user);
            setUserProfile(null);
          }
        } catch (error) {
          console.error('Error fetching/creating user profile:', error);
          // Keep the user signed in even if profile fetch fails
          setUser(user);
          setUserProfile(null);
        }
      } else {
        // User is signed out
        setUser(null);
        setUserProfile(null);
        setIsAdminClaim(false);
        setIsSuperAdminClaim(false);
      }
      setLoading(false); // Stop loading after all async operations are done
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string, redirect?: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    router.push(sanitizeAuthRedirect(redirect));
  };

  const signup = async (email: string, password: string, name: string, redirect?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName: name });
      await createUserProfileDocument(userCredential.user, name);
    }
    router.push(sanitizeAuthRedirect(redirect));
  };

  const logout = async (redirect?: string) => {
    await signOut(auth);
    router.push(redirect === undefined ? '/' : sanitizeAuthRedirect(redirect));
  };

  const signInWithGoogle = async (redirect?: string) => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    if (userCredential.user) {
      await createUserProfileDocument(userCredential.user);
    }
    router.push(sanitizeAuthRedirect(redirect));
  };

  const profileSaveInFlight = React.useRef(false);
  const updateUserProfile = async (displayName: string, photoFile?: File | null, removePhoto = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    if (profileSaveInFlight.current) throw new Error('A profile update is already in progress.');
    profileSaveInFlight.current = true;
    const uid = currentUser.uid;
    const userRef = doc(db, `users/${uid}`);
    const assertSameUser = () => {
      if (auth.currentUser !== currentUser) throw new Error('Your session changed. Please try again.');
    };
    try {
      const oldDocument = await getDoc(userRef);
      assertSameUser();
      const oldDocumentUrl = oldDocument.data()?.photoURL as string | undefined;
      const oldAuthUrl = currentUser.photoURL;
      const photoURL = await saveAccountPhoto({
        oldUrl: currentUser.photoURL, oldName: currentUser.displayName,
        name: displayName, pending: photoFile || null, remove: removePhoto,
        upload: async file => {
          validatePhoto(file);
          await prepareStorageUpload();
          assertSameUser();
          const objectRef = ref(storage, photoPrefix({uid}) + uniquePhotoName(file.type));
          await uploadBytes(objectRef, file, {contentType: file.type});
          try { return await getDownloadURL(objectRef); }
          catch (error) {
            await deleteObject(objectRef).catch(() => console.warn('New profile photo cleanup could not complete.'));
            throw error;
          }
        },
        saveAuth: async (name, url) => { assertSameUser(); await updateProfile(currentUser, {displayName: name, photoURL: url}); },
        saveDocument: async url => {
          assertSameUser();
          await setDoc(userRef, {displayName, photoURL: url || '', updatedAt: serverTimestamp()}, {merge: true});
        },
        cleanup: url => deleteOwnedPhoto(url, {uid}),
      });
      if ((removePhoto || photoFile) && oldDocumentUrl && oldDocumentUrl !== photoURL && oldDocumentUrl !== oldAuthUrl) {
        await deleteOwnedPhoto(oldDocumentUrl, {uid});
      }
      // Update the displayed profile immediately; a later refresh remains available.
      if (auth.currentUser === currentUser) {
        setUser(currentUser);
        setUserProfile(previous => ({...previous, ...oldDocument.data(), uid, displayName, photoURL: photoURL || ''} as UserProfile));
      }
    } finally { profileSaveInFlight.current = false; }
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

  const refreshUserProfile = async () => {
    if (!auth.currentUser) return;
    const userRef = doc(db, `users/${auth.currentUser.uid}`);
    const userProfileDoc = await getDoc(userRef);
    if (userProfileDoc.exists()) {
      setUserProfile(userProfileDoc.data() as UserProfile);
    }
  };

  const isAdmin = Boolean(
    isAdminClaim ||
    userProfile?.role === 'admin' ||
    userProfile?.role === 'super_admin' ||
    userProfile?.isPlatformAdmin
  );

  const isSuperAdmin = Boolean(
    isSuperAdminClaim ||
    userProfile?.role === 'super_admin'
  );

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      isAdmin,
      isSuperAdmin,
      login,
      signup,
      logout,
      signInWithGoogle,
      updateUserProfile,
      reauthenticate,
      updateUserPassword,
      deleteUserAccount,
      refreshUserProfile
    }}>
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
