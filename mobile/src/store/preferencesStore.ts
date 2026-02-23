import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@findmystar/preferences';

export type ThemePref = 'dark' | 'light' | 'system';

interface PreferencesState {
  theme: ThemePref;
  notificationsEnabled: boolean;
  minAltitudeDefault: number;
  loaded: boolean;

  setTheme: (theme: ThemePref) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setMinAltitudeDefault: (altitude: number) => void;
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

  loadPreferences: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          theme: data.theme ?? 'dark',
          notificationsEnabled: data.notificationsEnabled ?? true,
          minAltitudeDefault: data.minAltitudeDefault ?? 10,
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
