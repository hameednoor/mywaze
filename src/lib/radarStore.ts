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

const CACHE_KEY = 'mywaze_radars_cache';
const CACHE_TS_KEY = 'mywaze_radars_cache_ts';
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

function getCachedRadars(): Radar[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (ts && Date.now() - parseInt(ts) < CACHE_MAX_AGE) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    }
  } catch { /* ignore */ }
  return null;
}

function setCachedRadars(radars: Radar[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(radars));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

export const useRadarStore = create<RadarStore>((set, get) => ({
  radars: initialRadars as Radar[],

  loadRadars: () => {
    // Show cached data immediately
    const cached = getCachedRadars();
    if (cached) set({ radars: cached });

    // Then fetch fresh from API
    fetch('/api/radars')
      .then((res) => res.json())
      .then((data: Radar[]) => {
        if (Array.isArray(data) && data.length > 0) {
          set({ radars: data });
          setCachedRadars(data);
        }
      })
      .catch(() => {
        // API failed — keep cached or fallback to JSON
        if (!cached) set({ radars: initialRadars as Radar[] });
      });
  },

  addRadar: (radar) => {
    // Optimistic update
    const updated = [...get().radars, radar];
    set({ radars: updated });
    setCachedRadars(updated);

    fetch('/api/radars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(radar),
    }).catch(() => { /* revert on error if needed */ });
  },

  updateRadar: (radar) => {
    const updated = get().radars.map((r) => (r.id === radar.id ? radar : r));
    set({ radars: updated });
    setCachedRadars(updated);

    fetch(`/api/radars/${radar.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(radar),
    }).catch(() => { /* ignore */ });
  },

  deleteRadar: (id) => {
    const updated = get().radars.filter((r) => r.id !== id);
    set({ radars: updated });
    setCachedRadars(updated);

    fetch(`/api/radars/${id}`, { method: 'DELETE' })
      .catch(() => { /* ignore */ });
  },
}));
