'use client';

import { create } from 'zustand';
import { RouteData } from './routing';

const STORAGE_KEY = 'mywaze_active_route';

// 'all' = show all radars, 'route' = route radars only, 'none' = hide all
export type RadarVisibility = 'all' | 'route' | 'none';

interface Destination {
  lat: number;
  lng: number;
}

interface RouteState {
  route: RouteData | undefined;
  routeRadarIds: string[];
  destinations: Destination[];
  radarVisibility: RadarVisibility;
}

interface RouteStore extends RouteState {
  setRoute: (route: RouteData | undefined) => void;
  setRouteRadarIds: (ids: string[]) => void;
  setDestinations: (dests: Destination[]) => void;
  setRadarVisibility: (v: RadarVisibility) => void;
  cycleRadarVisibility: () => void;
  clearRoute: () => void;
  loadFromStorage: () => void;
}

function saveToStorage(state: RouteState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      route: state.route,
      routeRadarIds: state.routeRadarIds,
      destinations: state.destinations,
      radarVisibility: state.radarVisibility,
    }));
  } catch { /* ignore */ }
}

function readFromStorage(): Partial<RouteState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// Load initial state from sessionStorage immediately
const saved = readFromStorage();
const initialState: RouteState = {
  route: saved?.route ?? undefined,
  routeRadarIds: saved?.routeRadarIds ?? [],
  destinations: saved?.destinations ?? [],
  radarVisibility: saved?.radarVisibility ?? (saved?.route ? 'route' : 'all'),
};

export const useRouteStore = create<RouteStore>((set, get) => ({
  ...initialState,

  // Keep for backwards compat but no longer needed on mount
  loadFromStorage: () => {
    const s = readFromStorage();
    if (s) {
      set({
        route: s.route,
        routeRadarIds: s.routeRadarIds || [],
        destinations: s.destinations || [],
        radarVisibility: s.radarVisibility || (s.route ? 'route' : 'all'),
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
  setRadarVisibility: (radarVisibility: RadarVisibility) => {
    set({ radarVisibility });
    saveToStorage({ ...get(), radarVisibility });
  },
  cycleRadarVisibility: () => {
    const hasRoute = !!get().route && get().routeRadarIds.length > 0;
    const current = get().radarVisibility;
    let next: RadarVisibility;
    if (current === 'all') {
      next = hasRoute ? 'route' : 'none';
    } else if (current === 'route') {
      next = 'none';
    } else {
      next = 'all';
    }
    set({ radarVisibility: next });
    saveToStorage({ ...get(), radarVisibility: next });
  },
  clearRoute: () => {
    set({ route: undefined, routeRadarIds: [], destinations: [], radarVisibility: 'all' });
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  },
}));
