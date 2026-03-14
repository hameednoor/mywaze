'use client';

import { create } from 'zustand';

export interface SavedPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  type: 'home' | 'work' | 'favorite';
}

interface PlacesStore {
  places: SavedPlace[];
  loadPlaces: () => void;
  addPlace: (place: SavedPlace) => void;
  updatePlace: (place: SavedPlace) => void;
  deletePlace: (id: string) => void;
}

const STORAGE_KEY = 'mywaze_places';

function loadFromStorage(): SavedPlace[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function saveToStorage(places: SavedPlace[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

export const usePlacesStore = create<PlacesStore>((set, get) => ({
  places: [],

  loadPlaces: () => {
    set({ places: loadFromStorage() });
  },

  addPlace: (place) => {
    const updated = [...get().places, place];
    saveToStorage(updated);
    set({ places: updated });
  },

  updatePlace: (place) => {
    const updated = get().places.map((p) => (p.id === place.id ? place : p));
    saveToStorage(updated);
    set({ places: updated });
  },

  deletePlace: (id) => {
    const updated = get().places.filter((p) => p.id !== id);
    saveToStorage(updated);
    set({ places: updated });
  },
}));
