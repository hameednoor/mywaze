'use client';

import { create } from 'zustand';

export interface Settings {
  alertDistance: number;      // meters, 200-2000, default 500
  soundEnabled: boolean;      // beep sounds
  voiceEnabled: boolean;      // voice alerts
  volume: number;             // 0-100
  keepScreenAwake: boolean;   // Wake Lock API
  speedUnit: 'kmh';          // km/h only for now
  darkMode: boolean;          // manual dark mode
  autoDarkMode: boolean;      // auto switch 6pm-6am
}

interface SettingsStore extends Settings {
  setAlertDistance: (v: number) => void;
  setSoundEnabled: (v: boolean) => void;
  setVoiceEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setKeepScreenAwake: (v: boolean) => void;
  setSpeedUnit: (v: 'kmh') => void;
  setDarkMode: (v: boolean) => void;
  setAutoDarkMode: (v: boolean) => void;
  isDark: () => boolean;
  loadSettings: () => void;
}

const STORAGE_KEY = 'mywaze_settings';

const defaults: Settings = {
  alertDistance: 500,
  soundEnabled: true,
  voiceEnabled: true,
  volume: 80,
  keepScreenAwake: true,
  speedUnit: 'kmh',
  darkMode: false,
  autoDarkMode: false,
};

function loadFromStorage(): Settings {
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return defaults;
}

function saveToStorage(settings: Settings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...defaults,

  loadSettings: () => {
    const loaded = loadFromStorage();
    set(loaded);
  },

  setAlertDistance: (v) => {
    set({ alertDistance: v });
    saveToStorage({ ...get(), alertDistance: v } as Settings);
  },
  setSoundEnabled: (v) => {
    set({ soundEnabled: v });
    saveToStorage({ ...get(), soundEnabled: v } as Settings);
  },
  setVoiceEnabled: (v) => {
    set({ voiceEnabled: v });
    saveToStorage({ ...get(), voiceEnabled: v } as Settings);
  },
  setVolume: (v) => {
    set({ volume: v });
    saveToStorage({ ...get(), volume: v } as Settings);
  },
  setKeepScreenAwake: (v) => {
    set({ keepScreenAwake: v });
    saveToStorage({ ...get(), keepScreenAwake: v } as Settings);
  },
  setSpeedUnit: (v) => {
    set({ speedUnit: v });
    saveToStorage({ ...get(), speedUnit: v } as Settings);
  },
  setDarkMode: (v) => {
    set({ darkMode: v });
    saveToStorage({ ...get(), darkMode: v } as Settings);
  },
  setAutoDarkMode: (v) => {
    set({ autoDarkMode: v });
    saveToStorage({ ...get(), autoDarkMode: v } as Settings);
  },

  isDark: () => {
    const state = get();
    if (state.autoDarkMode) return isNightTime();
    return state.darkMode;
  },
}));
