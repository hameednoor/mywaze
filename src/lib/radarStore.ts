'use client';

import { create } from 'zustand';
import { Radar } from './types';
import initialRadars from '@/data/radars.json';

interface RadarStore {
  radars: Radar[];
  loadRadars: () => void;
  addRadar: (radar: Radar) => void;
  updateRadar: (radar: Radar) => void;
  deleteRadar: (id: string) => void;
}

const STORAGE_KEY = 'mywaze_radars';
const VERSION_KEY = 'mywaze_radars_version';
const CURRENT_VERSION = '6'; // Bump this to force reload from JSON

function loadFromStorage(): Radar[] {
  if (typeof window === 'undefined') return initialRadars as Radar[];
  try {
    const version = localStorage.getItem(VERSION_KEY);
    if (version === CURRENT_VERSION) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } else {
      // Clear old data and use fresh JSON
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }
  } catch { /* ignore */ }
  return initialRadars as Radar[];
}

function saveToStorage(radars: Radar[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(radars));
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
}

export const useRadarStore = create<RadarStore>((set, get) => ({
  radars: initialRadars as Radar[],

  loadRadars: () => {
    set({ radars: loadFromStorage() });
  },

  addRadar: (radar) => {
    const updated = [...get().radars, radar];
    saveToStorage(updated);
    set({ radars: updated });
  },

  updateRadar: (radar) => {
    const updated = get().radars.map((r) => (r.id === radar.id ? radar : r));
    saveToStorage(updated);
    set({ radars: updated });
  },

  deleteRadar: (id) => {
    const updated = get().radars.filter((r) => r.id !== id);
    saveToStorage(updated);
    set({ radars: updated });
  },
}));
