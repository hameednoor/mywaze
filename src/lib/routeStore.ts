'use client';

import { create } from 'zustand';
import { RouteData } from './routing';

const STORAGE_KEY = 'mywaze_active_route';

interface Destination {
  lat: number;
  lng: number;
}

interface RouteState {
  route: RouteData | undefined;
  routeRadarIds: string[];
  destinations: Destination[];
  showAllRadars: boolean;
}

interface RouteStore extends RouteState {
  setRoute: (route: RouteData | undefined) => void;
  setRouteRadarIds: (ids: string[]) => void;
  setDestinations: (dests: Destination[]) => void;
  toggleShowAllRadars: () => void;
  clearRoute: () => void;
  loadFromStorage: () => void;
}

function saveToStorage(state: RouteState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      route: state.route,
      routeRadarIds: state.routeRadarIds,
      destinations: state.destinations,
      showAllRadars: state.showAllRadars,
    }));
  } catch { /* ignore */ }
}

function readFromStorage(): Partial<RouteState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export const useRouteStore = create<RouteStore>((set, get) => ({
  route: undefined,
  routeRadarIds: [],
  destinations: [],
  showAllRadars: false,

  loadFromStorage: () => {
    const saved = readFromStorage();
    if (saved) {
      set({
        route: saved.route,
        routeRadarIds: saved.routeRadarIds || [],
        destinations: saved.destinations || [],
        showAllRadars: saved.showAllRadars || false,
      });
    }
  },

  setRoute: (route) => {
    set({ route });
    saveToStorage({ ...get(), route });
  },
  setRouteRadarIds: (routeRadarIds) => {
    set({ routeRadarIds });
    saveToStorage({ ...get(), routeRadarIds });
  },
  setDestinations: (destinations) => {
    set({ destinations });
    saveToStorage({ ...get(), destinations });
  },
  toggleShowAllRadars: () => {
    const next = !get().showAllRadars;
    set({ showAllRadars: next });
    saveToStorage({ ...get(), showAllRadars: next });
  },
  clearRoute: () => {
    set({ route: undefined, routeRadarIds: [], destinations: [], showAllRadars: false });
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  },
}));
