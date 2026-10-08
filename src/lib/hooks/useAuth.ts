'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, getIdTokenResult, User } from 'firebase/auth';
import { auth } from '../firebase/config';

export interface UserClaims {
  role?: 'user' | 'admin' | 'superadmin' | string;
  unitId?: string;
  regupId?: string;
  nik?: string;
  [key: string]: any;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<UserClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const tokenResult = await getIdTokenResult(currentUser, true);
          setClaims((tokenResult.claims as UserClaims) || {});
        } catch {
          setClaims({});
        }
      } else {
        setUser(null);
        setClaims(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    // Hapus session cookie
    document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setUser(null);
    setClaims(null);
  };

  return {
    user,
    claims,
    role: claims?.role || 'guest',
    unitId: claims?.unitId || null,
    regupId: claims?.regupId || null,
    nik: claims?.nik || null,
    loading,
    logout,
  };
}
