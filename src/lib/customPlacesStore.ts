'use client';

import { create } from 'zustand';
import { CustomPlace } from './customPlaces';
import { useAuthStore } from './authStore';

function getUserEmail(): string {
  return useAuthStore.getState().user?.email || '';
}

interface CustomPlacesStore {
  places: CustomPlace[];
  loadPlaces: () => void;
  addPlace: (place: CustomPlace) => void;
  removePlace: (id: string) => void;
}

export const useCustomPlacesStore = create<CustomPlacesStore>((set, get) => ({
  places: [],

  loadPlaces: () => {
    const email = getUserEmail();
    fetch('/api/places', {
      headers: { 'x-user-email': email },
    })
      .then((res) => res.json())
      .then((data: CustomPlace[]) => {
        if (Array.isArray(data)) {
          set({ places: data });
        }
      })
      .catch(() => { /* keep empty */ });
  },

  addPlace: (place) => {
    const email = getUserEmail();
    // Optimistic update
    const updated = [...get().places, place];
    set({ places: updated });

    fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-email': email },
      body: JSON.stringify(place),
    }).catch(() => { /* ignore */ });
  },

  removePlace: (id) => {
    const updated = get().places.filter((p) => p.id !== id);
    set({ places: updated });

    fetch(`/api/places/${id}`, { method: 'DELETE' })
      .catch(() => { /* ignore */ });
  },
}));
