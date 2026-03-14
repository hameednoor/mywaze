'use client';

import { create } from 'zustand';
import { CustomPlace } from './customPlaces';
import builtInPlaces from '@/data/customPlaces.json';

interface CustomPlacesStore {
  places: CustomPlace[];
  loadPlaces: () => void;
  addPlace: (place: CustomPlace) => void;
  removePlace: (id: string) => void;
}

const STORAGE_KEY = 'mywaze_custom_places';

function loadFromStorage(): CustomPlace[] {
  const base = builtInPlaces as CustomPlace[];
  if (typeof window === 'undefined') return base;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const local = JSON.parse(stored) as CustomPlace[];
      // Merge: built-in + local (dedup by id)
      const ids = new Set(base.map(p => p.id));
      const merged = [...base];
      for (const p of local) {
        if (!ids.has(p.id)) {
          merged.push(p);
          ids.add(p.id);
        }
      }
      return merged;
    }
  } catch { /* ignore */ }
  return base;
}

function saveLocalToStorage(places: CustomPlace[]) {
  if (typeof window === 'undefined') return;
  // Only save non-built-in places to localStorage
  const builtInIds = new Set((builtInPlaces as CustomPlace[]).map(p => p.id));
  const localOnly = places.filter(p => !builtInIds.has(p.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localOnly));
}

export const useCustomPlacesStore = create<CustomPlacesStore>((set, get) => ({
  places: builtInPlaces as CustomPlace[],

  loadPlaces: () => {
    set({ places: loadFromStorage() });
  },

  addPlace: (place) => {
    const updated = [...get().places, place];
    saveLocalToStorage(updated);
    set({ places: updated });
  },

  removePlace: (id) => {
    const updated = get().places.filter(p => p.id !== id);
    saveLocalToStorage(updated);
    set({ places: updated });
  },
}));
