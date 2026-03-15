'use client';

import { create } from 'zustand';

interface AuthUser {
  email: string;
  name: string;
  picture: string;
}

const STORAGE_KEY = 'mywaze_user';
const AUTH_KEY = 'mywaze_auth';

interface AuthState {
  user: AuthUser | null;
  checked: boolean;
  allowed: boolean;
  isOwner: boolean;
  setUser: (user: AuthUser | null) => void;
  setAllowed: (allowed: boolean) => void;
  setIsOwner: (isOwner: boolean) => void;
  setChecked: (checked: boolean) => void;
  signOut: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  checked: false,
  allowed: false,
  isOwner: false,
  setUser: (user) => {
    set({ user });
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
  setAllowed: (allowed) => {
    set({ allowed });
    try {
      const auth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...auth, allowed }));
    } catch { /* ignore */ }
  },
  setIsOwner: (isOwner) => {
    set({ isOwner });
    try {
      const auth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...auth, isOwner }));
    } catch { /* ignore */ }
  },
  setChecked: (checked) => set({ checked }),
  signOut: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTH_KEY);
    set({ user: null, allowed: false, isOwner: false, checked: true });
  },
  loadFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const auth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      if (stored) {
        set({
          user: JSON.parse(stored),
          allowed: auth.allowed || false,
          isOwner: auth.isOwner || false,
          checked: !!(auth.allowed), // skip loading if already approved
        });
      }
    } catch { /* ignore */ }
  },
}));
