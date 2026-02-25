import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@findmystar/preferences';

export type ThemePref = 'dark' | 'light' | 'system';

interface PreferencesState {
  theme: ThemePref;
  notificationsEnabled: boolean;
  minAltitudeDefault: number;
  cameraFovDeg: number; // Horizontal field of view in degrees
  loaded: boolean;

  setTheme: (theme: ThemePref) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setMinAltitudeDefault: (altitude: number) => void;
  setCameraFovDeg: (fov: number) => void;
  loadPreferences: () => Promise<void>;
}

async function persist(partial: Record<string, unknown>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const current = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
  } catch {
    // Storage failure is non-critical
  }
}

export const usePreferencesStore = create<PreferencesState>(set => ({
  theme: 'dark',
  notificationsEnabled: true,
  minAltitudeDefault: 10,
  cameraFovDeg: 60, // Default ~60° horizontal FOV (typical smartphone rear camera)
  loaded: false,

  setTheme: theme => {
    set({ theme });
    persist({ theme });
  },

  setNotificationsEnabled: enabled => {
    set({ notificationsEnabled: enabled });
    persist({ notificationsEnabled: enabled });
  },

  setMinAltitudeDefault: altitude => {
    set({ minAltitudeDefault: altitude });
    persist({ minAltitudeDefault: altitude });
  },

  setCameraFovDeg: fov => {
    const clamped = Math.max(30, Math.min(120, fov));
    set({ cameraFovDeg: clamped });
    persist({ cameraFovDeg: clamped });
  },

  loadPreferences: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          theme: data.theme ?? 'dark',
          notificationsEnabled: data.notificationsEnabled ?? true,
          minAltitudeDefault: data.minAltitudeDefault ?? 10,
          cameraFovDeg: data.cameraFovDeg ?? 60,
          loaded: true,
        });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },
}));
