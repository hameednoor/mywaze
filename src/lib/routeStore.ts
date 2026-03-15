'use client';

import { create } from 'zustand';
import { RouteData } from './routing';

interface Destination {
  lat: number;
  lng: number;
}

interface RouteStore {
  route: RouteData | undefined;
  routeRadarIds: string[];
  destinations: Destination[];
  setRoute: (route: RouteData | undefined) => void;
  setRouteRadarIds: (ids: string[]) => void;
  setDestinations: (dests: Destination[]) => void;
  clearRoute: () => void;
}

export const useRouteStore = create<RouteStore>((set) => ({
  route: undefined,
  routeRadarIds: [],
  destinations: [],
  setRoute: (route) => set({ route }),
  setRouteRadarIds: (routeRadarIds) => set({ routeRadarIds }),
  setDestinations: (destinations) => set({ destinations }),
  clearRoute: () => set({ route: undefined, routeRadarIds: [], destinations: [] }),
}));
