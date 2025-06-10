
"use client";
import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, name?: string) => Promise<void>;
  signup: (email: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserState: (newUser: User | null) => void; // Added for updating user details
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('konnectedRootsUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem('konnectedRootsUser');
      }
    }
    setLoading(false);
  }, []);

  const updateUserState = (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('konnectedRootsUser', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('konnectedRootsUser');
    }
  };

  const login = async (email: string, name: string = 'Demo User') => {
    setLoading(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const mockUser = { id: '1', name, email, avatar: `https://placehold.co/40x40.png?text=${name.substring(0,1)}` };
        updateUserState(mockUser);
        setLoading(false);
        router.push('/dashboard');
        resolve();
      }, 1000);
    });
  };

  const signup = async (email: string, name: string) => {
    setLoading(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const mockUser = { id: '2', name, email, avatar: `https://placehold.co/40x40.png?text=${name.substring(0,1)}` };
        updateUserState(mockUser);
        setLoading(false);
        router.push('/dashboard');
        resolve();
      }, 1000);
    });
  };

  const logout = async () => {
    updateUserState(null);
    router.push('/login'); // Redirect to login after logout
    return Promise.resolve();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUserState }}>
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
