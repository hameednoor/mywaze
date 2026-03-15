'use client';

import { create } from 'zustand';

interface AuthUser {
  email: string;
  name: string;
  picture: string;
}

interface AuthState {
  user: AuthUser | null;
  checked: boolean; // has auth been checked on load
  allowed: boolean; // is user in allowed_users table
  isOwner: boolean; // is user the app owner
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
      localStorage.setItem('mywaze_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mywaze_user');
    }
  },
  setAllowed: (allowed) => set({ allowed }),
  setIsOwner: (isOwner) => set({ isOwner }),
  setChecked: (checked) => set({ checked }),
  signOut: () => {
    localStorage.removeItem('mywaze_user');
    set({ user: null, allowed: false, isOwner: false });
  },
  loadFromStorage: () => {
    try {
      const stored = localStorage.getItem('mywaze_user');
      if (stored) {
        set({ user: JSON.parse(stored) });
      }
    } catch { /* ignore */ }
  },
}));
