"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User, signOut } from "firebase/auth";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);

      if (currentUser && typeof window !== 'undefined' && (window as any).chrome?.runtime) {
        const EXTENSION_ID = 'kkfojgfjhkhcgpodfdeldhnnnbabegee';
        try {
          (window as any).chrome.runtime.sendMessage(EXTENSION_ID, {
            action: 'AUTH_SYNC',
            uid: currentUser.uid
          }, () => {
             if ((window as any).chrome.runtime.lastError) {
               console.log('Extension not found or not responding. (Optional for dev)');
             } else {
               console.log('Successfully synced auth with Focus extension.');
             }
          });
        } catch (e) {
          console.warn('Failed to communicate with Focus extension.', e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
